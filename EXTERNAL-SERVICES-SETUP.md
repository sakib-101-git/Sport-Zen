# SportZen - External Services Setup Guide

Setup instructions for SSLCommerz, Twilio, Firebase, and other external services.

---

## 1. SSLCommerz Payment Gateway

SSLCommerz is the payment gateway for Bangladesh. You need both sandbox (testing) and live credentials.

### 1.1 Get Sandbox Credentials

1. Go to https://developer.sslcommerz.com/
2. Click "Sign Up" / "Register"
3. Fill in registration form:
   - Company Name: "SportZen" (or your business name)
   - Email: Your business email
   - Phone: Your phone number
4. Verify your email
5. Login to developer dashboard
6. Navigate to "Sandbox" section
7. Note your credentials:
   - **Store ID**: e.g., `sportzen123456`
   - **Store Password**: e.g., `sportzen123456@ssl`

### 1.2 Configure Environment

Add to `apps/api/.env`:

```env
# Sandbox (Testing)
SSLCOMMERZ_STORE_ID="your-sandbox-store-id"
SSLCOMMERZ_STORE_PASSWORD="your-sandbox-store-password"
SSLCOMMERZ_IS_LIVE=false

# URLs (localhost for development)
SSLCOMMERZ_SUCCESS_URL="http://localhost:3000/checkout/success"
SSLCOMMERZ_FAIL_URL="http://localhost:3000/checkout/failed"
SSLCOMMERZ_CANCEL_URL="http://localhost:3000/checkout/failed"
SSLCOMMERZ_IPN_URL="http://localhost:3001/api/v1/payments/sslcommerz/webhook"
```

### 1.3 Test Card Numbers (Sandbox)

| Card Type | Number | Expiry | CVV |
|-----------|--------|--------|-----|
| Visa | 4111111111111111 | Any future | Any 3 digits |
| MasterCard | 5500000000000004 | Any future | Any 3 digits |

### 1.4 Go Live Checklist

When ready for production:

1. Apply for live account at SSLCommerz
2. Submit required documents:
   - Trade license
   - Business registration
   - Bank account details
3. After approval, update `.env`:

```env
SSLCOMMERZ_STORE_ID="your-live-store-id"
SSLCOMMERZ_STORE_PASSWORD="your-live-store-password"
SSLCOMMERZ_IS_LIVE=true

SSLCOMMERZ_SUCCESS_URL="https://sportzen.com/checkout/success"
SSLCOMMERZ_FAIL_URL="https://sportzen.com/checkout/failed"
SSLCOMMERZ_CANCEL_URL="https://sportzen.com/checkout/failed"
SSLCOMMERZ_IPN_URL="https://api.sportzen.com/api/v1/payments/sslcommerz/webhook"
```

### 1.5 Webhook Testing (Local Development)

Since SSLCommerz can't reach localhost, use one of:

**Option A: Use Webhook Simulator (Built-in)**
```bash
# Simulate successful payment
curl -X POST http://localhost:3001/api/v1/payments/simulate-webhook \
  -H "Content-Type: application/json" \
  -d '{"bookingId": "your-booking-id"}'
```

**Option B: Use ngrok for real webhook testing**
```bash
# Install ngrok
npm install -g ngrok

# Expose local API
ngrok http 3001

# Update SSLCOMMERZ_IPN_URL with ngrok URL
# e.g., https://abc123.ngrok.io/api/v1/payments/sslcommerz/webhook
```

---

## 2. Twilio (SMS/OTP)

### 2.1 Create Account

1. Go to https://www.twilio.com/
2. Sign up for a free account
3. Verify your phone number
4. Get your credentials from Console Dashboard:
   - Account SID
   - Auth Token
5. Buy or use trial phone number

### 2.2 Configure Environment

Add to `apps/api/.env`:

```env
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_PHONE_NUMBER="+1234567890"
```

### 2.3 Trial Account Limitations

- Can only send to verified phone numbers
- Messages include "[Sent from a Twilio trial account]" prefix
- Limited daily SMS quota

### 2.4 For Bangladesh Numbers

- Ensure your Twilio account supports Bangladesh (+880)
- May need to enable geographic permissions
- Consider using Twilio Verify API for OTP

---

## 3. Firebase (Alternative OTP Provider)

### 3.1 Create Project

1. Go to https://console.firebase.google.com/
2. Click "Create a project"
3. Enter project name: "sportzen" (or similar)
4. Disable Google Analytics (optional)
5. Click "Create project"

### 3.2 Enable Phone Authentication

1. In Firebase Console, go to Authentication
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Phone"
5. Add test phone numbers for development

### 3.3 Get Service Account Credentials

1. Go to Project Settings (gear icon)
2. Go to "Service accounts" tab
3. Click "Generate new private key"
4. Download JSON file
5. Extract required values

### 3.4 Configure Environment

Add to `apps/api/.env`:

```env
FIREBASE_PROJECT_ID="sportzen-xxxxx"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@sportzen-xxxxx.iam.gserviceaccount.com"
```

**Note**: The private key must have `\n` for newlines, not actual line breaks.

### 3.5 Test Phone Numbers (Development)

In Firebase Console → Authentication → Sign-in method → Phone:

1. Scroll to "Phone numbers for testing"
2. Add test numbers:
   - `+8801700000001` → OTP: `123456`
   - `+8801700000002` → OTP: `123456`

---

## 4. Email (SMTP)

### 4.1 Gmail SMTP (Development Only)

1. Use Gmail account
2. Enable 2FA on Google account
3. Generate App Password:
   - Google Account → Security → App passwords
   - Generate for "Mail"

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM_EMAIL="noreply@sportzen.com"
```

### 4.2 SendGrid (Production)

1. Sign up at https://sendgrid.com/
2. Create API key
3. Verify sender domain

```env
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT=587
SMTP_USER="apikey"
SMTP_PASSWORD="your-sendgrid-api-key"
SMTP_FROM_EMAIL="noreply@sportzen.com"
```

### 4.3 Amazon SES (Production)

1. Set up AWS account
2. Verify domain in SES
3. Create SMTP credentials

```env
SMTP_HOST="email-smtp.ap-south-1.amazonaws.com"
SMTP_PORT=587
SMTP_USER="your-ses-smtp-username"
SMTP_PASSWORD="your-ses-smtp-password"
SMTP_FROM_EMAIL="noreply@sportzen.com"
```

---

## 5. Google Maps (Optional)

For map rendering and geocoding.

### 5.1 Get API Key

1. Go to https://console.cloud.google.com/
2. Create new project or select existing
3. Enable APIs:
   - Maps JavaScript API
   - Geocoding API
   - Places API
4. Go to Credentials
5. Create API key
6. Restrict key to your domains

### 5.2 Configure Environment

Add to `apps/web/.env.local`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

---

## 6. Sentry (Error Tracking)

### 6.1 Create Account

1. Go to https://sentry.io/
2. Sign up / Create account
3. Create new project for NestJS
4. Create new project for Next.js
5. Get DSN for each project

### 6.2 Configure Environment

API (apps/api/.env):
```env
SENTRY_DSN="https://xxxx@o1234567.ingest.sentry.io/1234567"
```

Web (apps/web/.env.local):
```env
NEXT_PUBLIC_SENTRY_DSN="https://yyyy@o1234567.ingest.sentry.io/7654321"
```

---

## 7. Environment Variables Summary

### API (.env) - Complete

```env
# Application
NODE_ENV=development
PORT=3001
API_PREFIX=api/v1

# Database
DATABASE_URL="postgresql://sportzen:sportzen_dev_password@localhost:5432/sportzen?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-refresh-secret-key-at-least-32-characters"
JWT_REFRESH_EXPIRES_IN="7d"

# SSLCommerz
SSLCOMMERZ_STORE_ID=""
SSLCOMMERZ_STORE_PASSWORD=""
SSLCOMMERZ_IS_LIVE=false
SSLCOMMERZ_SUCCESS_URL="http://localhost:3000/checkout/success"
SSLCOMMERZ_FAIL_URL="http://localhost:3000/checkout/failed"
SSLCOMMERZ_CANCEL_URL="http://localhost:3000/checkout/failed"
SSLCOMMERZ_IPN_URL="http://localhost:3001/api/v1/payments/sslcommerz/webhook"

# Twilio (Optional)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""

# Firebase (Optional)
FIREBASE_PROJECT_ID=""
FIREBASE_PRIVATE_KEY=""
FIREBASE_CLIENT_EMAIL=""

# Email (Optional)
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM_EMAIL="noreply@sportzen.com"

# Platform
PLATFORM_COMMISSION_RATE=0.05
HOLD_EXPIRY_MINUTES=10
BUFFER_MINUTES=10

# CORS
CORS_ORIGINS="http://localhost:3000"

# Logging
LOG_LEVEL=debug

# Sentry (Optional)
SENTRY_DSN=""
```

### Web (.env.local) - Complete

```env
# API
NEXT_PUBLIC_API_URL=http://localhost:3001

# Application
NEXT_PUBLIC_APP_NAME="SportZen"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Maps (Optional)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=""

# Analytics (Optional)
NEXT_PUBLIC_GA_TRACKING_ID=""
NEXT_PUBLIC_MIXPANEL_TOKEN=""

# Sentry (Optional)
NEXT_PUBLIC_SENTRY_DSN=""
```

---

## 8. Testing Without External Services

The application is designed to work without external services in development:

| Service | Fallback Behavior |
|---------|-------------------|
| SSLCommerz | Use webhook simulator endpoint |
| SMS/OTP | OTP logged to console |
| Email | Emails logged to console |
| Maps | Static placeholder or OSM fallback |

To see console logs:
```bash
cd apps/api
pnpm dev
# Watch console for [OTP] and [EMAIL] logs
```
