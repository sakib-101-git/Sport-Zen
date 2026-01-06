import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { getCorrelationId } from '../middleware/correlation-id.middleware';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const correlationId = getCorrelationId(request);
    const startTime = Date.now();
    const { method, originalUrl, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const userId = (request as any).user?.id;

    return next.handle().pipe(
      tap((response) => {
        const duration = Date.now() - startTime;
        const statusCode = context.switchToHttp().getResponse().statusCode;

        this.logger.log({
          type: 'REQUEST',
          correlationId,
          method,
          url: originalUrl,
          statusCode,
          duration: `${duration}ms`,
          userId,
          ip,
          userAgent: userAgent.substring(0, 100),
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        this.logger.error({
          type: 'REQUEST_ERROR',
          correlationId,
          method,
          url: originalUrl,
          statusCode: error.status || 500,
          duration: `${duration}ms`,
          userId,
          ip,
          error: error.message,
        });

        throw error;
      }),
    );
  }
}
