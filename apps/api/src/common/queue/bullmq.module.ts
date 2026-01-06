import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  QUEUE_HOLD_EXPIRY,
  QUEUE_AUTO_COMPLETE,
  QUEUE_REMINDERS,
  QUEUE_NOTIFICATIONS,
  QUEUE_INVOICES,
} from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host', 'localhost'),
          port: configService.get<number>('redis.port', 6379),
          password: configService.get<string>('redis.password'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            count: 1000,
            age: 24 * 60 * 60, // 24 hours
          },
          removeOnFail: {
            count: 5000,
            age: 7 * 24 * 60 * 60, // 7 days
          },
        },
      }),
    }),
    // Register individual queues
    BullModule.registerQueue(
      { name: QUEUE_HOLD_EXPIRY },
      { name: QUEUE_AUTO_COMPLETE },
      { name: QUEUE_REMINDERS },
      { name: QUEUE_NOTIFICATIONS },
      { name: QUEUE_INVOICES },
    ),
  ],
  exports: [BullModule],
})
export class BullMQModule {}
