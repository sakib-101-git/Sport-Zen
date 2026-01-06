/**
 * API Error Handling
 * Consistent error types and handling for the SportZen API
 */

export interface APIErrorResponse {
  code: string;
  message: string;
  details?: Array<{
    field: string;
    constraints: string[];
  }>;
  correlationId?: string;
}

export class APIError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: APIErrorResponse['details'];
  public readonly correlationId?: string;

  constructor(
    statusCode: number,
    response: APIErrorResponse,
  ) {
    super(response.message);
    this.name = 'APIError';
    this.code = response.code;
    this.statusCode = statusCode;
    this.details = response.details;
    this.correlationId = response.correlationId;
  }

  /**
   * Check if error is a validation error
   */
  isValidationError(): boolean {
    return this.code === 'VALIDATION_ERROR';
  }

  /**
   * Check if error is an authentication error
   */
  isAuthError(): boolean {
    return this.statusCode === 401 || this.code === 'UNAUTHORIZED';
  }

  /**
   * Check if error is a forbidden error
   */
  isForbiddenError(): boolean {
    return this.statusCode === 403 || this.code === 'FORBIDDEN';
  }

  /**
   * Check if error is a not found error
   */
  isNotFoundError(): boolean {
    return this.statusCode === 404 || this.code === 'NOT_FOUND';
  }

  /**
   * Check if error is a conflict error (e.g., slot already booked)
   */
  isConflictError(): boolean {
    return this.statusCode === 409 || this.code === 'CONFLICT';
  }

  /**
   * Get validation errors as a map of field -> error messages
   */
  getValidationErrors(): Record<string, string[]> {
    if (!this.details) return {};

    return this.details.reduce((acc, detail) => {
      acc[detail.field] = detail.constraints;
      return acc;
    }, {} as Record<string, string[]>);
  }

  /**
   * Get first validation error message for a field
   */
  getFieldError(field: string): string | undefined {
    const errors = this.getValidationErrors();
    return errors[field]?.[0];
  }
}

/**
 * Network Error (no response from server)
 */
export class NetworkError extends Error {
  constructor(message: string = 'Network error. Please check your connection.') {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Timeout Error
 */
export class TimeoutError extends Error {
  constructor(message: string = 'Request timed out. Please try again.') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Parse API error response
 */
export async function parseAPIError(response: Response): Promise<APIError> {
  try {
    const data = await response.json();
    return new APIError(response.status, {
      code: data.code || 'UNKNOWN_ERROR',
      message: data.message || 'An unexpected error occurred',
      details: data.details,
      correlationId: data.correlationId,
    });
  } catch {
    return new APIError(response.status, {
      code: 'PARSE_ERROR',
      message: `Request failed with status ${response.status}`,
    });
  }
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof APIError) {
    return error.message;
  }

  if (error instanceof NetworkError) {
    return error.message;
  }

  if (error instanceof TimeoutError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Common error codes and their user-friendly messages
 */
export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Please log in to continue',
  FORBIDDEN: 'You do not have permission to perform this action',
  NOT_FOUND: 'The requested resource was not found',
  VALIDATION_ERROR: 'Please check your input and try again',
  SLOT_ALREADY_BOOKED: 'This time slot has already been booked',
  BOOKING_HOLD_EXPIRED: 'Your booking hold has expired. Please try again.',
  PAYMENT_FAILED: 'Payment failed. Please try again.',
  INSUFFICIENT_BALANCE: 'Insufficient balance to complete this transaction',
  FACILITY_NOT_APPROVED: 'This facility is not available for booking',
  SUBSCRIPTION_INACTIVE: 'Facility subscription is inactive',
  CANCELLATION_NOT_ALLOWED: 'This booking cannot be canceled',
  ALREADY_CHECKED_IN: 'This booking has already been checked in',
  CHECKIN_WINDOW_CLOSED: 'Check-in is not available at this time',
  REVIEW_NOT_ELIGIBLE: 'You are not eligible to review this booking',
  PHONE_ALREADY_LINKED: 'This phone number is already linked to another account',
  OTP_EXPIRED: 'The verification code has expired. Please request a new one.',
  OTP_INVALID: 'Invalid verification code. Please try again.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait and try again.',
};

/**
 * Get error message by code
 */
export function getErrorMessageByCode(code: string): string {
  return ERROR_MESSAGES[code] || 'An unexpected error occurred';
}
