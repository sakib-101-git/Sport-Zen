import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OwnerService, OwnerBookingsQuery } from './owner.service';
import { BookingsService } from '../bookings/bookings.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole, BlockType, BookingStatus } from '@prisma/client';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
  IsArray,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { parseISO } from 'date-fns';

class GetBookingsQueryDto {
  @IsOptional()
  @IsString()
  month?: string; // YYYY-MM format

  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @IsOptional()
  @IsUUID()
  playAreaId?: string;

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

class CreateBlockDto {
  @IsUUID()
  facilityId: string;

  @IsOptional()
  @IsUUID()
  playAreaId?: string;

  @IsEnum(BlockType)
  blockType: BlockType;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;
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

class GetLedgerQueryDto {
  @IsOptional()
  @IsString()
  periodMonth?: string; // YYYY-MM format
}

@ApiTags('owner')
@Controller('owner')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.OWNER_STAFF)
@ApiBearerAuth()
export class OwnerController {
  constructor(
    private readonly ownerService: OwnerService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get owner dashboard stats' })
  async getDashboard(@CurrentUser('id') userId: string) {
    const stats = await this.ownerService.getDashboardStats(userId);
    return { success: true, data: stats };
  }

  @Get('facilities')
  @ApiOperation({ summary: 'Get owner facilities' })
  async getFacilities(@CurrentUser('id') userId: string) {
    const facilities = await this.ownerService.getOwnerFacilities(userId);
    return { success: true, data: facilities };
  }

  @Get('bookings')
  @ApiOperation({ summary: 'Get owner bookings for calendar' })
  async getBookings(
    @CurrentUser('id') userId: string,
    @Query() query: GetBookingsQueryDto,
  ) {
    const ownerQuery: OwnerBookingsQuery = {
      month: query.month,
      facilityId: query.facilityId,
      playAreaId: query.playAreaId,
      status: query.status,
      page: query.page,
      limit: query.limit,
    };

    const result = await this.ownerService.getOwnerBookings(userId, ownerQuery);
    return { success: true, data: result };
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get calendar view data (alias for bookings)' })
  async getCalendar(
    @CurrentUser('id') userId: string,
    @Query() query: GetBookingsQueryDto,
  ) {
    return this.getBookings(userId, query);
  }

  @Get('blocks')
  @ApiOperation({ summary: 'Get owner booking blocks' })
  async getBlocks(
    @CurrentUser('id') userId: string,
    @Query('facilityId') facilityId?: string,
  ) {
    const blocks = await this.ownerService.getOwnerBlocks(userId, facilityId);
    return { success: true, data: blocks };
  }

  @Post('blocks')
  @ApiOperation({ summary: 'Create booking block' })
  async createBlock(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBlockDto,
  ) {
    const block = await this.ownerService.createBlock(userId, {
      facilityId: dto.facilityId,
      playAreaId: dto.playAreaId,
      blockType: dto.blockType,
      reason: dto.reason,
      startAt: parseISO(dto.startAt),
      endAt: parseISO(dto.endAt),
    });
    return { success: true, data: block };
  }

  @Delete('blocks/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete booking block' })
  async deleteBlock(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) blockId: string,
  ) {
    await this.ownerService.deleteBlock(userId, blockId);
    return { success: true };
  }

  @Post('bookings/:id/offline-payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record offline payment for booking' })
  async recordOfflinePayment(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() dto: RecordOfflinePaymentDto,
  ) {
    await this.bookingsService.recordOfflinePayment(
      bookingId,
      userId,
      dto.amount,
      dto.method,
      dto.notes,
    );
    return { success: true };
  }

  @Post('bookings/:id/verify-checkin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify booking check-in via booking ID' })
  async verifyCheckinByBookingId(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) bookingId: string,
  ) {
    // Get booking to get QR token
    const booking = await this.bookingsService.getBooking(bookingId);
    if (!booking?.qrToken) {
      return { success: false, message: 'Booking not found or no QR token' };
    }

    const result = await this.bookingsService.verifyCheckin(booking.qrToken, userId);
    return { success: result.success, message: result.message };
  }

  @Get('settlements')
  @ApiOperation({ summary: 'Get owner ledger/settlement entries' })
  async getSettlements(
    @CurrentUser('id') userId: string,
    @Query() query: GetLedgerQueryDto,
  ) {
    const result = await this.ownerService.getLedgerEntries(userId, query.periodMonth);
    return { success: true, data: result };
  }
}
