import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CancellationTier, CancellationPolicyResult } from './cancellation.policy';

/**
 * Refund Calculation Result
 */
export interface RefundCalculation {
  advanceAmount: number;
  refundableAmount: number;
  platformProcessingFee: number;
  netRefundAmount: number;
  tier: CancellationTier;
  refundPercentage: number;
}

/**
 * Refund Status
 */
export enum RefundStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  PROCESSING = 'PROCESSING',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
  MANUAL_REQUIRED = 'MANUAL_REQUIRED',
  REJECTED = 'REJECTED',
}

/**
 * Refund Method
 */
export enum RefundMethod {
  ORIGINAL_PAYMENT = 'ORIGINAL_PAYMENT',
  WALLET = 'WALLET',
  BANK_TRANSFER = 'BANK_TRANSFER',
  MANUAL = 'MANUAL',
}

@Injectable()
export class RefundPolicy {
  private readonly logger = new Logger(RefundPolicy.name);
  private readonly platformProcessingFee: number;

  constructor(private readonly configService: ConfigService) {
    this.platformProcessingFee = this.configService.get<number>(
      'platform.processingFee',
      0,
    );
  }

  /**
   * Calculate the refund amount based on cancellation policy
   * Uses CEIL for any rounding to favor the customer slightly
   */
  calculateRefund(
    advanceAmount: number,
    cancellationResult: CancellationPolicyResult,
  ): RefundCalculation {
    const { tier, refundPercentage } = cancellationResult;

    // Calculate base refundable amount
    // Using Math.ceil to favor customer in case of fractional amounts
    const refundableAmount = Math.ceil(advanceAmount * refundPercentage);

    // Apply processing fee (only if there's a refund)
    const processingFee = refundableAmount > 0 ? this.platformProcessingFee : 0;

    // Net refund is refundable amount minus processing fee
    // Ensure it doesn't go below 0
    const netRefundAmount = Math.max(0, refundableAmount - processingFee);

    this.logger.debug({
      message: 'Refund calculated',
      advanceAmount,
      tier,
      refundPercentage,
      refundableAmount,
      processingFee,
      netRefundAmount,
    });

    return {
      advanceAmount,
      refundableAmount,
      platformProcessingFee: processingFee,
      netRefundAmount,
      tier,
      refundPercentage,
    };
  }

  /**
   * Calculate refund for a late webhook conflict
   * Full refund of the payment amount (minus any applicable fees)
   */
  calculateLateWebhookRefund(paymentAmount: number): RefundCalculation {
    const netRefundAmount = Math.max(0, paymentAmount - this.platformProcessingFee);

    return {
      advanceAmount: paymentAmount,
      refundableAmount: paymentAmount,
      platformProcessingFee: this.platformProcessingFee,
      netRefundAmount,
      tier: CancellationTier.FULL_REFUND,
      refundPercentage: 1.0,
    };
  }

  /**
   * Check if a refund requires manual processing
   * Returns true for edge cases that need admin intervention
   */
  requiresManualProcessing(refundCalculation: RefundCalculation): boolean {
    // Example conditions that might require manual processing:
    // - Very large refunds
    // - Refunds after a certain time period
    // - Specific payment methods that don't support automatic refunds

    const manualThreshold = 10000; // BDT - configurable
    return refundCalculation.netRefundAmount > manualThreshold;
  }

  /**
   * Get the appropriate refund method based on original payment
   */
  getRefundMethod(originalPaymentMethod: string): RefundMethod {
    // SSLCommerz supports refunds to original payment method
    const supportedMethods = ['CARD', 'BKASH', 'NAGAD', 'ROCKET'];

    if (supportedMethods.includes(originalPaymentMethod.toUpperCase())) {
      return RefundMethod.ORIGINAL_PAYMENT;
    }

    // For unsupported methods, require manual processing
    return RefundMethod.MANUAL;
  }

  /**
   * Validate refund amount
   */
  validateRefundAmount(
    requestedAmount: number,
    calculatedRefund: RefundCalculation,
  ): boolean {
    // Allow a small tolerance for rounding differences
    const tolerance = 1; // BDT
    return Math.abs(requestedAmount - calculatedRefund.netRefundAmount) <= tolerance;
  }

  /**
   * Get processing fee (for transparency in UI)
   */
  getProcessingFee(): number {
    return this.platformProcessingFee;
  }
}
