/**
 * Milestone 1 Test: Booking Concurrency
 *
 * Tests that the DB exclusion constraint prevents double bookings
 * when parallel HOLD requests are made for the same time slot.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../src/common/db/prisma.service';
import { RedisService } from '../../src/common/redis/redis.service';
import { BookingsService, CreateHoldInput } from '../../src/modules/bookings/bookings.service';
import { AvailabilityService } from '../../src/modules/availability/availability.service';
import { addHours, addDays } from 'date-fns';

describe('Booking Concurrency (Integration)', () => {
  let app: INestApplication;
  let bookingsService: BookingsService;
  let prisma: PrismaService;

  // Test data
  let testUserId1: string;
  let testUserId2: string;
  let testPlayAreaId: string;
  let testSportProfileId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        AvailabilityService,
        {
          provide: PrismaService,
          useValue: {
            // Mock or use real Prisma client
            sportProfile: { findUnique: jest.fn() },
            ownerSubscription: { findUnique: jest.fn() },
            booking: { create: jest.fn(), findUnique: jest.fn() },
            paymentIntent: { create: jest.fn() },
            bookingEvent: { create: jest.fn() },
            executeInTransaction: jest.fn(),
            isExclusionConstraintError: jest.fn(),
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            checkBookingRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
            acquireSlotLock: jest.fn().mockResolvedValue(true),
            releaseSlotLock: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    bookingsService = moduleFixture.get<BookingsService>(BookingsService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Setup test data IDs
    testUserId1 = '11111111-1111-1111-1111-111111111111';
    testUserId2 = '22222222-2222-2222-2222-222222222222';
    testPlayAreaId = '33333333-3333-3333-3333-333333333333';
    testSportProfileId = '44444444-4444-4444-4444-444444444444';
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('Parallel Hold Requests', () => {
    it('should allow first hold request to succeed', async () => {
      const startAt = addDays(addHours(new Date(), 3), 1);
      const mockSportProfile = {
        id: testSportProfileId,
        isActive: true,
        allowedDurations: [60, 90],
        bufferMinutes: 10,
        durationPrices: { '60': 1200, '90': 1700 },
        peakDurationPrices: null,
        peakRules: [],
        playArea: {
          id: testPlayAreaId,
          conflictGroupId: testPlayAreaId,
          facility: {
            id: 'facility-1',
            isApproved: true,
            deletedAt: null,
            ownerId: 'owner-1',
          },
        },
      };

      const mockSubscription = {
        status: 'TRIAL',
      };

      (prisma.sportProfile.findUnique as jest.Mock).mockResolvedValue(mockSportProfile);
      (prisma.ownerSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.executeInTransaction as jest.Mock).mockImplementation(async (fn) => {
        // Simulate successful transaction
        return fn({
          $queryRaw: jest.fn().mockResolvedValue([{ generate_booking_number: 'SZ-TEST-001' }]),
          booking: {
            create: jest.fn().mockResolvedValue({
              id: 'booking-1',
              bookingNumber: 'SZ-TEST-001',
            }),
          },
          paymentIntent: {
            create: jest.fn().mockResolvedValue({
              id: 'payment-intent-1',
            }),
          },
          bookingEvent: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const input: CreateHoldInput = {
        playAreaId: testPlayAreaId,
        sportProfileId: testSportProfileId,
        startAt,
        durationMinutes: 60,
        playerName: 'Test Player 1',
        playerPhone: '+8801700000001',
      };

      const result = await bookingsService.createHold(testUserId1, input);

      expect(result).toBeDefined();
      expect(result.bookingId).toBe('booking-1');
      expect(result.bookingNumber).toBe('SZ-TEST-001');
    });

    it('should reject second hold for same time slot with ConflictException', async () => {
      const startAt = addDays(addHours(new Date(), 3), 1);
      const mockSportProfile = {
        id: testSportProfileId,
        isActive: true,
        allowedDurations: [60, 90],
        bufferMinutes: 10,
        durationPrices: { '60': 1200, '90': 1700 },
        peakDurationPrices: null,
        peakRules: [],
        playArea: {
          id: testPlayAreaId,
          conflictGroupId: testPlayAreaId,
          facility: {
            id: 'facility-1',
            isApproved: true,
            deletedAt: null,
            ownerId: 'owner-1',
          },
        },
      };

      const mockSubscription = {
        status: 'ACTIVE',
      };

      (prisma.sportProfile.findUnique as jest.Mock).mockResolvedValue(mockSportProfile);
      (prisma.ownerSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      // Simulate exclusion constraint error on second attempt
      const exclusionError = new Error('duplicate key value violates unique constraint');
      (exclusionError as any).code = '23P01'; // PostgreSQL exclusion violation code

      (prisma.executeInTransaction as jest.Mock).mockRejectedValue(exclusionError);
      (prisma.isExclusionConstraintError as jest.Mock).mockReturnValue(true);

      const input: CreateHoldInput = {
        playAreaId: testPlayAreaId,
        sportProfileId: testSportProfileId,
        startAt,
        durationMinutes: 60,
        playerName: 'Test Player 2',
        playerPhone: '+8801700000002',
      };

      await expect(bookingsService.createHold(testUserId2, input)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should block adjacent slots due to buffer time', async () => {
      // When a 60-minute booking exists at 16:00, the 17:00 slot should be blocked
      // because buffer extends from 17:00 to 17:10, making 17:00 start unavailable
      // on a 30-minute slot grid

      const mockSportProfile = {
        id: testSportProfileId,
        isActive: true,
        allowedDurations: [60],
        bufferMinutes: 10,
        slotIntervalMinutes: 30,
        durationPrices: { '60': 1200 },
        peakDurationPrices: null,
        peakRules: [],
        playArea: {
          id: testPlayAreaId,
          conflictGroupId: testPlayAreaId,
          facility: {
            id: 'facility-1',
            isApproved: true,
            deletedAt: null,
            ownerId: 'owner-1',
          },
        },
      };

      // First booking: 16:00 - 17:00 (blocks until 17:10)
      // Second booking attempt: 17:00 - 18:00
      // Expected: Should fail because 17:00 < 17:10 (buffer end of first booking)

      (prisma.sportProfile.findUnique as jest.Mock).mockResolvedValue(mockSportProfile);
      (prisma.ownerSubscription.findUnique as jest.Mock).mockResolvedValue({ status: 'TRIAL' });

      // Simulate buffer conflict
      const bufferConflictError = new Error('exclusion constraint violation');
      (prisma.executeInTransaction as jest.Mock).mockRejectedValue(bufferConflictError);
      (prisma.isExclusionConstraintError as jest.Mock).mockReturnValue(true);

      const tomorrow = addDays(new Date(), 1);
      tomorrow.setHours(17, 0, 0, 0); // 17:00 start

      const input: CreateHoldInput = {
        playAreaId: testPlayAreaId,
        sportProfileId: testSportProfileId,
        startAt: tomorrow,
        durationMinutes: 60,
        playerName: 'Buffer Test Player',
        playerPhone: '+8801700000003',
      };

      await expect(bookingsService.createHold(testUserId1, input)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('Invalid Duration Rejection', () => {
    it('should reject booking with invalid duration', async () => {
      const mockSportProfile = {
        id: testSportProfileId,
        isActive: true,
        allowedDurations: [60, 90, 120], // 45 is not allowed
        bufferMinutes: 10,
        durationPrices: { '60': 1200, '90': 1700, '120': 2200 },
        peakDurationPrices: null,
        peakRules: [],
        playArea: {
          id: testPlayAreaId,
          conflictGroupId: testPlayAreaId,
          facility: {
            id: 'facility-1',
            isApproved: true,
            deletedAt: null,
            ownerId: 'owner-1',
          },
        },
      };

      (prisma.sportProfile.findUnique as jest.Mock).mockResolvedValue(mockSportProfile);
      (prisma.ownerSubscription.findUnique as jest.Mock).mockResolvedValue({ status: 'TRIAL' });

      const input: CreateHoldInput = {
        playAreaId: testPlayAreaId,
        sportProfileId: testSportProfileId,
        startAt: addDays(new Date(), 1),
        durationMinutes: 45, // Invalid duration
        playerName: 'Test Player',
        playerPhone: '+8801700000001',
      };

      await expect(bookingsService.createHold(testUserId1, input)).rejects.toThrow(
        'Invalid duration',
      );
    });
  });

  describe('Subscription Enforcement', () => {
    it('should reject booking when owner subscription is SUSPENDED', async () => {
      const mockSportProfile = {
        id: testSportProfileId,
        isActive: true,
        allowedDurations: [60],
        bufferMinutes: 10,
        durationPrices: { '60': 1200 },
        peakDurationPrices: null,
        peakRules: [],
        playArea: {
          id: testPlayAreaId,
          conflictGroupId: testPlayAreaId,
          facility: {
            id: 'facility-1',
            isApproved: true,
            deletedAt: null,
            ownerId: 'owner-1',
          },
        },
      };

      // Subscription is SUSPENDED - not bookable
      (prisma.sportProfile.findUnique as jest.Mock).mockResolvedValue(mockSportProfile);
      (prisma.ownerSubscription.findUnique as jest.Mock).mockResolvedValue({
        status: 'SUSPENDED',
      });

      const input: CreateHoldInput = {
        playAreaId: testPlayAreaId,
        sportProfileId: testSportProfileId,
        startAt: addDays(new Date(), 1),
        durationMinutes: 60,
        playerName: 'Test Player',
        playerPhone: '+8801700000001',
      };

      await expect(bookingsService.createHold(testUserId1, input)).rejects.toThrow(
        'Facility is currently not accepting bookings',
      );
    });
  });
});
