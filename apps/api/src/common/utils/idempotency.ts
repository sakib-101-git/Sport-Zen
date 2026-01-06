import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { createHash } from 'crypto';

export interface IdempotencyResult<T> {
  isNew: boolean;
  result?: T;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly keyPrefix = 'idempotency:';
  private readonly defaultTtlSeconds = 86400; // 24 hours

  constructor(private readonly redisService: RedisService) {}

  /**
   * Generate a deterministic idempotency key from input data
   */
  generateKey(namespace: string, ...parts: (string | number | object)[]): string {
    const data = parts
      .map((part) => (typeof part === 'object' ? JSON.stringify(part) : String(part)))
      .join(':');
    const hash = createHash('sha256').update(data).digest('hex').substring(0, 32);
    return `${this.keyPrefix}${namespace}:${hash}`;
  }

  /**
   * Check if an operation has already been processed
   * Returns the cached result if found, otherwise allows the operation to proceed
   */
  async check<T>(key: string): Promise<IdempotencyResult<T>> {
    try {
      const cached = await this.redisService.get<T>(key);
      if (cached) {
        this.logger.debug(`Idempotency hit for key: ${key}`);
        return {
          isNew: false,
          result: cached,
        };
      }
      return { isNew: true };
    } catch (error) {
      this.logger.warn(`Idempotency check failed for key: ${key}`, error);
      // On Redis failure, allow the operation to proceed
      // The database constraints should catch any actual duplicates
      return { isNew: true };
    }
  }

  /**
   * Mark an operation as processed and cache the result
   */
  async markProcessed<T>(
    key: string,
    result: T,
    ttlSeconds: number = this.defaultTtlSeconds,
  ): Promise<void> {
    try {
      // Convert to milliseconds for RedisService.set()
      await this.redisService.set(key, result, ttlSeconds * 1000);
      this.logger.debug(`Idempotency marked for key: ${key}`);
    } catch (error) {
      this.logger.warn(`Failed to mark idempotency for key: ${key}`, error);
      // Non-critical: if Redis fails, the operation still succeeded
    }
  }

  /**
   * Execute an operation with idempotency protection
   * If the operation was already processed, return the cached result
   * Otherwise, execute the operation and cache the result
   */
  async execute<T>(
    key: string,
    operation: () => Promise<T>,
    ttlSeconds: number = this.defaultTtlSeconds,
  ): Promise<{ result: T; wasNew: boolean }> {
    const check = await this.check<T>(key);

    if (!check.isNew && check.result !== undefined) {
      return { result: check.result, wasNew: false };
    }

    const result = await operation();
    await this.markProcessed(key, result, ttlSeconds);

    return { result, wasNew: true };
  }

  /**
   * Clear an idempotency key (useful for allowing retries after failures)
   */
  async clear(key: string): Promise<void> {
    try {
      await this.redisService.del(key);
    } catch (error) {
      this.logger.warn(`Failed to clear idempotency key: ${key}`, error);
    }
  }
}

/**
 * Generate an idempotency key for webhook processing
 */
export function generateWebhookIdempotencyKey(
  gateway: string,
  transactionId: string,
  status: string,
): string {
  return `webhook:${gateway}:${transactionId}:${status}`;
}

/**
 * Generate an idempotency key for payment confirmation
 */
export function generatePaymentConfirmIdempotencyKey(
  paymentIntentId: string,
): string {
  return `payment-confirm:${paymentIntentId}`;
}
