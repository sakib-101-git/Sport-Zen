import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import {
  generateTimeSlots,
  calculateBlockedEndAt,
  respectsLeadTime,
  checkPeakOverlap,
  toDhaka,
  startOfDayDhaka,
  endOfDayDhaka,
} from '../../common/utils/time';
import { addMinutes, isBefore, isAfter } from 'date-fns';

export interface SlotStatus {
  startAt: Date;
  endAt: Date;
  blockedEndAt: Date;
  status: 'available' | 'booked' | 'blocked' | 'disabled' | 'buffer';
  isPeak: boolean;
  price: number | null;
  bookingId?: string;
  blockId?: string;
}

export interface AvailabilityGrid {
  date: Date;
  conflictGroupId: string;
  sportProfileId: string;
  allowedDurations: number[];
  slots: Record<number, SlotStatus[]>; // keyed by duration
}

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get availability grid for a conflict group on a specific date
   * Returns slots for all allowed durations
   */
  async getAvailabilityGrid(
    conflictGroupId: string,
    sportProfileId: string,
    date: Date,
  ): Promise<AvailabilityGrid> {
    // Get sport profile with peak rules
    const sportProfile = await this.prisma.sportProfile.findUnique({
      where: { id: sportProfileId },
      include: {
        playArea: {
          include: {
            facility: true,
          },
        },
        peakRules: {
          where: { isActive: true },
        },
      },
    });

    if (!sportProfile) {
      throw new Error('Sport profile not found');
    }

    const { playArea, peakRules } = sportProfile;
    const { facility } = playArea;

    // Calculate date boundaries in UTC
    const dayStart = startOfDayDhaka(date);
    const dayEnd = endOfDayDhaka(date);

    // Get all bookings for this conflict group on this date
    const bookings = await this.prisma.booking.findMany({
      where: {
        conflictGroupId,
        deletedAt: null,
        status: { in: ['HOLD', 'CONFIRMED'] },
        startAt: { gte: dayStart },
        endAt: { lte: dayEnd },
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        blockedEndAt: true,
        status: true,
      },
    });

    // Get all blocks for this conflict group on this date
    const blocks = await this.prisma.bookingBlock.findMany({
      where: {
        conflictGroupId,
        deletedAt: null,
        startAt: { lte: dayEnd },
        endAt: { gte: dayStart },
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        blockType: true,
      },
    });

    // Generate base time slots
    const baseSlots = generateTimeSlots(
      date,
      facility.openingTime,
      facility.closingTime,
      sportProfile.slotIntervalMinutes,
    );

    // Build availability for each allowed duration
    const slots: Record<number, SlotStatus[]> = {};
    const now = new Date();

    for (const duration of sportProfile.allowedDurations) {
      slots[duration] = [];

      for (const slotStart of baseSlots) {
        const slotEnd = addMinutes(slotStart, duration);
        const blockedEnd = calculateBlockedEndAt(slotEnd, sportProfile.bufferMinutes);

        // Determine slot status
        const status = this.determineSlotStatus(
          slotStart,
          slotEnd,
          blockedEnd,
          bookings,
          blocks,
          sportProfile.minLeadTimeMinutes,
          now,
          facility.closingTime,
          date,
        );

        // Check peak pricing
        const isPeak = checkPeakOverlap(slotStart, slotEnd, peakRules);

        // Get price for this duration
        const durationPrices = sportProfile.durationPrices as Record<string, number>;
        const peakDurationPrices = sportProfile.peakDurationPrices as Record<string, number> | null;
        const prices = isPeak && peakDurationPrices ? peakDurationPrices : durationPrices;
        const price = prices?.[duration.toString()] ?? null;

        slots[duration].push({
          startAt: slotStart,
          endAt: slotEnd,
          blockedEndAt: blockedEnd,
          status: status.status,
          isPeak,
          price,
          bookingId: status.bookingId,
          blockId: status.blockId,
        });
      }
    }

    return {
      date,
      conflictGroupId,
      sportProfileId,
      allowedDurations: sportProfile.allowedDurations,
      slots,
    };
  }

  /**
   * Determine the status of a time slot
   */
  private determineSlotStatus(
    slotStart: Date,
    slotEnd: Date,
    blockedEnd: Date,
    bookings: Array<{
      id: string;
      startAt: Date;
      endAt: Date;
      blockedEndAt: Date;
      status: string;
    }>,
    blocks: Array<{
      id: string;
      startAt: Date;
      endAt: Date;
      blockType: string;
    }>,
    minLeadTimeMinutes: number,
    now: Date,
    closingTime: string,
    date: Date,
  ): { status: SlotStatus['status']; bookingId?: string; blockId?: string } {
    // Check if slot respects lead time
    if (!respectsLeadTime(slotStart, minLeadTimeMinutes, now)) {
      return { status: 'disabled' };
    }

    // Check if slot end exceeds closing time
    const closingDateTime = this.parseTimeOnDate(closingTime, date);
    if (isAfter(slotEnd, closingDateTime)) {
      return { status: 'disabled' };
    }

    // Check for booking conflicts
    // A slot conflicts if its range [slotStart, blockedEnd) overlaps with any booking's [startAt, blockedEndAt)
    for (const booking of bookings) {
      if (this.rangesOverlap(slotStart, blockedEnd, booking.startAt, booking.blockedEndAt)) {
        return { status: 'booked', bookingId: booking.id };
      }
    }

    // Check for manual blocks
    for (const block of blocks) {
      if (this.rangesOverlap(slotStart, blockedEnd, block.startAt, block.endAt)) {
        return { status: 'blocked', blockId: block.id };
      }
    }

    // Check if this slot would be affected by buffer from previous booking
    // If a booking ends at time T with buffer, next available start must be > T+buffer
    for (const booking of bookings) {
      // If slot starts during another booking's buffer time
      if (
        isAfter(slotStart, booking.endAt) &&
        isBefore(slotStart, booking.blockedEndAt)
      ) {
        return { status: 'buffer' };
      }
    }

    return { status: 'available' };
  }

  /**
   * Check if two time ranges overlap (using half-open intervals [start, end))
   */
  private rangesOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date,
  ): boolean {
    return isBefore(start1, end2) && isAfter(end1, start2);
  }

  /**
   * Parse time string on a date
   */
  private parseTimeOnDate(timeStr: string, date: Date): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  /**
   * Check if a specific slot is available
   * Used for final validation before booking
   */
  async isSlotAvailable(
    conflictGroupId: string,
    startAt: Date,
    blockedEndAt: Date,
    excludeBookingId?: string,
  ): Promise<boolean> {
    // Use the database helper function
    const result = await this.prisma.$queryRaw<[{ is_time_slot_available: boolean }]>`
      SELECT is_time_slot_available(
        ${conflictGroupId}::uuid,
        ${startAt}::timestamptz,
        ${blockedEndAt}::timestamptz,
        ${excludeBookingId ?? null}::uuid
      ) as is_time_slot_available
    `;

    return result[0]?.is_time_slot_available ?? false;
  }

  /**
   * Check if a facility has any available slots in the next N hours
   * Used for "Available Now" filtering
   */
  async hasAvailableSlotsNow(
    facilityId: string,
    hoursAhead: number = 4,
  ): Promise<boolean> {
    const now = new Date();
    const windowEnd = addMinutes(now, hoursAhead * 60);

    // Get all play areas and their conflict groups
    const playAreas = await this.prisma.playArea.findMany({
      where: {
        facilityId,
        deletedAt: null,
        isActive: true,
      },
      include: {
        sportProfiles: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    for (const playArea of playAreas) {
      if (playArea.sportProfiles.length === 0) continue;

      const sportProfile = playArea.sportProfiles[0];
      const minDuration = Math.min(...sportProfile.allowedDurations);

      // Check if there's any available slot in the next N hours
      const hasAvailable = await this.checkAvailabilityWindow(
        playArea.conflictGroupId,
        now,
        windowEnd,
        minDuration,
        sportProfile.bufferMinutes,
        sportProfile.minLeadTimeMinutes,
      );

      if (hasAvailable) return true;
    }

    return false;
  }

  /**
   * Check if there's any available slot within a time window
   */
  private async checkAvailabilityWindow(
    conflictGroupId: string,
    windowStart: Date,
    windowEnd: Date,
    durationMinutes: number,
    bufferMinutes: number,
    minLeadTimeMinutes: number,
  ): Promise<boolean> {
    const now = new Date();
    const minStart = addMinutes(now, minLeadTimeMinutes);

    // Get all bookings and blocks in the window
    const bookings = await this.prisma.booking.findMany({
      where: {
        conflictGroupId,
        deletedAt: null,
        status: { in: ['HOLD', 'CONFIRMED'] },
        blockedEndAt: { gte: windowStart },
        startAt: { lte: windowEnd },
      },
      select: { startAt: true, blockedEndAt: true },
      orderBy: { startAt: 'asc' },
    });

    const blocks = await this.prisma.bookingBlock.findMany({
      where: {
        conflictGroupId,
        deletedAt: null,
        endAt: { gte: windowStart },
        startAt: { lte: windowEnd },
      },
      select: { startAt: true, endAt: true },
      orderBy: { startAt: 'asc' },
    });

    // Find gaps large enough for the minimum duration + buffer
    const requiredGap = durationMinutes + bufferMinutes;

    // Merge bookings and blocks into occupied ranges
    const occupiedRanges = [
      ...bookings.map((b) => ({ start: b.startAt, end: b.blockedEndAt })),
      ...blocks.map((b) => ({ start: b.startAt, end: b.endAt })),
    ].sort((a, b) => a.start.getTime() - b.start.getTime());

    // Check for gaps
    let searchStart = windowStart;
    if (isBefore(searchStart, minStart)) {
      searchStart = minStart;
    }

    for (const range of occupiedRanges) {
      if (isBefore(searchStart, range.start)) {
        const gapMinutes = (range.start.getTime() - searchStart.getTime()) / 60000;
        if (gapMinutes >= requiredGap) {
          return true;
        }
      }
      if (isAfter(range.end, searchStart)) {
        searchStart = range.end;
      }
    }

    // Check remaining time after last occupied range
    if (isBefore(searchStart, windowEnd)) {
      const gapMinutes = (windowEnd.getTime() - searchStart.getTime()) / 60000;
      if (gapMinutes >= requiredGap) {
        return true;
      }
    }

    return false;
  }
}
