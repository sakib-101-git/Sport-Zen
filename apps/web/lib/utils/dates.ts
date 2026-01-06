/**
 * Date utilities for SportZen
 * All dates are stored in UTC but displayed in Asia/Dhaka timezone
 */

import { format, formatDistance, parseISO, addDays, startOfDay, endOfDay, isSameDay, isToday, isTomorrow, isPast, isFuture, differenceInMinutes, differenceInHours } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const TIMEZONE = 'Asia/Dhaka';

/**
 * Convert UTC date to Dhaka timezone for display
 */
export function toLocalTime(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(d, TIMEZONE);
}

/**
 * Convert local Dhaka time to UTC for storage
 */
export function toUTC(date: Date): Date {
  return fromZonedTime(date, TIMEZONE);
}

/**
 * Format date for display (e.g., "Mon, Jan 15, 2024")
 */
export function formatDate(date: Date | string): string {
  const local = toLocalTime(date);
  return format(local, 'EEE, MMM d, yyyy');
}

/**
 * Format date short (e.g., "Jan 15")
 */
export function formatDateShort(date: Date | string): string {
  const local = toLocalTime(date);
  return format(local, 'MMM d');
}

/**
 * Format time (e.g., "4:00 PM")
 */
export function formatTime(date: Date | string): string {
  const local = toLocalTime(date);
  return format(local, 'h:mm a');
}

/**
 * Format time range (e.g., "4:00 PM - 5:30 PM")
 */
export function formatTimeRange(start: Date | string, end: Date | string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

/**
 * Format full datetime (e.g., "Mon, Jan 15, 2024 at 4:00 PM")
 */
export function formatDateTime(date: Date | string): string {
  const local = toLocalTime(date);
  return format(local, "EEE, MMM d, yyyy 'at' h:mm a");
}

/**
 * Format relative time (e.g., "in 2 hours", "3 days ago")
 */
export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistance(d, new Date(), { addSuffix: true });
}

/**
 * Get friendly date label (Today, Tomorrow, or formatted date)
 */
export function getDateLabel(date: Date | string): string {
  const local = toLocalTime(date);
  if (isToday(local)) return 'Today';
  if (isTomorrow(local)) return 'Tomorrow';
  return format(local, 'EEE, MMM d');
}

/**
 * Generate date range for availability calendar (next N days)
 */
export function getDateRange(days: number = 14): Date[] {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, i) => addDays(today, i));
}

/**
 * Check if booking can be cancelled (more than 6 hours before start)
 */
export function canCancel(startAt: Date | string): boolean {
  const start = typeof startAt === 'string' ? parseISO(startAt) : startAt;
  return differenceInHours(start, new Date()) > 6;
}

/**
 * Get cancellation refund tier
 * @returns 'full' | 'half' | 'none'
 */
export function getCancellationTier(startAt: Date | string): 'full' | 'half' | 'none' {
  const start = typeof startAt === 'string' ? parseISO(startAt) : startAt;
  const hoursUntil = differenceInHours(start, new Date());

  if (hoursUntil > 24) return 'full';
  if (hoursUntil > 6) return 'half';
  return 'none';
}

/**
 * Get cancellation refund description
 */
export function getCancellationPolicy(startAt: Date | string): string {
  const tier = getCancellationTier(startAt);
  switch (tier) {
    case 'full':
      return 'Full refund (minus processing fee)';
    case 'half':
      return '50% refund (minus processing fee)';
    case 'none':
      return 'No refund available';
  }
}

/**
 * Check if check-in window is open (30 min before to 30 min after end)
 */
export function isCheckInWindowOpen(startAt: Date | string, endAt: Date | string): boolean {
  const start = typeof startAt === 'string' ? parseISO(startAt) : startAt;
  const end = typeof endAt === 'string' ? parseISO(endAt) : endAt;
  const now = new Date();

  const windowStart = new Date(start.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(end.getTime() + 30 * 60 * 1000);

  return now >= windowStart && now <= windowEnd;
}

/**
 * Format month for API (YYYY-MM)
 */
export function formatMonth(date: Date): string {
  return format(date, 'yyyy-MM');
}

/**
 * Parse month string to date
 */
export function parseMonth(month: string): Date {
  return parseISO(`${month}-01`);
}

/**
 * Get month name (e.g., "January 2024")
 */
export function getMonthName(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMMM yyyy');
}
