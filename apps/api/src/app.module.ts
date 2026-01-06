import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

// Common modules
import { PrismaModule } from './common/db/prisma.module';
import { RedisModule } from './common/redis/redis.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { FacilitiesModule } from './modules/facilities/facilities.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { HealthModule } from './modules/health/health.module';
import { OwnerModule } from './modules/owner/owner.module';
import { AdminModule } from './modules/admin/admin.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

// Middleware
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

// Filters & Interceptors
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

// Services
import { AuditService } from './common/audit/audit.service';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // BullMQ for background jobs
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),

    // Core modules
    PrismaModule,
    RedisModule,

    // Feature modules
    AuthModule,
    FacilitiesModule,
    AvailabilityModule,
    BookingsModule,
    PaymentsModule,
    JobsModule,
    HealthModule,
    OwnerModule,
    AdminModule,
    ReviewsModule,
    RefundsModule,
    SubscriptionsModule,
    LedgerModule,
    NotificationsModule,
  ],
  providers: [
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Global audit logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
    // Audit service (available globally)
    AuditService,
  ],
  exports: [AuditService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
