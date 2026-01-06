-- =============================================================================
-- SPORT ZEN - Critical Raw SQL Migrations
-- These must be run AFTER Prisma migrations
-- =============================================================================

-- =============================================================================
-- 1. ADD GEOGRAPHY COLUMN TO FACILITIES (PostGIS)
-- =============================================================================

-- Add the PostGIS geography column for spatial queries
ALTER TABLE facilities
ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

-- Create function to auto-update location from lat/lng
CREATE OR REPLACE FUNCTION update_facility_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update location
DROP TRIGGER IF EXISTS trigger_update_facility_location ON facilities;
CREATE TRIGGER trigger_update_facility_location
    BEFORE INSERT OR UPDATE OF latitude, longitude ON facilities
    FOR EACH ROW
    EXECUTE FUNCTION update_facility_location();

-- Update existing rows
UPDATE facilities
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE location IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create spatial index for nearby queries
CREATE INDEX IF NOT EXISTS idx_facilities_location
ON facilities USING GIST (location);

-- =============================================================================
-- 2. ADD TIME_RANGE COLUMN TO BOOKINGS
-- =============================================================================

-- Add the tstzrange column for exclusion constraint
-- Uses blocked_end_at (end_at + buffer) to enforce buffer time at DB level
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS time_range tstzrange;

-- Create function to auto-compute time_range from start_at and blocked_end_at
CREATE OR REPLACE FUNCTION update_booking_time_range()
RETURNS TRIGGER AS $$
BEGIN
    -- time_range uses blocked_end_at (which includes buffer) for proper overlap detection
    NEW.time_range := tstzrange(NEW.start_at, NEW.blocked_end_at, '[)');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-compute time_range
DROP TRIGGER IF EXISTS trigger_update_booking_time_range ON bookings;
CREATE TRIGGER trigger_update_booking_time_range
    BEFORE INSERT OR UPDATE OF start_at, blocked_end_at ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_time_range();

-- Update existing rows
UPDATE bookings
SET time_range = tstzrange(start_at, blocked_end_at, '[)')
WHERE time_range IS NULL AND start_at IS NOT NULL AND blocked_end_at IS NOT NULL;

-- =============================================================================
-- 3. BOOKING EXCLUSION CONSTRAINT (CRITICAL - PREVENTS DOUBLE BOOKING)
-- =============================================================================

-- Drop if exists (for re-running migrations)
ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS booking_no_overlap;

-- Create the exclusion constraint
-- This prevents any two bookings with overlapping time_range
-- for the same conflict_group_id when both are in HOLD or CONFIRMED status
-- and neither is soft-deleted
ALTER TABLE bookings
ADD CONSTRAINT booking_no_overlap
EXCLUDE USING gist (
    conflict_group_id WITH =,
    time_range WITH &&
)
WHERE (
    deleted_at IS NULL
    AND status IN ('HOLD', 'CONFIRMED')
);

-- Create supporting index for the constraint
CREATE INDEX IF NOT EXISTS idx_bookings_conflict_overlap
ON bookings USING GIST (conflict_group_id, time_range)
WHERE deleted_at IS NULL AND status IN ('HOLD', 'CONFIRMED');

-- =============================================================================
-- 4. BOOKING BLOCKS TIME_RANGE COLUMN
-- =============================================================================

-- Add time_range column to booking_blocks for efficient overlap queries
ALTER TABLE booking_blocks
ADD COLUMN IF NOT EXISTS time_range tstzrange;

-- Create function to auto-compute time_range
CREATE OR REPLACE FUNCTION update_booking_block_time_range()
RETURNS TRIGGER AS $$
BEGIN
    NEW.time_range := tstzrange(NEW.start_at, NEW.end_at, '[)');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_booking_block_time_range ON booking_blocks;
CREATE TRIGGER trigger_update_booking_block_time_range
    BEFORE INSERT OR UPDATE OF start_at, end_at ON booking_blocks
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_block_time_range();

-- Update existing rows
UPDATE booking_blocks
SET time_range = tstzrange(start_at, end_at, '[)')
WHERE time_range IS NULL;

-- Create index for block overlap queries
CREATE INDEX IF NOT EXISTS idx_booking_blocks_time_range
ON booking_blocks USING GIST (conflict_group_id, time_range)
WHERE deleted_at IS NULL;

-- =============================================================================
-- 5. ADDITIONAL INDEXES FOR PERFORMANCE
-- =============================================================================

-- Index for finding facilities by approval status and subscription
CREATE INDEX IF NOT EXISTS idx_facilities_bookable
ON facilities (is_approved, deleted_at)
WHERE is_approved = true AND deleted_at IS NULL;

-- Index for finding active bookings by status
CREATE INDEX IF NOT EXISTS idx_bookings_active_status
ON bookings (status, start_at)
WHERE deleted_at IS NULL AND status IN ('HOLD', 'CONFIRMED');

-- Index for hold expiry job
CREATE INDEX IF NOT EXISTS idx_bookings_hold_expiry
ON bookings (hold_expires_at)
WHERE status = 'HOLD' AND deleted_at IS NULL;

-- Index for auto-complete job
CREATE INDEX IF NOT EXISTS idx_bookings_complete
ON bookings (end_at)
WHERE status = 'CONFIRMED' AND deleted_at IS NULL;

-- =============================================================================
-- 6. HELPER FUNCTIONS
-- =============================================================================

-- Function to check if a time range is available for booking
-- Returns TRUE if available, FALSE if conflicting booking/block exists
CREATE OR REPLACE FUNCTION is_time_slot_available(
    p_conflict_group_id UUID,
    p_start_at TIMESTAMPTZ,
    p_blocked_end_at TIMESTAMPTZ,
    p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_time_range tstzrange;
    v_has_conflict BOOLEAN;
BEGIN
    v_time_range := tstzrange(p_start_at, p_blocked_end_at, '[)');

    -- Check for booking conflicts
    SELECT EXISTS (
        SELECT 1 FROM bookings
        WHERE conflict_group_id = p_conflict_group_id
        AND time_range && v_time_range
        AND status IN ('HOLD', 'CONFIRMED')
        AND deleted_at IS NULL
        AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
    ) INTO v_has_conflict;

    IF v_has_conflict THEN
        RETURN FALSE;
    END IF;

    -- Check for booking block conflicts
    SELECT EXISTS (
        SELECT 1 FROM booking_blocks
        WHERE conflict_group_id = p_conflict_group_id
        AND time_range && v_time_range
        AND deleted_at IS NULL
    ) INTO v_has_conflict;

    RETURN NOT v_has_conflict;
END;
$$ LANGUAGE plpgsql;

-- Function to get nearby facilities within radius
-- Returns facilities sorted by distance
CREATE OR REPLACE FUNCTION get_nearby_facilities(
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_radius_meters DOUBLE PRECISION DEFAULT 10000,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    facility_id UUID,
    distance_meters DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.id,
        ST_Distance(
            f.location,
            ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
        ) as dist
    FROM facilities f
    WHERE f.deleted_at IS NULL
    AND f.is_approved = true
    AND ST_DWithin(
        f.location,
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        p_radius_meters
    )
    ORDER BY dist
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. BOOKING NUMBER SEQUENCE
-- =============================================================================

-- Create sequence for booking numbers
CREATE SEQUENCE IF NOT EXISTS booking_number_seq START 1;

-- Function to generate booking number
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TEXT AS $$
DECLARE
    v_date TEXT;
    v_seq TEXT;
BEGIN
    v_date := TO_CHAR(NOW() AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD');
    v_seq := LPAD(NEXTVAL('booking_number_seq')::TEXT, 4, '0');
    -- Reset sequence daily (simplified - in production use a date-based approach)
    IF EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Dhaka') = 0
       AND EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'Asia/Dhaka') < 5 THEN
        ALTER SEQUENCE booking_number_seq RESTART WITH 1;
    END IF;
    RETURN 'SZ-' || v_date || '-' || v_seq;
END;
$$ LANGUAGE plpgsql;
