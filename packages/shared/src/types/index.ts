// =============================================================================
// SPORT ZEN - Shared TypeScript Types
// =============================================================================

// User & Auth
export type UserRole = 'PLAYER' | 'OWNER' | 'OWNER_STAFF' | 'SUPER_ADMIN';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Facility
export type FacilityStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface Facility {
  id: string;
  name: string;
  slug: string;
  description?: string;
  address: string;
  city: string;
  area: string;
  latitude: number;
  longitude: number;
  contactPhone: string;
  contactEmail?: string;
  openingTime: string;
  closingTime: string;
  amenities: string[];
  status: FacilityStatus;
  isApproved: boolean;
  avgRating?: number;
  reviewCount: number;
  photos: FacilityPhoto[];
  playAreas: PlayArea[];
}

export interface FacilityPhoto {
  id: string;
  url: string;
  caption?: string;
  isPrimary: boolean;
}

export interface PlayArea {
  id: string;
  name: string;
  description?: string;
  conflictGroupId: string;
  surfaceType?: string;
  dimensions?: string;
  capacity?: number;
  isIndoor: boolean;
  isActive: boolean;
  sportProfiles: SportProfile[];
}

// Sport
export interface SportType {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
}

export interface SportProfile {
  id: string;
  sportTypeId: string;
  sportType: SportType;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  minLeadTimeMinutes: number;
  maxAdvanceDays: number;
  allowedDurations: number[];
  durationPrices: Record<string, number>;
  peakDurationPrices?: Record<string, number>;
}

export interface PeakPricingRule {
  id: string;
  dayOfWeek: number; // 0-6
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  isActive: boolean;
}

// Booking
export type BookingStatus = 'HOLD' | 'CONFIRMED' | 'CANCELED' | 'COMPLETED' | 'EXPIRED';
export type PaymentStage = 'NOT_PAID' | 'ADVANCE_PAID' | 'PARTIAL_OFFLINE' | 'FULL_PAID_OFFLINE';
export type CheckinStatus = 'NOT_CHECKED_IN' | 'VERIFIED';
export type OfflinePaymentMethod = 'CASH' | 'BKASH' | 'NAGAD' | 'CARD' | 'OTHER';

export interface Booking {
  id: string;
  bookingNumber: string;
  playAreaId: string;
  sportProfileId: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  totalAmount: number;
  advanceAmount: number;
  isPeakPricing: boolean;
  status: BookingStatus;
  paymentStage: PaymentStage;
  checkinStatus: CheckinStatus;
  holdExpiresAt?: string;
  confirmedAt?: string;
  playerName: string;
  playerPhone: string;
  playerEmail?: string;
}

export interface BookingWithDetails extends Booking {
  playArea: PlayArea & {
    facility: Facility;
  };
  sportProfile: SportProfile;
}

// Availability
export type SlotStatus = 'available' | 'booked' | 'blocked' | 'disabled' | 'buffer';

export interface TimeSlot {
  startAt: string;
  endAt: string;
  blockedEndAt: string;
  status: SlotStatus;
  isPeak: boolean;
  price: number | null;
  bookingId?: string;
  blockId?: string;
}

export interface AvailabilityGrid {
  date: string;
  conflictGroupId: string;
  sportProfileId: string;
  allowedDurations: number[];
  slots: Record<number, TimeSlot[]>;
}

// Payment
export type PaymentIntentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'LATE_SUCCESS_CONFLICT';

export interface PaymentIntent {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  expiresAt: string;
}

export interface SSLCommerzInitData {
  gatewayUrl: string;
  sessionKey: string;
  tranId: string;
  formFields: Record<string, string>;
}

// Refund
export type RefundStatus = 'REQUESTED' | 'APPROVED' | 'PROCESSING' | 'REFUNDED' | 'FAILED' | 'MANUAL_REQUIRED';
export type RefundTier = '>24h' | '24h-6h' | '<6h';

export interface Refund {
  id: string;
  bookingId: string;
  refundAmount: number;
  platformFeeRetained: number;
  originalAdvance: number;
  refundTier: RefundTier;
  status: RefundStatus;
  reason: string;
}

// Subscription
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';

export interface OwnerSubscription {
  id: string;
  ownerId: string;
  planId: string;
  status: SubscriptionStatus;
  trialEndsAt?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

// Review
export interface Review {
  id: string;
  bookingId: string;
  facilityId: string;
  userId: string;
  rating: number;
  title?: string;
  comment?: string;
  isVisible: boolean;
  createdAt: string;
  user: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}

// Nearby Search
export interface NearbySearchParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  sportTypeId?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  availableNow?: boolean;
  page?: number;
  limit?: number;
}

export interface NearbyFacility {
  id: string;
  name: string;
  slug: string;
  address: string;
  area: string;
  distanceMeters: number;
  avgRating?: number;
  reviewCount: number;
  minPrice?: number;
  maxPrice?: number;
  primaryPhotoUrl?: string;
  sportTypes: string[];
  isAvailableNow: boolean;
}

// API Response Types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
  correlationId?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
