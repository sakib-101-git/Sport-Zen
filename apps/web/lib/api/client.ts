/**
 * API Client - Typed fetch wrapper for SportZen API
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    correlationId: string;
  };
}

export interface ApiResponse<T> {
  success: true;
  data: T;
}

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: RequestMethod;
  body?: any;
  headers?: Record<string, string>;
  token?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('accessToken', token);
      } else {
        localStorage.removeItem('accessToken');
      }
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken');
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { method = 'GET', body, headers = {}, token } = options;

    const authToken = token || this.getToken();

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    const config: RequestInit = {
      method,
      headers: requestHeaders,
      credentials: 'include',
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    const url = `${this.baseUrl}/api/v1${endpoint}`;

    try {
      const response = await fetch(url, config);

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/pdf') || contentType?.includes('spreadsheet')) {
        if (!response.ok) {
          throw new Error('Failed to download file');
        }
        return response.blob() as any;
      }

      const data = await response.json();

      if (!response.ok) {
        throw data;
      }

      return data;
    } catch (error: any) {
      if (error.error) {
        throw error;
      }
      throw {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error.message || 'Network error occurred',
          correlationId: 'unknown',
        },
      };
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request<ApiResponse<{ accessToken: string; refreshToken: string }>>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  }

  async register(email: string, password: string, name: string, role?: string) {
    return this.request<ApiResponse<{ accessToken: string; refreshToken: string }>>('/auth/register', {
      method: 'POST',
      body: { email, password, name, role },
    });
  }

  async requestOTP(phone: string) {
    return this.request<{ success: boolean; message: string }>('/auth/phone/request-otp', {
      method: 'POST',
      body: { phone },
    });
  }

  async verifyOTP(phone: string, code: string, name?: string) {
    return this.request<ApiResponse<{ accessToken: string; refreshToken: string; isNewUser: boolean }>>('/auth/phone/verify-otp', {
      method: 'POST',
      body: { phone, code, name },
    });
  }

  async refreshToken(refreshToken: string) {
    return this.request<ApiResponse<{ accessToken: string; refreshToken: string }>>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
  }

  async getMe() {
    return this.request<ApiResponse<any>>('/auth/me');
  }

  async logout(refreshToken: string) {
    return this.request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    });
  }

  // Facilities
  async searchFacilities(params: {
    lat?: number;
    lng?: number;
    radiusKm?: number;
    sport?: string;
    minPrice?: number;
    maxPrice?: number;
    rating?: number;
    availableNow?: boolean;
    page?: number;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    return this.request<ApiResponse<any[]>>(`/facilities/nearby?${searchParams}`);
  }

  async getFacility(id: string) {
    return this.request<ApiResponse<any>>(`/facilities/${id}`);
  }

  async getFacilityPlayAreas(facilityId: string) {
    return this.request<ApiResponse<any[]>>(`/facilities/${facilityId}/play-areas`);
  }

  async getFacilityReviews(facilityId: string, page = 1, limit = 10) {
    return this.request<ApiResponse<any[]>>(`/facilities/${facilityId}/reviews?page=${page}&limit=${limit}`);
  }

  // Availability
  async getAvailability(conflictGroupId: string, date: string) {
    return this.request<ApiResponse<any>>(`/availability?conflictGroupId=${conflictGroupId}&date=${date}`);
  }

  // Bookings
  async createHold(data: {
    sportProfileId: string;
    startAt: string;
    durationMinutes: number;
    playerName: string;
    playerPhone: string;
    playerEmail?: string;
  }) {
    return this.request<ApiResponse<any>>('/bookings/hold', {
      method: 'POST',
      body: data,
    });
  }

  async getBooking(id: string) {
    return this.request<ApiResponse<any>>(`/bookings/${id}`);
  }

  async getMyBookings(status?: string, page = 1, limit = 10) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    return this.request<ApiResponse<any[]>>(`/me/bookings?${params}`);
  }

  async cancelBooking(id: string) {
    return this.request<ApiResponse<any>>(`/bookings/${id}/cancel`, { method: 'POST' });
  }

  async getBookingQR(id: string) {
    return this.request<ApiResponse<{ qrToken: string; qrDataUrl: string }>>(`/bookings/${id}/qr`);
  }

  // Payments
  async initiatePayment(bookingId?: string, paymentIntentId?: string) {
    return this.request<ApiResponse<{
      gatewayUrl: string;
      sessionKey: string;
      tranId: string;
      formFields: Record<string, string>;
      redirectMethod: string;
    }>>('/payments/sslcommerz/initiate', {
      method: 'POST',
      body: { bookingId, paymentIntentId },
    });
  }

  async getPaymentStatus(intentId: string) {
    return this.request<ApiResponse<any>>(`/payments/${intentId}/status`);
  }

  // Reviews
  async createReview(bookingId: string, rating: number, comment: string) {
    return this.request<ApiResponse<any>>('/reviews', {
      method: 'POST',
      body: { bookingId, rating, comment },
    });
  }

  async reportReview(reviewId: string, reason: string) {
    return this.request<ApiResponse<any>>(`/reviews/${reviewId}/report`, {
      method: 'POST',
      body: { reason },
    });
  }

  // Owner endpoints
  async getOwnerDashboard() {
    return this.request<ApiResponse<any>>('/owner/dashboard');
  }

  async getOwnerBookings(params: { dateFrom?: string; dateTo?: string; status?: string; page?: number; limit?: number }) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    return this.request<ApiResponse<any[]>>(`/owner/bookings?${searchParams}`);
  }

  async getOwnerCalendar(month: string) {
    return this.request<ApiResponse<any>>(`/owner/calendar?month=${month}`);
  }

  async verifyCheckIn(bookingId: string, qrToken: string) {
    return this.request<ApiResponse<any>>(`/bookings/${bookingId}/checkin`, {
      method: 'POST',
      body: { qrToken },
    });
  }

  async updateOfflinePayment(bookingId: string, data: {
    offlineAmountCollected: number;
    offlinePaymentMethod: string;
  }) {
    return this.request<ApiResponse<any>>(`/owner/bookings/${bookingId}/offline-payment`, {
      method: 'PATCH',
      body: data,
    });
  }

  async getOwnerBlocks(facilityId?: string) {
    const params = facilityId ? `?facilityId=${facilityId}` : '';
    return this.request<ApiResponse<any[]>>(`/owner/blocks${params}`);
  }

  async createBlock(data: {
    playAreaId: string;
    startAt: string;
    endAt: string;
    reason?: string;
  }) {
    return this.request<ApiResponse<any>>('/owner/blocks', {
      method: 'POST',
      body: data,
    });
  }

  async deleteBlock(id: string) {
    return this.request<{ success: boolean }>(`/owner/blocks/${id}`, { method: 'DELETE' });
  }

  async getOwnerFacilities() {
    return this.request<ApiResponse<any[]>>('/owner/facilities');
  }

  async getOwnerFacilityDetail(id: string) {
    return this.request<ApiResponse<any>>(`/owner/facilities/${id}`);
  }

  async updateFacility(id: string, data: any) {
    return this.request<ApiResponse<any>>(`/owner/facilities/${id}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async getOwnerSettlements(month: string) {
    return this.request<ApiResponse<any>>(`/owner/settlements?month=${month}`);
  }

  async exportSettlementsPDF(month: string) {
    return this.request<Blob>(`/owner/exports/settlements.pdf?month=${month}`);
  }

  async exportSettlementsXLSX(month: string) {
    return this.request<Blob>(`/owner/exports/settlements.xlsx?month=${month}`);
  }

  async getOwnerStaff() {
    return this.request<ApiResponse<any[]>>('/owner/staff');
  }

  async createStaff(data: { email: string; name: string; role: string }) {
    return this.request<ApiResponse<any>>('/owner/staff', {
      method: 'POST',
      body: data,
    });
  }

  async updateStaffRole(id: string, role: string) {
    return this.request<ApiResponse<any>>(`/owner/staff/${id}/role`, {
      method: 'PATCH',
      body: { role },
    });
  }

  // Admin endpoints
  async getAdminDashboard() {
    return this.request<ApiResponse<any>>('/admin/dashboard');
  }

  async getFacilityApprovals() {
    return this.request<ApiResponse<any[]>>('/admin/facility-approvals');
  }

  async approveFacility(id: string) {
    return this.request<ApiResponse<any>>(`/admin/facility-approvals/${id}/approve`, { method: 'POST' });
  }

  async rejectFacility(id: string, reason: string) {
    return this.request<ApiResponse<any>>(`/admin/facility-approvals/${id}/reject`, {
      method: 'POST',
      body: { reason },
    });
  }

  async getAdminRefunds() {
    return this.request<ApiResponse<any[]>>('/admin/refunds');
  }

  async approveRefund(id: string) {
    return this.request<ApiResponse<any>>(`/admin/refunds/${id}/approve`, { method: 'POST' });
  }

  async markRefundComplete(id: string, referenceId: string) {
    return this.request<ApiResponse<any>>(`/admin/refunds/${id}/mark-manual-complete`, {
      method: 'POST',
      body: { referenceId },
    });
  }

  async getAdminSubscriptions() {
    return this.request<ApiResponse<any[]>>('/admin/subscriptions');
  }

  async updateSubscriptionStatus(ownerId: string, status: string) {
    return this.request<ApiResponse<any>>(`/admin/subscriptions/${ownerId}/status`, {
      method: 'PATCH',
      body: { status },
    });
  }

  async getAdminDisputes() {
    return this.request<ApiResponse<any[]>>('/admin/disputes');
  }

  async getAdminReviews() {
    return this.request<ApiResponse<any[]>>('/admin/reviews');
  }

  async moderateReview(id: string, action: 'hide' | 'restore') {
    return this.request<ApiResponse<any>>(`/admin/reviews/${id}/moderate`, {
      method: 'PATCH',
      body: { action },
    });
  }
}

export const api = new ApiClient(API_URL);
export default api;
