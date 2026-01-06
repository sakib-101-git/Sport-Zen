/**
 * Time utilities for Sport Zen
 * All DB storage is UTC (timestamptz)
 * Display and business logic uses Asia/Dhaka timezone
 */

import {
  format,
  addMinutes,
  differenceInMinutes,
  differenceInHours,
  startOfDay,
  endOfDay,
  parseISO,
  isAfter,
  isBefore,
  addDays,
  setHours,
  setMinutes,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export const DHAKA_TIMEZONE = 'Asia/Dhaka';
export const DEFAULT_BUFFER_MINUTES = 10;
export const DEFAULT_SLOT_INTERVAL_MINUTES = 30;
export const HOLD_EXPIRY_MINUTES = 10;

/**
 * Convert UTC Date to Dhaka timezone
 */
export function toDhaka(date: Date): Date {
  return toZonedTime(date, DHAKA_TIMEZONE);
}

/**
 * Convert Dhaka local time to UTC
 */
export function fromDhaka(date: Date): Date {
  return fromZonedTime(date, DHAKA_TIMEZONE);
}

/**
 * Format date in Dhaka timezone
 */
export function formatDhaka(date: Date, formatStr: string): string {
  const dhakaDate = toDhaka(date);
  return format(dhakaDate, formatStr);
}

/**
 * Get current time in Dhaka
 */
export function nowInDhaka(): Date {
  return toDhaka(new Date());
}

/**
 * Get start of day in Dhaka timezone, converted to UTC
 */
export function startOfDayDhaka(date: Date): Date {
  const dhakaDate = toDhaka(date);
  const startDhaka = startOfDay(dhakaDate);
  return fromDhaka(startDhaka);
}

/**
 * Get end of day in Dhaka timezone, converted to UTC
 */
export function endOfDayDhaka(date: Date): Date {
  const dhakaDate = toDhaka(date);
  const endDhaka = endOfDay(dhakaDate);
  return fromDhaka(endDhaka);
}

/**
 * Parse time string (HH:mm) on a specific date in Dhaka timezone
 * Returns UTC Date
 */
export function parseTimeOnDate(timeStr: string, date: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const dhakaDate = toDhaka(date);
  let result = setHours(dhakaDate, hours);
  result = setMinutes(result, minutes);
  return fromDhaka(result);
}

/**
 * Calculate blocked end time (end + buffer)
 * Used for DB exclusion constraint
 */
export function calculateBlockedEndAt(endAt: Date, bufferMinutes: number = DEFAULT_BUFFER_MINUTES): Date {
  return addMinutes(endAt, bufferMinutes);
}

/**
 * Calculate hold expiry time
 */
export function calculateHoldExpiresAt(createdAt: Date = new Date()): Date {
  return addMinutes(createdAt, HOLD_EXPIRY_MINUTES);
}

/**
 * Get cancellation tier based on hours until start
 * Uses Dhaka timezone for calculation
 */
export function getCancellationTier(
  startAt: Date,
  cancelAt: Date = new Date(),
): '>24h' | '24h-6h' | '<6h' {
  const hoursUntilStart = differenceInHours(startAt, cancelAt);

  if (hoursUntilStart > 24) {
    return '>24h';
  } else if (hoursUntilStart >= 6) {
    return '24h-6h';
  } else {
    return '<6h';
  }
}

/**
 * Check if time is within check-in window
 * Window: 30 minutes before start to 30 minutes after end
 */
export function isWithinCheckinWindow(
  startAt: Date,
  endAt: Date,
  checkTime: Date = new Date(),
): boolean {
  const windowStart = addMinutes(startAt, -30);
  const windowEnd = addMinutes(endAt, 30);

  return isAfter(checkTime, windowStart) && isBefore(checkTime, windowEnd);
}

/**
 * Generate time slots for a day
 * Returns array of start times based on interval
 */
export function generateTimeSlots(
  date: Date,
  openingTime: string, // HH:mm
  closingTime: string, // HH:mm
  intervalMinutes: number = DEFAULT_SLOT_INTERVAL_MINUTES,
): Date[] {
  const slots: Date[] = [];
  const startTime = parseTimeOnDate(openingTime, date);
  const endTime = parseTimeOnDate(closingTime, date);

  let current = startTime;
  while (isBefore(current, endTime)) {
    slots.push(current);
    current = addMinutes(current, intervalMinutes);
  }

  return slots;
}

/**
 * Check if a booking time overlaps with peak pricing rules
 * Any overlap means peak pricing applies (MVP rule)
 */
export function checkPeakOverlap(
  startAt: Date,
  endAt: Date,
  peakRules: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>,
): boolean {
  const dhakaStart = toDhaka(startAt);
  const dhakaEnd = toDhaka(endAt);
  const dayOfWeek = dhakaStart.getDay();

  const matchingRules = peakRules.filter((rule) => rule.dayOfWeek === dayOfWeek);

  for (const rule of matchingRules) {
    const peakStart = parseTimeOnDate(rule.startTime, startAt);
    const peakEnd = parseTimeOnDate(rule.endTime, startAt);

    // Check for any overlap
    // Overlap exists if: startAt < peakEnd AND endAt > peakStart
    if (isBefore(startAt, peakEnd) && isAfter(endAt, peakStart)) {
      return true;
    }
  }

  return false;
}

/**
 * Get available booking dates (from tomorrow to maxAdvanceDays)
 */
export function getAvailableBookingDates(maxAdvanceDays: number = 14): Date[] {
  const dates: Date[] = [];
  const now = new Date();

  for (let i = 0; i <= maxAdvanceDays; i++) {
    dates.push(startOfDayDhaka(addDays(now, i)));
  }

  return dates;
}

/**
 * Check if a slot time respects minimum lead time
 */
export function respectsLeadTime(
  slotStart: Date,
  minLeadTimeMinutes: number,
  now: Date = new Date(),
): boolean {
  const minStart = addMinutes(now, minLeadTimeMinutes);
  return isAfter(slotStart, minStart) || slotStart.getTime() === minStart.getTime();
}

/**
 * Format booking time range for display
 */
export function formatBookingTimeRange(startAt: Date, endAt: Date): string {
  const startStr = formatDhaka(startAt, 'h:mm a');
  const endStr = formatDhaka(endAt, 'h:mm a');
  const dateStr = formatDhaka(startAt, 'EEE, MMM d, yyyy');
  return `${dateStr} | ${startStr} - ${endStr}`;
}

/**
 * ISO string helpers
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

export function fromISOString(isoString: string): Date {
  return parseISO(isoString);
}
