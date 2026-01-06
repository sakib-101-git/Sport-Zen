import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface SlotLockData {
  bookingId: string;
  userId: string;
  lockedAt: string;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  // TTL constants
  private readonly SLOT_LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis error:', error);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  get redis(): Redis {
    return this.client;
  }

  // ==========================================================================
  // SLOT LOCKING (Supportive - DB is source of truth)
  // ==========================================================================

  /**
   * Generate slot lock key
   * Format: lock:conflict_group:{id}:{start_iso}:{end_iso}
   */
  private getSlotLockKey(
    conflictGroupId: string,
    startAt: Date,
    endAt: Date,
  ): string {
    return `lock:conflict_group:${conflictGroupId}:${startAt.toISOString()}:${endAt.toISOString()}`;
  }

  /**
   * Attempt to acquire a slot lock
   * Returns true if lock acquired, false if already locked
   */
  async acquireSlotLock(
    conflictGroupId: string,
    startAt: Date,
    endAt: Date,
    bookingId: string,
    userId: string,
  ): Promise<boolean> {
    const key = this.getSlotLockKey(conflictGroupId, startAt, endAt);
    const value: SlotLockData = {
      bookingId,
      userId,
      lockedAt: new Date().toISOString(),
    };

    // SET key value NX PX ttl
    const result = await this.client.set(
      key,
      JSON.stringify(value),
      'PX',
      this.SLOT_LOCK_TTL_MS,
      'NX',
    );

    return result === 'OK';
  }

  /**
   * Release a slot lock (only if we own it)
   */
  async releaseSlotLock(
    conflictGroupId: string,
    startAt: Date,
    endAt: Date,
    bookingId: string,
  ): Promise<boolean> {
    const key = this.getSlotLockKey(conflictGroupId, startAt, endAt);

    // Lua script for atomic check-and-delete
    const script = `
      local value = redis.call('GET', KEYS[1])
      if value then
        local data = cjson.decode(value)
        if data.bookingId == ARGV[1] then
          return redis.call('DEL', KEYS[1])
        end
      end
      return 0
    `;

    const result = await this.client.eval(script, 1, key, bookingId);
    return result === 1;
  }

  /**
   * Get slot lock info
   */
  async getSlotLock(
    conflictGroupId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<SlotLockData | null> {
    const key = this.getSlotLockKey(conflictGroupId, startAt, endAt);
    const value = await this.client.get(key);

    if (!value) return null;

    try {
      return JSON.parse(value) as SlotLockData;
    } catch {
      return null;
    }
  }

  /**
   * Extend slot lock TTL
   */
  async extendSlotLock(
    conflictGroupId: string,
    startAt: Date,
    endAt: Date,
    bookingId: string,
  ): Promise<boolean> {
    const key = this.getSlotLockKey(conflictGroupId, startAt, endAt);

    const script = `
      local value = redis.call('GET', KEYS[1])
      if value then
        local data = cjson.decode(value)
        if data.bookingId == ARGV[1] then
          return redis.call('PEXPIRE', KEYS[1], ARGV[2])
        end
      end
      return 0
    `;

    const result = await this.client.eval(
      script,
      1,
      key,
      bookingId,
      this.SLOT_LOCK_TTL_MS.toString(),
    );
    return result === 1;
  }

  // ==========================================================================
  // RATE LIMITING
  // ==========================================================================

  /**
   * Check and increment rate limit
   * Returns { allowed: boolean, remaining: number, resetAt: Date }
   */
  async checkRateLimit(
    key: string,
    maxRequests: number,
    windowMs: number = this.RATE_LIMIT_WINDOW_MS,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `ratelimit:${key}`;

    // Use sorted set with timestamp as score
    const multi = this.client.multi();

    // Remove old entries
    multi.zremrangebyscore(redisKey, '-inf', windowStart);
    // Add current request
    multi.zadd(redisKey, now, `${now}:${Math.random()}`);
    // Count requests in window
    multi.zcount(redisKey, windowStart, '+inf');
    // Set expiry
    multi.pexpire(redisKey, windowMs);

    const results = await multi.exec();
    const count = results?.[2]?.[1] as number ?? 0;
    const allowed = count <= maxRequests;
    const remaining = Math.max(0, maxRequests - count);
    const resetAt = new Date(now + windowMs);

    return { allowed, remaining, resetAt };
  }

  /**
   * Rate limit presets
   */
  async checkOtpRateLimit(phone: string): Promise<{ allowed: boolean; remaining: number }> {
    const { allowed, remaining } = await this.checkRateLimit(
      `otp:${phone}`,
      3, // 3 requests
      60 * 1000, // per minute
    );
    return { allowed, remaining };
  }

  async checkLoginRateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
    const { allowed, remaining } = await this.checkRateLimit(
      `login:${identifier}`,
      5, // 5 attempts
      5 * 60 * 1000, // per 5 minutes
    );
    return { allowed, remaining };
  }

  async checkBookingRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    const { allowed, remaining } = await this.checkRateLimit(
      `booking:${userId}`,
      10, // 10 hold attempts
      60 * 1000, // per minute
    );
    return { allowed, remaining };
  }

  // ==========================================================================
  // CACHING
  // ==========================================================================

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlMs) {
      await this.client.set(key, serialized, 'PX', ttlMs);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  // ==========================================================================
  // HEALTH CHECK
  // ==========================================================================

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // ATOMIC OPERATIONS (for OTP rate limiting)
  // ==========================================================================

  /**
   * Increment a key value (atomic)
   */
  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  /**
   * Set expiration on a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  /**
   * Get TTL of a key in seconds
   */
  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  /**
   * Set value with expiration (atomic SETEX)
   */
  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.client.setex(key, seconds, value);
  }
}
