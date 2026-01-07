import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheckService,
  HealthCheck,
  HealthCheckResult,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';

@ApiTags('health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private redisHealth: RedisHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  /**
   * Liveness probe - Kubernetes uses this to know if the container is alive
   * Should be fast and check minimal dependencies
   */
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness check - basic health' })
  async liveness(): Promise<HealthCheckResult> {
    return this.health.check([
      // Basic memory check - fail if heap exceeds 500MB
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
    ]);
  }

  /**
   * Readiness probe - Kubernetes uses this to know if the container is ready to serve traffic
   * Checks all critical dependencies
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness check - verifies database and redis connections' })
  async readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }

  /**
   * Detailed health check - for monitoring dashboards
   * Includes all dependencies plus additional system info
   */
  @Get('detailed')
  @HealthCheck()
  @ApiOperation({ summary: 'Detailed health check - all dependencies' })
  async detailed(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.prismaHealth.checkPostGIS('postgis'),
      () => this.redisHealth.isHealthy('redis'),
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024), // 1GB RSS limit
    ]);
  }

  /**
   * Simple ping endpoint for basic uptime monitoring
   */
  @Get('ping')
  @ApiOperation({ summary: 'Simple ping - returns pong' })
  ping() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
