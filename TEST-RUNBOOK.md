# SportZen RC1 - TEST RUNBOOK

Complete guide to run all tests for SportZen.

---

## Prerequisites

- All dependencies installed (`pnpm install`)
- Docker services running (postgres, redis)
- Database migrated (`npx prisma migrate dev`)

---

## 1. Lint Check

```bash
# From monorepo root
pnpm lint

# Or run separately:
cd apps/api && pnpm lint
cd apps/web && pnpm lint
```

**Expected**: No lint errors. Warnings acceptable but should be reviewed.

---

## 2. Type Check

```bash
# From monorepo root
pnpm typecheck

# Or run separately:
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

**Expected**: No TypeScript errors.

---

## 3. Unit Tests

### API Unit Tests

```bash
cd apps/api

# Run all tests
pnpm test

# Run with coverage
pnpm test:cov

# Run specific test file
pnpm test -- --testPathPattern=bookings

# Run in watch mode
pnpm test:watch
```

**Expected**: All tests pass. Coverage report generated in `coverage/` directory.

### Web Unit Tests

```bash
cd apps/web

# Run all tests
pnpm test

# Run with coverage
pnpm test:cov
```

---

## 4. Integration Tests

```bash
cd apps/api

# Ensure test database is available
# Tests use the same DATABASE_URL but isolated transactions

pnpm test:e2e
```

**Key Integration Tests:**

| Test | What It Verifies |
|------|------------------|
| Auth Flow | Registration, login, JWT tokens, refresh |
| Booking Flow | Hold creation, payment simulation, confirmation |
| Concurrency | Parallel booking attempts (exclusion constraint) |
| Idempotency | Duplicate webhook handling |

---

## 5. Critical Flow Tests

### A. Double Booking Prevention Test

Tests that the DB exclusion constraint prevents overlapping bookings.

```bash
cd apps/api
pnpm test -- --testPathPattern=concurrency
```

**What it tests:**
1. Two simultaneous HOLD requests for same time slot
2. Only one succeeds, other gets DB exclusion error
3. Error is properly handled and returned to client

### B. Webhook Idempotency Test

Tests that duplicate webhook calls don't corrupt data.

```bash
cd apps/api
pnpm test -- --testPathPattern=webhook
```

**What it tests:**
1. First webhook call confirms booking
2. Second identical webhook call returns success without changes
3. No duplicate ledger entries or notifications

### C. Late Webhook Handling Test

Tests handling of payment success after hold expiry.

```bash
cd apps/api
pnpm test -- --testPathPattern=late-webhook
```

**What it tests:**
1. Booking hold expires
2. Late payment webhook arrives
3. If slot still available → confirm
4. If slot taken → create refund record

### D. Cancellation Tier Tests

```bash
cd apps/api
pnpm test -- --testPathPattern=cancellation
```

**What it tests:**
- >24h cancellation: Full refund minus processing fee
- 6-24h cancellation: 50% refund minus processing fee
- <6h cancellation: No refund

---

## 6. Build Verification

```bash
# Build API
cd apps/api
pnpm build

# Build Web
cd apps/web
pnpm build
```

**Expected**: Both build successfully without errors.

---

## 7. Manual API Tests

Use Swagger UI at http://localhost:3001/api/docs or curl:

### Auth Tests

```bash
# Register
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123","name":"Test User"}'

# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'

# Get profile (use token from login response)
curl http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer <access_token>"
```

### Facility Tests

```bash
# Nearby search
curl "http://localhost:3001/api/v1/facilities/nearby?latitude=22.3569&longitude=91.7832&radiusKm=10"

# Get facility
curl http://localhost:3001/api/v1/facilities/<facility_id>
```

### Availability Tests

```bash
# Get slots for a date
curl "http://localhost:3001/api/v1/availability?conflictGroupId=<id>&date=2024-01-15"
```

### Booking Tests

```bash
# Create hold
curl -X POST http://localhost:3001/api/v1/bookings/hold \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sportProfileId": "<id>",
    "startAt": "2024-01-15T10:00:00Z",
    "duration": 60,
    "customerName": "Test",
    "customerPhone": "+8801234567890"
  }'
```

### Health Tests

```bash
# Liveness
curl http://localhost:3001/api/v1/health

# Readiness
curl http://localhost:3001/api/v1/health/ready

# Detailed
curl http://localhost:3001/api/v1/health/detailed
```

---

## 8. Performance Tests (Optional)

### Load Test Setup

```bash
# Install k6 (https://k6.io/)
# On Windows with Chocolatey:
choco install k6

# Or download from https://k6.io/docs/getting-started/installation/
```

### Basic Load Test

Create `load-test.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const res = http.get('http://localhost:3001/api/v1/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
```

Run:
```bash
k6 run load-test.js
```

---

## 9. Security Tests (Optional)

### Rate Limiting Test

```bash
# Should get 429 after too many requests
for i in {1..20}; do
  curl -X POST http://localhost:3001/api/v1/auth/phone/request-otp \
    -H "Content-Type: application/json" \
    -d '{"phone":"+8801234567890"}'
  echo ""
done
```

**Expected**: After 5 requests/minute, should return 429 Too Many Requests.

---

## Test Coverage Goals

| Area | Target |
|------|--------|
| Booking Service | >80% |
| Payment Service | >80% |
| Auth Service | >70% |
| Overall API | >60% |

---

## CI/CD Pipeline Commands

For CI integration:

```bash
# Full test suite
pnpm install
pnpm lint
pnpm typecheck
cd apps/api && pnpm test:cov
cd apps/web && pnpm test:cov
pnpm build
```

---

## Test Database Reset

If tests leave database in bad state:

```bash
cd apps/api
npx prisma migrate reset --force
pnpm db:migrate:raw
npx prisma db seed
```

---

## Troubleshooting Test Failures

### "Database connection failed"
- Ensure Docker containers are running
- Check DATABASE_URL in .env

### "Port already in use"
- Stop any running dev servers
- Check for orphaned node processes

### "Timeout exceeded"
- Increase Jest timeout in test file:
  ```typescript
  jest.setTimeout(30000);
  ```

### "Prisma client not generated"
```bash
npx prisma generate
```
