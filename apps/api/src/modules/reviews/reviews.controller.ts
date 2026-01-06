import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { IsString, IsNumber, IsUUID, Min, Max, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

class CreateReviewDto {
  @IsUUID()
  bookingId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating: number;

  @IsString()
  @MinLength(10)
  comment: string;
}

class ReportReviewDto {
  @IsString()
  @MinLength(10)
  reason: string;
}

class PaginationQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a review for a booking' })
  async createReview(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReviewDto,
  ) {
    const review = await this.reviewsService.createReview(userId, {
      bookingId: dto.bookingId,
      rating: dto.rating,
      comment: dto.comment,
    });
    return { success: true, data: review };
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report a review' })
  async reportReview(
    @Param('id', ParseUUIDPipe) reviewId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReportReviewDto,
  ) {
    await this.reviewsService.reportReview(reviewId, userId, dto.reason);
    return { success: true, message: 'Review reported' };
  }

  @Get('facility/:facilityId')
  @ApiOperation({ summary: 'Get reviews for a facility' })
  async getFacilityReviews(
    @Param('facilityId', ParseUUIDPipe) facilityId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const result = await this.reviewsService.getFacilityReviews(
      facilityId,
      query.page,
      query.limit,
    );
    return { success: true, data: result };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user reviews' })
  async getMyReviews(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const result = await this.reviewsService.getUserReviews(
      userId,
      query.page,
      query.limit,
    );
    return { success: true, data: result };
  }
}
