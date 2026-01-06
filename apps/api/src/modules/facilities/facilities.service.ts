import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { Prisma } from '@prisma/client';

export interface NearbySearchParams {
  lat: number;
  lng: number;
  radiusKm?: number;
  sportType?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  availableNow?: boolean;
  page?: number;
  limit?: number;
}

export interface FacilityListItem {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  primaryPhoto: string | null;
  averageRating: number;
  reviewCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  sports: string[];
  isAvailableNow: boolean;
}

@Injectable()
export class FacilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  /**
   * Search for nearby facilities with visibility enforcement
   * Only returns facilities where:
   * - is_approved = true
   * - OwnerSubscription.status IN ('TRIAL', 'ACTIVE')
   */
  async searchNearby(params: NearbySearchParams): Promise<{
    facilities: FacilityListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      lat,
      lng,
      radiusKm = 10,
      sportType,
      minPrice,
      maxPrice,
      minRating,
      availableNow,
      page = 1,
      limit = 20,
    } = params;

    const radiusMeters = radiusKm * 1000;
    const offset = (page - 1) * limit;

    // Build the query with visibility enforcement
    const facilities = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        address: string;
        latitude: number;
        longitude: number;
        distance_meters: number;
        primary_photo: string | null;
        average_rating: number;
        review_count: number;
        min_price: number | null;
        max_price: number | null;
        sports: string[];
      }>
    >`
      WITH bookable_facilities AS (
        SELECT f.id
        FROM facilities f
        INNER JOIN owner_subscriptions os ON os.owner_id = f.owner_id
        WHERE f.is_approved = true
          AND f.deleted_at IS NULL
          AND os.status IN ('TRIAL', 'ACTIVE')
          AND ST_DWithin(
            f.location::geography,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            ${radiusMeters}
          )
      ),
      facility_sports AS (
        SELECT
          pa.facility_id,
          array_agg(DISTINCT st.name) as sports,
          MIN((sp.duration_prices->>'60')::numeric) as min_price,
          MAX((sp.duration_prices->>'60')::numeric) as max_price
        FROM play_areas pa
        INNER JOIN sport_profiles sp ON sp.play_area_id = pa.id AND sp.is_active = true
        INNER JOIN sport_types st ON st.id = sp.sport_type_id
        WHERE pa.deleted_at IS NULL AND pa.is_active = true
        ${sportType ? Prisma.sql`AND st.slug = ${sportType}` : Prisma.empty}
        GROUP BY pa.facility_id
      ),
      facility_ratings AS (
        SELECT
          b.play_area_id,
          pa.facility_id,
          AVG(r.rating) as avg_rating,
          COUNT(r.id) as review_count
        FROM reviews r
        INNER JOIN bookings b ON b.id = r.booking_id
        INNER JOIN play_areas pa ON pa.id = b.play_area_id
        WHERE r.deleted_at IS NULL AND r.is_hidden = false
        GROUP BY b.play_area_id, pa.facility_id
      )
      SELECT
        f.id,
        f.name,
        f.address,
        ST_Y(f.location::geometry) as latitude,
        ST_X(f.location::geometry) as longitude,
        ST_Distance(
          f.location::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) as distance_meters,
        fp.url as primary_photo,
        COALESCE(fr.avg_rating, 0) as average_rating,
        COALESCE(fr.review_count, 0)::int as review_count,
        fs.min_price,
        fs.max_price,
        COALESCE(fs.sports, ARRAY[]::text[]) as sports
      FROM facilities f
      INNER JOIN bookable_facilities bf ON bf.id = f.id
      LEFT JOIN facility_sports fs ON fs.facility_id = f.id
      LEFT JOIN facility_ratings fr ON fr.facility_id = f.id
      LEFT JOIN facility_photos fp ON fp.facility_id = f.id AND fp.is_primary = true
      WHERE 1=1
        ${minPrice ? Prisma.sql`AND fs.min_price >= ${minPrice}` : Prisma.empty}
        ${maxPrice ? Prisma.sql`AND fs.max_price <= ${maxPrice}` : Prisma.empty}
        ${minRating ? Prisma.sql`AND COALESCE(fr.avg_rating, 0) >= ${minRating}` : Prisma.empty}
      ORDER BY distance_meters ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Get total count
    const countResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count
      FROM facilities f
      INNER JOIN owner_subscriptions os ON os.owner_id = f.owner_id
      WHERE f.is_approved = true
        AND f.deleted_at IS NULL
        AND os.status IN ('TRIAL', 'ACTIVE')
        AND ST_DWithin(
          f.location::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusMeters}
        )
    `;

    // Check availability if needed
    let facilityItems: FacilityListItem[] = facilities.map((f) => ({
      id: f.id,
      name: f.name,
      address: f.address,
      latitude: f.latitude,
      longitude: f.longitude,
      distanceKm: Math.round((f.distance_meters / 1000) * 100) / 100,
      primaryPhoto: f.primary_photo,
      averageRating: Math.round(f.average_rating * 10) / 10,
      reviewCount: f.review_count,
      minPrice: f.min_price,
      maxPrice: f.max_price,
      sports: f.sports,
      isAvailableNow: false, // Will be computed if requested
    }));

    // Filter by available now if requested
    if (availableNow) {
      const availabilityChecks = await Promise.all(
        facilityItems.map(async (f) => ({
          id: f.id,
          isAvailable: await this.availabilityService.hasAvailableSlotsNow(f.id),
        })),
      );

      facilityItems = facilityItems
        .map((f) => ({
          ...f,
          isAvailableNow: availabilityChecks.find((a) => a.id === f.id)?.isAvailable ?? false,
        }))
        .filter((f) => f.isAvailableNow);
    }

    return {
      facilities: facilityItems,
      total: Number(countResult[0].count),
      page,
      limit,
    };
  }

  /**
   * Get facility details with visibility enforcement
   */
  async getFacilityById(facilityId: string): Promise<any> {
    // First check if facility is bookable (visibility enforcement)
    const isBookable = await this.isFacilityBookable(facilityId);

    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId, deletedAt: null },
      include: {
        photos: { orderBy: { sortOrder: 'asc' } },
        amenities: { include: { amenity: true } },
        playAreas: {
          where: { deletedAt: null, isActive: true },
          include: {
            sportProfiles: {
              where: { isActive: true },
              include: {
                sportType: true,
                peakRules: { where: { isActive: true } },
              },
            },
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!facility) {
      throw new NotFoundException('Facility not found');
    }

    // Calculate rating
    const ratingResult = await this.prisma.$queryRaw<
      [{ avg_rating: number; review_count: bigint }]
    >`
      SELECT
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(r.id)::bigint as review_count
      FROM reviews r
      INNER JOIN bookings b ON b.id = r.booking_id
      INNER JOIN play_areas pa ON pa.id = b.play_area_id
      WHERE pa.facility_id = ${facilityId}
        AND r.deleted_at IS NULL
        AND r.is_hidden = false
    `;

    return {
      ...facility,
      averageRating: Math.round(ratingResult[0].avg_rating * 10) / 10,
      reviewCount: Number(ratingResult[0].review_count),
      isBookable,
    };
  }

  /**
   * Get facility play areas with sport profiles
   */
  async getFacilityPlayAreas(facilityId: string): Promise<any[]> {
    const playAreas = await this.prisma.playArea.findMany({
      where: {
        facilityId,
        deletedAt: null,
        isActive: true,
      },
      include: {
        sportProfiles: {
          where: { isActive: true },
          include: {
            sportType: true,
            peakRules: { where: { isActive: true } },
          },
        },
      },
    });

    return playAreas;
  }

  /**
   * Get facility reviews with pagination
   */
  async getFacilityReviews(
    facilityId: string,
    page = 1,
    limit = 10,
  ): Promise<{
    reviews: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const where = {
      booking: {
        playArea: { facilityId },
      },
      deletedAt: null,
      isHidden: false,
    };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          booking: {
            select: {
              playerName: true,
              startAt: true,
              sportProfile: {
                include: { sportType: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return { reviews, total, page, limit };
  }

  /**
   * Check if a facility is bookable (visibility enforcement)
   */
  async isFacilityBookable(facilityId: string): Promise<boolean> {
    const result = await this.prisma.$queryRaw<[{ is_bookable: boolean }]>`
      SELECT EXISTS (
        SELECT 1
        FROM facilities f
        INNER JOIN owner_subscriptions os ON os.owner_id = f.owner_id
        WHERE f.id = ${facilityId}::uuid
          AND f.is_approved = true
          AND f.deleted_at IS NULL
          AND os.status IN ('TRIAL', 'ACTIVE')
      ) as is_bookable
    `;

    return result[0]?.is_bookable ?? false;
  }

  /**
   * Get all sport types
   */
  async getSportTypes(): Promise<any[]> {
    return this.prisma.sportType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
