import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaModule } from '../../common/db/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
