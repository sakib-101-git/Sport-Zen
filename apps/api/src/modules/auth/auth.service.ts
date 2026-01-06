import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../common/db/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { OTPService } from './otp/otp.service';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly otpService: OTPService,
  ) {}

  async register(
    email: string,
    password: string,
    name: string,
    role: UserRole = UserRole.PLAYER,
  ): Promise<AuthTokens> {
    // Check if user exists
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role,
        emailVerified: false,
      },
    });

    // Generate tokens
    return this.generateTokens(user.id, email, role);
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    // Rate limiting
    const rateLimit = await this.redis.checkLoginRateLimit(email);
    if (!rateLimit.allowed) {
      throw new BadRequestException('Too many login attempts. Please wait.');
    }

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(user.id, user.email!, user.role);
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // Hash the token to find it
    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate: revoke old token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens with same family
    return this.generateTokens(
      storedToken.user.id,
      storedToken.user.email!,
      storedToken.user.role,
      storedToken.familyId,
    );
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash },
        data: { revokedAt: new Date() },
      });
    } else {
      // Revoke all refresh tokens for user
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        avatarUrl: true,
        role: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async linkPhone(userId: string, phone: string): Promise<void> {
    // Check if phone is already linked to another user
    const existing = await this.prisma.user.findFirst({
      where: {
        phone,
        id: { not: userId },
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException('Phone number already linked to another account');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { phone, phoneVerified: true },
    });
  }

  // ============================================================================
  // OTP Authentication Methods
  // ============================================================================

  /**
   * Request OTP for phone login/registration
   */
  async requestPhoneOTP(phone: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`OTP requested for phone: ${phone.substring(0, 6)}***`);
    return this.otpService.requestOTP(phone);
  }

  /**
   * Verify OTP and login/register user
   * Creates account if phone doesn't exist, otherwise logs in
   */
  async verifyPhoneOTP(
    phone: string,
    code: string,
    name?: string,
  ): Promise<AuthTokens & { isNewUser: boolean }> {
    // Verify OTP first
    const isValid = await this.otpService.verifyOTP(phone, code);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Normalize phone number
    const normalizedPhone = this.normalizePhone(phone);

    // Check if user exists with this phone
    let user = await this.prisma.user.findFirst({
      where: { phone: normalizedPhone, deletedAt: null },
    });

    let isNewUser = false;

    if (!user) {
      // Create new user with phone
      isNewUser = true;
      user = await this.prisma.user.create({
        data: {
          phone: normalizedPhone,
          phoneVerified: true,
          name: name || `Player ${normalizedPhone.slice(-4)}`,
          role: UserRole.PLAYER,
          isActive: true,
        },
      });
      this.logger.log(`New user created via OTP: ${user.id}`);
    } else {
      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      this.logger.log(`User logged in via OTP: ${user.id}`);
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email || normalizedPhone,
      user.role,
    );

    return { ...tokens, isNewUser };
  }

  /**
   * Link and verify phone to existing account (requires OTP)
   */
  async requestLinkPhoneOTP(userId: string, phone: string): Promise<{ success: boolean; message: string }> {
    const normalizedPhone = this.normalizePhone(phone);

    // Check if phone is already linked to another user
    const existing = await this.prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        id: { not: userId },
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException('Phone number already linked to another account');
    }

    return this.otpService.requestOTP(normalizedPhone);
  }

  /**
   * Verify OTP and link phone to account
   */
  async verifyLinkPhoneOTP(userId: string, phone: string, code: string): Promise<void> {
    const normalizedPhone = this.normalizePhone(phone);

    // Verify OTP
    const isValid = await this.otpService.verifyOTP(normalizedPhone, code);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Double check phone not taken
    const existing = await this.prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        id: { not: userId },
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException('Phone number already linked to another account');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { phone: normalizedPhone, phoneVerified: true },
    });

    this.logger.log(`Phone linked to user ${userId}`);
  }

  private normalizePhone(phone: string): string {
    let cleaned = phone.replace(/[^\d+]/g, '');

    if (cleaned.startsWith('0')) {
      cleaned = '+88' + cleaned;
    } else if (cleaned.startsWith('88') && !cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+88' + cleaned;
    }

    return cleaned;
  }

  async validateUser(userId: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null, isActive: true },
    });
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: UserRole,
    familyId?: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token
    const refreshTokenValue = randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(refreshTokenValue);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        familyId: familyId || randomUUID(),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  private hashToken(token: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
