import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../common/db/prisma.service';
import {
  QUEUE_HOLD_EXPIRY,
  QUEUE_AUTO_COMPLETE,
  QUEUE_INVOICES,
  JOB_EXPIRE_HOLD,
  JOB_AUTO_COMPLETE_BOOKING,
  JOB_GENERATE_MONTHLY_INVOICE,
} from '../../../common/queue/queue.constants';

@Injectable()
export class CronScheduler implements OnModuleInit {
  private readonly logger = new Logger(CronScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_HOLD_EXPIRY) private readonly holdExpiryQueue: Queue,
    @InjectQueue(QUEUE_AUTO_COMPLETE) private readonly autoCompleteQueue: Queue,
    @InjectQueue(QUEUE_INVOICES) private readonly invoicesQueue: Queue,
  ) {}

  onModuleInit() {
    this.logger.log('Cron scheduler initialized');
  }

  /**
   * Process expired holds every minute
   * Marks HOLD bookings as EXPIRED if hold_expires_at has passed
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processExpiredHolds(): Promise<void> {
    this.logger.debug('Checking for expired holds...');

    try {
      const expiredHolds = await this.prisma.booking.findMany({
        where: {
          status: 'HOLD',
          holdExpiresAt: {
            lte: new Date(),
          },
          deletedAt: null,
        },
        select: {
          id: true,
          bookingNumber: true,
        },
      });

      if (expiredHolds.length === 0) {
        return;
      }

      this.logger.log(`Found ${expiredHolds.length} expired holds to process`);

      // Queue each expired hold for processing
      for (const booking of expiredHolds) {
        await this.holdExpiryQueue.add(
          JOB_EXPIRE_HOLD,
          { bookingId: booking.id },
          { jobId: `expire-${booking.id}` },
        );
      }
    } catch (error) {
      this.logger.error('Failed to process expired holds', error);
    }
  }

  /**
   * Auto-complete bookings every 5 minutes
   * Marks CONFIRMED bookings as COMPLETED if end time has passed
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoCompleteBookings(): Promise<void> {
    this.logger.debug('Checking for bookings to auto-complete...');

    try {
      const bookingsToComplete = await this.prisma.booking.findMany({
        where: {
          status: 'CONFIRMED',
          endAt: {
            lte: new Date(),
          },
          deletedAt: null,
        },
        select: {
          id: true,
          bookingNumber: true,
        },
      });

      if (bookingsToComplete.length === 0) {
        return;
      }

      this.logger.log(`Found ${bookingsToComplete.length} bookings to auto-complete`);

      for (const booking of bookingsToComplete) {
        await this.autoCompleteQueue.add(
          JOB_AUTO_COMPLETE_BOOKING,
          { bookingId: booking.id },
          { jobId: `complete-${booking.id}` },
        );
      }
    } catch (error) {
      this.logger.error('Failed to auto-complete bookings', error);
    }
  }

  /**
   * Generate monthly invoices on the 1st of each month at midnight
   */
  @Cron('0 0 1 * *') // 1st of every month at midnight
  async generateMonthlyInvoices(): Promise<void> {
    this.logger.log('Starting monthly invoice generation...');

    try {
      // Get all active owners with subscriptions
      const activeSubscriptions = await this.prisma.ownerSubscription.findMany({
        where: {
          status: {
            in: ['ACTIVE', 'TRIAL'],
          },
        },
        select: {
          id: true,
          ownerId: true,
        },
      });

      const previousMonth = new Date();
      previousMonth.setMonth(previousMonth.getMonth() - 1);
      const monthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;

      for (const subscription of activeSubscriptions) {
        await this.invoicesQueue.add(
          JOB_GENERATE_MONTHLY_INVOICE,
          {
            subscriptionId: subscription.id,
            ownerId: subscription.ownerId,
            month: monthKey,
          },
          {
            jobId: `invoice-${subscription.id}-${monthKey}`,
          },
        );
      }

      this.logger.log(`Queued ${activeSubscriptions.length} monthly invoice jobs`);
    } catch (error) {
      this.logger.error('Failed to queue monthly invoices', error);
    }
  }

  /**
   * Check subscription status daily at 2 AM
   * Mark past due subscriptions and suspend if needed
   */
  @Cron('0 2 * * *') // Daily at 2 AM
  async checkSubscriptionStatus(): Promise<void> {
    this.logger.log('Checking subscription statuses...');

    try {
      // Find subscriptions that need attention
      const now = new Date();
      const gracePeriodDays = 7;
      const gracePeriodEnd = new Date(now.getTime() - gracePeriodDays * 24 * 60 * 60 * 1000);

      // Mark past due subscriptions
      const pastDueCount = await this.prisma.ownerSubscription.updateMany({
        where: {
          status: 'ACTIVE',
          currentPeriodEnd: {
            lt: now,
          },
        },
        data: {
          status: 'PAST_DUE',
        },
      });

      if (pastDueCount.count > 0) {
        this.logger.log(`Marked ${pastDueCount.count} subscriptions as PAST_DUE`);
      }

      // Suspend subscriptions past grace period
      const suspendedCount = await this.prisma.ownerSubscription.updateMany({
        where: {
          status: 'PAST_DUE',
          currentPeriodEnd: {
            lt: gracePeriodEnd,
          },
        },
        data: {
          status: 'SUSPENDED',
        },
      });

      if (suspendedCount.count > 0) {
        this.logger.log(`Suspended ${suspendedCount.count} subscriptions past grace period`);
      }
    } catch (error) {
      this.logger.error('Failed to check subscription statuses', error);
    }
  }

  /**
   * Cleanup old data weekly (Sunday at 3 AM)
   * Removes old completed jobs, expired tokens, etc.
   */
  @Cron('0 3 * * 0') // Sunday at 3 AM
  async weeklyCleanup(): Promise<void> {
    this.logger.log('Starting weekly cleanup...');

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Clean up old audit logs (keep last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // Note: Audit logs should not be deleted in production
      // This is just a placeholder for other cleanup tasks

      this.logger.log('Weekly cleanup completed');
    } catch (error) {
      this.logger.error('Weekly cleanup failed', error);
    }
  }
}
