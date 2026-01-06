# Sport Zen Infrastructure

## Environment Variables

### API (.env)

```env
# Database
DATABASE_URL="postgresql://sportzen:sportzen_dev_password@localhost:5432/sportzen?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# SSLCommerz
SSLCOMMERZ_STORE_ID="your-store-id"
SSLCOMMERZ_STORE_PASSWORD="your-store-password"
SSLCOMMERZ_IS_SANDBOX="true"

# Firebase (OTP) - Optional, can use Twilio instead
FIREBASE_PROJECT_ID=""
FIREBASE_PRIVATE_KEY=""
FIREBASE_CLIENT_EMAIL=""

# Twilio (OTP) - Alternative to Firebase
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""

# URLs
API_URL="http://localhost:3001"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Platform Config
PLATFORM_COMMISSION_RATE="0.05"
PLATFORM_PROCESSING_FEE="50"

# Timezone
TZ="Asia/Dhaka"

# Logging
LOG_LEVEL="debug"
```

### Web (.env.local)

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Local Development Setup

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose

### Step 1: Start Infrastructure

```bash
# Start PostgreSQL (with PostGIS) and Redis
cd infra/docker
docker-compose up -d

# With dev tools (pgAdmin, Redis Commander)
docker-compose --profile dev up -d
```

### Step 2: Setup Database

```bash
# From project root
cd apps/api

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate:dev

# Run raw SQL migrations for PostGIS and constraints
psql -U sportzen -d sportzen -f ../../infra/migrations/001-exclusion-constraint.sql

# Seed data (optional)
pnpm db:seed
```

### Step 3: Start Services

```bash
# From project root
pnpm install
pnpm dev
```

This starts:
- API server at http://localhost:3001
- Web app at http://localhost:3000
- Swagger docs at http://localhost:3001/api/docs

### Access Dev Tools

- **pgAdmin**: http://localhost:5050 (admin@sportzen.local / admin)
- **Redis Commander**: http://localhost:8081

## Database Management

```bash
# View database in browser
pnpm db:studio

# Reset database
cd apps/api
npx prisma migrate reset

# Create new migration
npx prisma migrate dev --name your_migration_name
```

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# With coverage
pnpm test:cov
```

## Production Deployment Checklist

1. **Environment Variables**
   - Change all secrets (JWT_SECRET, etc.)
   - Set SSLCOMMERZ_IS_SANDBOX="false"
   - Configure production database URL
   - Set proper API/APP URLs

2. **Database**
   - Run all migrations
   - Run raw SQL migrations
   - Verify exclusion constraint exists
   - Create geo indexes

3. **SSL/TLS**
   - Configure HTTPS for all services
   - Update SSLCommerz callback URLs

4. **Monitoring**
   - Configure Sentry DSN
   - Set up log aggregation
   - Configure health check endpoints

## Architecture Notes

### Buffer Time Strategy (Appended Buffer)

- Buffer is appended AFTER booking end time only
- Booking 4:00-5:00 blocks resource until 5:10
- DB constraint uses `blocked_end_at` (not `end_at`)
- 30-min grid + 10-min buffer = acceptable unsold gap

### Concurrency Safety

- Redis locks are supportive (UX optimization)
- PostgreSQL exclusion constraint is authoritative
- Always handle constraint violations gracefully

### Payment Flow

1. Create HOLD booking (10-min expiry)
2. Initialize SSLCommerz session
3. POST form redirect to gateway
4. Webhook confirms payment (NOT return URL)
5. Late payment after expiry: confirm if slot available, else auto-refund
