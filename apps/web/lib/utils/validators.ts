import { z } from 'zod';

/**
 * Common Validation Schemas
 * Shared Zod schemas for form validation
 */

// Email validation
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address');

// Password validation
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password is too long')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// Phone validation (Bangladesh format)
export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .regex(
    /^(\+880|880|0)?1[3-9]\d{8}$/,
    'Please enter a valid Bangladesh phone number',
  );

// Name validation
export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name is too long')
  .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces');

// OTP validation
export const otpSchema = z
  .string()
  .length(6, 'OTP must be 6 digits')
  .regex(/^\d{6}$/, 'OTP must contain only numbers');

/**
 * Auth Schemas
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    phone: phoneSchema.optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const phoneLoginSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: otpSchema,
});

/**
 * Booking Schemas
 */
export const createBookingSchema = z.object({
  sportProfileId: z.string().uuid('Invalid sport profile'),
  startAt: z.string().datetime('Invalid start time'),
  endAt: z.string().datetime('Invalid end time'),
  notes: z.string().max(500, 'Notes too long').optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().min(1, 'Please provide a reason').max(500, 'Reason too long'),
});

/**
 * Review Schemas
 */
export const createReviewSchema = z.object({
  bookingId: z.string().uuid('Invalid booking'),
  rating: z.number().min(1, 'Rating is required').max(5, 'Rating must be 1-5'),
  comment: z
    .string()
    .min(10, 'Review must be at least 10 characters')
    .max(1000, 'Review is too long'),
});

export const reportReviewSchema = z.object({
  reason: z
    .enum(['SPAM', 'INAPPROPRIATE', 'FAKE', 'OTHER'])
    .refine((val) => val !== undefined, 'Please select a reason'),
  details: z.string().max(500, 'Details too long').optional(),
});

/**
 * Owner Schemas
 */
export const createBlockSchema = z.object({
  playAreaId: z.string().uuid('Invalid play area').optional(),
  startAt: z.string().datetime('Invalid start time'),
  endAt: z.string().datetime('Invalid end time'),
  blockType: z.enum(['MAINTENANCE', 'PRIVATE_EVENT', 'WEATHER', 'OTHER']),
  reason: z.string().max(500, 'Reason too long').optional(),
});

export const offlinePaymentSchema = z.object({
  offlineAmountCollected: z
    .number()
    .min(0, 'Amount must be positive')
    .max(1000000, 'Amount too large'),
  offlinePaymentMethod: z.enum(['CASH', 'BKASH', 'NAGAD', 'CARD', 'OTHER']),
});

export const addStaffSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  role: z.enum(['OWNER_STAFF']),
});

/**
 * Facility Schemas
 */
export const updateFacilitySchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').optional(),
  description: z.string().max(2000, 'Description too long').optional(),
  address: z.string().min(5, 'Address is required').optional(),
  contactPhone: phoneSchema.optional(),
  contactEmail: emailSchema.optional(),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format').optional(),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format').optional(),
});

/**
 * Search Schemas
 */
export const searchFiltersSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().min(1).max(50).optional(),
  sport: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  rating: z.number().min(0).max(5).optional(),
  availableNow: z.boolean().optional(),
});

/**
 * Type Exports
 */
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type PhoneLoginInput = z.infer<typeof phoneLoginSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type ReportReviewInput = z.infer<typeof reportReviewSchema>;
export type CreateBlockInput = z.infer<typeof createBlockSchema>;
export type OfflinePaymentInput = z.infer<typeof offlinePaymentSchema>;
export type AddStaffInput = z.infer<typeof addStaffSchema>;
export type UpdateFacilityInput = z.infer<typeof updateFacilitySchema>;
export type SearchFiltersInput = z.infer<typeof searchFiltersSchema>;

/**
 * Validation Helpers
 */
export function validateEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

export function validatePhone(phone: string): boolean {
  return phoneSchema.safeParse(phone).success;
}

export function validatePassword(password: string): boolean {
  return passwordSchema.safeParse(password).success;
}

export function getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}
