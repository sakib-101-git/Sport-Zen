import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { PrismaService } from '../../../common/db/prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - startTime;

      return this.getStatus(key, true, { latencyMs });
    } catch (error) {
      throw new HealthCheckError(
        'Prisma health check failed',
        this.getStatus(key, false, { error: error.message }),
      );
    }
  }

  async checkPostGIS(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    try {
      const result = await this.prisma.$queryRaw<{ postgis_version: string }[]>`
        SELECT PostGIS_version() as postgis_version
      `;
      const latencyMs = Date.now() - startTime;

      return this.getStatus(key, true, {
        latencyMs,
        postgisVersion: result[0]?.postgis_version,
      });
    } catch (error) {
      throw new HealthCheckError(
        'PostGIS health check failed',
        this.getStatus(key, false, { error: error.message }),
      );
    }
  }
}
