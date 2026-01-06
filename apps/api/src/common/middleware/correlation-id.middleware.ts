import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request type to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // Get correlation ID from header or generate new one
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      randomUUID();

    // Attach to request
    req.correlationId = correlationId;

    // Set response header
    res.setHeader('X-Correlation-ID', correlationId);

    // Log request with correlation ID
    this.logger.debug(`${req.method} ${req.originalUrl}`, {
      correlationId,
      ip: req.ip,
      userAgent: req.get('user-agent')?.substring(0, 100),
    });

    next();
  }
}

/**
 * Helper to get correlation ID from request
 */
export function getCorrelationId(request: Request): string {
  return request.correlationId || randomUUID();
}
