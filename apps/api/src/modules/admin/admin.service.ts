import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { SubscriptionStatus, RefundStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // DASHBOARD
  // ============================================================================

  async getDashboardStats(): Promise<{
    totalFacilities: number;
    pendingApprovals: number;
    activeSubscriptions: number;
    pendingRefunds: number;
    todayBookings: number;
    totalRevenue: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalFacilities,
      pendingApprovals,
      activeSubscriptions,
      pendingRefunds,
      todayBookings,
      revenueResult,
    ] = await Promise.all([
      this.prisma.facility.count({ where: { deletedAt: null } }),
      this.prisma.facility.count({ where: { isApproved: false, deletedAt: null } }),
      this.prisma.ownerSubscription.count({
        where: { status: { in: ['TRIAL', 'ACTIVE'] } },
      }),
      this.prisma.refund.count({ where: { status: 'REQUESTED' } }),
      this.prisma.booking.count({
        where: {
          createdAt: { gte: today, lt: tomorrow },
          deletedAt: null,
        },
      }),
      this.prisma.paymentTransaction.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalFacilities,
      pendingApprovals,
      activeSubscriptions,
      pendingRefunds,
      todayBookings,
      totalRevenue: revenueResult._sum.amount || 0,
    };
  }

  // ============================================================================
  // FACILITY APPROVALS
  // ============================================================================

  async getPendingApprovals(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [facilities, total] = await Promise.all([
      this.prisma.facility.findMany({
        where: { isApproved: false, deletedAt: null },
        include: {
          owner: { select: { id: true, name: true, email: true, phone: true } },
          photos: { where: { isPrimary: true }, take: 1 },
          _count: { select: { playAreas: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.facility.count({ where: { isApproved: false, deletedAt: null } }),
    ]);

    return { facilities, total, page, limit };
  }

  async approveFacility(facilityId: string, adminId: string): Promise<void> {
    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
    });

    if (!facility) {
      throw new NotFoundException('Facility not found');
    }

    if (facility.isApproved) {
      throw new BadRequestException('Facility is already approved');
    }

    await this.prisma.$transaction([
      this.prisma.facility.update({
        where: { id: facilityId },
        data: {
          isApproved: true,
          approvedAt: new Date(),
          approvedBy: adminId,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          action: 'FACILITY_APPROVED',
          entityType: 'Facility',
          entityId: facilityId,
          performedBy: adminId,
          details: { facilityName: facility.name },
        },
      }),
    ]);

    this.logger.log(`Facility ${facilityId} approved by admin ${adminId}`);
  }

  async rejectFacility(facilityId: string, adminId: string, reason: string): Promise<void> {
    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
    });

    if (!facility) {
      throw new NotFoundException('Facility not found');
    }

    await this.prisma.$transaction([
      this.prisma.facility.update({
        where: { id: facilityId },
        data: {
          rejectionReason: reason,
          rejectedAt: new Date(),
          rejectedBy: adminId,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          action: 'FACILITY_REJECTED',
          entityType: 'Facility',
          entityId: facilityId,
          performedBy: adminId,
          details: { facilityName: facility.name, reason },
        },
      }),
    ]);

    this.logger.log(`Facility ${facilityId} rejected by admin ${adminId}`);
  }

  // ============================================================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================================================

  async getSubscriptions(status?: SubscriptionStatus, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [subscriptions, total] = await Promise.all([
      this.prisma.ownerSubscription.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          plan: { select: { name: true, monthlyPriceBdt: true } },
          invoices: { orderBy: { createdAt: 'desc' }, take: 3 },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ownerSubscription.count({ where }),
    ]);

    return { subscriptions, total, page, limit };
  }

  async updateSubscriptionStatus(
    ownerId: string,
    status: SubscriptionStatus,
    adminId: string,
  ): Promise<void> {
    const subscription = await this.prisma.ownerSubscription.findUnique({
      where: { ownerId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const updateData: any = { status };

    if (status === 'SUSPENDED') {
      updateData.suspendedAt = new Date();
    } else if (status === 'CANCELED') {
      updateData.canceledAt = new Date();
    } else if (status === 'ACTIVE') {
      updateData.suspendedAt = null;
    }

    await this.prisma.$transaction([
      this.prisma.ownerSubscription.update({
        where: { ownerId },
        data: updateData,
      }),
      this.prisma.auditLog.create({
        data: {
          action: 'SUBSCRIPTION_STATUS_CHANGED',
          entityType: 'OwnerSubscription',
          entityId: subscription.id,
          performedBy: adminId,
          details: { ownerId, oldStatus: subscription.status, newStatus: status },
        },
      }),
    ]);

    this.logger.log(`Subscription for owner ${ownerId} updated to ${status} by admin ${adminId}`);
  }

  // ============================================================================
  // REFUND MANAGEMENT
  // ============================================================================

  async getPendingRefunds(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [refunds, total] = await Promise.all([
      this.prisma.refund.findMany({
        where: { status: { in: ['REQUESTED', 'APPROVED', 'PROCESSING'] } },
        include: {
          booking: {
            include: {
              player: { select: { name: true, email: true, phone: true } },
              playArea: {
                include: { facility: { select: { name: true } } },
              },
            },
          },
          paymentIntent: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.refund.count({
        where: { status: { in: ['REQUESTED', 'APPROVED', 'PROCESSING'] } },
      }),
    ]);

    return { refunds, total, page, limit };
  }

  async approveRefund(refundId: string, adminId: string): Promise<void> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (refund.status !== 'REQUESTED') {
      throw new BadRequestException(`Cannot approve refund in ${refund.status} status`);
    }

    await this.prisma.$transaction([
      this.prisma.refund.update({
        where: { id: refundId },
        data: {
          status: 'APPROVED',
          approvedBy: adminId,
          approvedAt: new Date(),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          action: 'REFUND_APPROVED',
          entityType: 'Refund',
          entityId: refundId,
          performedBy: adminId,
          details: { amount: refund.amount, bookingId: refund.bookingId },
        },
      }),
    ]);

    this.logger.log(`Refund ${refundId} approved by admin ${adminId}`);
  }

  async markRefundComplete(
    refundId: string,
    adminId: string,
    referenceId: string,
  ): Promise<void> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (!['APPROVED', 'PROCESSING'].includes(refund.status)) {
      throw new BadRequestException(`Cannot complete refund in ${refund.status} status`);
    }

    await this.prisma.$transaction([
      this.prisma.refund.update({
        where: { id: refundId },
        data: {
          status: 'REFUNDED',
          processedAt: new Date(),
          referenceId,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          action: 'REFUND_COMPLETED',
          entityType: 'Refund',
          entityId: refundId,
          performedBy: adminId,
          details: { amount: refund.amount, referenceId },
        },
      }),
    ]);

    this.logger.log(`Refund ${refundId} marked complete by admin ${adminId}`);
  }

  // ============================================================================
  // REVIEW MODERATION
  // ============================================================================

  async getReportsedReviews(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          OR: [
            { reports: { some: {} } },
            { isHidden: false },
          ],
          deletedAt: null,
        },
        include: {
          booking: {
            include: {
              player: { select: { name: true } },
              playArea: {
                include: { facility: { select: { name: true } } },
              },
            },
          },
          reports: {
            include: {
              reportedBy: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({
        where: {
          OR: [
            { reports: { some: {} } },
            { isHidden: false },
          ],
          deletedAt: null,
        },
      }),
    ]);

    return { reviews, total, page, limit };
  }

  async moderateReview(
    reviewId: string,
    action: 'hide' | 'restore' | 'delete',
    adminId: string,
  ): Promise<void> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const updateData: any = {};
    let auditAction = '';

    switch (action) {
      case 'hide':
        updateData.isHidden = true;
        updateData.hiddenAt = new Date();
        updateData.hiddenBy = adminId;
        auditAction = 'REVIEW_HIDDEN';
        break;
      case 'restore':
        updateData.isHidden = false;
        updateData.hiddenAt = null;
        updateData.hiddenBy = null;
        auditAction = 'REVIEW_RESTORED';
        break;
      case 'delete':
        updateData.deletedAt = new Date();
        auditAction = 'REVIEW_DELETED';
        break;
    }

    await this.prisma.$transaction([
      this.prisma.review.update({
        where: { id: reviewId },
        data: updateData,
      }),
      this.prisma.auditLog.create({
        data: {
          action: auditAction,
          entityType: 'Review',
          entityId: reviewId,
          performedBy: adminId,
          details: { bookingId: review.bookingId },
        },
      }),
    ]);

    this.logger.log(`Review ${reviewId} ${action}d by admin ${adminId}`);
  }

  // ============================================================================
  // DISPUTES (Simplified)
  // ============================================================================

  async getDisputes(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // For MVP, disputes are derived from refund requests with notes
    const [disputes, total] = await Promise.all([
      this.prisma.refund.findMany({
        where: {
          status: 'REQUESTED',
          notes: { not: null },
        },
        include: {
          booking: {
            include: {
              player: { select: { name: true, email: true, phone: true } },
              playArea: {
                include: {
                  facility: {
                    include: {
                      owner: { select: { name: true, email: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.refund.count({
        where: {
          status: 'REQUESTED',
          notes: { not: null },
        },
      }),
    ]);

    return { disputes, total, page, limit };
  }
}
