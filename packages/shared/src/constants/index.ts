// =============================================================================
// SPORT ZEN - Shared Constants
// =============================================================================

// Timezone
export const DHAKA_TIMEZONE = 'Asia/Dhaka';

// Currency
export const CURRENCY = 'BDT';
export const CURRENCY_SYMBOL = '৳';

// Booking
export const ADVANCE_PERCENTAGE = 0.10; // 10%
export const DEFAULT_PLATFORM_COMMISSION_RATE = 0.05; // 5%
export const PLATFORM_PROCESSING_FEE = 50; // BDT
export const DEFAULT_BUFFER_MINUTES = 10;
export const DEFAULT_SLOT_INTERVAL_MINUTES = 30;
export const HOLD_EXPIRY_MINUTES = 10;
export const DEFAULT_MIN_LEAD_TIME_MINUTES = 60;
export const DEFAULT_MAX_ADVANCE_DAYS = 14;
export const CHECKIN_WINDOW_MINUTES = 30; // Before and after

// Search
export const DEFAULT_SEARCH_RADIUS_KM = 10;
export const MAX_SEARCH_RADIUS_KM = 50;
export const AVAILABLE_NOW_HOURS = 4;

// Cancellation Tiers (hours before start)
export const CANCELLATION_FULL_REFUND_HOURS = 24;
export const CANCELLATION_PARTIAL_REFUND_HOURS = 6;
export const PARTIAL_REFUND_PERCENTAGE = 0.5;

// Rate Limits
export const RATE_LIMITS = {
  OTP_REQUEST: { max: 3, windowMs: 60 * 1000 },
  OTP_VERIFY: { max: 5, windowMs: 60 * 1000 },
  LOGIN: { max: 5, windowMs: 5 * 60 * 1000 },
  BOOKING_HOLD: { max: 10, windowMs: 60 * 1000 },
  REVIEW_POST: { max: 5, windowMs: 60 * 60 * 1000 },
} as const;

// User Roles
export const USER_ROLES = {
  PLAYER: 'PLAYER',
  OWNER: 'OWNER',
  OWNER_STAFF: 'OWNER_STAFF',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

// Booking Statuses
export const BOOKING_STATUSES = {
  HOLD: 'HOLD',
  CONFIRMED: 'CONFIRMED',
  CANCELED: 'CANCELED',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
} as const;

// Payment Stages
export const PAYMENT_STAGES = {
  NOT_PAID: 'NOT_PAID',
  ADVANCE_PAID: 'ADVANCE_PAID',
  PARTIAL_OFFLINE: 'PARTIAL_OFFLINE',
  FULL_PAID_OFFLINE: 'FULL_PAID_OFFLINE',
} as const;

// Slot Statuses
export const SLOT_STATUSES = {
  AVAILABLE: 'available',
  BOOKED: 'booked',
  BLOCKED: 'blocked',
  DISABLED: 'disabled',
  BUFFER: 'buffer',
} as const;

// Subscription Statuses
export const SUBSCRIPTION_STATUSES = {
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  SUSPENDED: 'SUSPENDED',
  CANCELED: 'CANCELED',
} as const;

// Active subscription statuses (allows booking)
export const ACTIVE_SUBSCRIPTION_STATUSES = ['TRIAL', 'ACTIVE'] as const;

// Block Types
export const BLOCK_TYPES = {
  MAINTENANCE: 'MAINTENANCE',
  PRIVATE_EVENT: 'PRIVATE_EVENT',
  WEATHER: 'WEATHER',
  OTHER: 'OTHER',
} as const;

// Offline Payment Methods
export const OFFLINE_PAYMENT_METHODS = {
  CASH: 'CASH',
  BKASH: 'BKASH',
  NAGAD: 'NAGAD',
  CARD: 'CARD',
  OTHER: 'OTHER',
} as const;

// Review
export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const MIN_REVIEWS_FOR_RANKING = 5;
export const BAYESIAN_PRIOR_RATING = 3.5;
export const BAYESIAN_PRIOR_WEIGHT = 10;

// API
export const API_VERSION = 'v1';
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Error Codes
export const ERROR_CODES = {
  // Auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  PHONE_ALREADY_LINKED: 'PHONE_ALREADY_LINKED',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_INVALID: 'OTP_INVALID',
  RATE_LIMITED: 'RATE_LIMITED',

  // Booking
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  HOLD_EXPIRED: 'HOLD_EXPIRED',
  INVALID_DURATION: 'INVALID_DURATION',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  CANNOT_CANCEL: 'CANNOT_CANCEL',
  CHECKIN_WINDOW_CLOSED: 'CHECKIN_WINDOW_CLOSED',

  // Facility
  FACILITY_NOT_FOUND: 'FACILITY_NOT_FOUND',
  FACILITY_NOT_APPROVED: 'FACILITY_NOT_APPROVED',
  SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION_INACTIVE',

  // Payment
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',

  // Review
  REVIEW_NOT_ALLOWED: 'REVIEW_NOT_ALLOWED',
  ALREADY_REVIEWED: 'ALREADY_REVIEWED',
  CHECKIN_REQUIRED: 'CHECKIN_REQUIRED',

  // General
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
