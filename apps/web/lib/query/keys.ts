/**
 * Query Keys
 * Centralized query key definitions for TanStack Query
 * Using object notation for better type inference and key management
 */

export const queryKeys = {
  // Auth
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
    session: () => [...queryKeys.auth.all, 'session'] as const,
  },

  // Facilities
  facilities: {
    all: ['facilities'] as const,
    lists: () => [...queryKeys.facilities.all, 'list'] as const,
    nearby: (params: {
      lat?: number;
      lng?: number;
      radiusKm?: number;
      sport?: string;
      minPrice?: number;
      maxPrice?: number;
      rating?: number;
      availableNow?: boolean;
    }) => [...queryKeys.facilities.lists(), params] as const,
    search: (query: string) => [...queryKeys.facilities.lists(), 'search', query] as const,
    details: () => [...queryKeys.facilities.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.facilities.details(), id] as const,
    playAreas: (facilityId: string) => [...queryKeys.facilities.detail(facilityId), 'play-areas'] as const,
    reviews: (facilityId: string, page?: number) =>
      [...queryKeys.facilities.detail(facilityId), 'reviews', { page }] as const,
  },

  // Availability
  availability: {
    all: ['availability'] as const,
    slots: (params: { conflictGroupId: string; date: string }) =>
      [...queryKeys.availability.all, 'slots', params] as const,
    check: (params: { conflictGroupId: string; startAt: string; endAt: string }) =>
      [...queryKeys.availability.all, 'check', params] as const,
  },

  // Bookings
  bookings: {
    all: ['bookings'] as const,
    lists: () => [...queryKeys.bookings.all, 'list'] as const,
    myBookings: (filters?: { status?: string; page?: number }) =>
      [...queryKeys.bookings.lists(), 'my', filters] as const,
    details: () => [...queryKeys.bookings.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.bookings.details(), id] as const,
    qr: (id: string) => [...queryKeys.bookings.detail(id), 'qr'] as const,
  },

  // Payments
  payments: {
    all: ['payments'] as const,
    status: (intentId: string) => [...queryKeys.payments.all, 'status', intentId] as const,
  },

  // Reviews
  reviews: {
    all: ['reviews'] as const,
    forFacility: (facilityId: string) => [...queryKeys.reviews.all, 'facility', facilityId] as const,
  },

  // Owner
  owner: {
    all: ['owner'] as const,
    dashboard: () => [...queryKeys.owner.all, 'dashboard'] as const,
    bookings: (params?: { status?: string; dateFrom?: string; dateTo?: string; page?: number }) =>
      [...queryKeys.owner.all, 'bookings', params] as const,
    calendar: (params: { month: string; facilityId?: string }) =>
      [...queryKeys.owner.all, 'calendar', params] as const,
    blocks: () => [...queryKeys.owner.all, 'blocks'] as const,
    facilities: () => [...queryKeys.owner.all, 'facilities'] as const,
    facilityDetail: (id: string) => [...queryKeys.owner.facilities(), id] as const,
    settlements: (month: string) => [...queryKeys.owner.all, 'settlements', month] as const,
    staff: () => [...queryKeys.owner.all, 'staff'] as const,
  },

  // Admin
  admin: {
    all: ['admin'] as const,
    dashboard: () => [...queryKeys.admin.all, 'dashboard'] as const,
    facilityApprovals: (page?: number) =>
      [...queryKeys.admin.all, 'facility-approvals', { page }] as const,
    disputes: (page?: number) => [...queryKeys.admin.all, 'disputes', { page }] as const,
    refunds: (params?: { status?: string; page?: number }) =>
      [...queryKeys.admin.all, 'refunds', params] as const,
    subscriptions: (params?: { status?: string; page?: number }) =>
      [...queryKeys.admin.all, 'subscriptions', params] as const,
    reviews: (params?: { status?: string; page?: number }) =>
      [...queryKeys.admin.all, 'reviews', params] as const,
  },

  // Sport Types
  sportTypes: {
    all: ['sport-types'] as const,
    list: () => [...queryKeys.sportTypes.all, 'list'] as const,
  },

  // User
  user: {
    all: ['user'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,
    favorites: () => [...queryKeys.user.all, 'favorites'] as const,
  },
} as const;

/**
 * Mutation Keys
 * For tracking mutation state
 */
export const mutationKeys = {
  auth: {
    login: ['auth', 'login'] as const,
    register: ['auth', 'register'] as const,
    logout: ['auth', 'logout'] as const,
    requestOtp: ['auth', 'request-otp'] as const,
    verifyOtp: ['auth', 'verify-otp'] as const,
    linkPhone: ['auth', 'link-phone'] as const,
  },
  bookings: {
    createHold: ['bookings', 'create-hold'] as const,
    cancel: ['bookings', 'cancel'] as const,
    checkIn: ['bookings', 'check-in'] as const,
  },
  reviews: {
    create: ['reviews', 'create'] as const,
    report: ['reviews', 'report'] as const,
  },
  owner: {
    updateFacility: ['owner', 'update-facility'] as const,
    createBlock: ['owner', 'create-block'] as const,
    deleteBlock: ['owner', 'delete-block'] as const,
    recordPayment: ['owner', 'record-payment'] as const,
    verifyCheckIn: ['owner', 'verify-checkin'] as const,
    addStaff: ['owner', 'add-staff'] as const,
    updateStaffRole: ['owner', 'update-staff-role'] as const,
  },
  admin: {
    approveFacility: ['admin', 'approve-facility'] as const,
    rejectFacility: ['admin', 'reject-facility'] as const,
    approveRefund: ['admin', 'approve-refund'] as const,
    updateSubscription: ['admin', 'update-subscription'] as const,
    moderateReview: ['admin', 'moderate-review'] as const,
  },
} as const;
