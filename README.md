# SportZen

A production-grade, mobile-first turf booking platform for Bangladesh.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, TanStack Query v5 |
| **Backend** | Node.js + NestJS, REST API, Swagger/OpenAPI, JWT + Passport |
| **Database** | PostgreSQL 16 + PostGIS (geography queries) |
| **Cache/Queue** | Redis, BullMQ (background jobs) |
| **Payments** | SSLCommerz (hosted checkout + IPN webhook) |
| **Validation** | Zod (shared), class-validator (API) |

## Architecture Overview

```
sportzen/
├── apps/
│   ├── web/          # Next.js 14+ frontend (App Router)
│   └── api/          # NestJS backend
├── packages/
│   ├── shared/       # Shared types, Zod schemas, constants
│   └── eslint-config/
└── infra/
    ├── docker/       # docker-compose, postgres-init
    └── migrations/   # Raw SQL for PostGIS, exclusion constraints
```

## Key Features

### For Players
- Discover nearby turfs with real-time availability
- 10% advance payment via SSLCommerz
- QR code for venue check-in
- Review facilities after verified check-in

### For Owners
- Manage venues, play areas, and pricing
- Calendar view with booking management
- Block time slots (maintenance, private events)
- Track offline payments (remaining 90%)
- Settlement reports and exports

### For Platform (Super Admin)
- Facility approval workflow
- Subscription management
- Dispute/refund resolution
- Review moderation

## Core Domain Concepts

### Booking Flow
1. **HOLD** (10 min) → Player selects slot, advance calculated
2. **Payment** → SSLCommerz POST form redirect
3. **CONFIRMED** → Webhook verifies payment (NOT return URL)
4. **COMPLETED** → After booking end time (auto-complete job)

### Concurrency Safety
- **Redis locks**: UX optimization (10 min TTL)
- **PostgreSQL exclusion constraint**: Authoritative source of truth
- **Idempotent webhooks**: Handles duplicate deliveries

### Buffer Time (Appended Strategy)
- 10-minute buffer appended AFTER booking end
- Booking 4:00-5:00 blocks resource until 5:10
- DB constraint uses `blocked_end_at`, not `end_at`

### Pricing Model
- Duration-based pricing (not hourly multiplication)
- Peak pricing rules (day + time ranges)
- If ANY overlap with peak → entire booking uses peak price

### Cancellation & Refunds
| Time Until Start | Refund Amount |
|-----------------|---------------|
| >24 hours | Full advance - processing fee |
| 24h - 6h | 50% advance - processing fee |
| <6 hours | No refund |

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 8+
- Docker & Docker Compose

### Quick Start

```bash
# 1. Clone and install
git clone <repo>
cd sportzen
pnpm install

# 2. Start infrastructure
docker-compose -f infra/docker/docker-compose.yml up -d

# 3. Setup database
cd apps/api
cp ../../.env.example .env
pnpm db:generate
pnpm db:migrate:dev

# 4. Run PostGIS/constraint migrations
psql -U sportzen -d sportzen -f ../../infra/docker/postgres-init/001-extensions.sql
psql -U sportzen -d sportzen -f ../../infra/migrations/001-exclusion-constraint.sql

# 5. Start development
cd ../..
pnpm dev
```

### Access Points
- **Web App**: http://localhost:3000
- **API**: http://localhost:3001
- **API Docs**: http://localhost:3001/api/docs
- **pgAdmin**: http://localhost:5050 (with --profile dev)
- **Redis Commander**: http://localhost:8081 (with --profile dev)

## Environment Variables

See `infra/README.md` for complete list.

### Critical Variables
```env
DATABASE_URL="postgresql://sportzen:password@localhost:5432/sportzen"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="change-in-production"
SSLCOMMERZ_STORE_ID="your-store-id"
SSLCOMMERZ_STORE_PASSWORD="your-password"
SSLCOMMERZ_IS_SANDBOX="true"
```

## API Routes

### Authentication
- `POST /auth/register` - Email registration
- `POST /auth/login` - Email login
- `POST /auth/phone/request-otp` - Request phone OTP
- `POST /auth/phone/verify-otp` - Verify phone OTP
- `POST /auth/link-phone` - Link phone to account
- `POST /auth/refresh` - Refresh tokens
- `GET /auth/me` - Current user

### Facilities & Search
- `GET /facilities/nearby` - Nearby search with PostGIS
- `GET /facilities/:id` - Facility details
- `GET /facilities/:id/play-areas` - Play areas
- `GET /facilities/:id/reviews` - Reviews

### Booking
- `GET /availability` - Slot availability grid
- `POST /bookings/hold` - Create hold (10 min expiry)
- `GET /bookings/:id` - Booking details
- `POST /bookings/:id/cancel` - Cancel booking
- `POST /bookings/:id/checkin` - QR check-in

### Payments
- `POST /payments/sslcommerz/initiate` - Get gateway URL
- `POST /payments/sslcommerz/webhook` - IPN handler
- `GET /payments/:intentId/status` - Poll status

### Owner Panel
- `GET /owner/dashboard` - Stats overview
- `GET /owner/bookings` - Booking list
- `GET /owner/calendar` - Calendar view
- `POST /owner/blocks` - Create block
- `PATCH /owner/bookings/:id/offline-payment` - Record payment
- `GET /owner/settlements` - Monthly settlements

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:cov
```

### Critical Test Scenarios
1. Parallel holds for same slot (DB constraint blocks second)
2. Duplicate webhook deliveries (idempotent handling)
3. Late webhook after hold expiry (auto-refund if slot taken)
4. Cancellation refund tiers (Asia/Dhaka timezone)
5. Review eligibility (requires verified check-in)
6. Subscription enforcement (blocks holds for suspended)

## Production Deployment

### Checklist
- [ ] Change all secrets in environment
- [ ] Set `SSLCOMMERZ_IS_SANDBOX=false`
- [ ] Configure production database
- [ ] Run all migrations including raw SQL
- [ ] Configure HTTPS
- [ ] Update SSLCommerz callback URLs
- [ ] Set up log aggregation
- [ ] Configure health check monitoring

### Database Migrations
```bash
# Prisma migrations
pnpm db:migrate

# Raw SQL (MUST run after Prisma)
psql -f infra/migrations/001-exclusion-constraint.sql
```

## Design Decisions

### Why PostgreSQL Exclusion Constraint?
Redis locks can fail (network, expiry). The exclusion constraint is the authoritative guard against double-booking at the database level.

### Why POST Form Redirect for SSLCommerz?
SSLCommerz requires POST-based redirects. We use an auto-submitting hidden form component.

### Why 10% Advance Only?
Business model: Players pay 10% online, 90% at venue. System tracks offline payment status separately from booking status.

### Why Appended Buffer?
Revenue optimization: Buffer after booking (not before) means the facility owner gets the full booked time.

## License

Private - All rights reserved

---

Built with by the SportZen Engineering Team
