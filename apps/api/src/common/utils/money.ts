/**
 * Money utilities for Sport Zen
 * All monetary values are stored as integers in whole BDT
 * No fractional amounts - Bangladesh uses whole Taka for practical purposes
 */

export const CURRENCY = 'BDT';
export const ADVANCE_PERCENTAGE = 0.10; // 10%
export const DEFAULT_PLATFORM_COMMISSION_RATE = 0.05; // 5% of total booking value
export const PLATFORM_PROCESSING_FEE = 50; // Fixed fee in BDT for refund processing

/**
 * Calculate advance amount (10% of total)
 * Uses CEIL for deterministic rounding (favor platform)
 */
export function calculateAdvanceAmount(totalAmount: number): number {
  return Math.ceil(totalAmount * ADVANCE_PERCENTAGE);
}

/**
 * Calculate platform commission
 * Commission is X% of TOTAL booking value (not advance)
 * Uses CEIL for deterministic rounding
 */
export function calculatePlatformCommission(
  totalAmount: number,
  commissionRate: number = DEFAULT_PLATFORM_COMMISSION_RATE,
): number {
  const commission = Math.ceil(totalAmount * commissionRate);
  // Commission cannot exceed advance amount
  const advance = calculateAdvanceAmount(totalAmount);
  return Math.min(commission, advance);
}

/**
 * Calculate owner advance credit
 * owner_advance_credit = advance_amount - platform_commission
 */
export function calculateOwnerAdvanceCredit(
  advanceAmount: number,
  platformCommission: number,
): number {
  return Math.max(0, advanceAmount - platformCommission);
}

/**
 * Calculate remaining amount (paid offline)
 */
export function calculateRemainingAmount(totalAmount: number, advanceAmount: number): number {
  return totalAmount - advanceAmount;
}

/**
 * Calculate refund amount based on cancellation tier
 * Uses deterministic rounding (CEIL for %, FLOOR for split)
 */
export function calculateRefundAmount(
  advanceAmount: number,
  tier: '>24h' | '24h-6h' | '<6h',
  processingFee: number = PLATFORM_PROCESSING_FEE,
): { refundAmount: number; platformFeeRetained: number } {
  let refundAmount: number;
  let platformFeeRetained: number;

  switch (tier) {
    case '>24h':
      // Full advance minus processing fee
      refundAmount = Math.max(0, advanceAmount - processingFee);
      platformFeeRetained = processingFee;
      break;

    case '24h-6h':
      // 50% of advance minus processing fee
      // Use FLOOR for the 50% calculation (favor platform)
      const halfAdvance = Math.floor(advanceAmount * 0.5);
      refundAmount = Math.max(0, halfAdvance - processingFee);
      platformFeeRetained = advanceAmount - refundAmount;
      break;

    case '<6h':
      // No refund
      refundAmount = 0;
      platformFeeRetained = advanceAmount;
      break;
  }

  return { refundAmount, platformFeeRetained };
}

/**
 * Get price from duration-based pricing map
 * Returns null if duration is not allowed
 */
export function getPriceForDuration(
  durationPrices: Record<string, number>,
  durationMinutes: number,
): number | null {
  const price = durationPrices[durationMinutes.toString()];
  return price !== undefined ? price : null;
}

/**
 * Validate duration is allowed
 */
export function isValidDuration(
  allowedDurations: number[],
  durationMinutes: number,
): boolean {
  return allowedDurations.includes(durationMinutes);
}

/**
 * Calculate total booking price
 */
export function calculateBookingPrice(
  durationPrices: Record<string, number>,
  peakDurationPrices: Record<string, number> | null,
  durationMinutes: number,
  isPeak: boolean,
): number | null {
  const prices = isPeak && peakDurationPrices ? peakDurationPrices : durationPrices;
  return getPriceForDuration(prices, durationMinutes);
}

/**
 * Calculate all booking amounts
 */
export interface BookingPricing {
  totalAmount: number;
  advanceAmount: number;
  platformCommission: number;
  ownerAdvanceCredit: number;
  remainingAmount: number;
}

export function calculateBookingPricing(
  totalAmount: number,
  commissionRate: number = DEFAULT_PLATFORM_COMMISSION_RATE,
): BookingPricing {
  const advanceAmount = calculateAdvanceAmount(totalAmount);
  const platformCommission = calculatePlatformCommission(totalAmount, commissionRate);
  const ownerAdvanceCredit = calculateOwnerAdvanceCredit(advanceAmount, platformCommission);
  const remainingAmount = calculateRemainingAmount(totalAmount, advanceAmount);

  return {
    totalAmount,
    advanceAmount,
    platformCommission,
    ownerAdvanceCredit,
    remainingAmount,
  };
}

/**
 * Format amount for display
 */
export function formatAmount(amount: number): string {
  return `৳${amount.toLocaleString('en-BD')}`;
}

/**
 * Format amount with currency code
 */
export function formatAmountWithCode(amount: number): string {
  return `BDT ${amount.toLocaleString('en-BD')}`;
}

/**
 * Validate amount is a positive integer
 */
export function isValidAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0;
}

/**
 * Parse amount from string (removes formatting)
 */
export function parseAmount(amountStr: string): number | null {
  const cleaned = amountStr.replace(/[৳,\s]/g, '');
  const amount = parseInt(cleaned, 10);
  return isNaN(amount) ? null : amount;
}
