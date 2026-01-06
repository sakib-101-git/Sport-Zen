import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import { ConfigService } from '@nestjs/config';
import { verifySSLCommerzSignature, validateSSLCommerzResponse, type SSLCommerzIPNPayload } from './verify';
import { IdempotencyService, generatePaymentConfirmIdempotencyKey } from '../../../common/utils/idempotency';
import { BookingStatus, canBeConfirmed } from '../../bookings/booking.state';
import { LedgerService } from '../../ledger/ledger.service';
import { NotificationsService } from '../../notifications/notifications.service';

export interface SSLCommerzWebhookPayload {
  tran_id: string;
  val_id: string;
  amount: string;
  card_type: string;
  store_amount: string;
  card_no: string;
  bank_tran_id: string;
  status: string;
  tran_date: string;
  error?: string;
  currency: string;
  card_issuer: string;
  card_brand: string;
  card_issuer_country: string;
  card_issuer_country_code: string;
  store_id: string;
  verify_sign: string;
  verify_key: string;
  verify_sign_sha2?: string;
  currency_type: string;
  currency_amount: string;
  currency_rate: string;
  base_fair: string;
  value_a?: string;
  value_b?: string;
  value_c?: string;
  value_d?: string;
  risk_level: string;
  risk_title: string;
}

export interface WebhookProcessingResult {
  success: boolean;
  bookingId?: string;
  paymentIntentId?: string;
  message: string;
  isIdempotent?: boolean;
}

@Injectable()
export class SSLCommerzWebhookHandler {
  private readonly logger = new Logger(SSLCommerzWebhookHandler.name);
  private readonly storePassword: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly idempotencyService: IdempotencyService,
    private readonly ledgerService: LedgerService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.storePassword = this.configService.get<string>('sslcommerz.storePassword', '');
  }

  /**
   * Process incoming webhook from SSLCommerz
   * This is the main entry point for payment confirmation
   */
  async processWebhook(payload: SSLCommerzWebhookPayload): Promise<WebhookProcessingResult> {
    const { tran_id, val_id, status, amount } = payload;

    this.logger.log(`Processing webhook: tran_id=${tran_id}, status=${status}`);

    // Step 1: Verify signature
    const signatureResult = verifySSLCommerzSignature(
      payload as unknown as SSLCommerzIPNPayload,
      this.storePassword,
    );
    if (!signatureResult.isValid) {
      this.logger.warn(`Invalid signature for transaction ${tran_id}: ${signatureResult.error}`);
      throw new BadRequestException({
        code: 'INVALID_SIGNATURE',
        message: signatureResult.error || 'Webhook signature verification failed',
      });
    }

    // Step 2: Validate response structure
    const validation = validateSSLCommerzResponse(payload);
    if (!validation.isValid) {
      this.logger.warn(`Invalid webhook payload: ${validation.error}`);
      throw new BadRequestException({
        code: 'INVALID_PAYLOAD',
        message: validation.error,
      });
    }

    // Step 3: Find payment intent
    const paymentIntent = await this.prisma.paymentIntent.findFirst({
      where: { tranId: tran_id },
      include: {
        booking: true,
      },
    });

    if (!paymentIntent) {
      this.logger.warn(`Payment intent not found for tran_id: ${tran_id}`);
      throw new BadRequestException({
        code: 'PAYMENT_INTENT_NOT_FOUND',
        message: 'Payment intent not found',
      });
    }

    // Step 4: Check idempotency
    const idempotencyKey = generatePaymentConfirmIdempotencyKey(paymentIntent.id);
    const idempotencyCheck = await this.idempotencyService.check<WebhookProcessingResult>(idempotencyKey);

    if (!idempotencyCheck.isNew && idempotencyCheck.result) {
      this.logger.log(`Idempotent webhook: already processed for ${tran_id}`);
      return {
        ...idempotencyCheck.result,
        isIdempotent: true,
      };
    }

    // Step 5: Verify amount matches
    const expectedAmount = paymentIntent.amount;
    const receivedAmount = Math.round(parseFloat(amount));

    if (receivedAmount !== expectedAmount) {
      this.logger.error(
        `Amount mismatch for ${tran_id}: expected ${expectedAmount}, received ${receivedAmount}`,
      );
      throw new BadRequestException({
        code: 'AMOUNT_MISMATCH',
        message: 'Payment amount does not match expected amount',
      });
    }

    // Step 6: Process based on status
    let result: WebhookProcessingResult;

    if (status === 'VALID' || status === 'VALIDATED') {
      result = await this.handleSuccessfulPayment(paymentIntent, payload);
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      result = await this.handleFailedPayment(paymentIntent, payload);
    } else {
      this.logger.warn(`Unknown payment status: ${status}`);
      result = {
        success: false,
        paymentIntentId: paymentIntent.id,
        message: `Unknown payment status: ${status}`,
      };
    }

    // Cache the result for idempotency
    await this.idempotencyService.markProcessed(idempotencyKey, result);

    return result;
  }

  /**
   * Handle successful payment
   */
  private async handleSuccessfulPayment(
    paymentIntent: any,
    payload: SSLCommerzWebhookPayload,
  ): Promise<WebhookProcessingResult> {
    const { tran_id, val_id, card_type } = payload;
    const booking = paymentIntent.booking;

    this.logger.log(`Processing successful payment for booking ${booking.id}`);

    // Check if booking can be confirmed
    const currentStatus = booking.status as BookingStatus;

    if (currentStatus === BookingStatus.EXPIRED) {
      // Late webhook - try to confirm but handle conflict
      return await this.handleLateWebhookSuccess(paymentIntent, booking, payload);
    }

    if (!canBeConfirmed(currentStatus)) {
      // Booking is already confirmed or in a state that can't be confirmed
      if (currentStatus === BookingStatus.CONFIRMED) {
        return {
          success: true,
          bookingId: booking.id,
          paymentIntentId: paymentIntent.id,
          message: 'Booking already confirmed',
        };
      }

      this.logger.warn(
        `Cannot confirm booking ${booking.id}: current status is ${currentStatus}`,
      );
      return {
        success: false,
        bookingId: booking.id,
        paymentIntentId: paymentIntent.id,
        message: `Cannot confirm booking with status ${currentStatus}`,
      };
    }

    // Perform the confirmation in a transaction
    try {
      await this.prisma.$transaction(async (tx) => {
        // Update payment intent
        await tx.paymentIntent.update({
          where: { id: paymentIntent.id },
          data: {
            status: 'SUCCESS',
            valId: val_id,
          },
        });

        // Create payment transaction record
        await tx.paymentTransaction.create({
          data: {
            paymentIntentId: paymentIntent.id,
            gateway: 'SSLCOMMERZ',
            tranId: tran_id,
            valId: val_id,
            amount: paymentIntent.amount,
            status: 'SUCCESS',
            rawPayload: payload as any,
          },
        });

        // Update booking status
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: 'CONFIRMED',
            paymentStage: 'ADVANCE_PAID',
          },
        });

        // Create booking event
        await tx.bookingEvent.create({
          data: {
            bookingId: booking.id,
            eventType: 'PAYMENT_CONFIRMED',
            payload: {
              tranId: tran_id,
              valId: val_id,
              amount: paymentIntent.amount,
              cardType: card_type,
            },
          },
        });
      });

      // Create ledger entry for owner credit (outside transaction for non-critical)
      try {
        await this.ledgerService.createBookingCredit(booking.id);
      } catch (error) {
        this.logger.error(`Failed to create ledger entry for booking ${booking.id}`, error);
      }

      // Send notifications
      try {
        await this.notificationsService.sendBookingConfirmation(booking.id);
      } catch (error) {
        this.logger.error(`Failed to send confirmation notification for booking ${booking.id}`, error);
      }

      return {
        success: true,
        bookingId: booking.id,
        paymentIntentId: paymentIntent.id,
        message: 'Payment confirmed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to confirm booking ${booking.id}`, error);
      throw error;
    }
  }

  /**
   * Handle late webhook where booking has expired
   */
  private async handleLateWebhookSuccess(
    paymentIntent: any,
    booking: any,
    payload: SSLCommerzWebhookPayload,
  ): Promise<WebhookProcessingResult> {
    const { tran_id, val_id } = payload;

    this.logger.warn(`Late webhook for expired booking ${booking.id}`);

    try {
      // Try to confirm the booking
      // The DB exclusion constraint will fail if someone else booked
      await this.prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: 'CONFIRMED',
            paymentStage: 'ADVANCE_PAID',
          },
        });

        await tx.paymentIntent.update({
          where: { id: paymentIntent.id },
          data: {
            status: 'SUCCESS',
            valId: val_id,
          },
        });

        await tx.paymentTransaction.create({
          data: {
            paymentIntentId: paymentIntent.id,
            gateway: 'SSLCOMMERZ',
            tranId: tran_id,
            valId: val_id,
            amount: paymentIntent.amount,
            status: 'SUCCESS',
            rawPayload: payload as any,
          },
        });

        await tx.bookingEvent.create({
          data: {
            bookingId: booking.id,
            eventType: 'LATE_PAYMENT_CONFIRMED',
            payload: {
              tranId: tran_id,
              originalStatus: 'EXPIRED',
            },
          },
        });
      });

      // Create ledger entry
      try {
        await this.ledgerService.createBookingCredit(booking.id);
      } catch (error) {
        this.logger.error(`Failed to create ledger entry for late booking ${booking.id}`, error);
      }

      return {
        success: true,
        bookingId: booking.id,
        paymentIntentId: paymentIntent.id,
        message: 'Late payment confirmed successfully',
      };
    } catch (error: any) {
      // Check if it's a conflict error (exclusion constraint violation)
      if (error.code === 'P2002' || error.message?.includes('exclusion')) {
        this.logger.warn(`Late webhook conflict: slot already booked for ${booking.id}`);

        // Mark as conflict and create refund workflow
        await this.handleLateWebhookConflict(paymentIntent, booking, payload);

        return {
          success: false,
          bookingId: booking.id,
          paymentIntentId: paymentIntent.id,
          message: 'Slot already booked by another user. Refund initiated.',
        };
      }

      throw error;
    }
  }

  /**
   * Handle conflict when late webhook cannot confirm due to another booking
   */
  private async handleLateWebhookConflict(
    paymentIntent: any,
    booking: any,
    payload: SSLCommerzWebhookPayload,
  ): Promise<void> {
    const { tran_id, val_id } = payload;

    await this.prisma.$transaction(async (tx) => {
      // Mark payment intent as late success conflict
      await tx.paymentIntent.update({
        where: { id: paymentIntent.id },
        data: {
          status: 'LATE_SUCCESS_CONFLICT',
          valId: val_id,
        },
      });

      // Create payment transaction
      await tx.paymentTransaction.create({
        data: {
          paymentIntentId: paymentIntent.id,
          gateway: 'SSLCOMMERZ',
          tranId: tran_id,
          valId: val_id,
          amount: paymentIntent.amount,
          status: 'SUCCESS',
          rawPayload: payload as any,
        },
      });

      // Create refund record
      await tx.refund.create({
        data: {
          bookingId: booking.id,
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          reason: 'Late payment conflict - slot already booked',
          status: 'REQUESTED',
          requestedAt: new Date(),
        },
      });

      // Create booking event
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          eventType: 'LATE_PAYMENT_CONFLICT',
          payload: {
            tranId: tran_id,
            refundInitiated: true,
          },
        },
      });
    });

    // Notify user about the conflict and refund
    try {
      await this.notificationsService.sendLatePaymentConflict(booking.id);
    } catch (error) {
      this.logger.error(`Failed to send conflict notification for booking ${booking.id}`, error);
    }
  }

  /**
   * Handle failed payment
   */
  private async handleFailedPayment(
    paymentIntent: any,
    payload: SSLCommerzWebhookPayload,
  ): Promise<WebhookProcessingResult> {
    const { tran_id, status, error } = payload;
    const booking = paymentIntent.booking;

    this.logger.log(`Processing failed payment for booking ${booking.id}: ${status}`);

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentIntent.update({
        where: { id: paymentIntent.id },
        data: {
          status: 'FAILED',
        },
      });

      await tx.paymentTransaction.create({
        data: {
          paymentIntentId: paymentIntent.id,
          gateway: 'SSLCOMMERZ',
          tranId: tran_id,
          amount: paymentIntent.amount,
          status: 'FAILED',
          rawPayload: payload as any,
        },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          eventType: 'PAYMENT_FAILED',
          payload: {
            tranId: tran_id,
            status,
            error,
          },
        },
      });
    });

    return {
      success: false,
      bookingId: booking.id,
      paymentIntentId: paymentIntent.id,
      message: `Payment failed: ${error || status}`,
    };
  }
}
