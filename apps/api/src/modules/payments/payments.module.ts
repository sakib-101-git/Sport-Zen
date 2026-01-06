import { Module } from '@nestjs/common';
import { SSLCommerzService } from './sslcommerz/sslcommerz.service';
import { SSLCommerzController } from './sslcommerz/sslcommerz.controller';
import { SSLCommerzWebhookHandler } from './sslcommerz/sslcommerz.webhook';
import { PaymentsService } from './payments.service';
import { BookingsModule } from '../bookings/bookings.module';
import { PrismaModule } from '../../common/db/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { DevOnlyGuard } from '../../common/guards/dev-only.guard';
import { IdempotencyService } from '../../common/utils/idempotency';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    BookingsModule,
    LedgerModule,
    NotificationsModule,
  ],
  controllers: [SSLCommerzController],
  providers: [
    SSLCommerzService,
    SSLCommerzWebhookHandler,
    PaymentsService,
    DevOnlyGuard,
    IdempotencyService,
  ],
  exports: [SSLCommerzService, SSLCommerzWebhookHandler, PaymentsService],
})
export class PaymentsModule {}
