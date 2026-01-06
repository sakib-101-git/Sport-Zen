import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, canBeCanceled } from '../booking.state';

/**
 * Cancellation Tier
 * Based on time remaining until booking start (Asia/Dhaka timezone)
 */
export enum CancellationTier {
  FULL_REFUND = 'FULL_REFUND',         // >24 hours before
  PARTIAL_REFUND = 'PARTIAL_REFUND',   // 6-24 hours before
  NO_REFUND = 'NO_REFUND',             // <6 hours before
}

/**
 * Cancellation Policy Result
 */
export interface CancellationPolicyResult {
  canCancel: boolean;
  tier: CancellationTier;
  refundPercentage: number;
  hoursUntilStart: number;
  reason?: string;
}

/**
 * Cancellation Details for a booking
 */
export interface CancellationDetails {
  bookingId: string;
  status: BookingStatus;
  startAt: Date;
  advanceAmount: number;
}

@Injectable()
export class CancellationPolicy {
  private readonly logger = new Logger(CancellationPolicy.name);
  private readonly timezone: string;

  // Tier thresholds in hours
  private readonly fullRefundThresholdHours = 24;
  private readonly partialRefundThresholdHours = 6;

  constructor(private readonly configService: ConfigService) {
    this.timezone = this.configService.get<string>('platform.timezone', 'Asia/Dhaka');
  }

  /**
   * Calculate hours until booking start in the configured timezone
   */
  private calculateHoursUntilStart(startAt: Date, now: Date = new Date()): number {
    const diffMs = startAt.getTime() - now.getTime();
    return diffMs / (1000 * 60 * 60);
  }

  /**
   * Determine the cancellation tier based on time until start
   */
  private determineTier(hoursUntilStart: number): CancellationTier {
    if (hoursUntilStart > this.fullRefundThresholdHours) {
      return CancellationTier.FULL_REFUND;
    }
    if (hoursUntilStart >= this.partialRefundThresholdHours) {
      return CancellationTier.PARTIAL_REFUND;
    }
    return CancellationTier.NO_REFUND;
  }

  /**
   * Get refund percentage for a tier
   * Returns value between 0 and 1
   */
  private getRefundPercentage(tier: CancellationTier): number {
    switch (tier) {
      case CancellationTier.FULL_REFUND:
        return 1.0; // 100% refund (minus processing fee)
      case CancellationTier.PARTIAL_REFUND:
        return 0.5; // 50% refund (minus processing fee)
      case CancellationTier.NO_REFUND:
        return 0; // No refund
      default:
        return 0;
    }
  }

  /**
   * Evaluate cancellation policy for a booking
   */
  evaluatePolicy(details: CancellationDetails, now: Date = new Date()): CancellationPolicyResult {
    const { bookingId, status, startAt } = details;

    // Check if booking can be canceled based on status
    if (!canBeCanceled(status)) {
      this.logger.debug(
        `Booking ${bookingId} cannot be canceled: status is ${status}`,
      );
      return {
        canCancel: false,
        tier: CancellationTier.NO_REFUND,
        refundPercentage: 0,
        hoursUntilStart: 0,
        reason: `Booking with status ${status} cannot be canceled`,
      };
    }

    // Check if booking has already started
    const hoursUntilStart = this.calculateHoursUntilStart(startAt, now);
    if (hoursUntilStart < 0) {
      this.logger.debug(`Booking ${bookingId} has already started`);
      return {
        canCancel: false,
        tier: CancellationTier.NO_REFUND,
        refundPercentage: 0,
        hoursUntilStart,
        reason: 'Booking has already started or completed',
      };
    }

    // Determine tier and refund percentage
    const tier = this.determineTier(hoursUntilStart);
    const refundPercentage = this.getRefundPercentage(tier);

    this.logger.debug(
      `Booking ${bookingId} cancellation tier: ${tier}, refund: ${refundPercentage * 100}%`,
    );

    return {
      canCancel: true,
      tier,
      refundPercentage,
      hoursUntilStart,
    };
  }

  /**
   * Validate that a booking can be canceled
   * Throws if cancellation is not allowed
   */
  validateCancellation(details: CancellationDetails): CancellationPolicyResult {
    const result = this.evaluatePolicy(details);

    if (!result.canCancel) {
      throw new BadRequestException({
        code: 'CANCELLATION_NOT_ALLOWED',
        message: result.reason || 'This booking cannot be canceled',
      });
    }

    return result;
  }

  /**
   * Get human-readable description of the cancellation policy
   */
  getPolicyDescription(): string {
    return `
Cancellation Policy:
- More than 24 hours before booking: Full refund (minus processing fee)
- 6-24 hours before booking: 50% refund (minus processing fee)
- Less than 6 hours before booking: No refund
    `.trim();
  }
}
