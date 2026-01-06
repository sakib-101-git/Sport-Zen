import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService, CreateHoldInput } from './bookings.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole, BookingStatus } from '@prisma/client';
import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEmail,
  Min,
  MinLength,
  IsEnum,
  IsArray,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { parseISO, isValid } from 'date-fns';

class CreateHoldDto {
  @IsUUID()
  playAreaId: string;

  @IsUUID()
  sportProfileId: string;

  @IsDateString()
  startAt: string;

  @IsNumber()
  @Min(30)
  durationMinutes: number;

  @IsString()
  @MinLength(2)
  playerName: string;

  @IsString()
  @MinLength(10)
  playerPhone: string;

  @IsOptional()
  @IsEmail()
  playerEmail?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class CancelBookingDto {
  @IsString()
  @MinLength(5)
  reason: string;
}

class VerifyCheckinDto {
  @IsString()
  qrToken: string;
}

class RecordOfflinePaymentDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsEnum(['CASH', 'BKASH', 'NAGAD', 'CARD', 'OTHER'])
  method: 'CASH' | 'BKASH' | 'NAGAD' | 'CARD' | 'OTHER';

  @IsOptional()
  @IsString()
  notes?: string;
}

class GetBookingsQueryDto {
  @IsOptional()
  @IsArray()
  @IsEnum(BookingStatus, { each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  status?: BookingStatus[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('hold')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a booking hold' })
  async createHold(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateHoldDto,
  ) {
    const startAt = parseISO(dto.startAt);
    if (!isValid(startAt)) {
      throw new BadRequestException('Invalid start time format');
    }

    const input: CreateHoldInput = {
      playAreaId: dto.playAreaId,
      sportProfileId: dto.sportProfileId,
      startAt,
      durationMinutes: dto.durationMinutes,
      playerName: dto.playerName,
      playerPhone: dto.playerPhone,
      playerEmail: dto.playerEmail,
      notes: dto.notes,
    };

    const result = await this.bookingsService.createHold(userId, input);
    return { success: true, data: result };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user bookings' })
  async getMyBookings(
    @CurrentUser('id') userId: string,
    @Query() query: GetBookingsQueryDto,
  ) {
    const result = await this.bookingsService.getUserBookings(
      userId,
      query.status,
      query.page && query.limit ? { page: query.page, limit: query.limit } : undefined,
    );
    return { success: true, data: result };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get booking details' })
  async getBooking(@Param('id', ParseUUIDPipe) id: string) {
    const booking = await this.bookingsService.getBooking(id);
    if (!booking) {
      throw new BadRequestException('Booking not found');
    }
    return { success: true, data: booking };
  }

  @Get(':id/qr')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get booking QR code data' })
  async getBookingQr(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    const booking = await this.bookingsService.getBooking(id);
    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    // Only the player or owner/staff can see QR
    if (booking.playerId !== userId) {
      throw new BadRequestException('Not authorized to view QR code');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('QR code only available for confirmed bookings');
    }

    return {
      success: true,
      data: {
        qrToken: booking.qrToken,
        bookingNumber: booking.bookingNumber,
        playerName: booking.playerName,
        startAt: booking.startAt,
        endAt: booking.endAt,
        facilityName: booking.playArea.facility.name,
        playAreaName: booking.playArea.name,
      },
    };
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a booking' })
  async cancelBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CancelBookingDto,
  ) {
    const result = await this.bookingsService.cancelBooking(id, userId, dto.reason);
    return { success: true, data: result };
  }

  @Post(':id/checkin')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify check-in via QR token' })
  async verifyCheckin(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyCheckinDto,
  ) {
    const result = await this.bookingsService.verifyCheckin(dto.qrToken, userId);
    return { success: result.success, message: result.message };
  }

  @Post(':id/offline-payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.OWNER_STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record offline payment for booking' })
  async recordOfflinePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RecordOfflinePaymentDto,
  ) {
    await this.bookingsService.recordOfflinePayment(
      id,
      userId,
      dto.amount,
      dto.method,
      dto.notes,
    );
    return { success: true };
  }
}
