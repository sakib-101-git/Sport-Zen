import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { BookingStatus, CheckinStatus } from '@prisma/client';

export interface CreateReviewInput {
  bookingId: string;
  rating: number;
  comment: string;
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a review for a booking
   * Requirements:
   * - Booking must be COMPLETED
   * - Check-in must be VERIFIED
   * - No existing review for this booking
   */
  async createReview(userId: string, input: CreateReviewInput): Promise<any> {
    const { bookingId, rating, comment } = input;

    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Get booking and verify eligibility
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        review: true,
        playArea: {
          include: { facility: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Verify ownership
    if (booking.playerId !== userId) {
      throw new ForbiddenException('You can only review your own bookings');
    }

    // Verify booking is completed
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Can only review completed bookings');
    }

    // Verify check-in was done
    if (booking.checkinStatus !== CheckinStatus.VERIFIED) {
      throw new BadRequestException('Check-in verification required before reviewing');
    }

    // Check for existing review
    if (booking.review) {
      throw new BadRequestException('Review already exists for this booking');
    }

    // Create the review
    const review = await this.prisma.review.create({
      data: {
        bookingId,
        rating,
        comment,
      },
      include: {
        booking: {
          select: {
            playerName: true,
            playArea: {
              select: {
                name: true,
                facility: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    this.logger.log(`Review created for booking ${bookingId} by user ${userId}`);

    return review;
  }

  /**
   * Report a review
   */
  async reportReview(
    reviewId: string,
    userId: string,
    reason: string,
  ): Promise<void> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Check if user already reported this review
    const existingReport = await this.prisma.reviewReport.findFirst({
      where: {
        reviewId,
        reportedById: userId,
      },
    });

    if (existingReport) {
      throw new BadRequestException('You have already reported this review');
    }

    await this.prisma.reviewReport.create({
      data: {
        reviewId,
        reportedById: userId,
        reason,
      },
    });

    this.logger.log(`Review ${reviewId} reported by user ${userId}`);
  }

  /**
   * Get reviews for a facility
   */
  async getFacilityReviews(
    facilityId: string,
    page = 1,
    limit = 10,
  ): Promise<{ reviews: any[]; total: number; averageRating: number }> {
    const skip = (page - 1) * limit;

    const where = {
      booking: {
        playArea: { facilityId },
      },
      deletedAt: null,
      isHidden: false,
    };

    const [reviews, total, avgResult] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          booking: {
            select: {
              playerName: true,
              startAt: true,
              sportProfile: {
                select: { sportType: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({
        where,
        _avg: { rating: true },
      }),
    ]);

    return {
      reviews,
      total,
      averageRating: avgResult._avg.rating || 0,
    };
  }

  /**
   * Get user's reviews
   */
  async getUserReviews(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const where = {
      booking: { playerId: userId },
      deletedAt: null,
    };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          booking: {
            select: {
              playArea: {
                select: {
                  name: true,
                  facility: { select: { name: true } },
                },
              },
              startAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return { reviews, total, page, limit };
  }
}
