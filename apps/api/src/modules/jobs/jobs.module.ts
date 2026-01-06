import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HoldExpiryProcessor } from './processors/hold-expiry.processor';
import { AutoCompleteProcessor } from './processors/auto-complete.processor';
import { BookingsModule } from '../bookings/bookings.module';

export const QUEUE_NAMES = {
  HOLD_EXPIRY: 'hold-expiry',
  AUTO_COMPLETE: 'auto-complete',
  REMINDERS: 'reminders',
} as const;

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.HOLD_EXPIRY },
      { name: QUEUE_NAMES.AUTO_COMPLETE },
      { name: QUEUE_NAMES.REMINDERS },
    ),
    BookingsModule,
  ],
  providers: [HoldExpiryProcessor, AutoCompleteProcessor],
  exports: [BullModule],
})
export class JobsModule {}
