import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';

export interface SlotLockData {
  bookingId: string;
  userId: string;
  acquiredAt: string;
}

export interface SlotLockResult {
  acquired: boolean;
  existingLock?: SlotLockData;
}

@Injectable()
export class SlotLockService {
  private readonly logger = new Logger(SlotLockService.name);
  private readonly lockPrefix = 'lock:slot:';
  private readonly holdExpiryMinutes: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.holdExpiryMinutes = this.configService.get<number>(
      'booking.holdExpiryMinutes',
      10,
    );
  }

  /**
   * Generate a lock key for a slot
   * Format: lock:slot:{conflictGroupId}:{startIso}:{endIso}
   */
  generateLockKey(
    conflictGroupId: string,
    startAt: Date,
    endAt: Date,
  ): string {
    const startIso = startAt.toISOString();
    const endIso = endAt.toISOString();
    return `${this.lockPrefix}${conflictGroupId}:${startIso}:${endIso}`;
  }

  /**
   * Attempt to acquire a lock for a slot
   * Uses Redis SET NX PX for atomic lock acquisition
   */
  async acquireLock(
    conflictGroupId: string,
    startAt: Date,
    endAt: Date,
    bookingId: string,
    userId: string,
  ): Promise<SlotLockResult> {
    const lockKey = this.generateLockKey(conflictGroupId, startAt, endAt);
    const lockData: SlotLockData = {
      bookingId,
      userId,
      acquiredAt: new Date().toISOString(),
    };
    const lockValue = JSON.stringify(lockData);
    const ttlMs = this.holdExpiryMinutes * 60 * 1000;

    try {
      // SET key value NX PX ttl - atomic lock
      const result = await this.redisService.setNx(lockKey, lockValue, ttlMs);

      if (result) {
        this.logger.debug(`Lock acquired: ${lockKey} for booking ${bookingId}`);
        return { acquired: true };
      }

      // Lock already exists, get the existing lock data
      const existingValue = await this.redisService.get(lockKey);
      if (existingValue) {
        const existingLock = JSON.parse(existingValue) as SlotLockData;
        this.logger.debug(
          `Lock already held: ${lockKey} by booking ${existingLock.bookingId}`,
        );
        return { acquired: false, existingLock };
      }

      // Lock expired between our check, try again
      return this.acquireLock(conflictGroupId, startAt, endAt, bookingId, userId);
    } catch (error) {
      this.logger.error(`Failed to acquire lock: ${lockKey}`, error);
      // On Redis failure, allow the operation to proceed
      // The database exclusion constraint will catch actual conflicts
      return { acquired: true };
    }
  }

  /**
   * Release a lock for a slot
   * Only releases if the lock belongs to the specified booking
   */
  async releaseLock(
    conflictGroupId: string,
    startAt: Date,
    endAt: Date,
    bookingId: string,
  ): Promise<boolean> {
    const lockKey = this.generateLockKey(conflictGroupId, startAt, endAt);

    try {
      // Check if this booking owns the lock
      const existingValue = await this.redisService.get(lockKey);
      if (!existingValue) {
        return true; // Lock already released
      }

      const existingLock = JSON.parse(existingValue) as SlotLockData;
      if (existingLock.bookingId !== bookingId) {
        this.logger.warn(
          `Cannot release lock: ${lockKey} owned by different booking ${existingLock.bookingId}`,
        );
        return false;
      }

      await this.redisService.del(lockKey);
      this.logger.debug(`Lock released: ${lockKey} for booking ${bookingId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to release lock: ${lockKey}`, error);
      return false;
    }
  }

  /**
   * Extend a lock's TTL
   * Used when a hold needs to be extended
   */
  async extendLock(
    conflictGroupId: string,
    startAt: Date,
    endAt: Date,
    bookingId: string,
    additionalMinutes: number = 5,
  ): Promise<boolean> {
    const lockKey = this.generateLockKey(conflictGroupId, startAt, endAt);
    const additionalTtlSeconds = additionalMinutes * 60;

    try {
      const existingValue = await this.redisService.get(lockKey);
      if (!existingValue) {
        return false;
      }

      const existingLock = JSON.parse(existingValue) as SlotLockData;
      if (existingLock.bookingId !== bookingId) {
        return false;
      }

      // Get current TTL and extend
      const currentTtl = await this.redisService.ttl(lockKey);
      if (currentTtl > 0) {
        await this.redisService.expire(lockKey, currentTtl + additionalTtlSeconds);
        this.logger.debug(
          `Lock extended: ${lockKey} by ${additionalMinutes} minutes`,
        );
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to extend lock: ${lockKey}`, error);
      return false;
    }
  }

  /**
   * Check if a slot is locked
   */
  async isLocked(
    conflictGroupId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<SlotLockData | null> {
    const lockKey = this.generateLockKey(conflictGroupId, startAt, endAt);

    try {
      const existingValue = await this.redisService.get(lockKey);
      if (existingValue) {
        return JSON.parse(existingValue) as SlotLockData;
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to check lock: ${lockKey}`, error);
      return null;
    }
  }
}
