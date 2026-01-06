import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { Prisma, BookingStatus, BlockType } from '@prisma/client';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';

export interface OwnerBookingsQuery {
  month?: string; // YYYY-MM format
  facilityId?: string;
  playAreaId?: string;
  status?: BookingStatus[];
  page?: number;
  limit?: number;
}

export interface OwnerDashboardStats {
  totalBookingsThisMonth: number;
  confirmedBookings: number;
  totalRevenueThisMonth: number;
  advanceCollectedThisMonth: number;
  offlineCollectedThisMonth: number;
  pendingPayments: number;
  upcomingBookingsToday: number;
}

@Injectable()
export class OwnerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get owner's facilities
   */
  async getOwnerFacilities(ownerId: string) {
    return this.prisma.facility.findMany({
      where: {
        ownerId,
        deletedAt: null,
      },
      include: {
        playAreas: {
          where: { deletedAt: null, isActive: true },
          include: {
            sportProfiles: {
              where: { isActive: true },
              include: { sportType: true },
            },
          },
        },
        photos: { where: { isPrimary: true }, take: 1 },
        _count: {
          select: {
            playAreas: { where: { deletedAt: null } },
          },
        },
      },
    });
  }

  /**
   * Get owner's bookings for calendar view
   */
  async getOwnerBookings(ownerId: string, query: OwnerBookingsQuery) {
    // Get owner's facilities
    const facilities = await this.prisma.facility.findMany({
      where: { ownerId, deletedAt: null },
      select: { id: true },
    });

    const facilityIds = facilities.map((f) => f.id);

    if (facilityIds.length === 0) {
      return { bookings: [], total: 0 };
    }

    // Parse month
    let startDate: Date;
    let endDate: Date;

    if (query.month) {
      const [year, month] = query.month.split('-').map(Number);
      startDate = startOfMonth(new Date(year, month - 1));
      endDate = endOfMonth(new Date(year, month - 1));
    } else {
      startDate = startOfMonth(new Date());
      endDate = endOfMonth(new Date());
    }

    const where: Prisma.BookingWhereInput = {
      playArea: {
        facilityId: query.facilityId
          ? { equals: query.facilityId }
          : { in: facilityIds },
        ...(query.playAreaId && { id: query.playAreaId }),
      },
      startAt: { gte: startDate },
      endAt: { lte: endDate },
      deletedAt: null,
      ...(query.status && { status: { in: query.status } }),
    };

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          playArea: {
            select: { id: true, name: true, facility: { select: { id: true, name: true } } },
          },
          sportProfile: {
            include: { sportType: { select: { name: true, icon: true } } },
          },
        },
        orderBy: { startAt: 'asc' },
        skip: query.page && query.limit ? (query.page - 1) * query.limit : undefined,
        take: query.limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  }

  /**
   * Get dashboard stats for owner
   */
  async getDashboardStats(ownerId: string): Promise<OwnerDashboardStats> {
    const facilities = await this.prisma.facility.findMany({
      where: { ownerId, deletedAt: null },
      select: { id: true },
    });

    const facilityIds = facilities.map((f) => f.id);

    if (facilityIds.length === 0) {
      return {
        totalBookingsThisMonth: 0,
        confirmedBookings: 0,
        totalRevenueThisMonth: 0,
        advanceCollectedThisMonth: 0,
        offlineCollectedThisMonth: 0,
        pendingPayments: 0,
        upcomingBookingsToday: 0,
      };
    }

    const startOfMonthDate = startOfMonth(new Date());
    const endOfMonthDate = endOfMonth(new Date());
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const baseWhere = {
      playArea: { facilityId: { in: facilityIds } },
      deletedAt: null,
    };

    const [
      totalBookings,
      confirmedBookings,
      revenueStats,
      upcomingToday,
    ] = await Promise.all([
      // Total bookings this month
      this.prisma.booking.count({
        where: {
          ...baseWhere,
          startAt: { gte: startOfMonthDate, lte: endOfMonthDate },
          status: { in: ['CONFIRMED', 'COMPLETED'] },
        },
      }),

      // Confirmed bookings
      this.prisma.booking.count({
        where: {
          ...baseWhere,
          status: 'CONFIRMED',
        },
      }),

      // Revenue stats
      this.prisma.booking.aggregate({
        where: {
          ...baseWhere,
          startAt: { gte: startOfMonthDate, lte: endOfMonthDate },
          status: { in: ['CONFIRMED', 'COMPLETED'] },
        },
        _sum: {
          totalAmount: true,
          advanceAmount: true,
          offlineAmountCollected: true,
        },
      }),

      // Upcoming bookings today
      this.prisma.booking.count({
        where: {
          ...baseWhere,
          startAt: { gte: now, lte: endOfToday },
          status: 'CONFIRMED',
        },
      }),
    ]);

    // Calculate pending payments (confirmed bookings where offline not collected)
    const pendingPayments = await this.prisma.booking.count({
      where: {
        ...baseWhere,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        paymentStage: { in: ['ADVANCE_PAID', 'PARTIAL_OFFLINE'] },
      },
    });

    return {
      totalBookingsThisMonth: totalBookings,
      confirmedBookings,
      totalRevenueThisMonth: revenueStats._sum.totalAmount || 0,
      advanceCollectedThisMonth: revenueStats._sum.advanceAmount || 0,
      offlineCollectedThisMonth: revenueStats._sum.offlineAmountCollected || 0,
      pendingPayments,
      upcomingBookingsToday: upcomingToday,
    };
  }

  /**
   * Create a booking block
   */
  async createBlock(
    ownerId: string,
    data: {
      facilityId: string;
      playAreaId?: string;
      blockType: BlockType;
      reason?: string;
      startAt: Date;
      endAt: Date;
    },
  ) {
    // Verify ownership
    const facility = await this.prisma.facility.findFirst({
      where: { id: data.facilityId, ownerId, deletedAt: null },
    });

    if (!facility) {
      throw new ForbiddenException('Not authorized to manage this facility');
    }

    // Get conflict group ID
    let conflictGroupId: string;
    if (data.playAreaId) {
      const playArea = await this.prisma.playArea.findUnique({
        where: { id: data.playAreaId },
      });
      if (!playArea) {
        throw new NotFoundException('Play area not found');
      }
      conflictGroupId = playArea.conflictGroupId;
    } else {
      // Block all play areas - create blocks for each
      const playAreas = await this.prisma.playArea.findMany({
        where: { facilityId: data.facilityId, deletedAt: null },
      });

      const blocks = await Promise.all(
        playAreas.map((pa) =>
          this.prisma.bookingBlock.create({
            data: {
              facilityId: data.facilityId,
              playAreaId: pa.id,
              conflictGroupId: pa.conflictGroupId,
              blockType: data.blockType,
              reason: data.reason,
              startAt: data.startAt,
              endAt: data.endAt,
              createdById: ownerId,
            },
          }),
        ),
      );

      return blocks;
    }

    return this.prisma.bookingBlock.create({
      data: {
        facilityId: data.facilityId,
        playAreaId: data.playAreaId,
        conflictGroupId,
        blockType: data.blockType,
        reason: data.reason,
        startAt: data.startAt,
        endAt: data.endAt,
        createdById: ownerId,
      },
    });
  }

  /**
   * Delete a booking block
   */
  async deleteBlock(ownerId: string, blockId: string) {
    const block = await this.prisma.bookingBlock.findUnique({
      where: { id: blockId },
      include: { facility: true },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    if (block.facility.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized to manage this block');
    }

    return this.prisma.bookingBlock.update({
      where: { id: blockId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Get owner's blocks
   */
  async getOwnerBlocks(ownerId: string, facilityId?: string) {
    const facilities = await this.prisma.facility.findMany({
      where: { ownerId, deletedAt: null },
      select: { id: true },
    });

    const facilityIds = facilities.map((f) => f.id);

    return this.prisma.bookingBlock.findMany({
      where: {
        facilityId: facilityId ? facilityId : { in: facilityIds },
        deletedAt: null,
        endAt: { gte: new Date() }, // Only future blocks
      },
      include: {
        playArea: { select: { id: true, name: true } },
        facility: { select: { id: true, name: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  /**
   * Get ledger entries for owner
   */
  async getLedgerEntries(ownerId: string, periodMonth?: string) {
    const where: Prisma.OwnerLedgerEntryWhereInput = {
      ownerId,
      ...(periodMonth && { periodMonth }),
    };

    const entries = await this.prisma.ownerLedgerEntry.findMany({
      where,
      include: {
        booking: {
          select: {
            bookingNumber: true,
            playerName: true,
            startAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate summary
    const summary = entries.reduce(
      (acc, entry) => {
        if (entry.amount > 0) {
          acc.totalCredits += entry.amount;
        } else {
          acc.totalDebits += Math.abs(entry.amount);
        }
        return acc;
      },
      { totalCredits: 0, totalDebits: 0 },
    );

    return {
      entries,
      summary: {
        ...summary,
        netAmount: summary.totalCredits - summary.totalDebits,
        currentBalance: entries[0]?.runningBalance ?? 0,
      },
    };
  }
}
