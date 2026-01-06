-- =============================================================================
-- SPORT ZEN - PostgreSQL Extensions Initialization
-- Run this when creating a fresh database
-- =============================================================================

-- Enable PostGIS for geographic queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable btree_gist for exclusion constraints with multiple column types
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Enable uuid-ossp for UUID generation (optional, Prisma uses cuid by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for fuzzy text search (optional, for search functionality)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
