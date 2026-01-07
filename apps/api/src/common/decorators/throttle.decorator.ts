import { Throttle, SkipThrottle } from '@nestjs/throttler';

/**
 * Strict rate limiting for OTP endpoints
 * 5 requests per minute, 10 requests per hour
 */
export const ThrottleOTP = () =>
  Throttle({
    short: { ttl: 60000, limit: 5 }, // 5 per minute
    medium: { ttl: 3600000, limit: 10 }, // 10 per hour
    long: { ttl: 86400000, limit: 30 }, // 30 per day
  });

/**
 * Strict rate limiting for login endpoints
 * 5 attempts per 15 minutes
 */
export const ThrottleLogin = () =>
  Throttle({
    short: { ttl: 60000, limit: 10 }, // 10 per minute
    medium: { ttl: 900000, limit: 5 }, // 5 per 15 minutes after failures
    long: { ttl: 3600000, limit: 20 }, // 20 per hour
  });

/**
 * Strict rate limiting for booking hold creation
 * Prevents slot holding abuse
 */
export const ThrottleBookingHold = () =>
  Throttle({
    short: { ttl: 10000, limit: 3 }, // 3 per 10 seconds
    medium: { ttl: 60000, limit: 10 }, // 10 per minute
    long: { ttl: 3600000, limit: 30 }, // 30 per hour
  });

/**
 * Rate limiting for review submissions
 */
export const ThrottleReview = () =>
  Throttle({
    short: { ttl: 60000, limit: 3 }, // 3 per minute
    medium: { ttl: 3600000, limit: 10 }, // 10 per hour
    long: { ttl: 86400000, limit: 20 }, // 20 per day
  });

/**
 * Skip throttling (for health checks, webhooks, etc.)
 */
export const NoThrottle = () => SkipThrottle();
