import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { RefundStatus, RefundReason } from '@prisma/client';

export interface CreateRefundInput {
  bookingId: string;
  paymentIntentId: string;
  amount: number;
  reason: RefundReason;
  notes?: string;
}

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a refund request
   */
  async createRefund(input: CreateRefundInput): Promise<any> {
    const refund = await this.prisma.refund.create({
      data: {
        bookingId: input.bookingId,
        paymentIntentId: input.paymentIntentId,
        amount: input.amount,
        reason: input.reason,
        status: RefundStatus.REQUESTED,
        notes: input.notes,
      },
    });

    this.logger.log(`Refund created for booking ${input.bookingId}: ${input.amount} BDT`);

    return refund;
  }

  /**
   * Create an automatic refund for late payment conflict
   */
  async createAutoRefundForConflict(
    bookingId: string,
    paymentIntentId: string,
    amount: number,
  ): Promise<any> {
    const refund = await this.prisma.refund.create({
      data: {
        bookingId,
        paymentIntentId,
        amount,
        reason: RefundReason.LATE_PAYMENT_CONFLICT,
        status: RefundStatus.APPROVED, // Auto-approved for conflicts
        approvedAt: new Date(),
        notes: 'Auto-created: Payment received after slot was booked by another user',
      },
    });

    this.logger.log(`Auto-refund created for conflict: booking ${bookingId}, ${amount} BDT`);

    return refund;
  }

  /**
   * Get refund by ID
   */
  async getRefund(refundId: string): Promise<any> {
    return this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        booking: {
          select: {
            bookingNumber: true,
            playerName: true,
            player: { select: { email: true, phone: true } },
          },
        },
        paymentIntent: {
          select: { amount: true, gateway: true },
        },
      },
    });
  }

  /**
   * Get refunds for a booking
   */
  async getBookingRefunds(bookingId: string): Promise<any[]> {
    return this.prisma.refund.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update refund status
   */
  async updateRefundStatus(
    refundId: string,
    status: RefundStatus,
    adminId?: string,
    referenceId?: string,
  ): Promise<void> {
    const updateData: any = { status };

    if (status === RefundStatus.APPROVED && adminId) {
      updateData.approvedBy = adminId;
      updateData.approvedAt = new Date();
    }

    if (status === RefundStatus.REFUNDED) {
      updateData.processedAt = new Date();
      if (referenceId) updateData.referenceId = referenceId;
    }

    await this.prisma.refund.update({
      where: { id: refundId },
      data: updateData,
    });

    this.logger.log(`Refund ${refundId} status updated to ${status}`);
  }

  /**
   * Calculate refund amount based on cancellation policy
   * Returns the refund amount after deducting processing fees
   */
  calculateRefundAmount(
    advanceAmount: number,
    hoursUntilStart: number,
    processingFeeRate: number = 0.02, // 2% processing fee
  ): { refundAmount: number; processingFee: number; tier: string } {
    let refundPercentage: number;
    let tier: string;

    if (hoursUntilStart > 24) {
      // >24h: full refund minus processing fee
      refundPercentage = 1.0;
      tier = 'FULL';
    } else if (hoursUntilStart >= 6) {
      // 24h-6h: 50% refund minus processing fee
      refundPercentage = 0.5;
      tier = 'PARTIAL_50';
    } else {
      // <6h: no refund
      refundPercentage = 0;
      tier = 'NONE';
    }

    const baseRefund = Math.floor(advanceAmount * refundPercentage);
    const processingFee = refundPercentage > 0 ? Math.ceil(advanceAmount * processingFeeRate) : 0;
    const refundAmount = Math.max(0, baseRefund - processingFee);

    return { refundAmount, processingFee, tier };
  }
}
