import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    // Generate or use existing correlation ID
    const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || uuidv4();
    req.headers[CORRELATION_ID_HEADER] = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    // Attach correlation ID to request for access in controllers/services
    (req as any).correlationId = correlationId;

    // Log request
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';

    this.logger.log({
      type: 'request',
      correlationId,
      method,
      url: originalUrl,
      ip,
      userAgent,
    });

    // Log response on finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      const logMethod = statusCode >= 400 ? 'warn' : 'log';

      this.logger[logMethod]({
        type: 'response',
        correlationId,
        method,
        url: originalUrl,
        statusCode,
        duration: `${duration}ms`,
      });
    });

    next();
  }
}

// Helper to get correlation ID from request
export function getCorrelationId(req: Request): string {
  return (req as any).correlationId || req.headers[CORRELATION_ID_HEADER] as string || 'unknown';
}
