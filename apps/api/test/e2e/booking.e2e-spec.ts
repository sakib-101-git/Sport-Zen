// =============================================================================
// SPORT ZEN - Booking E2E Tests
// =============================================================================

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/db/prisma.service';
import { RedisService } from '../../src/common/redis/redis.service';

describe('Booking E2E Tests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  // Test data
  let authToken: string;
  let testFacilityId: string;
  let testPlayAreaId: string;
  let testSportProfileId: string;
  let testConflictGroupId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    redis = moduleFixture.get<RedisService>(RedisService);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function setupTestData() {
    // Create test user and login
    // Create test facility, play area, sport profile
    // This would be implemented based on actual seed data
  }

  async function cleanupTestData() {
    // Clean up test bookings, users, etc.
  }

  describe('POST /bookings/hold', () => {
    it('should create a booking hold successfully', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const response = await request(app.getHttpServer())
        .post('/api/v1/bookings/hold')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          playAreaId: testPlayAreaId,
          sportProfileId: testSportProfileId,
          startAt: tomorrow.toISOString(),
          durationMinutes: 60,
          playerName: 'Test Player',
          playerPhone: '01712345678',
        })
        .expect(201);

      expect(response.body).toHaveProperty('bookingId');
      expect(response.body).toHaveProperty('paymentIntentId');
      expect(response.body).toHaveProperty('advanceAmount');
      expect(response.body).toHaveProperty('holdExpiresAt');
    });

    it('should reject parallel hold attempts for same slot (DB constraint)', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0);

      // First hold should succeed
      const first = await request(app.getHttpServer())
        .post('/api/v1/bookings/hold')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          playAreaId: testPlayAreaId,
          sportProfileId: testSportProfileId,
          startAt: tomorrow.toISOString(),
          durationMinutes: 60,
          playerName: 'Player 1',
          playerPhone: '01712345678',
        });

      expect(first.status).toBe(201);

      // Second hold for same slot should fail
      const second = await request(app.getHttpServer())
        .post('/api/v1/bookings/hold')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          playAreaId: testPlayAreaId,
          sportProfileId: testSportProfileId,
          startAt: tomorrow.toISOString(),
          durationMinutes: 60,
          playerName: 'Player 2',
          playerPhone: '01787654321',
        });

      expect(second.status).toBe(409); // Conflict
      expect(second.body.message).toContain('no longer available');
    });

    it('should enforce buffer time between bookings', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(16, 0, 0, 0);

      // Create first booking 16:00-17:00 (blocks until 17:10 with buffer)
      const first = await request(app.getHttpServer())
        .post('/api/v1/bookings/hold')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          playAreaId: testPlayAreaId,
          sportProfileId: testSportProfileId,
          startAt: tomorrow.toISOString(),
          durationMinutes: 60,
          playerName: 'Player 1',
          playerPhone: '01712345678',
        });

      expect(first.status).toBe(201);

      // Try to book at 17:00 - should fail (within buffer)
      const bufferTime = new Date(tomorrow);
      bufferTime.setHours(17, 0, 0, 0);

      const second = await request(app.getHttpServer())
        .post('/api/v1/bookings/hold')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          playAreaId: testPlayAreaId,
          sportProfileId: testSportProfileId,
          startAt: bufferTime.toISOString(),
          durationMinutes: 60,
          playerName: 'Player 2',
          playerPhone: '01787654321',
        });

      expect(second.status).toBe(409);
    });
  });

  describe('POST /payments/sslcommerz/webhook (Idempotency)', () => {
    it('should handle duplicate webhook deliveries idempotently', async () => {
      // Create a confirmed booking first
      const bookingId = 'test-booking-id';
      const tranId = 'TEST-TRAN-123';

      const webhookPayload = {
        tran_id: tranId,
        val_id: 'VAL123',
        amount: '100.00',
        status: 'VALID',
        value_a: 'payment-intent-id',
        value_b: bookingId,
        verify_sign: 'mock-signature',
        verify_key: 'tran_id,val_id,amount,status',
      };

      // First webhook call
      const first = await request(app.getHttpServer())
        .post('/api/v1/payments/sslcommerz/webhook')
        .send(webhookPayload);

      expect(first.status).toBe(200);

      // Second webhook call (duplicate) should also succeed without side effects
      const second = await request(app.getHttpServer())
        .post('/api/v1/payments/sslcommerz/webhook')
        .send(webhookPayload);

      expect(second.status).toBe(200);
      expect(second.body.success).toBe(true);
    });
  });

  describe('POST /bookings/:id/cancel (Refund Tiers)', () => {
    it('should calculate correct refund for >24h cancellation', async () => {
      // Create and confirm a booking for 48 hours from now
      // Cancel it
      // Verify refund amount matches >24h tier
    });

    it('should calculate correct refund for 24h-6h cancellation', async () => {
      // Create and confirm a booking for 12 hours from now
      // Cancel it
      // Verify refund amount matches 24h-6h tier (50% minus fee)
    });

    it('should not provide refund for <6h cancellation', async () => {
      // Create and confirm a booking for 3 hours from now
      // Cancel it
      // Verify no refund
    });
  });

  describe('POST /bookings/:id/checkin (Review Eligibility)', () => {
    it('should allow review only after verified check-in', async () => {
      // Create and complete a booking without check-in
      // Attempt to post review - should fail

      // Verify check-in
      // Attempt to post review - should succeed
    });
  });

  describe('Subscription Enforcement', () => {
    it('should block new holds for suspended subscription', async () => {
      // Suspend owner subscription
      // Attempt to create hold for their facility
      // Should fail with appropriate message
    });
  });
});

// =============================================================================
// TESTING PLAN
// =============================================================================
/**
 * Critical Test Scenarios:
 *
 * 1. CONCURRENCY / DOUBLE BOOKING
 *    - Two simultaneous hold attempts for same slot
 *    - DB exclusion constraint must reject second attempt
 *    - Redis lock is supportive, not authoritative
 *
 * 2. PAYMENT WEBHOOK IDEMPOTENCY
 *    - Duplicate webhook deliveries
 *    - Out-of-order webhook deliveries
 *    - Late webhook after hold expiry
 *
 * 3. LATE PAYMENT AFTER HOLD EXPIRY
 *    - Hold expires, then webhook arrives
 *    - If slot still available: confirm booking
 *    - If slot taken: create auto-refund
 *
 * 4. CANCELLATION REFUND TIERS
 *    - >24h before start: full advance minus processing fee
 *    - 24h-6h before start: 50% advance minus processing fee
 *    - <6h before start: no refund
 *    - All calculations use Asia/Dhaka timezone
 *
 * 5. REVIEW ELIGIBILITY
 *    - Booking must be COMPLETED
 *    - Check-in must be VERIFIED
 *    - Only one review per booking
 *
 * 6. SUBSCRIPTION ENFORCEMENT
 *    - TRIAL/ACTIVE: allows booking
 *    - PAST_DUE/SUSPENDED/CANCELED: blocks new holds
 *    - Existing confirmed bookings remain valid
 *
 * 7. BUFFER TIME ENFORCEMENT
 *    - 10-min buffer appended after booking end
 *    - DB constraint uses blocked_end_at
 *    - Next booking cannot start during buffer
 *
 * 8. SSLCOMMERZ POST FORM
 *    - Form auto-submits on mount
 *    - Hidden fields contain correct data
 *    - Handles redirect failures gracefully
 */
