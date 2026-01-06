import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../common/db/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { BookingStatus } from '@prisma/client';

export const HOLD_EXPIRY_QUEUE = 'hold-expiry';

export interface HoldExpiryJobData {
  bookingId: string;
}

@Processor(HOLD_EXPIRY_QUEUE)
export class HoldExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(HoldExpiryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job<HoldExpiryJobData>): Promise<void> {
    const { bookingId } = job.data;
    this.logger.log(`Processing hold expiry for booking ${bookingId}`);

    try {
      // Get booking
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        this.logger.warn(`Booking ${bookingId} not found`);
        return;
      }

      // Idempotency: Only expire if still in HOLD status
      if (booking.status !== BookingStatus.HOLD) {
        this.logger.log(`Booking ${bookingId} is ${booking.status}, skipping expiry`);
        return;
      }

      // Check if hold has actually expired
      if (booking.holdExpiresAt && booking.holdExpiresAt > new Date()) {
        this.logger.log(`Booking ${bookingId} hold not yet expired, rescheduling`);
        // Could reschedule the job, but for now just skip
        return;
      }

      // Expire the booking in a transaction
      await this.prisma.$transaction(async (tx) => {
        // Update booking status
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.EXPIRED,
            expiredAt: new Date(),
          },
        });

        // Update payment intent
        await tx.paymentIntent.updateMany({
          where: {
            bookingId,
            status: 'PENDING',
          },
          data: {
            status: 'EXPIRED',
          },
        });

        // Create booking event
        await tx.bookingEvent.create({
          data: {
            bookingId,
            event: 'expired',
            fromStatus: 'HOLD',
            toStatus: 'EXPIRED',
            metadata: {
              reason: 'hold_timeout',
              expiredAt: new Date().toISOString(),
            },
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

      this.logger.log(`Successfully expired booking ${bookingId}`);
    } catch (error) {
      this.logger.error(`Failed to expire booking ${bookingId}`, error);
      throw error; // Let BullMQ handle retries
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<HoldExpiryJobData>) {
    this.logger.debug(`Hold expiry job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<HoldExpiryJobData>, error: Error) {
    this.logger.error(`Hold expiry job ${job.id} failed: ${error.message}`);
  }
}
