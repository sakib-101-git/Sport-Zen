import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import { Prisma } from '@prisma/client';

export interface NearbyFacilityResult {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  area: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  avgRating: number | null;
  reviewCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  primaryPhotoUrl: string | null;
  sportTypes: string[];
  isAvailableNow: boolean;
}

export interface NearbySearchParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  sportTypeId?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  availableNow?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class NearbyFacilitiesQuery {
  private readonly logger = new Logger(NearbyFacilitiesQuery.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search for nearby facilities using PostGIS
   * Enforces visibility rules: approved + subscription active
   */
  async execute(params: NearbySearchParams): Promise<{
    facilities: NearbyFacilityResult[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      latitude,
      longitude,
      radiusKm = 10,
      sportTypeId,
      minPrice,
      maxPrice,
      minRating,
      availableNow,
      page = 1,
      limit = 20,
    } = params;

    const radiusMeters = radiusKm * 1000;
    const offset = (page - 1) * limit;

    // Build the base query using PostGIS
    const facilitiesQuery = Prisma.sql`
      WITH nearby AS (
        SELECT
          f.id,
          f.name,
          f.slug,
          f.address,
          f.city,
          f.area,
          f.latitude,
          f.longitude,
          f.avg_rating,
          f.review_count,
          f.owner_id,
          ST_Distance(
            f.location,
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
          ) as distance_meters
        FROM facilities f
        WHERE f.deleted_at IS NULL
          AND f.is_approved = true
          AND ST_DWithin(
            f.location,
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
            ${radiusMeters}
          )
      ),
      with_subscription AS (
        SELECT
          n.*,
          CASE
            WHEN os.status IN ('TRIAL', 'ACTIVE') THEN true
            ELSE false
          END as is_bookable
        FROM nearby n
        LEFT JOIN owner_subscriptions os ON os.owner_id = n.owner_id
      ),
      with_pricing AS (
        SELECT
          ws.*,
          (
            SELECT MIN((value::text)::int)
            FROM play_areas pa
            JOIN sport_profiles sp ON sp.play_area_id = pa.id
            CROSS JOIN LATERAL jsonb_each(sp.duration_prices) AS prices(key, value)
            WHERE pa.facility_id = ws.id
              AND pa.deleted_at IS NULL
              AND sp.is_active = true
          ) as min_price,
          (
            SELECT MAX((value::text)::int)
            FROM play_areas pa
            JOIN sport_profiles sp ON sp.play_area_id = pa.id
            CROSS JOIN LATERAL jsonb_each(
              COALESCE(sp.peak_duration_prices, sp.duration_prices)
            ) AS prices(key, value)
            WHERE pa.facility_id = ws.id
              AND pa.deleted_at IS NULL
              AND sp.is_active = true
          ) as max_price
        FROM with_subscription ws
        WHERE ws.is_bookable = true
      ),
      with_sports AS (
        SELECT
          wp.*,
          ARRAY(
            SELECT DISTINCT st.name
            FROM play_areas pa
            JOIN sport_profiles sp ON sp.play_area_id = pa.id
            JOIN sport_types st ON st.id = sp.sport_type_id
            WHERE pa.facility_id = wp.id
              AND pa.deleted_at IS NULL
              AND sp.is_active = true
          ) as sport_types,
          (
            SELECT fp.url
            FROM facility_photos fp
            WHERE fp.facility_id = wp.id
              AND fp.is_primary = true
            LIMIT 1
          ) as primary_photo_url
        FROM with_pricing wp
      )
      SELECT * FROM with_sports ws
      WHERE 1=1
        ${minPrice ? Prisma.sql`AND ws.min_price >= ${minPrice}` : Prisma.empty}
        ${maxPrice ? Prisma.sql`AND ws.max_price <= ${maxPrice}` : Prisma.empty}
        ${minRating ? Prisma.sql`AND ws.avg_rating >= ${minRating}` : Prisma.empty}
      ORDER BY ws.distance_meters
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Count query
    const countQuery = Prisma.sql`
      SELECT COUNT(*) as total
      FROM facilities f
      JOIN owner_subscriptions os ON os.owner_id = f.owner_id
      WHERE f.deleted_at IS NULL
        AND f.is_approved = true
        AND os.status IN ('TRIAL', 'ACTIVE')
        AND ST_DWithin(
          f.location,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          ${radiusMeters}
        )
    `;

    const [facilitiesRaw, countResult] = await Promise.all([
      this.prisma.$queryRaw<any[]>(facilitiesQuery),
      this.prisma.$queryRaw<[{ total: bigint }]>(countQuery),
    ]);

    // Filter by sport type if specified
    let facilities = facilitiesRaw;
    if (sportTypeId) {
      const sportType = await this.prisma.sportType.findUnique({
        where: { id: sportTypeId },
        select: { name: true },
      });
      if (sportType) {
        facilities = facilities.filter((f) =>
          f.sport_types.includes(sportType.name),
        );
      }
    }

    // Check availability if needed
    if (availableNow) {
      const facilityIds = facilities.map((f) => f.id);
      const availabilityMap = await this.checkBulkAvailability(facilityIds);
      facilities = facilities.filter((f) => availabilityMap.get(f.id) === true);
    }

    // Map to result type
    const results: NearbyFacilityResult[] = facilities.map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      address: f.address,
      city: f.city,
      area: f.area,
      latitude: f.latitude,
      longitude: f.longitude,
      distanceMeters: Math.round(f.distance_meters),
      avgRating: f.avg_rating,
      reviewCount: f.review_count,
      minPrice: f.min_price,
      maxPrice: f.max_price,
      primaryPhotoUrl: f.primary_photo_url,
      sportTypes: f.sport_types || [],
      isAvailableNow: true, // Would be updated by availability check
    }));

    return {
      facilities: results,
      total: Number(countResult[0]?.total ?? 0),
      page,
      limit,
    };
  }

  /**
   * Check availability for multiple facilities at once
   */
  private async checkBulkAvailability(
    facilityIds: string[],
  ): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();

    // For MVP, we do a simple check per facility
    // In production, this could be optimized with a single query
    for (const facilityId of facilityIds) {
      const hasAvailable = await this.checkFacilityAvailabilityNow(facilityId);
      result.set(facilityId, hasAvailable);
    }

    return result;
  }

  /**
   * Check if facility has available slots in next 4 hours
   */
  private async checkFacilityAvailabilityNow(facilityId: string): Promise<boolean> {
    const now = new Date();
    const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    // Get play areas and check for any available slot
    const playAreas = await this.prisma.playArea.findMany({
      where: {
        facilityId,
        deletedAt: null,
        isActive: true,
      },
      include: {
        sportProfiles: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    for (const playArea of playAreas) {
      if (playArea.sportProfiles.length === 0) continue;

      const sportProfile = playArea.sportProfiles[0];
      const minDuration = Math.min(...sportProfile.allowedDurations);
      const requiredMinutes = minDuration + sportProfile.bufferMinutes;

      // Check if there's a gap large enough
      const hasGap = await this.hasAvailableGap(
        playArea.conflictGroupId,
        now,
        fourHoursLater,
        requiredMinutes,
        sportProfile.minLeadTimeMinutes,
      );

      if (hasGap) return true;
    }

    return false;
  }

  /**
   * Check if there's an available gap in the schedule
   */
  private async hasAvailableGap(
    conflictGroupId: string,
    windowStart: Date,
    windowEnd: Date,
    requiredMinutes: number,
    leadTimeMinutes: number,
  ): Promise<boolean> {
    const minStartTime = new Date(Date.now() + leadTimeMinutes * 60 * 1000);

    const occupiedRanges = await this.prisma.$queryRaw<
      Array<{ start_at: Date; blocked_end_at: Date }>
    >`
      SELECT start_at, blocked_end_at
      FROM bookings
      WHERE conflict_group_id = ${conflictGroupId}::uuid
        AND deleted_at IS NULL
        AND status IN ('HOLD', 'CONFIRMED')
        AND blocked_end_at > ${windowStart}
        AND start_at < ${windowEnd}
      UNION ALL
      SELECT start_at, end_at as blocked_end_at
      FROM booking_blocks
      WHERE conflict_group_id = ${conflictGroupId}::uuid
        AND deleted_at IS NULL
        AND end_at > ${windowStart}
        AND start_at < ${windowEnd}
      ORDER BY start_at
    `;

    let searchStart = windowStart > minStartTime ? windowStart : minStartTime;

    for (const range of occupiedRanges) {
      if (searchStart < range.start_at) {
        const gapMinutes =
          (range.start_at.getTime() - searchStart.getTime()) / 60000;
        if (gapMinutes >= requiredMinutes) {
          return true;
        }
      }
      if (range.blocked_end_at > searchStart) {
        searchStart = range.blocked_end_at;
      }
    }

    // Check remaining time
    if (searchStart < windowEnd) {
      const remainingMinutes =
        (windowEnd.getTime() - searchStart.getTime()) / 60000;
      if (remainingMinutes >= requiredMinutes) {
        return true;
      }
    }

    return false;
  }
}
