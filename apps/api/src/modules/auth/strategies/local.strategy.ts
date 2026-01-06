import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(LocalStrategy.name);

  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    this.logger.debug(`Validating user: ${email}`);

    const user = await this.authService.validateUser(email, password);

    if (!user) {
      this.logger.warn(`Authentication failed for user: ${email}`);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    // Check if user is soft deleted
    if (user.deletedAt) {
      this.logger.warn(`Deleted user attempted login: ${email}`);
      throw new UnauthorizedException({
        code: 'ACCOUNT_DELETED',
        message: 'This account has been deleted',
      });
    }

    this.logger.debug(`User authenticated: ${email}`);
    return user;
  }
}
