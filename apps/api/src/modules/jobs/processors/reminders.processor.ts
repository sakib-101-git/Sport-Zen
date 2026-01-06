import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../common/db/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { QUEUE_REMINDERS, JOB_SEND_REMINDER } from '../../../common/queue/queue.constants';

export interface ReminderJobData {
  bookingId: string;
  userId: string;
  type: 'day_before' | 'hour_before';
}

@Processor(QUEUE_REMINDERS)
export class RemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(RemindersProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<ReminderJobData>): Promise<void> {
    const { bookingId, userId, type } = job.data;

    this.logger.debug(`Processing reminder: ${type} for booking ${bookingId}`);

    try {
      // Fetch booking with related data
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          player: true,
          playArea: {
            include: {
              facility: true,
            },
          },
          sportProfile: {
            include: {
              sportType: true,
            },
          },
        },
      });

      if (!booking) {
        this.logger.warn(`Booking ${bookingId} not found for reminder`);
        return;
      }

      // Only send reminder if booking is still confirmed
      if (booking.status !== 'CONFIRMED') {
        this.logger.debug(
          `Booking ${bookingId} is not confirmed (status: ${booking.status}), skipping reminder`,
        );
        return;
      }

      // Send the reminder notification
      await this.notificationsService.sendBookingReminder({
        userId: booking.playerId,
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        facilityName: booking.playArea.facility.name,
        playAreaName: booking.playArea.name,
        sportType: booking.sportProfile.sportType.name,
        startAt: booking.startAt,
        endAt: booking.endAt,
        reminderType: type,
      });

      this.logger.log(`Reminder sent: ${type} for booking ${bookingId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send reminder for booking ${bookingId}`,
        error,
      );
      throw error; // Re-throw to trigger retry
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ReminderJobData>) {
    this.logger.debug(`Reminder job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ReminderJobData>, error: Error) {
    this.logger.error(`Reminder job ${job.id} failed: ${error.message}`);
  }
}

/**
 * Schedule reminders for a booking
 */
export async function scheduleBookingReminders(
  queue: any, // BullMQ Queue
  bookingId: string,
  userId: string,
  startAt: Date,
): Promise<void> {
  const now = new Date();
  const oneDayBefore = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
  const oneHourBefore = new Date(startAt.getTime() - 60 * 60 * 1000);

  // Schedule day-before reminder if more than 24 hours away
  if (oneDayBefore > now) {
    await queue.add(
      JOB_SEND_REMINDER,
      {
        bookingId,
        userId,
        type: 'day_before',
      } as ReminderJobData,
      {
        delay: oneDayBefore.getTime() - now.getTime(),
        jobId: `reminder-day-${bookingId}`,
      },
    );
  }

  // Schedule hour-before reminder if more than 1 hour away
  if (oneHourBefore > now) {
    await queue.add(
      JOB_SEND_REMINDER,
      {
        bookingId,
        userId,
        type: 'hour_before',
      } as ReminderJobData,
      {
        delay: oneHourBefore.getTime() - now.getTime(),
        jobId: `reminder-hour-${bookingId}`,
      },
    );
  }
}

/**
 * Cancel scheduled reminders for a booking
 */
export async function cancelBookingReminders(
  queue: any,
  bookingId: string,
): Promise<void> {
  const jobIds = [`reminder-day-${bookingId}`, `reminder-hour-${bookingId}`];

  for (const jobId of jobIds) {
    try {
      const job = await queue.getJob(jobId);
      if (job) {
        await job.remove();
      }
    } catch {
      // Job might not exist, which is fine
    }
  }
}
