import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../common/redis/redis.service';

/**
 * OTP Provider Interface - allows swapping between Twilio/Firebase/Mock
 */
export interface OTPProvider {
  sendOTP(phone: string): Promise<{ success: boolean; message: string }>;
  verifyOTP(phone: string, code: string): Promise<boolean>;
}

/**
 * Twilio Verify OTP Provider
 */
@Injectable()
export class TwilioOTPProvider implements OTPProvider {
  private readonly logger = new Logger(TwilioOTPProvider.name);
  private readonly client: any;
  private readonly serviceSid: string;
  private readonly isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.serviceSid = this.configService.get<string>('TWILIO_VERIFY_SERVICE_SID') || '';

    this.isEnabled = !!(accountSid && authToken && this.serviceSid);

    if (this.isEnabled) {
      try {
        // Dynamic import to avoid issues if twilio is not installed
        const Twilio = require('twilio');
        this.client = Twilio(accountSid, authToken);
        this.logger.log('Twilio OTP provider initialized');
      } catch (error) {
        this.logger.warn('Twilio SDK not available, OTP will be disabled');
        this.isEnabled = false;
      }
    } else {
      this.logger.warn('Twilio credentials not configured, OTP will be disabled');
    }
  }

  async sendOTP(phone: string): Promise<{ success: boolean; message: string }> {
    if (!this.isEnabled) {
      throw new BadRequestException('OTP service is not configured');
    }

    try {
      const verification = await this.client.verify.v2
        .services(this.serviceSid)
        .verifications.create({
          to: phone,
          channel: 'sms',
        });

      this.logger.log(`OTP sent to ${phone.substring(0, 6)}***`, {
        status: verification.status,
        sid: verification.sid,
      });

      return {
        success: verification.status === 'pending',
        message: 'OTP sent successfully',
      };
    } catch (error) {
      this.logger.error('Failed to send OTP via Twilio', error);
      throw new BadRequestException('Failed to send OTP. Please try again.');
    }
  }

  async verifyOTP(phone: string, code: string): Promise<boolean> {
    if (!this.isEnabled) {
      throw new BadRequestException('OTP service is not configured');
    }

    try {
      const verificationCheck = await this.client.verify.v2
        .services(this.serviceSid)
        .verificationChecks.create({
          to: phone,
          code,
        });

      this.logger.log(`OTP verification for ${phone.substring(0, 6)}***`, {
        status: verificationCheck.status,
      });

      return verificationCheck.status === 'approved';
    } catch (error) {
      this.logger.error('Failed to verify OTP via Twilio', error);
      return false;
    }
  }
}

/**
 * Mock OTP Provider for development/testing
 */
@Injectable()
export class MockOTPProvider implements OTPProvider {
  private readonly logger = new Logger(MockOTPProvider.name);
  private readonly otpStore = new Map<string, { code: string; expiresAt: Date }>();

  async sendOTP(phone: string): Promise<{ success: boolean; message: string }> {
    // Generate a 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    this.otpStore.set(phone, { code, expiresAt });

    this.logger.log(`[DEV] OTP for ${phone}: ${code}`);

    return {
      success: true,
      message: `[DEV] OTP sent. Code: ${code}`,
    };
  }

  async verifyOTP(phone: string, code: string): Promise<boolean> {
    const stored = this.otpStore.get(phone);

    if (!stored) {
      return false;
    }

    if (new Date() > stored.expiresAt) {
      this.otpStore.delete(phone);
      return false;
    }

    if (stored.code !== code) {
      return false;
    }

    this.otpStore.delete(phone);
    return true;
  }
}

/**
 * OTP Service - Main service with rate limiting and provider abstraction
 */
@Injectable()
export class OTPService {
  private readonly logger = new Logger(OTPService.name);
  private readonly provider: OTPProvider;

  // Rate limiting constants
  private readonly MAX_OTP_REQUESTS_PER_PHONE = 5; // per hour
  private readonly MAX_OTP_VERIFY_ATTEMPTS = 5; // per OTP
  private readonly OTP_RATE_LIMIT_WINDOW = 60 * 60; // 1 hour in seconds
  private readonly VERIFY_RATE_LIMIT_WINDOW = 10 * 60; // 10 minutes in seconds

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    twilioProvider: TwilioOTPProvider,
    mockProvider: MockOTPProvider,
  ) {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const useTwilio = this.configService.get('USE_TWILIO_OTP', 'false') === 'true';

    if (nodeEnv === 'production' || useTwilio) {
      this.provider = twilioProvider;
      this.logger.log('Using Twilio OTP provider');
    } else {
      this.provider = mockProvider;
      this.logger.log('Using Mock OTP provider (development mode)');
    }
  }

  /**
   * Request OTP for phone number
   */
  async requestOTP(phone: string): Promise<{ success: boolean; message: string }> {
    // Normalize phone number
    const normalizedPhone = this.normalizePhone(phone);

    // Check rate limit
    const rateLimitKey = `otp:request:${normalizedPhone}`;
    const requestCount = await this.redis.incr(rateLimitKey);

    if (requestCount === 1) {
      await this.redis.expire(rateLimitKey, this.OTP_RATE_LIMIT_WINDOW);
    }

    if (requestCount > this.MAX_OTP_REQUESTS_PER_PHONE) {
      this.logger.warn(`OTP rate limit exceeded for ${normalizedPhone.substring(0, 6)}***`);
      throw new BadRequestException(
        'Too many OTP requests. Please wait before trying again.',
      );
    }

    // Reset verify attempts on new OTP request
    const verifyAttemptsKey = `otp:verify:${normalizedPhone}`;
    await this.redis.del(verifyAttemptsKey);

    // Send OTP via provider
    return this.provider.sendOTP(normalizedPhone);
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(phone: string, code: string): Promise<boolean> {
    const normalizedPhone = this.normalizePhone(phone);

    // Check verify attempts rate limit
    const verifyAttemptsKey = `otp:verify:${normalizedPhone}`;
    const attempts = await this.redis.incr(verifyAttemptsKey);

    if (attempts === 1) {
      await this.redis.expire(verifyAttemptsKey, this.VERIFY_RATE_LIMIT_WINDOW);
    }

    if (attempts > this.MAX_OTP_VERIFY_ATTEMPTS) {
      this.logger.warn(`OTP verify attempts exceeded for ${normalizedPhone.substring(0, 6)}***`);
      throw new BadRequestException(
        'Too many verification attempts. Please request a new OTP.',
      );
    }

    const isValid = await this.provider.verifyOTP(normalizedPhone, code);

    if (isValid) {
      // Clear rate limit on successful verification
      await this.redis.del(verifyAttemptsKey);
    }

    return isValid;
  }

  /**
   * Normalize phone number to E.164 format for Bangladesh
   */
  private normalizePhone(phone: string): string {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Bangladesh phone format handling
    if (cleaned.startsWith('0')) {
      // Local format: 01XXXXXXXXX -> +8801XXXXXXXXX
      cleaned = '+88' + cleaned;
    } else if (cleaned.startsWith('88') && !cleaned.startsWith('+')) {
      // Country code without +: 8801XXXXXXXXX -> +8801XXXXXXXXX
      cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      // Assume Bangladesh if no country code
      cleaned = '+88' + cleaned;
    }

    return cleaned;
  }
}
