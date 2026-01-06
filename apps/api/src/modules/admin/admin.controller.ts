import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole, SubscriptionStatus } from '@prisma/client';
import { IsString, IsOptional, IsNumber, IsEnum, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

class PaginationQueryDto {
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

class RejectFacilityDto {
  @IsString()
  @MinLength(10)
  reason: string;
}

class UpdateSubscriptionDto {
  @IsEnum(SubscriptionStatus)
  status: SubscriptionStatus;
}

class MarkRefundCompleteDto {
  @IsString()
  @MinLength(5)
  referenceId: string;
}

class ModerateReviewDto {
  @IsEnum(['hide', 'restore', 'delete'])
  action: 'hide' | 'restore' | 'delete';
}

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ============================================================================
  // DASHBOARD
  // ============================================================================

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  async getDashboard() {
    const stats = await this.adminService.getDashboardStats();
    return { success: true, data: stats };
  }

  // ============================================================================
  // FACILITY APPROVALS
  // ============================================================================

  @Get('facility-approvals')
  @ApiOperation({ summary: 'Get pending facility approvals' })
  async getPendingApprovals(@Query() query: PaginationQueryDto) {
    const result = await this.adminService.getPendingApprovals(
      query.page || 1,
      query.limit || 20,
    );
    return { success: true, data: result };
  }

  @Post('facility-approvals/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a facility' })
  async approveFacility(
    @Param('id', ParseUUIDPipe) facilityId: string,
    @CurrentUser('id') adminId: string,
  ) {
    await this.adminService.approveFacility(facilityId, adminId);
    return { success: true, message: 'Facility approved' };
  }

  @Post('facility-approvals/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a facility' })
  async rejectFacility(
    @Param('id', ParseUUIDPipe) facilityId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: RejectFacilityDto,
  ) {
    await this.adminService.rejectFacility(facilityId, adminId, dto.reason);
    return { success: true, message: 'Facility rejected' };
  }

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  @Get('subscriptions')
  @ApiOperation({ summary: 'Get all subscriptions' })
  async getSubscriptions(
    @Query('status') status?: SubscriptionStatus,
    @Query() query?: PaginationQueryDto,
  ) {
    const result = await this.adminService.getSubscriptions(
      status,
      query?.page || 1,
      query?.limit || 20,
    );
    return { success: true, data: result };
  }

  @Patch('subscriptions/:ownerId/status')
  @ApiOperation({ summary: 'Update subscription status' })
  async updateSubscriptionStatus(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    await this.adminService.updateSubscriptionStatus(ownerId, dto.status, adminId);
    return { success: true, message: 'Subscription status updated' };
  }

  // ============================================================================
  // REFUNDS
  // ============================================================================

  @Get('refunds')
  @ApiOperation({ summary: 'Get pending refunds' })
  async getPendingRefunds(@Query() query: PaginationQueryDto) {
    const result = await this.adminService.getPendingRefunds(
      query.page || 1,
      query.limit || 20,
    );
    return { success: true, data: result };
  }

  @Post('refunds/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a refund' })
  async approveRefund(
    @Param('id', ParseUUIDPipe) refundId: string,
    @CurrentUser('id') adminId: string,
  ) {
    await this.adminService.approveRefund(refundId, adminId);
    return { success: true, message: 'Refund approved' };
  }

  @Post('refunds/:id/mark-manual-complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark refund as manually completed' })
  async markRefundComplete(
    @Param('id', ParseUUIDPipe) refundId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: MarkRefundCompleteDto,
  ) {
    await this.adminService.markRefundComplete(refundId, adminId, dto.referenceId);
    return { success: true, message: 'Refund marked as complete' };
  }

  // ============================================================================
  // DISPUTES
  // ============================================================================

  @Get('disputes')
  @ApiOperation({ summary: 'Get disputes' })
  async getDisputes(@Query() query: PaginationQueryDto) {
    const result = await this.adminService.getDisputes(
      query.page || 1,
      query.limit || 20,
    );
    return { success: true, data: result };
  }

  // ============================================================================
  // REVIEW MODERATION
  // ============================================================================

  @Get('reviews')
  @ApiOperation({ summary: 'Get reviews for moderation' })
  async getReviews(@Query() query: PaginationQueryDto) {
    const result = await this.adminService.getReportsedReviews(
      query.page || 1,
      query.limit || 20,
    );
    return { success: true, data: result };
  }

  @Patch('reviews/:id/moderate')
  @ApiOperation({ summary: 'Moderate a review' })
  async moderateReview(
    @Param('id', ParseUUIDPipe) reviewId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ModerateReviewDto,
  ) {
    await this.adminService.moderateReview(reviewId, dto.action, adminId);
    return { success: true, message: `Review ${dto.action}d` };
  }
}
