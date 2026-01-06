import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
  Logger,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { SSLCommerzService } from './sslcommerz.service';
import { BookingsService } from '../../bookings/bookings.service';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { DevOnlyGuard } from '../../../common/guards/dev-only.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { PrismaService } from '../../../common/db/prisma.service';
import { IsString, IsUUID, IsOptional } from 'class-validator';

class InitiatePaymentDto {
  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @IsUUID()
  @IsOptional()
  paymentIntentId?: string;
}

// DEV ONLY: Webhook simulator DTO
class DevWebhookSimulatorDto {
  @IsUUID()
  paymentIntentId: string;

  @IsOptional()
  @IsString()
  tranId?: string;
}

@ApiTags('payments')
@Controller('payments')
export class SSLCommerzController {
  private readonly logger = new Logger(SSLCommerzController.name);

  constructor(
    private readonly sslcommerzService: SSLCommerzService,
    private readonly bookingsService: BookingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('sslcommerz/initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate SSLCommerz payment' })
  async initiatePayment(
    @CurrentUser() user: any,
    @Body() dto: InitiatePaymentDto,
  ) {
    if (!dto.bookingId && !dto.paymentIntentId) {
      throw new BadRequestException('Either bookingId or paymentIntentId is required');
    }

    // Initiate SSLCommerz session using the new service
    const result = await this.sslcommerzService.initiatePayment({
      bookingId: dto.bookingId,
      paymentIntentId: dto.paymentIntentId,
    });

    return { success: true, data: result };
  }

  @Post('sslcommerz/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SSLCommerz IPN webhook' })
  async handleWebhook(@Body() payload: any) {
    this.logger.log('SSLCommerz webhook received', {
      tranId: payload.tran_id,
      status: payload.status,
    });

    try {
      // Process the webhook (signature verification is done inside the service)
      const result = await this.sslcommerzService.handleWebhook(payload);
      return { status: result.success ? 'OK' : 'FAILED', message: result.message };
    } catch (error) {
      this.logger.error('Webhook processing failed', error);
      return { status: 'ERROR', message: error.message };
    }
  }

  @Post('sslcommerz/success')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SSLCommerz success redirect (POST)' })
  async handleSuccessRedirect(@Body() payload: any, @Res() res: Response) {
    // Log the return but do NOT confirm payment here
    this.logger.log('SSLCommerz success redirect received', {
      tranId: payload.tran_id,
    });

    // Extract payment intent ID from tran_id (format: SSLCZ-{intentId}-{timestamp})
    const tranIdParts = payload.tran_id?.split('-') || [];
    const intentId = tranIdParts.length >= 2 ? tranIdParts[1] : null;

    // Redirect to frontend pending page - actual confirmation is via webhook only
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return res.redirect(`${appUrl}/checkout/pending?intentId=${intentId}`);
  }

  @Post('sslcommerz/fail')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SSLCommerz fail redirect (POST)' })
  async handleFailRedirect(@Body() payload: any, @Res() res: Response) {
    this.logger.log('SSLCommerz fail redirect received', {
      tranId: payload.tran_id,
      error: payload.error,
    });

    const tranIdParts = payload.tran_id?.split('-') || [];
    const intentId = tranIdParts.length >= 2 ? tranIdParts[1] : null;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return res.redirect(`${appUrl}/checkout/failed?intentId=${intentId}&error=${encodeURIComponent(payload.error || 'Payment failed')}`);
  }

  @Post('sslcommerz/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SSLCommerz cancel redirect (POST)' })
  async handleCancelRedirect(@Body() payload: any, @Res() res: Response) {
    this.logger.log('SSLCommerz cancel redirect received', {
      tranId: payload.tran_id,
    });

    const tranIdParts = payload.tran_id?.split('-') || [];
    const intentId = tranIdParts.length >= 2 ? tranIdParts[1] : null;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return res.redirect(`${appUrl}/checkout/failed?intentId=${intentId}&error=Payment%20cancelled`);
  }

  @Get(':intentId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment intent status' })
  async getPaymentStatus(@Param('intentId', ParseUUIDPipe) intentId: string) {
    const paymentIntent = await this.prisma.paymentIntent.findUnique({
      where: { id: intentId },
      include: {
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            status: true,
            startAt: true,
            endAt: true,
          },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!paymentIntent) {
      throw new BadRequestException('Payment intent not found');
    }

    return {
      success: true,
      data: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        booking: paymentIntent.booking,
        lastTransaction: paymentIntent.transactions[0] || null,
      },
    };
  }

  // =============================================================================
  // DEV ONLY: Webhook Simulator
  // These endpoints allow testing the booking confirmation flow without real SSLCommerz
  // Protected by DevOnlyGuard - returns 404 in production
  // =============================================================================
  @Post('dev/simulate-webhook')
  @UseGuards(DevOnlyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '[DEV ONLY] Simulate successful payment webhook' })
  async simulateWebhook(@Body() dto: DevWebhookSimulatorDto) {
    this.logger.log('DEV: Simulating webhook for payment intent', dto.paymentIntentId);

    // Get payment intent
    const paymentIntent = await this.prisma.paymentIntent.findUnique({
      where: { id: dto.paymentIntentId },
      include: { booking: true },
    });

    if (!paymentIntent) {
      throw new BadRequestException('Payment intent not found');
    }

    if (paymentIntent.status === 'SUCCESS') {
      return {
        success: true,
        message: 'Payment already confirmed',
        bookingStatus: 'CONFIRMED',
      };
    }

    // Generate mock transaction ID if not provided
    const tranId = dto.tranId || `DEV-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    // Call the bookings service to confirm
    await this.bookingsService.confirmBooking(
      paymentIntent.bookingId,
      paymentIntent.id,
      {
        tranId,
        valId: `VAL-${tranId}`,
        amount: paymentIntent.amount,
      },
    );

    // Get updated booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: paymentIntent.bookingId },
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        qrToken: true,
      },
    });

    return {
      success: true,
      message: 'Payment simulated successfully',
      data: {
        tranId,
        paymentIntentId: paymentIntent.id,
        bookingId: booking?.id,
        bookingNumber: booking?.bookingNumber,
        bookingStatus: booking?.status,
        qrToken: booking?.qrToken,
      },
    };
  }

  @Post('dev/expire-hold/:bookingId')
  @UseGuards(DevOnlyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '[DEV ONLY] Simulate hold expiry' })
  async simulateExpiry(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    await this.bookingsService.expireHold(bookingId);
    return { success: true, message: 'Hold expired' };
  }

  @Post('dev/complete-booking/:bookingId')
  @UseGuards(DevOnlyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '[DEV ONLY] Simulate booking completion' })
  async simulateCompletion(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    await this.bookingsService.completeBooking(bookingId);
    return { success: true, message: 'Booking completed' };
  }

  @Post('dev/simulate-late-webhook/:paymentIntentId')
  @UseGuards(DevOnlyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '[DEV ONLY] Simulate late payment after hold expiry' })
  async simulateLateWebhook(@Param('paymentIntentId', ParseUUIDPipe) paymentIntentId: string) {
    this.logger.log('DEV: Simulating late webhook for payment intent', paymentIntentId);

    const paymentIntent = await this.prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId },
      include: { booking: true },
    });

    if (!paymentIntent) {
      throw new BadRequestException('Payment intent not found');
    }

    // First expire the hold if still in HOLD status
    if (paymentIntent.booking.status === 'HOLD') {
      await this.bookingsService.expireHold(paymentIntent.bookingId);
    }

    // Now simulate the late webhook
    const tranId = `DEV-LATE-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    await this.bookingsService.confirmBooking(
      paymentIntent.bookingId,
      paymentIntent.id,
      {
        tranId,
        valId: `VAL-${tranId}`,
        amount: paymentIntent.amount,
      },
    );

    // Get updated records
    const [updatedIntent, updatedBooking] = await Promise.all([
      this.prisma.paymentIntent.findUnique({ where: { id: paymentIntentId } }),
      this.prisma.booking.findUnique({ where: { id: paymentIntent.bookingId } }),
    ]);

    return {
      success: true,
      message: 'Late webhook simulated',
      data: {
        tranId,
        paymentIntentStatus: updatedIntent?.status,
        bookingStatus: updatedBooking?.status,
        wasConflict: updatedIntent?.status === 'LATE_SUCCESS_CONFLICT',
      },
    };
  }
}
