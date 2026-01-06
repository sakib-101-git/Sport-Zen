import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { SubscriptionStatus, InvoiceStatus } from '@prisma/client';
import { addMonths, startOfMonth, endOfMonth } from 'date-fns';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if owner has active subscription
   * Used for visibility enforcement
   */
  async isSubscriptionActive(ownerId: string): Promise<boolean> {
    const subscription = await this.prisma.ownerSubscription.findUnique({
      where: { ownerId },
    });

    if (!subscription) return false;

    return ['TRIAL', 'ACTIVE'].includes(subscription.status);
  }

  /**
   * Get subscription for owner
   */
  async getOwnerSubscription(ownerId: string): Promise<any> {
    const subscription = await this.prisma.ownerSubscription.findUnique({
      where: { ownerId },
      include: {
        plan: true,
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  /**
   * Create subscription for new owner
   */
  async createTrialSubscription(ownerId: string, planId: string): Promise<any> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new BadRequestException('Invalid plan');
    }

    const now = new Date();
    const trialEnd = addMonths(now, 0); // Trial days from plan
    trialEnd.setDate(now.getDate() + plan.trialDays);

    const subscription = await this.prisma.ownerSubscription.create({
      data: {
        ownerId,
        planId,
        status: SubscriptionStatus.TRIAL,
        trialEndsAt: trialEnd,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
      },
    });

    this.logger.log(`Trial subscription created for owner ${ownerId}`);

    return subscription;
  }

  /**
   * Generate monthly invoices for all active subscriptions
   * Called by cron job
   */
  async generateMonthlyInvoices(): Promise<number> {
    const now = new Date();
    const periodStart = startOfMonth(now);
    const periodEnd = endOfMonth(now);
    const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get all active subscriptions that need invoicing
    const subscriptions = await this.prisma.ownerSubscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { lte: now },
      },
      include: { plan: true },
    });

    let invoicesCreated = 0;

    for (const subscription of subscriptions) {
      // Check if invoice already exists for this period
      const existingInvoice = await this.prisma.invoice.findFirst({
        where: {
          subscriptionId: subscription.id,
          periodMonth,
        },
      });

      if (existingInvoice) continue;

      // Create invoice
      await this.prisma.$transaction([
        this.prisma.invoice.create({
          data: {
            subscriptionId: subscription.id,
            amount: subscription.plan.monthlyPriceBdt,
            periodMonth,
            periodStart,
            periodEnd,
            dueDate: addMonths(periodStart, 0), // Due on 1st of month
            status: InvoiceStatus.PENDING,
          },
        }),
        this.prisma.ownerSubscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
          },
        }),
      ]);

      invoicesCreated++;
    }

    this.logger.log(`Generated ${invoicesCreated} monthly invoices for ${periodMonth}`);

    return invoicesCreated;
  }

  /**
   * Get owner invoices
   */
  async getOwnerInvoices(ownerId: string, page = 1, limit = 12): Promise<any> {
    const subscription = await this.prisma.ownerSubscription.findUnique({
      where: { ownerId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { subscriptionId: subscription.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({
        where: { subscriptionId: subscription.id },
      }),
    ]);

    return { invoices, total, page, limit };
  }

  /**
   * Mark invoice as paid (admin action)
   */
  async markInvoicePaid(invoiceId: string, referenceId: string): Promise<void> {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
        paymentReference: referenceId,
      },
    });

    this.logger.log(`Invoice ${invoiceId} marked as paid`);
  }

  /**
   * Check and update expired trials
   */
  async processExpiredTrials(): Promise<number> {
    const now = new Date();

    const result = await this.prisma.ownerSubscription.updateMany({
      where: {
        status: SubscriptionStatus.TRIAL,
        trialEndsAt: { lte: now },
      },
      data: {
        status: SubscriptionStatus.PAST_DUE,
      },
    });

    if (result.count > 0) {
      this.logger.log(`${result.count} trial subscriptions marked as past due`);
    }

    return result.count;
  }
}
