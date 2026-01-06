/**
 * Money formatting utilities for BDT currency
 */

/**
 * Format amount in BDT (Bangladeshi Taka)
 * @param amount - Amount in BDT (integer)
 * @param showSymbol - Whether to show ৳ symbol
 */
export function formatAmount(amount: number, showSymbol = true): string {
  const formatted = new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  return showSymbol ? `৳${formatted}` : formatted;
}

/**
 * Format amount with decimal places
 */
export function formatAmountDecimal(amount: number, showSymbol = true): string {
  const formatted = new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return showSymbol ? `৳${formatted}` : formatted;
}

/**
 * Calculate advance amount (10% of total)
 */
export function calculateAdvance(totalAmount: number): number {
  return Math.ceil(totalAmount * 0.1);
}

/**
 * Calculate remaining amount (90% of total)
 */
export function calculateRemaining(totalAmount: number): number {
  return totalAmount - calculateAdvance(totalAmount);
}

/**
 * Calculate platform commission
 * @param totalAmount - Total booking value
 * @param commissionRate - Commission rate (default 5%)
 */
export function calculateCommission(totalAmount: number, commissionRate = 0.05): number {
  return Math.ceil(totalAmount * commissionRate);
}

/**
 * Calculate owner credit from advance payment
 */
export function calculateOwnerCredit(advanceAmount: number, commissionRate = 0.05): number {
  const totalBookingValue = advanceAmount / 0.1; // Reverse calculate total from advance
  const commission = calculateCommission(totalBookingValue, commissionRate);
  return Math.max(0, advanceAmount - commission);
}
