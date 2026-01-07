import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { ThrottleOTP, ThrottleLogin } from '../../common/decorators/throttle.decorator';
import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

// DTOs
class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

class RefreshDto {
  @IsString()
  refreshToken: string;
}

class LinkPhoneDto {
  @IsString()
  phone: string;
}

class RequestOTPDto {
  @IsString()
  phone: string;
}

class VerifyOTPDto {
  @IsString()
  phone: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class LinkPhoneOTPDto {
  @IsString()
  phone: string;

  @IsString()
  code: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  async register(@Body() dto: RegisterDto) {
    const tokens = await this.authService.register(
      dto.email,
      dto.password,
      dto.name,
      dto.role,
    );
    return { success: true, data: tokens };
  }

  @Post('login')
  @ThrottleLogin()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password' })
  async login(@Body() dto: LoginDto) {
    const tokens = await this.authService.login(dto.email, dto.password);
    return { success: true, data: tokens };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshDto) {
    const tokens = await this.authService.refreshToken(dto.refreshToken);
    return { success: true, data: tokens };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  async logout(
    @CurrentUser('id') userId: string,
    @Body() dto: RefreshDto,
  ) {
    await this.authService.logout(userId, dto.refreshToken);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@CurrentUser('id') userId: string) {
    const user = await this.authService.getMe(userId);
    return { success: true, data: user };
  }

  @Post('link-phone')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link phone number to account (deprecated - use OTP flow)' })
  async linkPhone(
    @CurrentUser('id') userId: string,
    @Body() dto: LinkPhoneDto,
  ) {
    await this.authService.linkPhone(userId, dto.phone);
    return { success: true };
  }

  // ============================================================================
  // OTP Authentication Endpoints
  // ============================================================================

  @Post('phone/request-otp')
  @ThrottleOTP()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP for phone login/registration' })
  async requestPhoneOTP(@Body() dto: RequestOTPDto) {
    const result = await this.authService.requestPhoneOTP(dto.phone);
    return { success: result.success, message: result.message };
  }

  @Post('phone/verify-otp')
  @ThrottleOTP()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and login/register with phone' })
  async verifyPhoneOTP(@Body() dto: VerifyOTPDto) {
    const result = await this.authService.verifyPhoneOTP(
      dto.phone,
      dto.code,
      dto.name,
    );
    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        isNewUser: result.isNewUser,
      },
    };
  }

  @Post('link-phone/request-otp')
  @ThrottleOTP()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request OTP to link phone to account' })
  async requestLinkPhoneOTP(
    @CurrentUser('id') userId: string,
    @Body() dto: RequestOTPDto,
  ) {
    const result = await this.authService.requestLinkPhoneOTP(userId, dto.phone);
    return { success: result.success, message: result.message };
  }

  @Post('link-phone/verify-otp')
  @ThrottleOTP()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify OTP and link phone to account' })
  async verifyLinkPhoneOTP(
    @CurrentUser('id') userId: string,
    @Body() dto: LinkPhoneOTPDto,
  ) {
    await this.authService.verifyLinkPhoneOTP(userId, dto.phone, dto.code);
    return { success: true, message: 'Phone linked successfully' };
  }
}
