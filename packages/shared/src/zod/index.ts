// =============================================================================
// SPORT ZEN - Shared Zod Schemas
// =============================================================================

import { z } from 'zod';

// Common Validators
export const uuidSchema = z.string().uuid();
export const phoneSchema = z.string().regex(/^01[3-9]\d{8}$/, 'Invalid Bangladeshi phone number');
export const emailSchema = z.string().email();
export const bdtAmountSchema = z.number().int().positive();

// Auth Schemas
export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: phoneSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const phoneOtpRequestSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(['login', 'register', 'link_phone']),
});

export const phoneOtpVerifySchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6, 'OTP must be 6 digits'),
  purpose: z.enum(['login', 'register', 'link_phone']),
});

export const linkPhoneSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6),
});

// Booking Schemas
export const createHoldSchema = z.object({
  playAreaId: uuidSchema,
  sportProfileId: uuidSchema,
  startAt: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  playerName: z.string().min(2),
  playerPhone: phoneSchema,
  playerEmail: emailSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().min(5, 'Please provide a reason').max(500),
});

export const recordOfflinePaymentSchema = z.object({
  amount: bdtAmountSchema,
  method: z.enum(['CASH', 'BKASH', 'NAGAD', 'CARD', 'OTHER']),
  notes: z.string().max(200).optional(),
});

// Availability Schemas
export const availabilityQuerySchema = z.object({
  conflictGroupId: uuidSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

// Search Schemas
export const nearbySearchSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().min(1).max(50).optional().default(10),
  sportTypeId: uuidSchema.optional(),
  minPrice: bdtAmountSchema.optional(),
  maxPrice: bdtAmountSchema.optional(),
  minRating: z.number().min(1).max(5).optional(),
  availableNow: z.boolean().optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

// Review Schemas
export const createReviewSchema = z.object({
  bookingId: uuidSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().max(100).optional(),
  comment: z.string().max(1000).optional(),
});

export const reportReviewSchema = z.object({
  reason: z.enum(['spam', 'inappropriate', 'fake', 'harassment', 'other']),
  description: z.string().max(500).optional(),
});

// Facility Schemas
export const createFacilitySchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(2000).optional(),
  address: z.string().min(10).max(200),
  city: z.string().min(2).max(50),
  area: z.string().min(2).max(50),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  contactPhone: phoneSchema,
  contactEmail: emailSchema.optional(),
  openingTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format'),
  closingTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format'),
  amenities: z.array(z.string()).optional().default([]),
});

export const createPlayAreaSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(500).optional(),
  surfaceType: z.string().max(50).optional(),
  dimensions: z.string().max(50).optional(),
  capacity: z.number().int().positive().optional(),
  isIndoor: z.boolean().optional().default(false),
  conflictGroupId: uuidSchema.optional(), // If sharing with another play area
});

export const createSportProfileSchema = z.object({
  playAreaId: uuidSchema,
  sportTypeId: uuidSchema,
  slotIntervalMinutes: z.number().int().positive().default(30),
  bufferMinutes: z.number().int().min(0).default(10),
  minLeadTimeMinutes: z.number().int().min(0).default(60),
  maxAdvanceDays: z.number().int().positive().default(14),
  allowedDurations: z.array(z.number().int().positive()).min(1),
  durationPrices: z.record(z.string(), z.number().int().positive()),
  peakDurationPrices: z.record(z.string(), z.number().int().positive()).optional(),
});

// Block Schemas
export const createBlockSchema = z.object({
  playAreaId: uuidSchema.optional(), // null = all play areas
  conflictGroupId: uuidSchema,
  blockType: z.enum(['MAINTENANCE', 'PRIVATE_EVENT', 'WEATHER', 'OTHER']),
  reason: z.string().max(200).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

// Payment Schemas
export const initiatePaymentSchema = z.object({
  bookingId: uuidSchema,
  customerInfo: z.object({
    name: z.string().min(2),
    email: emailSchema.optional(),
    phone: phoneSchema,
  }),
});

// Admin Schemas
export const approvalActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
});

export const moderateReviewSchema = z.object({
  action: z.enum(['hide', 'delete', 'restore']),
  note: z.string().max(500).optional(),
});

export const updateSubscriptionStatusSchema = z.object({
  status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED']),
  reason: z.string().max(500).optional(),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateHoldInput = z.infer<typeof createHoldSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type NearbySearchInput = z.infer<typeof nearbySearchSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreateFacilityInput = z.infer<typeof createFacilitySchema>;
export type CreatePlayAreaInput = z.infer<typeof createPlayAreaSchema>;
export type CreateSportProfileInput = z.infer<typeof createSportProfileSchema>;
export type CreateBlockInput = z.infer<typeof createBlockSchema>;
