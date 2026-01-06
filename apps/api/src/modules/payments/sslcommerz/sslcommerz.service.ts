import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/db/prisma.service';
import { BookingsService } from '../../bookings/bookings.service';
import { createHash, createHmac } from 'crypto';
import { BookingStatus, PaymentIntentStatus } from '@prisma/client';

export interface SSLCommerzInitResponse {
  gatewayUrl: string;
  sessionKey: string;
  tranId: string;
  formFields: Record<string, string>;
  redirectMethod: 'GET' | 'POST';
}

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
  currency: string;
  card_issuer: string;
  card_brand: string;
  card_issuer_country: string;
  card_issuer_country_code: string;
  verify_sign: string;
  verify_key: string;
  verify_sign_sha2: string;
  currency_type: string;
  currency_amount: string;
  currency_rate: string;
  base_fair: string;
  value_a: string; // payment_intent_id
  value_b: string; // booking_id
  value_c: string; // booking_number
  value_d: string;
  risk_level: string;
  risk_title: string;
}

export interface InitiatePaymentInput {
  bookingId?: string;
  paymentIntentId?: string;
}

@Injectable()
export class SSLCommerzService {
  private readonly logger = new Logger(SSLCommerzService.name);
  private readonly storeId: string;
  private readonly storePassword: string;
  private readonly isLive: boolean;
  private readonly baseUrl: string;
  private readonly appUrl: string;
  private readonly apiUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
  ) {
    this.storeId = this.configService.get('SSLCOMMERZ_STORE_ID', '');
    this.storePassword = this.configService.get('SSLCOMMERZ_STORE_PASSWORD', '');
    this.isLive = this.configService.get('SSLCOMMERZ_IS_LIVE', 'false') === 'true';
    this.baseUrl = this.isLive
      ? 'https://securepay.sslcommerz.com'
      : 'https://sandbox.sslcommerz.com';
    this.appUrl = this.configService.get('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    this.apiUrl = this.configService.get('API_URL', 'http://localhost:3001/api/v1');
  }

  /**
   * Initiate SSLCommerz payment session
   * Called from /payments/sslcommerz/initiate
   *
   * Validates:
   * - Booking is in HOLD status
   * - Booking hold has not expired
   * - Facility is approved and owner subscription is TRIAL/ACTIVE
   *
   * Returns gateway_url and form_fields for auto-submitting POST form
   */
  async initiatePayment(input: InitiatePaymentInput): Promise<SSLCommerzInitResponse> {
    // Get payment intent and booking
    let paymentIntent;
    let booking;

    if (input.paymentIntentId) {
      paymentIntent = await this.prisma.paymentIntent.findUnique({
        where: { id: input.paymentIntentId },
        include: {
          booking: {
            include: {
              playArea: {
                include: {
                  facility: {
                    include: {
                      owner: true,
                    },
                  },
                },
              },
              sportProfile: {
                include: { sportType: true },
              },
            },
          },
        },
      });

      if (!paymentIntent) {
        throw new NotFoundException('Payment intent not found');
      }
      booking = paymentIntent.booking;
    } else if (input.bookingId) {
      booking = await this.prisma.booking.findUnique({
        where: { id: input.bookingId },
        include: {
          playArea: {
            include: {
              facility: {
                include: {
                  owner: true,
                },
              },
            },
          },
          sportProfile: {
            include: { sportType: true },
          },
          paymentIntents: {
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      paymentIntent = booking.paymentIntents?.[0];
      if (!paymentIntent) {
        throw new BadRequestException('No pending payment intent found for this booking');
      }
    } else {
      throw new BadRequestException('Either bookingId or paymentIntentId is required');
    }

    // Validate booking status
    if (booking.status !== BookingStatus.HOLD) {
      throw new BadRequestException(
        `Cannot initiate payment for booking in ${booking.status} status. Only HOLD bookings can be paid.`,
      );
    }

    // Validate hold has not expired
    if (booking.holdExpiresAt && new Date() > booking.holdExpiresAt) {
      throw new BadRequestException(
        'Booking hold has expired. Please create a new booking.',
      );
    }

    // Validate payment intent is still pending
    if (paymentIntent.status !== 'PENDING') {
      throw new BadRequestException(
        `Payment intent is ${paymentIntent.status}. Cannot initiate new payment.`,
      );
    }

    // Validate facility is approved
    const facility = booking.playArea.facility;
    if (!facility.isApproved) {
      throw new BadRequestException('Facility is not approved for bookings');
    }

    // Validate owner subscription is TRIAL or ACTIVE
    const subscription = await this.prisma.ownerSubscription.findUnique({
      where: { ownerId: facility.ownerId },
    });

    if (!subscription || !['TRIAL', 'ACTIVE'].includes(subscription.status)) {
      throw new BadRequestException(
        'Facility is currently not accepting bookings due to subscription status',
      );
    }

    // Generate unique transaction ID
    const tranId = this.generateTransactionId();

    // Build SSLCommerz request parameters
    const successUrl = `${this.appUrl}/checkout/success?bookingId=${booking.id}`;
    const failUrl = `${this.appUrl}/checkout/failed?bookingId=${booking.id}`;
    const cancelUrl = `${this.appUrl}/checkout/failed?bookingId=${booking.id}&reason=cancelled`;
    const ipnUrl = `${this.apiUrl}/payments/sslcommerz/webhook`;

    const params: Record<string, string> = {
      store_id: this.storeId,
      store_passwd: this.storePassword,
      total_amount: paymentIntent.amount.toString(),
      currency: 'BDT',
      tran_id: tranId,
      success_url: successUrl,
      fail_url: failUrl,
      cancel_url: cancelUrl,
      ipn_url: ipnUrl,

      // Customer info
      cus_name: booking.playerName,
      cus_email: booking.playerEmail || 'customer@sportzen.com',
      cus_phone: booking.playerPhone,
      cus_add1: facility.address,
      cus_city: facility.city,
      cus_country: 'Bangladesh',
      cus_postcode: '1000',

      // Product info
      product_name: `${booking.sportProfile.sportType.name} - ${facility.name}`,
      product_category: 'Sports Booking',
      product_profile: 'general',

      // Shipping (not applicable)
      shipping_method: 'NO',
      num_of_item: '1',

      // Custom values for webhook verification
      value_a: paymentIntent.id,
      value_b: booking.id,
      value_c: booking.bookingNumber,
      value_d: facility.id,

      // Multi-card/EMI options (optional)
      multi_card_name: '',
      allowed_bin: '',
    };

    try {
      this.logger.log('Initiating SSLCommerz payment', {
        tranId,
        bookingId: booking.id,
        amount: paymentIntent.amount,
      });

      // Call SSLCommerz API to create session
      const response = await fetch(`${this.baseUrl}/gwprocess/v4/api.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
      });

      const data = await response.json();

      if (data.status !== 'SUCCESS') {
        this.logger.error('SSLCommerz session creation failed', {
          status: data.status,
          failedreason: data.failedreason,
          tranId,
        });
        throw new InternalServerErrorException(
          `Payment gateway error: ${data.failedreason || 'Session creation failed'}`,
        );
      }

      // Update payment intent with SSLCommerz data
      await this.prisma.paymentIntent.update({
        where: { id: paymentIntent.id },
        data: {
          sslTranId: tranId,
          sslSessionKey: data.sessionkey,
          sslGatewayUrl: data.GatewayPageURL,
        },
      });

      this.logger.log('SSLCommerz session created successfully', {
        tranId,
        sessionKey: data.sessionkey,
      });

      // Return data for frontend
      // SSLCommerz hosted checkout uses GET redirect to GatewayPageURL
      // But we return form_fields for flexibility (POST form option)
      return {
        gatewayUrl: data.GatewayPageURL,
        sessionKey: data.sessionkey,
        tranId,
        redirectMethod: 'GET', // SSLCommerz uses GET redirect for hosted checkout
        formFields: {
          // For embedded checkout (if needed in future)
          store_id: this.storeId,
          tran_id: tranId,
          amount: paymentIntent.amount.toString(),
          currency: 'BDT',
          signature_key: data.sessionkey,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error('SSLCommerz initiation error', {
        error: error.message,
        tranId,
      });
      throw new InternalServerErrorException('Failed to initialize payment gateway');
    }
  }

  /**
   * Handle SSLCommerz IPN webhook
   * CRITICAL: This is the only trusted source of payment confirmation
   */
  async handleWebhook(payload: SSLCommerzWebhookPayload): Promise<{ success: boolean; message: string }> {
    const correlationId = `webhook-${payload.tran_id}-${Date.now()}`;

    this.logger.log('SSLCommerz webhook received', {
      correlationId,
      tranId: payload.tran_id,
      status: payload.status,
      amount: payload.amount,
      valId: payload.val_id,
    });

    // Step 1: Verify webhook signature
    const isSignatureValid = this.verifyWebhookSignature(payload);
    if (!isSignatureValid) {
      this.logger.error('Invalid webhook signature', {
        correlationId,
        tranId: payload.tran_id,
      });
      throw new BadRequestException('Invalid webhook signature');
    }

    // Step 2: Find payment intent by tran_id
    const paymentIntent = await this.prisma.paymentIntent.findUnique({
      where: { sslTranId: payload.tran_id },
      include: {
        booking: {
          include: {
            playArea: { include: { facility: true } },
          },
        },
      },
    });

    if (!paymentIntent) {
      // Try finding by value_a (payment_intent_id)
      const intentById = await this.prisma.paymentIntent.findUnique({
        where: { id: payload.value_a },
        include: {
          booking: {
            include: {
              playArea: { include: { facility: true } },
            },
          },
        },
      });

      if (!intentById) {
        this.logger.error('Payment intent not found', {
          correlationId,
          tranId: payload.tran_id,
          valueA: payload.value_a,
        });
        throw new BadRequestException('Payment intent not found');
      }
    }

    const intent = paymentIntent || (await this.prisma.paymentIntent.findUnique({
      where: { id: payload.value_a },
      include: {
        booking: {
          include: {
            playArea: { include: { facility: true } },
          },
        },
      },
    }));

    if (!intent) {
      throw new BadRequestException('Payment intent not found');
    }

    // Step 3: Idempotency check - already processed?
    const existingTransaction = await this.prisma.paymentTransaction.findFirst({
      where: {
        paymentIntentId: intent.id,
        tranId: payload.tran_id,
        status: { in: ['VALID', 'VALIDATED'] },
      },
    });

    if (existingTransaction) {
      this.logger.log('Webhook already processed (idempotent)', {
        correlationId,
        tranId: payload.tran_id,
        existingTransactionId: existingTransaction.id,
      });
      return { success: true, message: 'Already processed' };
    }

    // Step 4: Verify amount matches exactly
    const webhookAmount = Math.round(parseFloat(payload.amount));
    if (webhookAmount !== intent.amount) {
      this.logger.error('Amount mismatch detected', {
        correlationId,
        tranId: payload.tran_id,
        expected: intent.amount,
        received: webhookAmount,
      });

      // Record the tampered transaction
      await this.prisma.paymentTransaction.create({
        data: {
          paymentIntentId: intent.id,
          gateway: 'SSLCOMMERZ',
          tranId: payload.tran_id,
          valId: payload.val_id,
          amount: webhookAmount,
          currency: 'BDT',
          status: 'AMOUNT_MISMATCH',
          cardType: payload.card_type,
          cardBrand: payload.card_brand,
          bankTranId: payload.bank_tran_id,
          rawPayload: payload as unknown as Record<string, unknown>,
        },
      });

      throw new BadRequestException('Amount mismatch - possible tampering detected');
    }

    // Step 5: Validate with SSLCommerz API (double verification)
    const isValidWithSSL = await this.validateTransactionWithSSL(payload.val_id);
    if (!isValidWithSSL) {
      this.logger.error('SSLCommerz validation API rejected transaction', {
        correlationId,
        tranId: payload.tran_id,
        valId: payload.val_id,
      });

      await this.prisma.paymentTransaction.create({
        data: {
          paymentIntentId: intent.id,
          gateway: 'SSLCOMMERZ',
          tranId: payload.tran_id,
          valId: payload.val_id,
          amount: webhookAmount,
          currency: 'BDT',
          status: 'VALIDATION_FAILED',
          cardType: payload.card_type,
          cardBrand: payload.card_brand,
          bankTranId: payload.bank_tran_id,
          rawPayload: payload as unknown as Record<string, unknown>,
        },
      });

      throw new BadRequestException('Transaction validation failed with SSLCommerz');
    }

    // Step 6: Process based on payment status
    if (payload.status === 'VALID' || payload.status === 'VALIDATED') {
      return this.processSuccessfulPayment(intent, payload, correlationId);
    } else {
      return this.processFailedPayment(intent, payload, correlationId);
    }
  }

  /**
   * Process successful payment
   */
  private async processSuccessfulPayment(
    intent: any,
    payload: SSLCommerzWebhookPayload,
    correlationId: string,
  ): Promise<{ success: boolean; message: string }> {
    const booking = intent.booking;
    const webhookAmount = Math.round(parseFloat(payload.amount));

    // Check if booking is still in confirmable state
    if (booking.status === BookingStatus.CONFIRMED) {
      // Already confirmed - idempotent
      this.logger.log('Booking already confirmed', { correlationId, bookingId: booking.id });
      return { success: true, message: 'Booking already confirmed' };
    }

    if (booking.status === BookingStatus.EXPIRED) {
      // Late payment after hold expiry - handle specially
      return this.handleLatePayment(intent, payload, correlationId);
    }

    if (booking.status !== BookingStatus.HOLD) {
      this.logger.error('Booking in unexpected status', {
        correlationId,
        bookingId: booking.id,
        status: booking.status,
      });
      throw new BadRequestException(`Cannot confirm booking in ${booking.status} status`);
    }

    // Confirm the booking
    try {
      await this.bookingsService.confirmBooking(
        booking.id,
        intent.id,
        {
          tranId: payload.tran_id,
          valId: payload.val_id,
          amount: webhookAmount,
        },
      );

      this.logger.log('Booking confirmed successfully', {
        correlationId,
        bookingId: booking.id,
        tranId: payload.tran_id,
      });

      return { success: true, message: 'Payment confirmed and booking updated' };
    } catch (error) {
      this.logger.error('Failed to confirm booking', {
        correlationId,
        bookingId: booking.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process failed payment
   */
  private async processFailedPayment(
    intent: any,
    payload: SSLCommerzWebhookPayload,
    correlationId: string,
  ): Promise<{ success: boolean; message: string }> {
    const webhookAmount = Math.round(parseFloat(payload.amount));

    await this.prisma.$transaction([
      this.prisma.paymentTransaction.create({
        data: {
          paymentIntentId: intent.id,
          gateway: 'SSLCOMMERZ',
          tranId: payload.tran_id,
          valId: payload.val_id,
          amount: webhookAmount,
          currency: 'BDT',
          status: payload.status,
          cardType: payload.card_type,
          cardBrand: payload.card_brand,
          bankTranId: payload.bank_tran_id,
          rawPayload: payload as unknown as Record<string, unknown>,
        },
      }),
      this.prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: 'FAILED' },
      }),
    ]);

    this.logger.warn('Payment failed', {
      correlationId,
      tranId: payload.tran_id,
      status: payload.status,
    });

    return { success: true, message: 'Payment failure recorded' };
  }

  /**
   * Handle late payment after hold expiry
   * Attempts to confirm if slot still available, otherwise creates refund
   */
  private async handleLatePayment(
    intent: any,
    payload: SSLCommerzWebhookPayload,
    correlationId: string,
  ): Promise<{ success: boolean; message: string }> {
    const booking = intent.booking;
    const webhookAmount = Math.round(parseFloat(payload.amount));

    this.logger.warn('Processing late payment after hold expiry', {
      correlationId,
      bookingId: booking.id,
      tranId: payload.tran_id,
    });

    // Check if slot is still available
    const isSlotAvailable = await this.checkSlotAvailability(booking);

    if (isSlotAvailable) {
      // Attempt to confirm the booking
      try {
        await this.prisma.$transaction(async (tx) => {
          // Update booking status
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: BookingStatus.CONFIRMED,
              paymentStage: 'ADVANCE_PAID',
              confirmedAt: new Date(),
            },
          });

          // Update payment intent
          await tx.paymentIntent.update({
            where: { id: intent.id },
            data: { status: 'SUCCESS' },
          });

          // Create transaction record
          await tx.paymentTransaction.create({
            data: {
              paymentIntentId: intent.id,
              gateway: 'SSLCOMMERZ',
              tranId: payload.tran_id,
              valId: payload.val_id,
              amount: webhookAmount,
              currency: 'BDT',
              status: 'VALID',
              cardType: payload.card_type,
              cardBrand: payload.card_brand,
              bankTranId: payload.bank_tran_id,
              rawPayload: payload as unknown as Record<string, unknown>,
              verifiedAt: new Date(),
            },
          });

          // Create booking event
          await tx.bookingEvent.create({
            data: {
              bookingId: booking.id,
              event: 'late_payment_accepted',
              fromStatus: 'EXPIRED',
              toStatus: 'CONFIRMED',
              metadata: {
                tranId: payload.tran_id,
                latePayment: true,
              },
            },
          });
        });

        this.logger.log('Late payment accepted - slot was available', {
          correlationId,
          bookingId: booking.id,
        });

        return { success: true, message: 'Late payment accepted - booking confirmed' };
      } catch (error) {
        // Conflict occurred during confirmation
        this.logger.error('Conflict during late payment confirmation', {
          correlationId,
          bookingId: booking.id,
          error: error.message,
        });
        // Fall through to create refund
      }
    }

    // Slot not available or conflict occurred - create refund
    await this.prisma.$transaction(async (tx) => {
      // Mark payment intent as late success conflict
      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: PaymentIntentStatus.LATE_SUCCESS_CONFLICT },
      });

      // Create transaction record
      await tx.paymentTransaction.create({
        data: {
          paymentIntentId: intent.id,
          gateway: 'SSLCOMMERZ',
          tranId: payload.tran_id,
          valId: payload.val_id,
          amount: webhookAmount,
          currency: 'BDT',
          status: 'LATE_SUCCESS_CONFLICT',
          cardType: payload.card_type,
          cardBrand: payload.card_brand,
          bankTranId: payload.bank_tran_id,
          rawPayload: payload as unknown as Record<string, unknown>,
          verifiedAt: new Date(),
        },
      });

      // Create automatic refund record
      await tx.refund.create({
        data: {
          bookingId: booking.id,
          paymentIntentId: intent.id,
          refundAmount: webhookAmount,
          platformFeeRetained: 0, // Full refund for late conflict
          originalAdvance: webhookAmount,
          refundTier: 'late_payment_conflict',
          status: 'APPROVED',
          reason: 'Payment received after hold expired and slot was booked by another customer',
          approvedAt: new Date(),
        },
      });

      // Create booking event
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          event: 'late_payment_conflict_refund',
          metadata: {
            tranId: payload.tran_id,
            refundAmount: webhookAmount,
            reason: 'Slot no longer available',
          },
        },
      });
    });

    this.logger.warn('Late payment conflict - refund created', {
      correlationId,
      bookingId: booking.id,
      refundAmount: webhookAmount,
    });

    // TODO: Send notification to user and admin

    return { success: true, message: 'Late payment conflict - refund initiated' };
  }

  /**
   * Check if booking's slot is still available
   */
  private async checkSlotAvailability(booking: any): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM bookings
        WHERE conflict_group_id = ${booking.conflictGroupId}::uuid
          AND id != ${booking.id}::uuid
          AND deleted_at IS NULL
          AND status IN ('HOLD', 'CONFIRMED')
          AND tstzrange(start_at, blocked_end_at) && tstzrange(${booking.startAt}::timestamptz, ${booking.blockedEndAt}::timestamptz)
      `;
      return Number(result[0].count) === 0;
    } catch (error) {
      this.logger.error('Error checking slot availability', { error: error.message });
      return false;
    }
  }

  /**
   * Verify webhook signature using SSLCommerz verify_sign method
   */
  verifyWebhookSignature(payload: SSLCommerzWebhookPayload): boolean {
    const verifyKey = payload.verify_key;
    const verifySign = payload.verify_sign;

    if (!verifyKey || !verifySign) {
      this.logger.warn('Missing verify_key or verify_sign in webhook payload');
      return false;
    }

    try {
      // Build the string to hash based on verify_key fields
      const keyFields = verifyKey.split(',');
      const values: string[] = [];

      for (const field of keyFields) {
        const value = (payload as Record<string, string>)[field];
        if (value !== undefined && value !== null) {
          values.push(`${field}=${value}`);
        }
      }

      // Add hashed store password
      const hashedPassword = createHash('md5')
        .update(this.storePassword)
        .digest('hex');
      values.push(`store_passwd=${hashedPassword}`);

      const signString = values.join('&');
      const calculatedSign = createHash('md5')
        .update(signString)
        .digest('hex');

      const isValid = calculatedSign === verifySign;

      if (!isValid) {
        this.logger.warn('Signature verification failed', {
          expected: calculatedSign,
          received: verifySign,
        });
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying webhook signature', { error: error.message });
      return false;
    }
  }

  /**
   * Validate transaction with SSLCommerz validation API
   */
  private async validateTransactionWithSSL(valId: string): Promise<boolean> {
    try {
      const validationUrl = `${this.baseUrl}/validator/api/validationserverAPI.php`;
      const params = new URLSearchParams({
        val_id: valId,
        store_id: this.storeId,
        store_passwd: this.storePassword,
        format: 'json',
      });

      const response = await fetch(`${validationUrl}?${params}`);
      const data = await response.json();

      this.logger.log('SSLCommerz validation response', {
        valId,
        status: data.status,
      });

      return data.status === 'VALID' || data.status === 'VALIDATED';
    } catch (error) {
      this.logger.error('SSLCommerz validation API error', {
        valId,
        error: error.message,
      });
      // In case of network error, we rely on signature verification
      return false;
    }
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `SZ${timestamp}${random}`;
  }

  /**
   * Process webhook - alias for handleWebhook
   */
  async processWebhook(payload: SSLCommerzWebhookPayload): Promise<{ success: boolean; message: string }> {
    return this.handleWebhook(payload);
  }

  /**
   * Get payment status for polling
   */
  async getPaymentStatus(paymentIntentId: string): Promise<{
    status: string;
    bookingStatus: string;
    bookingId: string;
    bookingNumber: string;
    isConfirmed: boolean;
  }> {
    const paymentIntent = await this.prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            bookingNumber: true,
          },
        },
      },
    });

    if (!paymentIntent) {
      throw new NotFoundException('Payment intent not found');
    }

    return {
      status: paymentIntent.status,
      bookingStatus: paymentIntent.booking.status,
      bookingId: paymentIntent.booking.id,
      bookingNumber: paymentIntent.booking.bookingNumber,
      isConfirmed: paymentIntent.booking.status === BookingStatus.CONFIRMED,
    };
  }

  /**
   * Get redirect URLs
   */
  getSuccessRedirectUrl(bookingId: string): string {
    return `${this.appUrl}/checkout/success?bookingId=${bookingId}`;
  }

  getFailRedirectUrl(bookingId: string): string {
    return `${this.appUrl}/checkout/failed?bookingId=${bookingId}`;
  }

  getCancelRedirectUrl(bookingId: string): string {
    return `${this.appUrl}/checkout/failed?bookingId=${bookingId}&reason=cancelled`;
  }
}
