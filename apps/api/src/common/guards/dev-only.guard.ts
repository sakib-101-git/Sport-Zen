import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard that only allows access in development environment
 * Returns 404 in production to hide dev endpoints completely
 */
@Injectable()
export class DevOnlyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');

    if (nodeEnv === 'production') {
      // Return 404 to hide the existence of dev endpoints in production
      throw new NotFoundException('Not Found');
    }

    return true;
  }
}
