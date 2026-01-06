import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../common/db/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check - verifies database and redis connections' })
  async ready() {
    const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string }> = {};

    // Check Postgres
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
    } catch (error) {
      checks.database = { status: 'error', error: error.message };
    }

    // Check Redis
    const redisStart = Date.now();
    try {
      await this.redis.ping();
      checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart };
    } catch (error) {
      checks.redis = { status: 'error', error: error.message };
    }

    const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

    return {
      status: allHealthy ? 'ready' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
