/**
 * API Routes Configuration
 * Centralized endpoint definitions for the SportZen API
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const API_ROUTES = {
  // Auth
  auth: {
    register: `${API_BASE_URL}/auth/register`,
    login: `${API_BASE_URL}/auth/login`,
    logout: `${API_BASE_URL}/auth/logout`,
    refresh: `${API_BASE_URL}/auth/refresh`,
    me: `${API_BASE_URL}/auth/me`,
    requestOtp: `${API_BASE_URL}/auth/phone/request-otp`,
    verifyOtp: `${API_BASE_URL}/auth/phone/verify-otp`,
    linkPhone: `${API_BASE_URL}/auth/link-phone`,
  },

  // Facilities
  facilities: {
    nearby: `${API_BASE_URL}/facilities/nearby`,
    detail: (id: string) => `${API_BASE_URL}/facilities/${id}`,
    playAreas: (id: string) => `${API_BASE_URL}/facilities/${id}/play-areas`,
    reviews: (id: string) => `${API_BASE_URL}/facilities/${id}/reviews`,
    search: `${API_BASE_URL}/facilities/search`,
  },

  // Availability
  availability: {
    slots: `${API_BASE_URL}/availability`,
    check: `${API_BASE_URL}/availability/check`,
  },

  // Bookings
  bookings: {
    hold: `${API_BASE_URL}/bookings/hold`,
    list: `${API_BASE_URL}/me/bookings`,
    detail: (id: string) => `${API_BASE_URL}/bookings/${id}`,
    cancel: (id: string) => `${API_BASE_URL}/bookings/${id}/cancel`,
    qr: (id: string) => `${API_BASE_URL}/bookings/${id}/qr`,
    checkIn: (id: string) => `${API_BASE_URL}/bookings/${id}/checkin`,
  },

  // Payments
  payments: {
    initiate: `${API_BASE_URL}/payments/sslcommerz/initiate`,
    status: (intentId: string) => `${API_BASE_URL}/payments/${intentId}/status`,
    webhook: `${API_BASE_URL}/payments/sslcommerz/webhook`,
    simulateSuccess: `${API_BASE_URL}/payments/dev/simulate-success`, // DEV ONLY
  },

  // Reviews
  reviews: {
    create: `${API_BASE_URL}/reviews`,
    report: (id: string) => `${API_BASE_URL}/reviews/${id}/report`,
  },

  // Owner
  owner: {
    dashboard: `${API_BASE_URL}/owner/dashboard`,
    bookings: `${API_BASE_URL}/owner/bookings`,
    calendar: `${API_BASE_URL}/owner/calendar`,
    blocks: `${API_BASE_URL}/owner/blocks`,
    deleteBlock: (id: string) => `${API_BASE_URL}/owner/blocks/${id}`,
    facilities: `${API_BASE_URL}/owner/facilities`,
    facilityDetail: (id: string) => `${API_BASE_URL}/owner/facilities/${id}`,
    facilityPhotos: (id: string) => `${API_BASE_URL}/owner/facilities/${id}/photos`,
    offlinePayment: (bookingId: string) => `${API_BASE_URL}/owner/bookings/${bookingId}/offline-payment`,
    verifyCheckIn: (bookingId: string) => `${API_BASE_URL}/owner/bookings/${bookingId}/verify-checkin`,
    settlements: `${API_BASE_URL}/owner/settlements`,
    exportSettlementsPDF: `${API_BASE_URL}/owner/exports/settlements.pdf`,
    exportSettlementsXLSX: `${API_BASE_URL}/owner/exports/settlements.xlsx`,
    staff: `${API_BASE_URL}/owner/staff`,
    staffRole: (id: string) => `${API_BASE_URL}/owner/staff/${id}/role`,
  },

  // Admin
  admin: {
    dashboard: `${API_BASE_URL}/admin/dashboard`,
    facilityApprovals: `${API_BASE_URL}/admin/facility-approvals`,
    approveFacility: (id: string) => `${API_BASE_URL}/admin/facility-approvals/${id}/approve`,
    rejectFacility: (id: string) => `${API_BASE_URL}/admin/facility-approvals/${id}/reject`,
    disputes: `${API_BASE_URL}/admin/disputes`,
    refunds: `${API_BASE_URL}/admin/refunds`,
    approveRefund: (id: string) => `${API_BASE_URL}/admin/refunds/${id}/approve`,
    markRefundComplete: (id: string) => `${API_BASE_URL}/admin/refunds/${id}/mark-manual-complete`,
    subscriptions: `${API_BASE_URL}/admin/subscriptions`,
    updateSubscription: (ownerId: string) => `${API_BASE_URL}/admin/subscriptions/${ownerId}/status`,
    reviews: `${API_BASE_URL}/admin/reviews`,
    moderateReview: (id: string) => `${API_BASE_URL}/admin/reviews/${id}/moderate`,
  },

  // Health
  health: {
    check: `${API_BASE_URL}/health`,
    ready: `${API_BASE_URL}/ready`,
  },
} as const;

/**
 * Build query string from params object
 */
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParams.append(key, String(v)));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Build URL with query params
 */
export function buildUrl(baseUrl: string, params?: Record<string, any>): string {
  if (!params) return baseUrl;
  return `${baseUrl}${buildQueryString(params)}`;
}
