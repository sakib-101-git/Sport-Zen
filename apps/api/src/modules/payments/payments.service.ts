import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service';
import { PaymentIntentStatus } from '@prisma/client';

export interface PaymentIntentDetails {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  gateway: string;
  expiresAt: Date;
  createdAt: Date;
  booking: {
    id: string;
    bookingNumber: string;
    status: string;
    startAt: Date;
    endAt: Date;
    playerName: string;
    playArea: {
      name: string;
      facility: {
        name: string;
      };
    };
  };
  transactions: Array<{
    id: string;
    status: string;
    amount: number;
    createdAt: Date;
  }>;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get payment intent status with full details
   */
  async getPaymentIntentStatus(intentId: string): Promise<PaymentIntentDetails | null> {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: intentId },
      include: {
        booking: {
          include: {
            playArea: {
              include: {
                facility: {
                  select: { name: true },
                },
              },
            },
          },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!intent) return null;

    return {
      id: intent.id,
      bookingId: intent.bookingId,
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status,
      gateway: intent.gateway,
      expiresAt: intent.expiresAt,
      createdAt: intent.createdAt,
      booking: {
        id: intent.booking.id,
        bookingNumber: intent.booking.bookingNumber,
        status: intent.booking.status,
        startAt: intent.booking.startAt,
        endAt: intent.booking.endAt,
        playerName: intent.booking.playerName,
        playArea: {
          name: intent.booking.playArea.name,
          facility: {
            name: intent.booking.playArea.facility.name,
          },
        },
      },
      transactions: intent.transactions.map((t) => ({
        id: t.id,
        status: t.status,
        amount: t.amount,
        createdAt: t.createdAt,
      })),
    };
  }

  /**
   * Check if a payment intent has already been processed
   * Used for idempotency checks
   */
  async isPaymentIntentProcessed(intentId: string): Promise<boolean> {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: intentId },
      select: { status: true },
    });

    if (!intent) return false;

    return ['SUCCESS', 'LATE_SUCCESS_CONFLICT'].includes(intent.status);
  }

  /**
   * Check if a transaction with this tran_id already exists
   */
  async transactionExists(tranId: string): Promise<boolean> {
    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { tranId },
    });

    return !!transaction;
  }

  /**
   * Get payment intent by booking ID
   */
  async getPaymentIntentByBookingId(bookingId: string): Promise<PaymentIntentDetails | null> {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          include: {
            playArea: {
              include: {
                facility: {
                  select: { name: true },
                },
              },
            },
          },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!intent) return null;

    return {
      id: intent.id,
      bookingId: intent.bookingId,
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status,
      gateway: intent.gateway,
      expiresAt: intent.expiresAt,
      createdAt: intent.createdAt,
      booking: {
        id: intent.booking.id,
        bookingNumber: intent.booking.bookingNumber,
        status: intent.booking.status,
        startAt: intent.booking.startAt,
        endAt: intent.booking.endAt,
        playerName: intent.booking.playerName,
        playArea: {
          name: intent.booking.playArea.name,
          facility: {
            name: intent.booking.playArea.facility.name,
          },
        },
      },
      transactions: intent.transactions.map((t) => ({
        id: t.id,
        status: t.status,
        amount: t.amount,
        createdAt: t.createdAt,
      })),
    };
  }

  /**
   * Get all payment intents for a user
   */
  async getUserPaymentHistory(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ payments: PaymentIntentDetails[]; total: number }> {
    const skip = (page - 1) * limit;

    const [intents, total] = await Promise.all([
      this.prisma.paymentIntent.findMany({
        where: {
          booking: { playerId: userId },
        },
        include: {
          booking: {
            include: {
              playArea: {
                include: {
                  facility: {
                    select: { name: true },
                  },
                },
              },
            },
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.paymentIntent.count({
        where: {
          booking: { playerId: userId },
        },
      }),
    ]);

    return {
      payments: intents.map((intent) => ({
        id: intent.id,
        bookingId: intent.bookingId,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        gateway: intent.gateway,
        expiresAt: intent.expiresAt,
        createdAt: intent.createdAt,
        booking: {
          id: intent.booking.id,
          bookingNumber: intent.booking.bookingNumber,
          status: intent.booking.status,
          startAt: intent.booking.startAt,
          endAt: intent.booking.endAt,
          playerName: intent.booking.playerName,
          playArea: {
            name: intent.booking.playArea.name,
            facility: {
              name: intent.booking.playArea.facility.name,
            },
          },
        },
        transactions: intent.transactions.map((t) => ({
          id: t.id,
          status: t.status,
          amount: t.amount,
          createdAt: t.createdAt,
        })),
      })),
      total,
    };
  }
}
