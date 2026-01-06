export default () => ({
  // Application
  app: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },

  // Database
  database: {
    url: process.env.DATABASE_URL,
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // SSLCommerz Payment Gateway
  sslcommerz: {
    storeId: process.env.SSLCOMMERZ_STORE_ID,
    storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD,
    isSandbox: process.env.SSLCOMMERZ_SANDBOX === 'true',
    baseUrl: process.env.SSLCOMMERZ_SANDBOX === 'true'
      ? 'https://sandbox.sslcommerz.com'
      : 'https://securepay.sslcommerz.com',
    successUrl: process.env.SSLCOMMERZ_SUCCESS_URL || 'http://localhost:3000/checkout/success',
    failUrl: process.env.SSLCOMMERZ_FAIL_URL || 'http://localhost:3000/checkout/failed',
    cancelUrl: process.env.SSLCOMMERZ_CANCEL_URL || 'http://localhost:3000/checkout/failed',
    ipnUrl: process.env.SSLCOMMERZ_IPN_URL || 'http://localhost:3001/payments/sslcommerz/webhook',
  },

  // OTP / SMS Provider
  otp: {
    provider: process.env.OTP_PROVIDER || 'mock', // 'firebase' | 'twilio' | 'mock'
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioServiceSid: process.env.TWILIO_SERVICE_SID,
  },

  // Booking Configuration
  booking: {
    bufferMinutes: parseInt(process.env.BOOKING_BUFFER_MINUTES || '10', 10),
    holdExpiryMinutes: parseInt(process.env.BOOKING_HOLD_EXPIRY_MINUTES || '10', 10),
    slotIntervalMinutes: parseInt(process.env.BOOKING_SLOT_INTERVAL_MINUTES || '30', 10),
    advancePercentage: parseFloat(process.env.BOOKING_ADVANCE_PERCENTAGE || '0.10'),
    availableNowHours: parseInt(process.env.BOOKING_AVAILABLE_NOW_HOURS || '4', 10),
    checkinWindowMinutes: parseInt(process.env.BOOKING_CHECKIN_WINDOW_MINUTES || '30', 10),
  },

  // Platform Configuration
  platform: {
    commissionRate: parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.05'),
    processingFee: parseInt(process.env.PLATFORM_PROCESSING_FEE || '0', 10), // BDT
    currency: 'BDT',
    timezone: 'Asia/Dhaka',
  },

  // Rate Limiting
  rateLimit: {
    otpRequestWindowMs: parseInt(process.env.RATE_LIMIT_OTP_WINDOW_MS || '60000', 10),
    otpRequestMax: parseInt(process.env.RATE_LIMIT_OTP_MAX || '3', 10),
    loginWindowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || '900000', 10),
    loginMax: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5', 10),
  },

  // Notifications
  notifications: {
    emailProvider: process.env.EMAIL_PROVIDER || 'mock',
    smsProvider: process.env.SMS_PROVIDER || 'mock',
  },
});
