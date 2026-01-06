import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { LedgerEntryType } from '@prisma/client';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export interface SettlementSummary {
  periodMonth: string;
  totalBookings: number;
  totalBookingValue: number;
  totalAdvanceCollected: number;
  platformCommission: number;
  ownerCredit: number;
  refundsProcessed: number;
  netPayout: number;
  entries: any[];
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create ledger entry for confirmed booking
   * Called when booking is confirmed via webhook
   */
  async createBookingCreditEntry(
    ownerId: string,
    bookingId: string,
    advanceAmount: number,
    platformCommission: number,
  ): Promise<any> {
    const ownerCredit = advanceAmount - platformCommission;

    const entry = await this.prisma.ownerLedger.create({
      data: {
        ownerId,
        bookingId,
        entryType: LedgerEntryType.BOOKING_CREDIT,
        amount: ownerCredit,
        description: `Booking credit (advance ${advanceAmount} - commission ${platformCommission})`,
        metadata: {
          advanceAmount,
          platformCommission,
          ownerCredit,
        },
      },
    });

    this.logger.log(`Ledger credit created for owner ${ownerId}: ${ownerCredit} BDT`);

    return entry;
  }

  /**
   * Create ledger debit entry for cancellation/refund
   * Reverses the credit when booking is canceled
   */
  async createRefundDebitEntry(
    ownerId: string,
    bookingId: string,
    amount: number,
    reason: string,
  ): Promise<any> {
    const entry = await this.prisma.ownerLedger.create({
      data: {
        ownerId,
        bookingId,
        entryType: LedgerEntryType.REFUND_DEBIT,
        amount: -amount, // Negative for debit
        description: `Refund debit: ${reason}`,
      },
    });

    this.logger.log(`Ledger debit created for owner ${ownerId}: ${amount} BDT`);

    return entry;
  }

  /**
   * Create payout entry when owner is paid
   */
  async createPayoutEntry(
    ownerId: string,
    amount: number,
    referenceId: string,
    periodMonth: string,
  ): Promise<any> {
    const entry = await this.prisma.ownerLedger.create({
      data: {
        ownerId,
        entryType: LedgerEntryType.PAYOUT,
        amount: -amount, // Negative for payout
        description: `Payout for ${periodMonth}`,
        referenceId,
        periodMonth,
      },
    });

    this.logger.log(`Payout entry created for owner ${ownerId}: ${amount} BDT`);

    return entry;
  }

  /**
   * Get owner ledger entries
   */
  async getOwnerLedger(
    ownerId: string,
    periodMonth?: string,
    page = 1,
    limit = 50,
  ): Promise<{ entries: any[]; total: number; balance: number }> {
    const skip = (page - 1) * limit;
    const where: any = { ownerId };

    if (periodMonth) {
      where.periodMonth = periodMonth;
    }

    const [entries, total, balanceResult] = await Promise.all([
      this.prisma.ownerLedger.findMany({
        where,
        include: {
          booking: {
            select: { bookingNumber: true, startAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ownerLedger.count({ where }),
      this.prisma.ownerLedger.aggregate({
        where: { ownerId },
        _sum: { amount: true },
      }),
    ]);

    return {
      entries,
      total,
      balance: balanceResult._sum.amount || 0,
    };
  }

  /**
   * Get settlement summary for owner for a specific month
   */
  async getSettlementSummary(ownerId: string, periodMonth: string): Promise<SettlementSummary> {
    const [year, month] = periodMonth.split('-').map(Number);
    const periodStart = startOfMonth(new Date(year, month - 1));
    const periodEnd = endOfMonth(new Date(year, month - 1));

    // Get all confirmed bookings in this period
    const bookings = await this.prisma.booking.findMany({
      where: {
        playArea: {
          facility: { ownerId },
        },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        createdAt: { gte: periodStart, lte: periodEnd },
        deletedAt: null,
      },
      select: {
        id: true,
        totalAmount: true,
        advanceAmount: true,
      },
    });

    // Get ledger entries for this period
    const entries = await this.prisma.ownerLedger.findMany({
      where: {
        ownerId,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      include: {
        booking: { select: { bookingNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate totals
    const totalBookingValue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalAdvanceCollected = bookings.reduce((sum, b) => sum + b.advanceAmount, 0);

    const credits = entries
      .filter((e) => e.entryType === 'BOOKING_CREDIT')
      .reduce((sum, e) => sum + e.amount, 0);

    const debits = entries
      .filter((e) => e.entryType === 'REFUND_DEBIT')
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    const payouts = entries
      .filter((e) => e.entryType === 'PAYOUT')
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    const platformCommission = totalAdvanceCollected - credits;
    const netPayout = credits - debits - payouts;

    return {
      periodMonth,
      totalBookings: bookings.length,
      totalBookingValue,
      totalAdvanceCollected,
      platformCommission,
      ownerCredit: credits,
      refundsProcessed: debits,
      netPayout,
      entries,
    };
  }

  /**
   * Get unpaid balance for owner
   */
  async getUnpaidBalance(ownerId: string): Promise<number> {
    const result = await this.prisma.ownerLedger.aggregate({
      where: { ownerId },
      _sum: { amount: true },
    });

    return result._sum.amount || 0;
  }

  /**
   * Create ledger credit for a booking (fetches booking details automatically)
   * This is a convenience method called by the webhook handler
   */
  async createBookingCredit(bookingId: string): Promise<any> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        playArea: {
          include: {
            facility: { select: { ownerId: true } },
          },
        },
      },
    });

    if (!booking) {
      throw new Error(`Booking not found: ${bookingId}`);
    }

    const ownerId = booking.playArea.facility.ownerId;
    const advanceAmount = booking.advanceAmount;

    // Calculate platform commission (default 5% of total booking value)
    const platformCommissionRate = 0.05;
    const platformCommission = Math.ceil(booking.totalAmount * platformCommissionRate);

    return this.createBookingCreditEntry(
      ownerId,
      bookingId,
      advanceAmount,
      platformCommission,
    );
  }

  /**
   * Reverse ledger credit for a canceled/refunded booking
   */
  async reverseBookingCredit(bookingId: string): Promise<any> {
    // Find the original credit entry
    const creditEntry = await this.prisma.ownerLedger.findFirst({
      where: {
        bookingId,
        entryType: LedgerEntryType.BOOKING_CREDIT,
      },
    });

    if (!creditEntry) {
      this.logger.warn(`No credit entry found to reverse for booking ${bookingId}`);
      return null;
    }

    // Get the booking for owner info
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        playArea: {
          include: {
            facility: { select: { ownerId: true } },
          },
        },
      },
    });

    if (!booking) {
      throw new Error(`Booking not found: ${bookingId}`);
    }

    return this.createRefundDebitEntry(
      booking.playArea.facility.ownerId,
      bookingId,
      creditEntry.amount,
      'Booking canceled/refunded',
    );
  }
}
