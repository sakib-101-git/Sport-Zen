import { BadRequestException, Logger } from '@nestjs/common';

/**
 * Booking Status Enum
 * Represents the lifecycle of a booking
 */
export enum BookingStatus {
  HOLD = 'HOLD',           // Pending payment, temporary hold
  CONFIRMED = 'CONFIRMED', // Payment verified, booking active
  CANCELED = 'CANCELED',   // Canceled by user or system
  COMPLETED = 'COMPLETED', // Booking time has passed
  EXPIRED = 'EXPIRED',     // Hold expired without payment
}

/**
 * Payment Stage Enum
 * Tracks the payment collection status
 */
export enum PaymentStage {
  NOT_PAID = 'NOT_PAID',
  ADVANCE_PAID = 'ADVANCE_PAID',
  PARTIAL_OFFLINE = 'PARTIAL_OFFLINE',
  FULL_PAID_OFFLINE = 'FULL_PAID_OFFLINE',
}

/**
 * Check-in Status Enum
 */
export enum CheckinStatus {
  NOT_CHECKED_IN = 'NOT_CHECKED_IN',
  VERIFIED = 'VERIFIED',
}

/**
 * Valid state transitions for bookings
 */
const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.HOLD]: [
    BookingStatus.CONFIRMED,
    BookingStatus.EXPIRED,
    BookingStatus.CANCELED,
  ],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.COMPLETED,
    BookingStatus.CANCELED,
  ],
  [BookingStatus.CANCELED]: [], // Terminal state
  [BookingStatus.COMPLETED]: [], // Terminal state
  [BookingStatus.EXPIRED]: [
    // Special case: late webhook success can move EXPIRED to CONFIRMED
    // if no conflict exists (handled specially in payment confirmation)
    BookingStatus.CONFIRMED,
  ],
};

/**
 * Check if a state transition is valid
 */
export function isValidTransition(from: BookingStatus, to: BookingStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Validate and perform a state transition
 * Throws if the transition is invalid
 */
export function validateTransition(
  bookingId: string,
  from: BookingStatus,
  to: BookingStatus,
): void {
  if (!isValidTransition(from, to)) {
    throw new BadRequestException({
      code: 'INVALID_STATE_TRANSITION',
      message: `Cannot transition booking ${bookingId} from ${from} to ${to}`,
    });
  }
}

/**
 * Get the next valid states for a booking
 */
export function getNextValidStates(currentStatus: BookingStatus): BookingStatus[] {
  return VALID_TRANSITIONS[currentStatus] ?? [];
}

/**
 * Check if a booking can be canceled
 */
export function canBeCanceled(status: BookingStatus): boolean {
  return [BookingStatus.HOLD, BookingStatus.CONFIRMED].includes(status);
}

/**
 * Check if a booking is in a terminal state
 */
export function isTerminalState(status: BookingStatus): boolean {
  return [
    BookingStatus.CANCELED,
    BookingStatus.COMPLETED,
    BookingStatus.EXPIRED,
  ].includes(status);
}

/**
 * Check if a booking can be confirmed (from HOLD or late EXPIRED)
 */
export function canBeConfirmed(status: BookingStatus): boolean {
  return [BookingStatus.HOLD, BookingStatus.EXPIRED].includes(status);
}

/**
 * Check if a booking can accept check-in
 */
export function canCheckIn(status: BookingStatus): boolean {
  return status === BookingStatus.CONFIRMED;
}

/**
 * Check if a booking can receive offline payment
 */
export function canReceiveOfflinePayment(status: BookingStatus): boolean {
  return [BookingStatus.CONFIRMED, BookingStatus.COMPLETED].includes(status);
}

/**
 * Booking State Machine Logger
 */
export class BookingStateMachine {
  private readonly logger = new Logger(BookingStateMachine.name);

  /**
   * Log a state transition
   */
  logTransition(
    bookingId: string,
    from: BookingStatus,
    to: BookingStatus,
    reason?: string,
  ): void {
    this.logger.log({
      event: 'state_transition',
      bookingId,
      from,
      to,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Perform a transition with logging and validation
   */
  transition(
    bookingId: string,
    from: BookingStatus,
    to: BookingStatus,
    reason?: string,
  ): void {
    validateTransition(bookingId, from, to);
    this.logTransition(bookingId, from, to, reason);
  }
}

// Export a singleton instance
export const bookingStateMachine = new BookingStateMachine();
