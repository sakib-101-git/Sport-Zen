import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { RedisService } from '../../../common/redis/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    try {
      const pong = await this.redis.ping();
      const latencyMs = Date.now() - startTime;

      if (pong !== 'PONG') {
        throw new Error(`Unexpected ping response: ${pong}`);
      }

      return this.getStatus(key, true, { latencyMs });
    } catch (error) {
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, { error: error.message }),
      );
    }
  }
}
