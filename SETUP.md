# SportZen - Complete Setup Guide

This guide will help you set up the SportZen turf booking platform for local development.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **pnpm** (v8 or higher) - `npm install -g pnpm`
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)
- **Git** - [Download](https://git-scm.com/)

## Step 1: Clone and Install Dependencies

```bash
# Navigate to the project directory
cd sportzen

# Install all dependencies
pnpm install
```

## Step 2: Start Database Services

Start PostgreSQL and Redis using Docker Compose:

```bash
# Navigate to infra directory
cd infra/docker

# Start services (postgres + redis)
docker-compose up -d

# To include development tools (pgAdmin, Redis Commander):
docker-compose --profile dev up -d
```

**Service URLs:**
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- pgAdmin (dev): `localhost:5050` (admin@sportzen.local / admin)
- Redis Commander (dev): `localhost:8081`

## Step 3: Configure Environment Variables

### API (.env)

```bash
# Copy example env file
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` with these values for local development:

```env
NODE_ENV=development
PORT=3001

# Database (matches docker-compose)
DATABASE_URL="postgresql://sportzen:sportzen_dev_password@localhost:5432/sportzen?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT (generate secure keys for production)
JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters"
JWT_REFRESH_SECRET="your-refresh-secret-key-at-least-32-characters"

# SSLCommerz (use sandbox credentials for testing)
SSLCOMMERZ_STORE_ID="your-sandbox-store-id"
SSLCOMMERZ_STORE_PASSWORD="your-sandbox-store-password"
SSLCOMMERZ_IS_SANDBOX=true
SSLCOMMERZ_SUCCESS_URL="http://localhost:3000/checkout/success"
SSLCOMMERZ_FAIL_URL="http://localhost:3000/checkout/failed"
SSLCOMMERZ_CANCEL_URL="http://localhost:3000/checkout/failed"
SSLCOMMERZ_IPN_URL="http://localhost:3001/api/v1/payments/sslcommerz/webhook"
```

### Web (.env.local)

```bash
# Copy example env file
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME="SportZen"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Step 4: Initialize Database

Run Prisma migrations and seed data:

```bash
# Navigate to API directory
cd apps/api

# Generate Prisma client
npx prisma generate

# Run migrations (creates tables)
npx prisma migrate dev

# Seed the database with test data
npx prisma db seed
```

## Step 5: Start Development Servers

Open two terminal windows:

### Terminal 1 - API Server

```bash
cd apps/api
pnpm dev
```

API will be available at: `http://localhost:3001`
Swagger docs: `http://localhost:3001/api/docs`

### Terminal 2 - Web Server

```bash
cd apps/web
pnpm dev
```

Web app will be available at: `http://localhost:3000`

## Test Credentials

After seeding, you can log in with these accounts:

| Role        | Email                  | Password     |
|-------------|------------------------|--------------|
| Super Admin | admin@sportzen.com     | password123  |
| Owner       | owner@example.com      | password123  |
| Player      | player@example.com     | password123  |

## SSLCommerz Setup (Payment Gateway)

1. Register for a sandbox account at [SSLCommerz Developer](https://developer.sslcommerz.com/)
2. Get your sandbox Store ID and Store Password
3. Update `apps/api/.env` with your credentials

For testing without SSLCommerz, the API includes a dev-only webhook simulator endpoint:
```
POST /api/v1/payments/simulate-webhook
```

## Development Tools

### Prisma Studio (Database GUI)

```bash
cd apps/api
npx prisma studio
```
Opens at: `http://localhost:5555`

### API Documentation

Swagger UI is available at: `http://localhost:3001/api/docs`

### pgAdmin (Database Admin)

If started with dev profile: `http://localhost:5050`
- Email: admin@sportzen.local
- Password: admin

### Redis Commander

If started with dev profile: `http://localhost:8081`

## Troubleshooting

### Database Connection Issues

```bash
# Check if postgres is running
docker ps

# View postgres logs
docker logs sportzen-postgres

# Reset database completely
cd apps/api
npx prisma migrate reset
```

### Port Already in Use

```bash
# Find process using port
netstat -ano | findstr :3001
# or on Mac/Linux
lsof -i :3001

# Kill process (Windows)
taskkill /PID <process_id> /F
```

### Clear Node Modules

```bash
# From root directory
rm -rf node_modules
rm -rf apps/api/node_modules
rm -rf apps/web/node_modules
pnpm install
```

## Project Structure

```
sportzen/
├── apps/
│   ├── api/          # NestJS backend
│   │   ├── prisma/   # Database schema & migrations
│   │   └── src/      # API source code
│   └── web/          # Next.js frontend
│       ├── app/      # App router pages
│       └── components/
├── packages/
│   └── shared/       # Shared types & utils
└── infra/
    └── docker/       # Docker compose files
```

## Key Features

- **Player Portal**: Search turfs, view availability, book slots, pay advance, get QR for check-in
- **Owner Dashboard**: Manage facilities, view calendar, mark offline payments, view settlements
- **Admin Panel**: Approve facilities, manage refunds, moderate reviews, manage subscriptions

## Support

For issues or questions, please create a GitHub issue or contact the development team.
