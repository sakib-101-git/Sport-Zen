import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { format } from 'date-fns';

export enum NotificationType {
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  BOOKING_REMINDER = 'BOOKING_REMINDER',
  BOOKING_CANCELED = 'BOOKING_CANCELED',
  BOOKING_COMPLETED = 'BOOKING_COMPLETED',
  REFUND_PROCESSED = 'REFUND_PROCESSED',
  SUBSCRIPTION_EXPIRING = 'SUBSCRIPTION_EXPIRING',
}

export interface NotificationPayload {
  type: NotificationType;
  recipientId: string;
  recipientPhone?: string;
  recipientEmail?: string;
  data: Record<string, any>;
}

/**
 * Notification provider interface
 * Implement this for different notification channels (SMS, Email, Push)
 */
export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<boolean>;
}

/**
 * Console notification provider for development
 */
class ConsoleNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger('ConsoleNotification');

  async send(payload: NotificationPayload): Promise<boolean> {
    this.logger.log(`[${payload.type}] To: ${payload.recipientId}`);
    this.logger.log(`Data: ${JSON.stringify(payload.data, null, 2)}`);
    return true;
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly provider: NotificationProvider;

  constructor(private readonly prisma: PrismaService) {
    // Use console provider for development
    // In production, this would be Twilio/Firebase/SendGrid
    this.provider = new ConsoleNotificationProvider();
  }

  /**
   * Notify owner about new confirmed booking
   */
  async notifyBookingConfirmed(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        playArea: {
          include: {
            facility: {
              include: {
                owner: { select: { id: true, phone: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!booking) return;

    const owner = booking.playArea.facility.owner;

    await this.provider.send({
      type: NotificationType.BOOKING_CONFIRMED,
      recipientId: owner.id,
      recipientPhone: owner.phone || undefined,
      recipientEmail: owner.email,
      data: {
        bookingNumber: booking.bookingNumber,
        playerName: booking.playerName,
        playerPhone: booking.playerPhone,
        facilityName: booking.playArea.facility.name,
        playAreaName: booking.playArea.name,
        dateTime: format(booking.startAt, 'MMM d, yyyy h:mm a'),
        duration: booking.durationMinutes,
        amount: booking.totalAmount,
        advance: booking.advanceAmount,
      },
    });

    // Also create in-app notification record
    await this.prisma.notification.create({
      data: {
        userId: owner.id,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'New Booking',
        message: `${booking.playerName} booked ${booking.playArea.name} for ${format(booking.startAt, 'MMM d h:mm a')}`,
        data: { bookingId },
      },
    });

    this.logger.log(`Booking confirmation notification sent for ${bookingId}`);
  }

  /**
   * Notify player about upcoming booking (reminder)
   */
  async notifyBookingReminder(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        player: { select: { id: true, phone: true, email: true } },
        playArea: {
          include: {
            facility: { select: { name: true, address: true, contactPhone: true } },
          },
        },
      },
    });

    if (!booking || !booking.player) return;

    await this.provider.send({
      type: NotificationType.BOOKING_REMINDER,
      recipientId: booking.player.id,
      recipientPhone: booking.player.phone || undefined,
      recipientEmail: booking.player.email,
      data: {
        bookingNumber: booking.bookingNumber,
        facilityName: booking.playArea.facility.name,
        playAreaName: booking.playArea.name,
        address: booking.playArea.facility.address,
        contactPhone: booking.playArea.facility.contactPhone,
        dateTime: format(booking.startAt, 'MMM d, yyyy h:mm a'),
        duration: booking.durationMinutes,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: booking.player.id,
        type: NotificationType.BOOKING_REMINDER,
        title: 'Booking Reminder',
        message: `Your booking at ${booking.playArea.facility.name} is coming up at ${format(booking.startAt, 'h:mm a')}`,
        data: { bookingId },
      },
    });

    this.logger.log(`Booking reminder sent for ${bookingId}`);
  }

  /**
   * Notify player about booking cancellation
   */
  async notifyBookingCanceled(
    bookingId: string,
    refundAmount: number,
  ): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        player: { select: { id: true, phone: true, email: true } },
        playArea: {
          include: { facility: { select: { name: true } } },
        },
      },
    });

    if (!booking || !booking.player) return;

    await this.provider.send({
      type: NotificationType.BOOKING_CANCELED,
      recipientId: booking.player.id,
      recipientPhone: booking.player.phone || undefined,
      recipientEmail: booking.player.email,
      data: {
        bookingNumber: booking.bookingNumber,
        facilityName: booking.playArea.facility.name,
        dateTime: format(booking.startAt, 'MMM d, yyyy h:mm a'),
        refundAmount,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: booking.player.id,
        type: NotificationType.BOOKING_CANCELED,
        title: 'Booking Canceled',
        message: `Your booking #${booking.bookingNumber} has been canceled. Refund: ${refundAmount} BDT`,
        data: { bookingId, refundAmount },
      },
    });

    this.logger.log(`Cancellation notification sent for ${bookingId}`);
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { notifications, total, unreadCount, page, limit };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Alias for notifyBookingConfirmed (used by webhook handler)
   */
  async sendBookingConfirmation(bookingId: string): Promise<void> {
    return this.notifyBookingConfirmed(bookingId);
  }

  /**
   * Notify user about late payment conflict and refund initiation
   */
  async sendLatePaymentConflict(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        player: { select: { id: true, phone: true, email: true } },
        playArea: {
          include: { facility: { select: { name: true } } },
        },
      },
    });

    if (!booking || !booking.player) return;

    await this.provider.send({
      type: NotificationType.BOOKING_CANCELED,
      recipientId: booking.player.id,
      recipientPhone: booking.player.phone || undefined,
      recipientEmail: booking.player.email,
      data: {
        bookingNumber: booking.bookingNumber,
        facilityName: booking.playArea.facility.name,
        dateTime: format(booking.startAt, 'MMM d, yyyy h:mm a'),
        reason: 'Payment received after slot was booked by another user',
        refundInitiated: true,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: booking.player.id,
        type: NotificationType.BOOKING_CANCELED,
        title: 'Booking Conflict - Refund Initiated',
        message: `Your payment for booking #${booking.bookingNumber} was received after the slot was taken. A refund has been initiated.`,
        data: { bookingId, conflict: true },
      },
    });

    this.logger.log(`Late payment conflict notification sent for ${bookingId}`);
  }

  /**
   * Send refund processed notification
   */
  async sendRefundProcessed(bookingId: string, refundAmount: number): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        player: { select: { id: true, phone: true, email: true } },
        playArea: {
          include: { facility: { select: { name: true } } },
        },
      },
    });

    if (!booking || !booking.player) return;

    await this.provider.send({
      type: NotificationType.REFUND_PROCESSED,
      recipientId: booking.player.id,
      recipientPhone: booking.player.phone || undefined,
      recipientEmail: booking.player.email,
      data: {
        bookingNumber: booking.bookingNumber,
        facilityName: booking.playArea.facility.name,
        refundAmount,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: booking.player.id,
        type: NotificationType.REFUND_PROCESSED,
        title: 'Refund Processed',
        message: `Your refund of ${refundAmount} BDT for booking #${booking.bookingNumber} has been processed.`,
        data: { bookingId, refundAmount },
      },
    });

    this.logger.log(`Refund notification sent for ${bookingId}: ${refundAmount} BDT`);
  }
}
