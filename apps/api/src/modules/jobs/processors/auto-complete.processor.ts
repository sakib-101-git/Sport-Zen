import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../common/db/prisma.service';
import { BookingStatus } from '@prisma/client';

export const AUTO_COMPLETE_QUEUE = 'auto-complete';

export interface AutoCompleteJobData {
  bookingId: string;
}

@Processor(AUTO_COMPLETE_QUEUE)
export class AutoCompleteProcessor extends WorkerHost {
  private readonly logger = new Logger(AutoCompleteProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<AutoCompleteJobData>): Promise<void> {
    const { bookingId } = job.data;
    this.logger.log(`Processing auto-complete for booking ${bookingId}`);

    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        this.logger.warn(`Booking ${bookingId} not found`);
        return;
      }

      // Idempotency: Only complete if CONFIRMED
      if (booking.status !== BookingStatus.CONFIRMED) {
        this.logger.log(`Booking ${bookingId} is ${booking.status}, skipping completion`);
        return;
      }

      // Check if booking end time has passed
      if (booking.endAt > new Date()) {
        this.logger.log(`Booking ${bookingId} has not ended yet, skipping`);
        return;
      }

      // Complete the booking
      await this.prisma.$transaction(async (tx) => {
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
            metadata: {
              reason: 'auto_complete',
              completedAt: new Date().toISOString(),
            },
          },
        });
      });

      this.logger.log(`Successfully completed booking ${bookingId}`);
    } catch (error) {
      this.logger.error(`Failed to complete booking ${bookingId}`, error);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<AutoCompleteJobData>) {
    this.logger.debug(`Auto-complete job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AutoCompleteJobData>, error: Error) {
    this.logger.error(`Auto-complete job ${job.id} failed: ${error.message}`);
  }
}
