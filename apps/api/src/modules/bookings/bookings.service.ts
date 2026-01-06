import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { AvailabilityService } from '../availability/availability.service';
import {
  calculateBlockedEndAt,
  calculateHoldExpiresAt,
  getCancellationTier,
  isWithinCheckinWindow,
  formatBookingTimeRange,
} from '../../common/utils/time';
import {
  calculateBookingPrice,
  calculateBookingPricing,
  isValidDuration,
  calculateRefundAmount,
} from '../../common/utils/money';
import { BookingStatus, PaymentStage, CheckinStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

export interface CreateHoldInput {
  playAreaId: string;
  sportProfileId: string;
  startAt: Date;
  durationMinutes: number;
  playerName: string;
  playerPhone: string;
  playerEmail?: string;
  notes?: string;
}

export interface HoldResult {
  bookingId: string;
  bookingNumber: string;
  paymentIntentId: string;
  advanceAmount: number;
  totalAmount: number;
  holdExpiresAt: Date;
}

export interface CancelResult {
  refundAmount: number;
  platformFeeRetained: number;
  refundTier: string;
  refundId?: string;
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly availability: AvailabilityService,
  ) {}

  /**
   * Create a booking hold
   * This is the critical path - must be concurrency safe
   */
  async createHold(userId: string, input: CreateHoldInput): Promise<HoldResult> {
    // Rate limiting check
    const rateLimit = await this.redis.checkBookingRateLimit(userId);
    if (!rateLimit.allowed) {
      throw new BadRequestException('Too many booking attempts. Please wait a moment.');
    }

    // Validate sport profile and get pricing
    const sportProfile = await this.prisma.sportProfile.findUnique({
      where: { id: input.sportProfileId },
      include: {
        playArea: {
          include: {
            facility: {
              include: {
                owner: {
                  include: {
                    // Check owner subscription status
                  },
                },
              },
            },
          },
        },
        peakRules: { where: { isActive: true } },
      },
    });

    if (!sportProfile || !sportProfile.isActive) {
      throw new NotFoundException('Sport profile not found or inactive');
    }

    const { playArea } = sportProfile;
    const { facility } = playArea;

    // Verify facility is approved and bookable
    if (!facility.isApproved || facility.deletedAt) {
      throw new BadRequestException('Facility is not available for booking');
    }

    // Verify owner subscription (check via separate query)
    const subscription = await this.prisma.ownerSubscription.findUnique({
      where: { ownerId: facility.ownerId },
    });

    if (!subscription || !['TRIAL', 'ACTIVE'].includes(subscription.status)) {
      throw new BadRequestException('Facility is currently not accepting bookings');
    }

    // Validate duration
    if (!isValidDuration(sportProfile.allowedDurations, input.durationMinutes)) {
      throw new BadRequestException(
        `Invalid duration. Allowed: ${sportProfile.allowedDurations.join(', ')} minutes`,
      );
    }

    // Calculate times
    const startAt = input.startAt;
    const endAt = new Date(startAt.getTime() + input.durationMinutes * 60000);
    const blockedEndAt = calculateBlockedEndAt(endAt, sportProfile.bufferMinutes);
    const holdExpiresAt = calculateHoldExpiresAt();

    // Check peak pricing
    const isPeak = sportProfile.peakRules.some((rule) => {
      // Simplified check - full implementation in time.ts
      return true; // Use checkPeakOverlap from time.ts
    });

    // Calculate price
    const durationPrices = sportProfile.durationPrices as Record<string, number>;
    const peakDurationPrices = sportProfile.peakDurationPrices as Record<string, number> | null;
    const totalAmount = calculateBookingPrice(
      durationPrices,
      peakDurationPrices,
      input.durationMinutes,
      isPeak,
    );

    if (totalAmount === null) {
      throw new BadRequestException('Price not available for this duration');
    }

    const pricing = calculateBookingPricing(totalAmount);

    // Try to acquire Redis lock (best effort - DB is source of truth)
    const lockAcquired = await this.redis.acquireSlotLock(
      playArea.conflictGroupId,
      startAt,
      endAt,
      'pending', // Will be updated with booking ID
      userId,
    );

    if (!lockAcquired) {
      // Lock already held - but we still try DB (race condition possible)
      this.logger.warn('Redis lock not acquired, attempting DB insertion anyway');
    }

    try {
      // Create booking and payment intent in a transaction
      const result = await this.prisma.executeInTransaction(async (tx) => {
        // Generate booking number
        const bookingNumberResult = await tx.$queryRaw<[{ generate_booking_number: string }]>`
          SELECT generate_booking_number()
        `;
        const bookingNumber = bookingNumberResult[0]?.generate_booking_number ??
          `SZ-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        // Generate QR token (will be used after confirmation)
        const qrToken = randomBytes(32).toString('hex');

        // Create booking with HOLD status
        const booking = await tx.booking.create({
          data: {
            bookingNumber,
            playerId: userId,
            playAreaId: input.playAreaId,
            sportProfileId: input.sportProfileId,
            conflictGroupId: playArea.conflictGroupId,
            startAt,
            endAt,
            blockedEndAt,
            durationMinutes: input.durationMinutes,
            totalAmount: pricing.totalAmount,
            advanceAmount: pricing.advanceAmount,
            platformCommission: pricing.platformCommission,
            ownerAdvanceCredit: pricing.ownerAdvanceCredit,
            isPeakPricing: isPeak,
            status: BookingStatus.HOLD,
            paymentStage: PaymentStage.NOT_PAID,
            holdExpiresAt,
            qrToken,
            playerName: input.playerName,
            playerPhone: input.playerPhone,
            playerEmail: input.playerEmail,
            notes: input.notes,
          },
        });

        // Create payment intent
        const paymentIntent = await tx.paymentIntent.create({
          data: {
            bookingId: booking.id,
            amount: pricing.advanceAmount,
            currency: 'BDT',
            status: 'PENDING',
            expiresAt: holdExpiresAt,
          },
        });

        // Create booking event
        await tx.bookingEvent.create({
          data: {
            bookingId: booking.id,
            event: 'created',
            toStatus: 'HOLD',
            metadata: {
              totalAmount: pricing.totalAmount,
              advanceAmount: pricing.advanceAmount,
              duration: input.durationMinutes,
            },
            createdBy: userId,
          },
        });

        return { booking, paymentIntent };
      });

      // Update Redis lock with actual booking ID
      if (lockAcquired) {
        await this.redis.releaseSlotLock(
          playArea.conflictGroupId,
          startAt,
          endAt,
          'pending',
        );
        await this.redis.acquireSlotLock(
          playArea.conflictGroupId,
          startAt,
          endAt,
          result.booking.id,
          userId,
        );
      }

      return {
        bookingId: result.booking.id,
        bookingNumber: result.booking.bookingNumber,
        paymentIntentId: result.paymentIntent.id,
        advanceAmount: pricing.advanceAmount,
        totalAmount: pricing.totalAmount,
        holdExpiresAt,
      };
    } catch (error) {
      // Release Redis lock on failure
      if (lockAcquired) {
        await this.redis.releaseSlotLock(
          playArea.conflictGroupId,
          startAt,
          endAt,
          'pending',
        );
      }

      // Check for exclusion constraint violation (double booking)
      if (this.prisma.isExclusionConstraintError(error)) {
        throw new ConflictException(
          'This time slot is no longer available. Please select another time.',
        );
      }

      throw error;
    }
  }

  /**
   * Confirm a booking after successful payment
   * Called by payment webhook handler
   */
  async confirmBooking(
    bookingId: string,
    paymentIntentId: string,
    transactionData: {
      tranId: string;
      valId?: string;
      amount: number;
    },
  ): Promise<void> {
    await this.prisma.executeInTransaction(async (tx) => {
      // Lock booking row
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          playArea: { include: { facility: true } },
        },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      // Check if already confirmed (idempotency)
      if (booking.status === BookingStatus.CONFIRMED) {
        this.logger.log(`Booking ${bookingId} already confirmed, skipping`);
        return;
      }

      // Check if booking is in valid state for confirmation
      if (booking.status !== BookingStatus.HOLD) {
        // Late payment after expiry - handle specially
        if (booking.status === BookingStatus.EXPIRED) {
          await this.handleLatePaymentAfterExpiry(tx, booking, paymentIntentId, transactionData);
          return;
        }
        throw new BadRequestException(`Cannot confirm booking in ${booking.status} status`);
      }

      // Update booking status
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CONFIRMED,
          paymentStage: PaymentStage.ADVANCE_PAID,
          confirmedAt: new Date(),
        },
      });

      // Update payment intent
      await tx.paymentIntent.update({
        where: { id: paymentIntentId },
        data: { status: 'SUCCESS' },
      });

      // Create payment transaction record
      await tx.paymentTransaction.create({
        data: {
          paymentIntentId,
          gateway: 'SSLCOMMERZ',
          tranId: transactionData.tranId,
          valId: transactionData.valId,
          amount: transactionData.amount,
          currency: 'BDT',
          status: 'VALID',
          rawPayload: transactionData as unknown as Prisma.JsonObject,
          verifiedAt: new Date(),
        },
      });

      // Create owner ledger entry
      const previousBalance = await this.getOwnerBalance(tx, booking.playArea.facility.ownerId);
      await tx.ownerLedgerEntry.create({
        data: {
          ownerId: booking.playArea.facility.ownerId,
          bookingId,
          entryType: 'BOOKING_CREDIT',
          amount: booking.ownerAdvanceCredit,
          runningBalance: previousBalance + booking.ownerAdvanceCredit,
          description: `Booking ${booking.bookingNumber} - Advance credit`,
          periodMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
        },
      });

      // Create booking event
      await tx.bookingEvent.create({
        data: {
          bookingId,
          event: 'confirmed',
          fromStatus: 'HOLD',
          toStatus: 'CONFIRMED',
          metadata: { paymentIntentId, tranId: transactionData.tranId },
        },
      });

      // TODO: Queue notification to owner and player
    });
  }

  /**
   * Handle late payment after hold expiry
   */
  private async handleLatePaymentAfterExpiry(
    tx: Prisma.TransactionClient,
    booking: any,
    paymentIntentId: string,
    transactionData: { tranId: string; valId?: string; amount: number },
  ): Promise<void> {
    this.logger.warn(`Late payment for expired booking ${booking.id}`);

    // Try to confirm anyway - if slot is still available
    try {
      // Check if slot is still available
      const isAvailable = await this.prisma.$queryRaw<[{ is_time_slot_available: boolean }]>`
        SELECT is_time_slot_available(
          ${booking.conflictGroupId}::uuid,
          ${booking.startAt}::timestamptz,
          ${booking.blockedEndAt}::timestamptz,
          ${booking.id}::uuid
        ) as is_time_slot_available
      `;

      if (isAvailable[0]?.is_time_slot_available) {
        // Slot still available - confirm the booking
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.CONFIRMED,
            paymentStage: PaymentStage.ADVANCE_PAID,
            confirmedAt: new Date(),
          },
        });

        await tx.paymentIntent.update({
          where: { id: paymentIntentId },
          data: { status: 'SUCCESS' },
        });

        this.logger.log(`Late payment accepted for booking ${booking.id}`);
      } else {
        // Slot taken - mark as conflict and create refund
        await tx.paymentIntent.update({
          where: { id: paymentIntentId },
          data: { status: 'LATE_SUCCESS_CONFLICT' },
        });

        // Create automatic refund request
        await tx.refund.create({
          data: {
            bookingId: booking.id,
            paymentIntentId,
            refundAmount: transactionData.amount,
            platformFeeRetained: 0,
            originalAdvance: transactionData.amount,
            refundTier: 'late_payment_conflict',
            status: 'APPROVED', // Auto-approved
            reason: 'Late payment after hold expiry - slot no longer available',
            approvedAt: new Date(),
          },
        });

        await tx.bookingEvent.create({
          data: {
            bookingId: booking.id,
            event: 'late_payment_conflict',
            metadata: { paymentIntentId, tranId: transactionData.tranId },
          },
        });

        this.logger.warn(`Late payment conflict for booking ${booking.id}, refund created`);
        // TODO: Notify admin and user
      }
    } catch (error) {
      this.logger.error(`Failed to handle late payment for ${booking.id}`, error);
      throw error;
    }
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: string, userId: string, reason: string): Promise<CancelResult> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        playArea: { include: { facility: true } },
        paymentIntents: { where: { status: 'SUCCESS' } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Check authorization
    if (booking.playerId !== userId) {
      // Check if user is owner or staff
      const isOwnerOrStaff = booking.playArea.facility.ownerId === userId ||
        (await this.prisma.facilityStaff.findFirst({
          where: { facilityId: booking.playArea.facilityId, userId },
        }));

      if (!isOwnerOrStaff) {
        throw new ForbiddenException('Not authorized to cancel this booking');
      }
    }

    // Check if booking can be canceled
    if (!['HOLD', 'CONFIRMED'].includes(booking.status)) {
      throw new BadRequestException(`Cannot cancel booking in ${booking.status} status`);
    }

    // Calculate refund
    const tier = getCancellationTier(booking.startAt);
    const { refundAmount, platformFeeRetained } = calculateRefundAmount(
      booking.advanceAmount,
      tier,
    );

    const result = await this.prisma.executeInTransaction(async (tx) => {
      // Update booking status
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELED,
          canceledAt: new Date(),
          cancellationReason: reason,
        },
      });

      let refundId: string | undefined;

      // Create refund if applicable
      if (booking.paymentStage === PaymentStage.ADVANCE_PAID && refundAmount > 0) {
        const refund = await tx.refund.create({
          data: {
            bookingId,
            paymentIntentId: booking.paymentIntents[0]?.id,
            refundAmount,
            platformFeeRetained,
            originalAdvance: booking.advanceAmount,
            refundTier: tier,
            status: 'REQUESTED',
            reason,
          },
        });
        refundId = refund.id;

        // Reverse owner ledger entry
        const previousBalance = await this.getOwnerBalance(tx, booking.playArea.facility.ownerId);
        await tx.ownerLedgerEntry.create({
          data: {
            ownerId: booking.playArea.facility.ownerId,
            bookingId,
            entryType: 'BOOKING_REVERSAL',
            amount: -booking.ownerAdvanceCredit,
            runningBalance: previousBalance - booking.ownerAdvanceCredit,
            description: `Booking ${booking.bookingNumber} - Cancellation reversal`,
            periodMonth: new Date().toISOString().slice(0, 7),
          },
        });
      }

      // Release Redis lock
      await this.redis.releaseSlotLock(
        booking.conflictGroupId,
        booking.startAt,
        booking.endAt,
        booking.id,
      );

      // Create booking event
      await tx.bookingEvent.create({
        data: {
          bookingId,
          event: 'canceled',
          fromStatus: booking.status,
          toStatus: 'CANCELED',
          metadata: { reason, refundTier: tier, refundAmount },
          createdBy: userId,
        },
      });

      return { refundId };
    });

    return {
      refundAmount,
      platformFeeRetained,
      refundTier: tier,
      refundId: result.refundId,
    };
  }

  /**
   * Expire a hold that hasn't been paid
   */
  async expireHold(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking || booking.status !== BookingStatus.HOLD) {
      return; // Already processed
    }

    await this.prisma.executeInTransaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.EXPIRED,
          expiredAt: new Date(),
        },
      });

      await tx.paymentIntent.updateMany({
        where: { bookingId, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId,
          event: 'expired',
          fromStatus: 'HOLD',
          toStatus: 'EXPIRED',
        },
      });
    });

    // Release Redis lock
    await this.redis.releaseSlotLock(
      booking.conflictGroupId,
      booking.startAt,
      booking.endAt,
      booking.id,
    );
  }

  /**
   * Complete a booking (after end time)
   */
  async completeBooking(bookingId: string): Promise<void> {
    await this.prisma.executeInTransaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking || booking.status !== BookingStatus.CONFIRMED) {
        return;
      }

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId,
          event: 'completed',
          fromStatus: 'CONFIRMED',
          toStatus: 'COMPLETED',
        },
      });
    });
  }

  /**
   * Verify check-in via QR code
   */
  async verifyCheckin(qrToken: string, verifierId: string): Promise<{ success: boolean; message: string }> {
    const booking = await this.prisma.booking.findUnique({
      where: { qrToken },
      include: {
        playArea: { include: { facility: true } },
      },
    });

    if (!booking) {
      return { success: false, message: 'Invalid QR code' };
    }

    // Verify the verifier is authorized
    const facility = booking.playArea.facility;
    const isAuthorized = facility.ownerId === verifierId ||
      (await this.prisma.facilityStaff.findFirst({
        where: {
          facilityId: facility.id,
          userId: verifierId,
          canVerifyCheckin: true,
        },
      }));

    if (!isAuthorized) {
      return { success: false, message: 'Not authorized to verify check-ins' };
    }

    // Check booking status
    if (booking.status !== BookingStatus.CONFIRMED) {
      return { success: false, message: `Booking is ${booking.status.toLowerCase()}` };
    }

    // Check if already verified
    if (booking.checkinStatus === CheckinStatus.VERIFIED) {
      return { success: false, message: 'Already checked in' };
    }

    // Check time window
    if (!isWithinCheckinWindow(booking.startAt, booking.endAt)) {
      return { success: false, message: 'Check-in window is not open' };
    }

    // Update check-in status
    await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        checkinStatus: CheckinStatus.VERIFIED,
        checkinVerifiedAt: new Date(),
        checkinVerifiedByUserId: verifierId,
      },
    });

    await this.prisma.bookingEvent.create({
      data: {
        bookingId: booking.id,
        event: 'checked_in',
        metadata: { verifierId },
        createdBy: verifierId,
      },
    });

    return {
      success: true,
      message: `${booking.playerName} checked in for ${formatBookingTimeRange(booking.startAt, booking.endAt)}`,
    };
  }

  /**
   * Record offline payment
   */
  async recordOfflinePayment(
    bookingId: string,
    recorderId: string,
    amount: number,
    method: 'CASH' | 'BKASH' | 'NAGAD' | 'CARD' | 'OTHER',
    notes?: string,
  ): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { playArea: { include: { facility: true } } },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Verify authorization
    const facility = booking.playArea.facility;
    const isAuthorized = facility.ownerId === recorderId ||
      (await this.prisma.facilityStaff.findFirst({
        where: { facilityId: facility.id, userId: recorderId },
      }));

    if (!isAuthorized) {
      throw new ForbiddenException('Not authorized to record payments');
    }

    const remainingAmount = booking.totalAmount - booking.advanceAmount;
    const totalCollected = booking.offlineAmountCollected + amount;

    let paymentStage: PaymentStage;
    if (totalCollected >= remainingAmount) {
      paymentStage = PaymentStage.FULL_PAID_OFFLINE;
    } else if (totalCollected > 0) {
      paymentStage = PaymentStage.PARTIAL_OFFLINE;
    } else {
      paymentStage = booking.paymentStage;
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        offlineAmountCollected: totalCollected,
        offlinePaymentMethod: method,
        offlinePaymentRecordedByUserId: recorderId,
        offlinePaymentRecordedAt: new Date(),
        offlinePaymentNotes: notes,
        paymentStage,
      },
    });

    await this.prisma.bookingEvent.create({
      data: {
        bookingId,
        event: 'offline_payment_recorded',
        metadata: { amount, method, notes, totalCollected },
        createdBy: recorderId,
      },
    });
  }

  /**
   * Get owner's current ledger balance
   */
  private async getOwnerBalance(
    tx: Prisma.TransactionClient,
    ownerId: string,
  ): Promise<number> {
    const lastEntry = await tx.ownerLedgerEntry.findFirst({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      select: { runningBalance: true },
    });
    return lastEntry?.runningBalance ?? 0;
  }

  /**
   * Get booking by ID
   */
  async getBooking(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        playArea: {
          include: {
            facility: {
              include: {
                photos: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
        },
        sportProfile: {
          include: { sportType: true },
        },
        paymentIntents: true,
        refunds: true,
      },
    });
  }

  /**
   * Get user's bookings
   */
  async getUserBookings(
    userId: string,
    status?: BookingStatus[],
    pagination?: { page: number; limit: number },
  ) {
    const where: Prisma.BookingWhereInput = {
      playerId: userId,
      deletedAt: null,
      ...(status && { status: { in: status } }),
    };

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          playArea: {
            include: {
              facility: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                  photos: { where: { isPrimary: true }, take: 1 },
                },
              },
            },
          },
          sportProfile: {
            include: { sportType: { select: { name: true, icon: true } } },
          },
        },
        orderBy: { startAt: 'desc' },
        skip: pagination ? (pagination.page - 1) * pagination.limit : undefined,
        take: pagination?.limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { bookings, total, page: pagination?.page ?? 1, limit: pagination?.limit ?? total };
  }
}
