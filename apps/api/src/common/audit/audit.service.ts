import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

export enum AuditAction {
  // Auth actions
  USER_REGISTERED = 'USER_REGISTERED',
  USER_LOGGED_IN = 'USER_LOGGED_IN',
  USER_LOGGED_OUT = 'USER_LOGGED_OUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PHONE_LINKED = 'PHONE_LINKED',
  OTP_REQUESTED = 'OTP_REQUESTED',
  OTP_VERIFIED = 'OTP_VERIFIED',

  // Booking actions
  BOOKING_HOLD_CREATED = 'BOOKING_HOLD_CREATED',
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  BOOKING_EXPIRED = 'BOOKING_EXPIRED',
  BOOKING_COMPLETED = 'BOOKING_COMPLETED',
  BOOKING_CHECKED_IN = 'BOOKING_CHECKED_IN',

  // Payment actions
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_WEBHOOK_RECEIVED = 'PAYMENT_WEBHOOK_RECEIVED',
  REFUND_REQUESTED = 'REFUND_REQUESTED',
  REFUND_APPROVED = 'REFUND_APPROVED',
  REFUND_PROCESSED = 'REFUND_PROCESSED',

  // Facility actions
  FACILITY_CREATED = 'FACILITY_CREATED',
  FACILITY_UPDATED = 'FACILITY_UPDATED',
  FACILITY_APPROVED = 'FACILITY_APPROVED',
  FACILITY_REJECTED = 'FACILITY_REJECTED',

  // Admin actions
  ADMIN_ACTION = 'ADMIN_ACTION',
  SUBSCRIPTION_UPDATED = 'SUBSCRIPTION_UPDATED',
  REVIEW_MODERATED = 'REVIEW_MODERATED',
}

export interface AuditLogEntry {
  action: AuditAction;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          userId: entry.userId,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          metadata: entry.metadata || {},
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          correlationId: entry.correlationId,
        },
      });

      this.logger.debug(`Audit: ${entry.action}`, {
        userId: entry.userId,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        correlationId: entry.correlationId,
      });
    } catch (error) {
      // Log error but don't fail the operation
      this.logger.error('Failed to write audit log', error);
    }
  }

  /**
   * Log a booking event (writes to both audit log and booking events table)
   */
  async logBookingEvent(
    bookingId: string,
    action: AuditAction,
    userId?: string,
    metadata?: Record<string, any>,
    correlationId?: string,
  ): Promise<void> {
    // Write to audit log
    await this.log({
      action,
      userId,
      resourceType: 'BOOKING',
      resourceId: bookingId,
      metadata,
      correlationId,
    });

    // Also write to booking events for the booking timeline
    try {
      await this.prisma.bookingEvent.create({
        data: {
          bookingId,
          eventType: action,
          payload: metadata || {},
          createdByUserId: userId,
        },
      });
    } catch (error) {
      this.logger.error('Failed to write booking event', error);
    }
  }

  /**
   * Get audit logs for a resource
   */
  async getResourceLogs(
    resourceType: string,
    resourceId: string,
    limit = 50,
  ): Promise<any[]> {
    return this.prisma.auditLog.findMany({
      where: { resourceType, resourceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get audit logs for a user
   */
  async getUserLogs(userId: string, limit = 50): Promise<any[]> {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
