import { Module } from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { PrismaModule } from '../../common/db/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
