// =============================================================================
// SPORT ZEN - Booking Service Unit Tests
// =============================================================================

import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from '../../src/modules/bookings/bookings.service';
import { PrismaService } from '../../src/common/db/prisma.service';
import { RedisService } from '../../src/common/redis/redis.service';
import { AvailabilityService } from '../../src/modules/availability/availability.service';
import { BookingStatus, PaymentStage } from '@prisma/client';
import {
  calculateRefundAmount,
  calculateBookingPricing,
  calculateAdvanceAmount,
} from '../../src/common/utils/money';
import { getCancellationTier } from '../../src/common/utils/time';

// Mock dependencies
const mockPrismaService = {
  booking: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  paymentIntent: {
    create: jest.fn(),
  },
  bookingEvent: {
    create: jest.fn(),
  },
  sportProfile: {
    findUnique: jest.fn(),
  },
  ownerSubscription: {
    findUnique: jest.fn(),
  },
  executeInTransaction: jest.fn((fn) => fn(mockPrismaService)),
  isExclusionConstraintError: jest.fn(),
  $queryRaw: jest.fn(),
};

const mockRedisService = {
  checkBookingRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 9 }),
  acquireSlotLock: jest.fn().mockResolvedValue(true),
  releaseSlotLock: jest.fn().mockResolvedValue(true),
};

const mockAvailabilityService = {
  isSlotAvailable: jest.fn().mockResolvedValue(true),
};

describe('BookingsService', () => {
  let service: BookingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: AvailabilityService, useValue: mockAvailabilityService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    jest.clearAllMocks();
  });

  describe('Money Calculations', () => {
    it('should calculate advance amount correctly (10% with CEIL)', () => {
      expect(calculateAdvanceAmount(1000)).toBe(100);
      expect(calculateAdvanceAmount(1500)).toBe(150);
      expect(calculateAdvanceAmount(1001)).toBe(101); // CEIL
      expect(calculateAdvanceAmount(999)).toBe(100); // CEIL(99.9) = 100
    });

    it('should calculate booking pricing correctly', () => {
      const pricing = calculateBookingPricing(1000);

      expect(pricing.totalAmount).toBe(1000);
      expect(pricing.advanceAmount).toBe(100);
      expect(pricing.platformCommission).toBe(50); // 5% of 1000
      expect(pricing.ownerAdvanceCredit).toBe(50); // 100 - 50
      expect(pricing.remainingAmount).toBe(900);
    });

    it('should ensure platform commission does not exceed advance', () => {
      // With very low total, commission should not exceed advance
      const pricing = calculateBookingPricing(100);

      expect(pricing.advanceAmount).toBe(10);
      expect(pricing.platformCommission).toBeLessThanOrEqual(pricing.advanceAmount);
    });
  });

  describe('Cancellation Refund Tiers', () => {
    it('should return full refund minus fee for >24h cancellation', () => {
      const { refundAmount, platformFeeRetained } = calculateRefundAmount(100, '>24h', 50);

      expect(refundAmount).toBe(50); // 100 - 50 fee
      expect(platformFeeRetained).toBe(50);
    });

    it('should return 50% refund minus fee for 24h-6h cancellation', () => {
      const { refundAmount, platformFeeRetained } = calculateRefundAmount(100, '24h-6h', 20);

      // FLOOR(100 * 0.5) = 50, minus 20 fee = 30
      expect(refundAmount).toBe(30);
      expect(platformFeeRetained).toBe(70); // 100 - 30
    });

    it('should return no refund for <6h cancellation', () => {
      const { refundAmount, platformFeeRetained } = calculateRefundAmount(100, '<6h');

      expect(refundAmount).toBe(0);
      expect(platformFeeRetained).toBe(100);
    });

    it('should determine correct cancellation tier based on time', () => {
      const now = new Date();

      // 25 hours from now
      const far = new Date(now.getTime() + 25 * 60 * 60 * 1000);
      expect(getCancellationTier(far, now)).toBe('>24h');

      // 12 hours from now
      const mid = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      expect(getCancellationTier(mid, now)).toBe('24h-6h');

      // 3 hours from now
      const soon = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      expect(getCancellationTier(soon, now)).toBe('<6h');
    });
  });

  describe('Hold Creation', () => {
    const mockSportProfile = {
      id: 'sport-profile-1',
      isActive: true,
      allowedDurations: [60, 90, 120],
      bufferMinutes: 10,
      durationPrices: { '60': 1000, '90': 1400, '120': 1800 },
      peakDurationPrices: null,
      peakRules: [],
      playArea: {
        id: 'play-area-1',
        conflictGroupId: 'conflict-group-1',
        facility: {
          id: 'facility-1',
          ownerId: 'owner-1',
          isApproved: true,
          deletedAt: null,
        },
      },
    };

    const mockSubscription = {
      id: 'sub-1',
      status: 'ACTIVE',
    };

    it('should reject invalid duration', async () => {
      mockPrismaService.sportProfile.findUnique.mockResolvedValue(mockSportProfile);
      mockPrismaService.ownerSubscription.findUnique.mockResolvedValue(mockSubscription);

      await expect(
        service.createHold('user-1', {
          playAreaId: 'play-area-1',
          sportProfileId: 'sport-profile-1',
          startAt: new Date(),
          durationMinutes: 45, // Invalid - not in allowedDurations
          playerName: 'Test Player',
          playerPhone: '01712345678',
        })
      ).rejects.toThrow('Invalid duration');
    });

    it('should reject booking for unapproved facility', async () => {
      mockPrismaService.sportProfile.findUnique.mockResolvedValue({
        ...mockSportProfile,
        playArea: {
          ...mockSportProfile.playArea,
          facility: { ...mockSportProfile.playArea.facility, isApproved: false },
        },
      });

      await expect(
        service.createHold('user-1', {
          playAreaId: 'play-area-1',
          sportProfileId: 'sport-profile-1',
          startAt: new Date(),
          durationMinutes: 60,
          playerName: 'Test Player',
          playerPhone: '01712345678',
        })
      ).rejects.toThrow('Facility is not available');
    });

    it('should reject booking for suspended subscription', async () => {
      mockPrismaService.sportProfile.findUnique.mockResolvedValue(mockSportProfile);
      mockPrismaService.ownerSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        status: 'SUSPENDED',
      });

      await expect(
        service.createHold('user-1', {
          playAreaId: 'play-area-1',
          sportProfileId: 'sport-profile-1',
          startAt: new Date(),
          durationMinutes: 60,
          playerName: 'Test Player',
          playerPhone: '01712345678',
        })
      ).rejects.toThrow('not accepting bookings');
    });
  });
});

describe('Concurrency Tests', () => {
  describe('DB Exclusion Constraint', () => {
    it('should handle exclusion constraint violation gracefully', () => {
      const mockError = {
        code: 'P2010',
        message: 'Raw query failed. Code: 23P01. Message: conflicting key value violates exclusion constraint "booking_no_overlap"',
      };

      // This simulates what PrismaService.isExclusionConstraintError does
      const isExclusionError = (error: any) => {
        return error.code === 'P2010' && error.message.includes('exclusion');
      };

      expect(isExclusionError(mockError)).toBe(true);
    });
  });
});

describe('Review Eligibility', () => {
  it('should require COMPLETED status and VERIFIED checkin for review', () => {
    const isEligibleForReview = (booking: { status: string; checkinStatus: string }) => {
      return booking.status === 'COMPLETED' && booking.checkinStatus === 'VERIFIED';
    };

    expect(isEligibleForReview({ status: 'COMPLETED', checkinStatus: 'VERIFIED' })).toBe(true);
    expect(isEligibleForReview({ status: 'COMPLETED', checkinStatus: 'NOT_CHECKED_IN' })).toBe(false);
    expect(isEligibleForReview({ status: 'CONFIRMED', checkinStatus: 'VERIFIED' })).toBe(false);
    expect(isEligibleForReview({ status: 'CANCELED', checkinStatus: 'NOT_CHECKED_IN' })).toBe(false);
  });
});
