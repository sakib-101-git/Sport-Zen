/**
 * Milestone 2 Test: SSLCommerz Security Tests
 *
 * Tests:
 * - Webhook signature verification
 * - Amount tampering detection
 * - Dev endpoints blocked in production
 * - Webhook idempotency
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SSLCommerzService } from '../../src/modules/payments/sslcommerz/sslcommerz.service';
import { PrismaService } from '../../src/common/db/prisma.service';
import { RedisService } from '../../src/common/redis/redis.service';
import { BookingsService } from '../../src/modules/bookings/bookings.service';
import { DevOnlyGuard } from '../../src/common/guards/dev-only.guard';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';

describe('SSLCommerz Security (Milestone 2)', () => {
  let sslcommerzService: SSLCommerzService;
  let configService: ConfigService;

  const mockPrisma = {
    paymentIntent: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    paymentTransaction: {
      create: jest.fn(),
    },
    booking: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ownerLedgerEntry: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    bookingEvent: {
      create: jest.fn(),
    },
    refund: {
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
    executeInTransaction: jest.fn(),
  };

  const mockRedis = {
    del: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockBookingsService = {
    confirmBooking: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        SSLCommerzService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'SSLCOMMERZ_STORE_ID': 'test_store',
                'SSLCOMMERZ_STORE_PASSWORD': 'test_password123',
                'SSLCOMMERZ_IS_SANDBOX': 'true',
                'API_URL': 'http://localhost:3001',
                'NEXT_PUBLIC_APP_URL': 'http://localhost:3000',
                'NODE_ENV': 'development',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: BookingsService, useValue: mockBookingsService },
      ],
    }).compile();

    sslcommerzService = moduleFixture.get<SSLCommerzService>(SSLCommerzService);
    configService = moduleFixture.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Webhook Signature Verification', () => {
    it('should verify valid webhook signature', () => {
      const storePassword = 'test_password123';
      const hashedPassword = createHash('md5').update(storePassword).digest('hex');

      // Simulate SSLCommerz payload
      const payload: any = {
        tran_id: 'SSLCZ-test-123',
        val_id: 'VAL-123',
        amount: '120.00',
        store_amount: '117.00',
        currency: 'BDT',
        bank_tran_id: 'BANK-123',
        status: 'VALID',
        verify_key: 'amount,bank_tran_id,currency,status',
      };

      // Build verify string
      const verifyString = `amount=${payload.amount}&bank_tran_id=${payload.bank_tran_id}&currency=${payload.currency}&status=${payload.status}&store_passwd=${hashedPassword}`;
      payload.verify_sign = createHash('md5').update(verifyString).digest('hex');
      payload.verify_sign_sha2 = createHash('sha256').update(verifyString).digest('hex');

      const isValid = sslcommerzService.verifyWebhookSignature(payload);
      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload: any = {
        tran_id: 'SSLCZ-test-123',
        val_id: 'VAL-123',
        amount: '120.00',
        status: 'VALID',
        verify_key: 'amount,status',
        verify_sign: 'invalid_signature',
      };

      const isValid = sslcommerzService.verifyWebhookSignature(payload);
      expect(isValid).toBe(false);
    });

    it('should reject payload without verify_sign', () => {
      const payload: any = {
        tran_id: 'SSLCZ-test-123',
        amount: '120.00',
        status: 'VALID',
      };

      const isValid = sslcommerzService.verifyWebhookSignature(payload);
      expect(isValid).toBe(false);
    });
  });

  describe('Amount Tampering Detection', () => {
    it('should reject webhook when amount does not match payment intent', async () => {
      const paymentIntent = {
        id: 'intent-1',
        amount: 120,
        currency: 'BDT',
        status: 'PENDING',
        bookingId: 'booking-1',
        tranId: 'SSLCZ-intent-1-123456',
        booking: {
          id: 'booking-1',
          status: 'HOLD',
        },
      };

      mockPrisma.paymentIntent.findFirst.mockResolvedValue(paymentIntent);

      // Webhook with tampered amount (should be 120.00)
      const tamperedPayload: any = {
        tran_id: 'SSLCZ-intent-1-123456',
        val_id: 'VAL-123',
        amount: '50.00', // TAMPERED - should be 120.00
        status: 'VALID',
        verify_key: 'amount,status',
      };

      // Build valid signature with tampered amount
      const storePassword = 'test_password123';
      const hashedPassword = createHash('md5').update(storePassword).digest('hex');
      const verifyString = `amount=${tamperedPayload.amount}&status=${tamperedPayload.status}&store_passwd=${hashedPassword}`;
      tamperedPayload.verify_sign = createHash('md5').update(verifyString).digest('hex');

      const result = await sslcommerzService.handleWebhook(tamperedPayload);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Amount mismatch');
    });

    it('should accept webhook when amount matches exactly', async () => {
      const paymentIntent = {
        id: 'intent-1',
        amount: 120,
        currency: 'BDT',
        status: 'PENDING',
        bookingId: 'booking-1',
        tranId: 'SSLCZ-intent-1-123456',
        booking: {
          id: 'booking-1',
          status: 'HOLD',
          ownerAdvanceCredit: 114,
          playArea: {
            facility: {
              ownerId: 'owner-1',
            },
          },
        },
      };

      mockPrisma.paymentIntent.findFirst.mockResolvedValue(paymentIntent);
      mockPrisma.paymentIntent.update.mockResolvedValue({ ...paymentIntent, status: 'SUCCESS' });
      mockBookingsService.confirmBooking.mockResolvedValue(undefined);

      const validPayload: any = {
        tran_id: 'SSLCZ-intent-1-123456',
        val_id: 'VAL-123',
        amount: '120.00', // Matches exactly
        status: 'VALID',
        verify_key: 'amount,status',
      };

      // Build valid signature
      const storePassword = 'test_password123';
      const hashedPassword = createHash('md5').update(storePassword).digest('hex');
      const verifyString = `amount=${validPayload.amount}&status=${validPayload.status}&store_passwd=${hashedPassword}`;
      validPayload.verify_sign = createHash('md5').update(verifyString).digest('hex');

      const result = await sslcommerzService.handleWebhook(validPayload);

      expect(result.success).toBe(true);
    });
  });

  describe('Webhook Idempotency', () => {
    it('should return success without re-processing already confirmed payment', async () => {
      const paymentIntent = {
        id: 'intent-1',
        amount: 120,
        currency: 'BDT',
        status: 'SUCCESS', // Already processed
        bookingId: 'booking-1',
        tranId: 'SSLCZ-intent-1-123456',
        booking: {
          id: 'booking-1',
          status: 'CONFIRMED',
        },
      };

      mockPrisma.paymentIntent.findFirst.mockResolvedValue(paymentIntent);

      const payload: any = {
        tran_id: 'SSLCZ-intent-1-123456',
        val_id: 'VAL-123',
        amount: '120.00',
        status: 'VALID',
        verify_key: 'amount,status',
      };

      // Build valid signature
      const storePassword = 'test_password123';
      const hashedPassword = createHash('md5').update(storePassword).digest('hex');
      const verifyString = `amount=${payload.amount}&status=${payload.status}&store_passwd=${hashedPassword}`;
      payload.verify_sign = createHash('md5').update(verifyString).digest('hex');

      const result = await sslcommerzService.handleWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.message).toContain('already processed');
      expect(mockBookingsService.confirmBooking).not.toHaveBeenCalled();
    });
  });
});

describe('DevOnlyGuard', () => {
  let guard: DevOnlyGuard;

  const createMockContext = (): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getClass: () => ({}),
    getHandler: () => ({}),
    getArgs: () => [],
    getArgByIndex: () => ({}),
    switchToRpc: () => ({} as any),
    switchToWs: () => ({} as any),
    getType: () => 'http',
  } as ExecutionContext);

  it('should allow access in development environment', () => {
    const configService = {
      get: jest.fn().mockReturnValue('development'),
    } as any;

    guard = new DevOnlyGuard(configService);
    const context = createMockContext();

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw NotFoundException in production environment', () => {
    const configService = {
      get: jest.fn().mockReturnValue('production'),
    } as any;

    guard = new DevOnlyGuard(configService);
    const context = createMockContext();

    expect(() => guard.canActivate(context)).toThrow(NotFoundException);
  });

  it('should allow access in test environment', () => {
    const configService = {
      get: jest.fn().mockReturnValue('test'),
    } as any;

    guard = new DevOnlyGuard(configService);
    const context = createMockContext();

    expect(guard.canActivate(context)).toBe(true);
  });
});
