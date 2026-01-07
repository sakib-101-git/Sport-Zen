# SportZen RC1 - ONE TRUE RUNBOOK

Complete guide to run SportZen locally on Windows with Docker.

---

## Prerequisites

Ensure these are installed:

| Tool | Version | Download |
|------|---------|----------|
| Node.js | v18+ | https://nodejs.org/ |
| pnpm | v8+ | `npm install -g pnpm` |
| Docker Desktop | Latest | https://docker.com/products/docker-desktop/ |
| Git | Latest | https://git-scm.com/ |

Verify installations:
```bash
node --version    # Should be v18+
pnpm --version    # Should be v8+
docker --version  # Should show Docker version
```

---

## Step 1: Clone & Install Dependencies

```bash
cd "C:\Users\User\OneDrive\Desktop\Sport Zen\sportzen"

# Install all dependencies (monorepo)
pnpm install
```

---

## Step 2: Start Docker Services

```bash
# Navigate to infra directory
cd infra/docker

# Start PostgreSQL + PostGIS + Redis
docker-compose up -d

# Verify containers are running
docker ps
```

Expected containers:
- `sportzen-postgres` (port 5432)
- `sportzen-redis` (port 6379)

**Optional**: Start with dev tools (pgAdmin, Redis Commander):
```bash
docker-compose --profile dev up -d
```

---

## Step 3: Configure Environment

### API Configuration

```bash
cd apps/api

# Copy example env file
copy .env.example .env
```

Edit `apps/api/.env`:

```env
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL="postgresql://sportzen:sportzen_dev_password@localhost:5432/sportzen?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT (change in production!)
JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters-long"
JWT_REFRESH_SECRET="your-refresh-secret-key-at-least-32-characters-long"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# SSLCommerz (use sandbox for testing)
SSLCOMMERZ_STORE_ID="your-sandbox-store-id"
SSLCOMMERZ_STORE_PASSWORD="your-sandbox-store-password"
SSLCOMMERZ_IS_LIVE=false
SSLCOMMERZ_SUCCESS_URL="http://localhost:3000/checkout/success"
SSLCOMMERZ_FAIL_URL="http://localhost:3000/checkout/failed"
SSLCOMMERZ_CANCEL_URL="http://localhost:3000/checkout/failed"
SSLCOMMERZ_IPN_URL="http://localhost:3001/api/v1/payments/sslcommerz/webhook"

# Platform Config
PLATFORM_COMMISSION_RATE=0.05
HOLD_EXPIRY_MINUTES=10
BUFFER_MINUTES=10

# CORS
CORS_ORIGINS="http://localhost:3000"
```

### Web Configuration

```bash
cd ../web

# Copy example env file
copy .env.example .env.local
```

Edit `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME="SportZen"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Step 4: Initialize Database

```bash
cd apps/api

# Generate Prisma client
npx prisma generate

# Run Prisma migrations
npx prisma migrate dev

# Run raw SQL migrations (PostGIS, exclusion constraints)
pnpm db:migrate:raw

# Seed the database with test data
npx prisma db seed
```

**Alternative**: Full reset:
```bash
pnpm db:reset
```

---

## Step 5: Start Development Servers

### Terminal 1 - API Server

```bash
cd apps/api
pnpm dev
```

API will be available at:
- **API**: http://localhost:3001
- **Swagger**: http://localhost:3001/api/docs
- **Health**: http://localhost:3001/api/v1/health

### Terminal 2 - Web Server

```bash
cd apps/web
pnpm dev
```

Web will be available at:
- **App**: http://localhost:3000

---

## Step 6: Verify Installation

### Health Checks

```bash
# Basic health
curl http://localhost:3001/api/v1/health

# Readiness (DB + Redis)
curl http://localhost:3001/api/v1/health/ready

# Detailed health
curl http://localhost:3001/api/v1/health/detailed
```

### Test Login

Open http://localhost:3000 and login with:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@sportzen.com | password123 |
| Owner | owner@example.com | password123 |
| Player | player@example.com | password123 |

---

## Quick Reference URLs

| Service | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger Docs | http://localhost:3001/api/docs |
| Health Check | http://localhost:3001/api/v1/health |
| Prisma Studio | Run `npx prisma studio` → http://localhost:5555 |
| pgAdmin (dev) | http://localhost:5050 (admin@sportzen.local / admin) |
| Redis Commander (dev) | http://localhost:8081 |

---

## Troubleshooting

### Database Connection Failed

```bash
# Check if postgres is running
docker ps | grep postgres

# View postgres logs
docker logs sportzen-postgres

# Restart containers
cd infra/docker
docker-compose down
docker-compose up -d
```

### Port Already in Use

```bash
# Find process on port 3001
netstat -ano | findstr :3001

# Kill process
taskkill /PID <process_id> /F
```

### Prisma Errors

```bash
# Regenerate client
npx prisma generate

# Full database reset
cd apps/api
npx prisma migrate reset --force
pnpm db:migrate:raw
npx prisma db seed
```

### PostGIS Extension Error

Ensure you're using the `postgis/postgis` Docker image. The docker-compose.yml should have:

```yaml
image: postgis/postgis:15-3.3
```

### Clear Everything & Start Fresh

```bash
# Stop all containers
cd infra/docker
docker-compose down -v

# Remove node_modules
cd ../..
rmdir /s /q node_modules
rmdir /s /q apps\api\node_modules
rmdir /s /q apps\web\node_modules

# Reinstall
pnpm install

# Start fresh
cd infra/docker
docker-compose up -d
cd ../../apps/api
npx prisma generate
npx prisma migrate dev
pnpm db:migrate:raw
npx prisma db seed
```

---

## Common Commands

```bash
# Run all tests
pnpm test

# Run API tests only
cd apps/api && pnpm test

# Run web tests only
cd apps/web && pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build all
pnpm build
```

---

## Next Steps

1. **SSLCommerz Setup**: Get sandbox credentials from https://developer.sslcommerz.com/
2. **OTP Provider**: Configure Twilio or Firebase for phone authentication
3. **Review Manual QA Checklist**: See `QA-CHECKLIST.md`
4. **Run Test Suite**: See `TEST-RUNBOOK.md`
