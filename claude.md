
ROLE: ELITE SOFTWARE ENGINEERING SQUAD (10-PERSON TEAM)
Act as a world-class engineering team (Solution Architect, Backend Lead, Frontend Lead, DevOps, UI/UX Designer, QA Lead, Security Engineer, Data Engineer, Payments Engineer, Product Engineer). Architect and build “Sport Zen”, a high-performance, mobile-first centralized turf booking platform for a single city in Bangladesh (MVP), designed to scale to more cities later.

Your output must be a production-grade blueprint + core code that is logically consistent under concurrency, payments, and scheduling. Do NOT simplify.

================================================================================
0) CONTEXT PACK (DOMAIN CLARITY — READ THIS AS AUTHORITATIVE)
================================================================================
You are building a real-world booking/payment platform. The goal is correctness under concurrency + clear UX on mobile.

A) Product Vision & Scope
- Players: discover nearby turfs, see real-time availability, pay 10% advance via SSLCommerz, get QR for check-in, review after playing.
- Owners (Turf Owners): manage venues/play areas, booking calendar, blocks, pricing, offline remaining payment tracking, settlements/reports, receive notifications automatically.
- Super Admin: approve facilities, manage subscriptions, resolve disputes/refunds, moderate reviews.

“Electric Sports” UI theme: deep dark background + neon green highlights, smooth animations, minimal friction, mobile-first.

B) Core Domain Definitions (No Ambiguity)
1) Facility (Venue): a location with address, geo location, photos, policies, owner contact.
2) PlayArea (Resource): a bookable unit inside a facility (Pitch A, Pitch B, Court 1).
3) Conflict Group (Shared Physical Space):
   - Some sports share the SAME physical surface/time allocation.
   - When a booking exists in a conflict group, it blackouts ALL sports tied to that same conflict group and time range.
   - Model: each PlayArea has conflict_group_id.
     - Default: conflict_group_id = play_area_id (isolated)
     - Shared: multiple SportProfiles or multiple PlayAreas reference same conflict_group_id intentionally.
4) SportProfile (PlayArea + SportType rules): allowed durations, slot interval, pricing rules (base + peak), constraints.
5) Booking is TIME-RANGE based (start_at, end_at; UTC in DB; display Asia/Dhaka).
6) Booking HOLD vs CONFIRMED:
   - Booking begins as HOLD during payment.
   - HOLD prevents others from booking due to DB exclusion constraint.
   - HOLD expires after 10 minutes if payment isn’t verified.

C) Time, Timezone, Money Rules
- Store timestamps in UTC (timestamptz). Display in Asia/Dhaka.
- Cancellation tiers computed in Asia/Dhaka local time.
- Currency: BDT.
- Store money as integers consistently (choose: whole BDT or minor units; define one, use everywhere).
- Advance = 10% of total price using a deterministic rounding rule (CEIL).

D) Availability Rules
Affected by:
1) Bookings in HOLD or CONFIRMED
2) BookingBlocks (maintenance/manual blocks)
3) Buffer Time: mandatory 10 minutes between bookings

Buffer logic:
- Each booking occupies: [start_at - buffer_before, end_at + buffer_after] within the SAME conflict_group_id.

Slot grid:
- interval default 30 mins
- durations depend on sport profile (football 60/90/120 etc.)

Available Now:
- A facility is “available now” if it has at least one valid start time within next N hours (default 4), respecting lead time + buffer.

E) Concurrency Requirements
- Redis lock helps UX but DB is final authority via exclusion constraint.
- Must handle simultaneous booking attempts, Redis expiry, webhook delays.

F) Payment Requirements (SSLCommerz)
- PaymentIntent must exist; webhook must be idempotent.
- Return URL is NOT proof of payment. Use webhook verification.
- Late webhook after hold expiry must be handled safely (confirm if still possible else refund workflow).

G) Cancellation & Refund Rules (Advance Only)
- >24h: refund full advance minus platform processing fee
- 24h–6h: refund 50% of advance (deterministic rounding) minus processing fee (if applicable)
- <6h: no refund
- Refund lifecycle exists even if refunds must be manual.

H) Subscriptions
- Owners pay monthly subscription to list/accept bookings.
- States: TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELED
- Enforcement must be consistent and documented.

I) Reviews & Moderation
- Reviews must be authentic: only COMPLETED + VERIFIED check-in bookings can review.
- One review per booking.
- Reporting/moderation exists.
- Ranking uses Bayesian weighting + optional minimum review threshold.

J) QR Check-in
- CONFIRMED booking generates QR token.
- Owner/staff verifies within window (e.g., 30 min before start to end+30).
- Check-in required for review eligibility.

K) Roles & RBAC
- PLAYER, OWNER, OWNER_STAFF, SUPER_ADMIN
- Owner staff scoped to owner facilities.
- Dual-auth with email/pass + phone OTP.
- Phone linking policy: no account merges; linking fails if phone is already linked elsewhere.
- Refresh token rotation + OTP rate limiting required.

L) Notifications
- Owner notified on CONFIRMED booking.
- Player notified on confirmation + reminder.
- Implement provider interfaces with stubs.

M) UI/UX Expectations
- Mobile-first sticky “Book Now” footer
- Bottom nav for player area
- Slot grid colors: Green free, Red booked/blocked, Orange selected, Gray disabled
- Skeleton loaders
- Framer Motion micro-animations

N) API Conventions
- Pagination for lists
- Consistent error shape {code, message, details?, correlationId}
- Idempotent webhook and safe-to-retry cancellation request patterns
- Audit logs required

O) “Done” Criteria
1) DB exclusion prevents double-booking
2) Booking confirmation requires verified webhook (not return URL)
3) Holds expire by state change, not deletion
4) Multi-sport conflict works via conflict_group_id
5) Buffer time enforced
6) Refund tiers correct and tracked
7) Owner dashboard shows who booked, time, payment status, offline settlement fields, settlements
8) UI responsive and matches Electric Sports theme

================================================================================
1) MANDATORY TECH STACK (EXACT — DO NOT SUBSTITUTE)
================================================================================
Frontend:
- Next.js 14+ (App Router), TypeScript
- Tailwind CSS, shadcn/ui
- Framer Motion
- TanStack Query v5
- Zod validation
Backend:
- Node.js + NestJS (Modular MVC), REST API
- JWT + Passport
- Swagger/OpenAPI
- class-validator + class-transformer
- BullMQ for background jobs
- Redis for slot locks + rate limiting
- Prisma ORM
Database:
- PostgreSQL + PostGIS
- Use timestamptz in UTC; Asia/Dhaka for display/policy
- PostGIS geography(Point, 4326) for distance queries
Payments:
- SSLCommerz hosted checkout with webhook + signature verification
Authentication:
- Dual system: Email/Password + Phone/OTP (Firebase or Twilio)

================================================================================
2) CLARIFICATIONS ON SCOPE (MUST IMPLEMENT EXACTLY)
================================================================================
1) Remaining Balance (90%):
- The remaining 90% is paid OFFLINE at the venue.
- The system must not treat COMPLETED as “fully paid.”
- Track offline settlement separately on the booking.

2) Owner Payouts / Settlement Math:
- Platform collects 10% advance.
- Platform commission is X% of TOTAL booking value (configurable, default 5%).
- owner_advance_credit = advance_amount - platform_commission (must be >= 0).
- Track owner_advance_credit in an OwnerLedger for monthly payout.

3) Rescheduling:
- OUT OF SCOPE in MVP. Users must cancel (refund tiers apply) and rebook.
- No reschedule endpoints in MVP.

4) Pricing Complexity:
- Keep pricing simple: weekly recurring Peak Rules (day-of-week + time-of-day ranges).
- No holiday calendars, no per-date overrides in MVP.
- Pricing rule: if ANY portion overlaps peak => whole booking uses peak price (documented MVP rule).

5) Account Merging:
- Not supported in MVP. If phone already linked to a different user, linking fails.

6) Review Exploit Mitigation:
- Reviews ONLY allowed if booking is COMPLETED AND checkin_status = VERIFIED (QR scanned).

7) SSLCommerz Redirect:
- Must support POST-based redirect via an auto-submitting hidden HTML form.
- Do not rely on router.push() only.

================================================================================
3) DOMAIN ENTITIES (MUST EXIST)
================================================================================
- User (roles: PLAYER, OWNER, OWNER_STAFF, SUPER_ADMIN)
- Facility
- PlayArea
- SportType
- SportProfile
- Booking (time range + hold expiry + status + payment_stage)
- BookingBlock (maintenance/manual blocks; time range)
- PaymentIntent
- PaymentTransaction
- Refund
- SubscriptionPlan, OwnerSubscription, Invoice
- Review, ReviewReport
- OwnerLedger (credits/debits for owner payouts)
- AuditLog + BookingEvent
- Notification (provider interface + stub)

Soft deletes:
- Users, Facilities, PlayAreas, Bookings use deleted_at.
- Payment/Refund/Invoice/Ledger/Audit are immutable (no hard delete).

================================================================================
4) TIME, SLOTS, DURATION, BUFFER (PRECISE)
================================================================================
Defaults:
- slot_interval_minutes = 30
- buffer_minutes = 10 (applies before and after)
- allowed durations per sport profile (array)

Booking uses UTC:
- Booking.start_at, Booking.end_at are timestamptz UTC.
- UI converts to Asia/Dhaka display.

Buffer enforcement:
- Booking occupies [start_at - buffer, end_at + buffer] for overlap checks.

Available Now:
- Has at least one valid start time within next 4 hours (configurable).

================================================================================
5) BOOKING STATE MACHINE (STRICT)
================================================================================
Booking.status:
- HOLD (pending payment)
- CONFIRMED (advance verified by webhook)
- CANCELED
- COMPLETED (time-based; does NOT imply fully paid)
- EXPIRED (hold expired)
- (Optional) REFUND_PENDING / REFUNDED / REFUND_FAILED (or via Refund table)

Add Booking.payment_stage:
- ADVANCE_PAID
- FULL_PAID_OFFLINE
- PARTIAL_OFFLINE
- NOT_PAID_OFFLINE

Offline tracking fields on Booking:
- offline_amount_collected (int)
- offline_payment_method (CASH/BKASH/NAGAD/CARD/OTHER/null)
- offline_payment_recorded_by_user_id
- offline_payment_recorded_at

HOLD behavior:
- On hold creation: set hold_expires_at = now + 10 minutes
- Redis lock TTL = 10 minutes (UX)
- DB constraint prevents overlap for HOLD and CONFIRMED
- BullMQ job marks EXPIRED after hold_expires_at if still HOLD and no success payment

Do not delete bookings to release. Use status transitions.

================================================================================
6) DB-LEVEL NON-OVERLAP (MANDATORY — NO EXCEPTIONS)
================================================================================
Must implement Postgres exclusion constraint using GiST and tstzrange.

Bookings must store:
- conflict_group_id (UUID)
- time_range = tstzrange(start_at, end_at)

Exclusion:
EXCLUDE USING gist (
  conflict_group_id WITH =,
  time_range WITH &&
)
WHERE (deleted_at IS NULL AND status IN ('HOLD','CONFIRMED'));

Enable extensions:
- postgis
- btree_gist

Prisma requires raw SQL migrations for exclusion constraint.

================================================================================
7) REDIS SLOT LOCKING (SUPPORTIVE ONLY)
================================================================================
Key format:
- lock:conflict_group:{id}:{start_iso}:{end_iso}
Acquire:
- SET key value NX PX ttl(10 min)
Value includes booking_id + user_id

Rate limit (Redis):
- OTP request, OTP verify, login, booking hold creation, review post

DB remains the source of truth.

================================================================================
8) PAYMENTS (SSLCOMMERZ) — COMPLETE & SAFE
================================================================================
Money:
- total_booking_value computed server-side only
- advance_amount = CEIL(total_booking_value * 0.10)
- platform_commission = CEIL(total_booking_value * platform_commission_rate)
- Ensure platform_commission <= advance_amount
- owner_advance_credit = advance_amount - platform_commission

Payment tables:
PaymentIntent:
- id, booking_id, amount(int), currency='BDT', status(PENDING/SUCCESS/FAILED/EXPIRED/LATE_SUCCESS_CONFLICT), expires_at, metadata_hash
PaymentTransaction:
- id, payment_intent_id, gateway='SSLCOMMERZ', tran_id, val_id, amount, status, raw_payload(json), created_at

Flow:
1) POST /bookings/hold:
   - Acquire Redis lock (best effort)
   - In DB transaction:
     - Insert Booking (HOLD) with hold_expires_at
     - Insert PaymentIntent (PENDING)
   - Return: payment_intent_id + booking_id + payment initiation data
2) POST /payments/sslcommerz/initiate:
   - Returns gateway_url + form_fields (POST form payload)
3) Frontend:
   - Creates hidden <form method="POST" action=gateway_url> with inputs = form_fields
   - Auto-submit on mount
4) Webhook /payments/sslcommerz/webhook:
   - Verify signature/validity per SSLCommerz rules
   - Verify tran_id matches PaymentIntent
   - Verify amount equals PaymentIntent.amount
   - Idempotency:
     - If transaction already SUCCESS processed => return 200 without changes
   - On success:
     - In DB transaction:
       - Mark PaymentIntent SUCCESS
       - Mark Booking CONFIRMED (and payment_stage = ADVANCE_PAID)
       - Create OwnerLedger credit entry for owner_advance_credit
       - Emit BookingEvent + notify owner
5) Return URL pages:
   - Frontend shows “Pending confirmation” until PaymentIntent becomes SUCCESS via polling.
   - Do NOT mark confirmed based on return URL.

Late webhook after hold expiry policy:
- If booking is EXPIRED when webhook arrives:
  - Attempt to set booking CONFIRMED in transaction.
  - If DB exclusion fails (conflict booked by someone else):
    - Mark PaymentIntent LATE_SUCCESS_CONFLICT
    - Create Refund record automatically (amount = PaymentIntent.amount minus processing rules if any)
    - Notify admin & user.

================================================================================
9) CANCELLATION, REFUNDS, FEES (ADVANCE ONLY)
================================================================================
Refund tiers based on Asia/Dhaka time until start_at:
- >24h: refund = advance_amount - platform_processing_fee
- 24h–6h: refund = FLOOR/CEIL(advance_amount * 0.5) - platform_processing_fee (choose deterministic rounding and document)
- <6h: refund = 0

Refund lifecycle:
- REQUESTED → APPROVED → PROCESSING → REFUNDED / FAILED / MANUAL_REQUIRED

Platform processing fee:
- Always retained by platform (revenue)
- Appears in settlement reports

Ledger effects:
- If booking was CONFIRMED and owner_advance_credit was credited, cancellation must reverse/adjust ledger accordingly.

================================================================================
10) OWNER SUBSCRIPTIONS (MONTHLY)
================================================================================
OwnerSubscription states:
- TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELED

Enforcement (choose one and implement consistently):
Option A (recommended):
- If subscription not ACTIVE/TRIAL => disable new booking holds for that owner’s facilities (show message)
Owners can still view dashboards and historical data.

Invoices:
- Generate monthly invoices
- Track payment status even if manual

================================================================================
11) REVIEWS, MODERATION, RANKING
================================================================================
Review eligibility:
- booking.status = COMPLETED AND booking.checkin_status = VERIFIED
- unique constraint: one review per booking

Review abuse:
- Report endpoint creates ReviewReport
- Admin can hide/delete (soft) review

Ranking:
- Bayesian weighted rating + optional min verified reviews threshold (e.g., >= 5) for top lists

================================================================================
12) CHECK-IN (QR)
================================================================================
Booking.checkin_status:
- NOT_CHECKED_IN | VERIFIED
Fields:
- checkin_verified_by_user_id
- checkin_verified_at
- qr_token (secure random)
Verify window:
- 30 mins before start to end+30 mins

================================================================================
13) POSTGIS NEARBY SEARCH
================================================================================
Facility location:
- geography(Point, 4326)
Implement:
- ST_DWithin for radius
- ST_Distance sorting
Filters:
- sport type availability (SportProfile exists)
- price range
- rating threshold
- availableNow (availability engine for next 4 hours)
- subscription eligibility (facility bookable only if owner subscription active/trial)

================================================================================
14) REQUIRED API ROUTES (MINIMUM)
================================================================================
Auth:
- POST /auth/register
- POST /auth/login
- POST /auth/phone/request-otp
- POST /auth/phone/verify-otp
- POST /auth/link-phone (reject if phone already linked)
- POST /auth/refresh
- POST /auth/logout
- GET  /auth/me

Facilities/Search:
- GET /facilities/nearby?lat=&lng=&radiusKm=&sport=&minPrice=&maxPrice=&rating=&availableNow=
- GET /facilities/:id
- GET /facilities/:id/play-areas
- GET /facilities/:id/reviews

Availability/Booking:
- GET  /availability?conflictGroupId=&date=
- POST /bookings/hold
- GET  /bookings/:id
- GET  /me/bookings
- POST /bookings/:id/cancel
- POST /bookings/:id/checkin
- GET  /bookings/:id/qr

Payments:
- POST /payments/sslcommerz/initiate (returns gateway_url + form_fields)
- POST /payments/sslcommerz/webhook (idempotent)
- GET  /payments/:intentId/status

Reviews:
- POST /reviews
- POST /reviews/:id/report

Owner Panel:
- GET  /owner/dashboard
- GET  /owner/bookings?dateRange=
- GET  /owner/calendar?month=
- POST /owner/blocks
- DELETE /owner/blocks/:id
- PATCH /owner/facilities/:id
- POST /owner/facilities/:id/photos
- PATCH /owner/bookings/:id/offline-payment (mark FULL_PAID_OFFLINE, etc)
- GET  /owner/settlements?month=
- GET  /owner/exports/settlements.pdf
- GET  /owner/exports/settlements.xlsx
- POST /owner/staff
- PATCH /owner/staff/:id/role

Super Admin:
- GET  /admin/facility-approvals
- POST /admin/facility-approvals/:id/approve
- POST /admin/facility-approvals/:id/reject
- GET  /admin/disputes
- POST /admin/refunds/:id/approve
- POST /admin/refunds/:id/mark-manual-complete
- GET  /admin/subscriptions
- PATCH /admin/subscriptions/:ownerId/status
- PATCH /admin/reviews/:id/moderate

All endpoints:
- validated inputs
- consistent error format
- correlationId logging
- RBAC guards

================================================================================
15) BACKGROUND JOBS (BULLMQ)
================================================================================
Jobs (idempotent):
- HOLD_EXPIRY: mark HOLD => EXPIRED if not paid
- REMINDER: notify player before booking
- AUTO_COMPLETE: mark CONFIRMED => COMPLETED after end time
- MONTHLY_INVOICES: create invoices and settlement summaries
- (Optional) RECONCILIATION: verify payment intent statuses if needed

================================================================================
16) UI/UX REQUIREMENTS (ELECTRIC SPORTS)
================================================================================
Theme:
- Deep Obsidian #050505
- Neon Pitch-Green #39FF14

Pages:
- Home (geo search + filters)
- Listings (cards + skeletons)
- Turf details (gallery, map, facilities, reviews, owner contact, slot grid)
- Checkout (advance summary + POST form redirect)
- Payment pending (poll)
- Player dashboard (bookings, QR, cancel, favorites)
- Owner panel (calendar, bookings, blocks, pricing, offline payment marking, settlements)
- Super admin panel (approvals, refunds, subscriptions, moderation)

Components:
- Slot Selection Grid with colors and durations
- Sticky “Book Now” footer (mobile)
- Bottom nav (mobile)
- Skeleton loaders
- Framer Motion micro-interactions

================================================================================
17) OBSERVABILITY + DEVOPS
================================================================================
Local:
- docker-compose: postgres+postgis, redis
- prisma migrate + seed

Logging:
- structured logs (pino)
- correlation ID middleware

Monitoring hooks:
- Sentry-ready placeholders
- /health and /ready endpoints

CI/CD outline:
- lint, typecheck, tests, build
- migration checks

================================================================================
18) TESTING (CRITICAL FLOWS)
================================================================================
Provide test plan + example tests for:
- parallel holds attempting same time (DB constraint blocks)
- webhook duplicate deliveries idempotent
- late webhook after hold expiry => conflict => refund record
- cancellation refund tier calculations (Asia/Dhaka)
- review eligibility requires VERIFIED check-in
- subscription enforcement blocks new holds
- SSLCommerz POST form redirect works

================================================================================
19) DELIVERABLE FORMAT (STRICT ORDER)
================================================================================
Output in this exact order:

A) Monorepo folder structure:
- /apps/web (Next.js)
- /apps/api (NestJS)
- /packages/shared (types, zod schemas)
- /infra (docker-compose, SQL migrations notes)

B) Prisma schema:
- PostGIS geography types
- soft deletes
- indexes
- relations
- enums
- ledger + invoice + refunds

C) Raw SQL migrations:
- CREATE EXTENSION postgis; CREATE EXTENSION btree_gist;
- Booking time_range generation
- GiST exclusion constraint on conflict_group_id + time_range
- Geo indexes (GIST) for facility location

D) NestJS modules + real code snippets:
- BookingModule: availability engine, hold creation in transaction, state transitions
- PaymentsModule: SSLCommerz initiation + webhook handler (idempotent), signature checks placeholders, late webhook conflict handling
- Ledger/Settlement logic
- JobsModule: BullMQ workers
- AuthModule: dual-auth, refresh token rotation, phone linking rejection, rate limiting
- Owner/Admin modules with RBAC guards
Include real code for:
- PostGIS nearby query
- Redis lock acquire/release
- DB transaction usage (Prisma)
- webhook idempotency patterns

E) Next.js key pages + components code:
- Turf detail page (map, gallery, reviews, slot grid)
- SlotSelectionGrid component
- Checkout page generating auto-submitting POST form
- Payment pending page polling
- Owner calendar view

F) Environment variables list (web/api)
G) Run instructions (local dev)
H) Testing instructions

================================================================================
20) GUARDRAILS (NEVER VIOLATE)
================================================================================
- Never trust client-side price math
- Never confirm booking via return URL; only via verified webhook
- DB exclusion constraint is mandatory
- Redis is supportive only
- Use conflict_group_id for multi-sport blackout
- Holds expire by status change, never deletion
- Late webhook conflicts trigger refund workflow
- Offline remaining 90% tracking is separate from booking status
- Rescheduling is out of scope in MVP
- Phone linking rejects if phone is already linked (no merges)
- Reviews require VERIFIED check-in

========================
ADDITIONAL MVP CLARIFICATIONS (FINAL)
========================

8) Buffer & Grid Strategy (Revenue Protection)
- Buffer strategy is "APPENDED BUFFER":
  - A booking duration is 100% play time.
  - The mandatory 10-minute buffer is appended AFTER the booking only (not before).
  - Example: booking 4:00–5:00 means playable time ends at 5:00, but the resource is blocked until 5:10.
- UI/Availability constraint:
  - The time-slot grid uses fixed 30-minute start times (e.g., 4:00, 4:30, 5:00, 5:30).
  - If 4:00–5:00 is booked, the 5:00 start time MUST be disabled (because the block extends until 5:10).
  - The system accepts that a fixed 30-min grid combined with 10-min appended buffers creates an unsold gap (5:10–5:30). This is acceptable for MVP.

Implementation mandate:
- Availability/overlap checks must consider the "blocked_end_at = end_at + buffer_minutes".
- The DB non-overlap constraint must use time_range = tstzrange(start_at, blocked_end_at) (not end_at) so that buffer is enforced at the database level.

9) Facility Visibility Logic (Search + Booking)
- A facility is visible/searchable/bookable ONLY if:
  - Facility.is_approved == TRUE
  - AND OwnerSubscription.status IN ['TRIAL', 'ACTIVE']
- All search endpoints and booking hold endpoints MUST enforce this rule (server-side). Do not rely on frontend filtering.

10) Pricing Model (Duration-Based Pricing)
- Pricing is NOT computed by multiplying hourly rates.
- SportProfile must store explicit prices per allowed duration:
  - Example: duration_prices JSON map: { "60": 1000, "90": 1400, "120": 1800 }
- Price calculation must:
  - Reject any duration not present in duration_prices.
  - Use the exact mapped price for the selected duration.
- Peak pricing rules:
  - Peak pricing can be represented as a second explicit duration map (peak_duration_prices), OR a simple multiplier applied to the duration price (choose one for MVP and document).
  - MVP rule remains: if ANY portion overlaps peak => apply peak price strategy to the WHOLE booking.


Now generate the full blueprint + the core implementation according to all constraints above.




sportzen/
├─ apps/
│  ├─ web/                               # Next.js 14+ (App Router)
│  │  ├─ app/
│  │  │  ├─ (public)/
│  │  │  │  ├─ page.tsx                  # Home (search)
│  │  │  │  ├─ turfs/
│  │  │  │  │  ├─ page.tsx               # Turf listing
│  │  │  │  │  └─ [facilityId]/
│  │  │  │  │     ├─ page.tsx            # Turf details + slot grid
│  │  │  │  │     └─ loading.tsx         # Skeleton
│  │  │  │  ├─ auth/
│  │  │  │  │  ├─ login/page.tsx
│  │  │  │  │  ├─ register/page.tsx
│  │  │  │  │  └─ phone/page.tsx         # OTP login
│  │  │  │  └─ legal/
│  │  │  │     ├─ terms/page.tsx
│  │  │  │     └─ privacy/page.tsx
│  │  │  ├─ (player)/
│  │  │  │  ├─ layout.tsx                # Bottom nav layout
│  │  │  │  ├─ dashboard/page.tsx
│  │  │  │  ├─ bookings/page.tsx
│  │  │  │  ├─ bookings/[bookingId]/page.tsx  # QR + details
│  │  │  │  ├─ favorites/page.tsx
│  │  │  │  └─ profile/page.tsx
│  │  │  ├─ (owner)/
│  │  │  │  ├─ owner/layout.tsx
│  │  │  │  ├─ owner/page.tsx            # Owner dashboard
│  │  │  │  ├─ owner/calendar/page.tsx
│  │  │  │  ├─ owner/bookings/page.tsx
│  │  │  │  ├─ owner/blocks/page.tsx
│  │  │  │  ├─ owner/facilities/page.tsx
│  │  │  │  ├─ owner/facilities/[facilityId]/page.tsx
│  │  │  │  ├─ owner/staff/page.tsx
│  │  │  │  └─ owner/settlements/page.tsx
│  │  │  ├─ (admin)/
│  │  │  │  ├─ admin/layout.tsx
│  │  │  │  ├─ admin/page.tsx            # Admin overview
│  │  │  │  ├─ admin/facility-approvals/page.tsx
│  │  │  │  ├─ admin/refunds/page.tsx
│  │  │  │  ├─ admin/subscriptions/page.tsx
│  │  │  │  ├─ admin/disputes/page.tsx
│  │  │  │  └─ admin/reviews/page.tsx
│  │  │  ├─ checkout/
│  │  │  │  ├─ [bookingId]/page.tsx      # Advance summary + form submit
│  │  │  │  ├─ pending/page.tsx          # Poll payment intent
│  │  │  │  ├─ success/page.tsx          # Shows pending->confirmed
│  │  │  │  └─ failed/page.tsx
│  │  │  └─ api/                         # Next route handlers (optional)
│  │  │     └─ health/route.ts
│  │  ├─ components/
│  │  │  ├─ ui/                          # shadcn components
│  │  │  ├─ layout/
│  │  │  │  ├─ bottom-nav.tsx
│  │  │  │  ├─ header.tsx
│  │  │  │  └─ sticky-footer.tsx
│  │  │  ├─ turf/
│  │  │  │  ├─ turf-card.tsx
│  │  │  │  ├─ turf-gallery.tsx
│  │  │  │  ├─ slot-grid.tsx             # Green/Red/Orange/Gray grid
│  │  │  │  ├─ price-breakdown.tsx
│  │  │  │  └─ reviews.tsx
│  │  │  ├─ checkout/
│  │  │  │  ├─ sslcommerz-post-form.tsx  # auto-submitting POST form
│  │  │  │  └─ payment-status-poller.tsx
│  │  │  └─ common/
│  │  │     ├─ skeletons.tsx
│  │  │     ├─ empty-state.tsx
│  │  │     └─ error-boundary.tsx
│  │  ├─ lib/
│  │  │  ├─ api/
│  │  │  │  ├─ client.ts                 # typed fetch wrapper
│  │  │  │  ├─ routes.ts                 # endpoint builders
│  │  │  │  └─ errors.ts                 # consistent error mapping
│  │  │  ├─ auth/
│  │  │  │  ├─ session.ts                # token storage strategy
│  │  │  │  └─ guards.ts                 # route protection helpers
│  │  │  ├─ query/
│  │  │  │  ├─ query-client.ts
│  │  │  │  └─ keys.ts
│  │  │  ├─ geo/
│  │  │  │  ├─ geolocate.ts
│  │  │  │  └─ distance.ts
│  │  │  └─ utils/
│  │  │     ├─ cn.ts
│  │  │     ├─ money.ts
│  │  │     ├─ dates.ts                  # Asia/Dhaka formatting
│  │  │     └─ validators.ts             # zod schemas
│  │  ├─ styles/
│  │  │  └─ globals.css                  # Electric Sports theme tokens
│  │  ├─ public/
│  │  │  └─ images/
│  │  ├─ middleware.ts                   # RBAC route gating
│  │  ├─ next.config.js
│  │  ├─ tailwind.config.ts
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  │
│  └─ api/                               # NestJS
│     ├─ src/
│     │  ├─ main.ts
│     │  ├─ app.module.ts
│     │  ├─ common/
│     │  │  ├─ config/
│     │  │  │  ├─ env.validation.ts
│     │  │  │  └─ configuration.ts
│     │  │  ├─ db/
│     │  │  │  ├─ prisma.service.ts
│     │  │  │  └─ prisma.module.ts
│     │  │  ├─ redis/
│     │  │  │  ├─ redis.module.ts
│     │  │  │  └─ redis.service.ts
│     │  │  ├─ queue/
│     │  │  │  ├─ bullmq.module.ts
│     │  │  │  └─ queue.constants.ts
│     │  │  ├─ middleware/
│     │  │  │  ├─ correlation-id.middleware.ts
│     │  │  │  └─ request-logger.middleware.ts
│     │  │  ├─ guards/
│     │  │  │  ├─ jwt.guard.ts
│     │  │  │  └─ roles.guard.ts
│     │  │  ├─ decorators/
│     │  │  │  ├─ roles.decorator.ts
│     │  │  │  └─ user.decorator.ts
│     │  │  ├─ filters/
│     │  │  │  └─ http-exception.filter.ts
│     │  │  ├─ pipes/
│     │  │  │  └─ validation.pipe.ts
│     │  │  └─ utils/
│     │  │     ├─ money.ts
│     │  │     ├─ time.ts                # UTC + Asia/Dhaka helpers
│     │  │     └─ idempotency.ts
│     │  ├─ modules/
│     │  │  ├─ auth/
│     │  │  │  ├─ auth.module.ts
│     │  │  │  ├─ auth.controller.ts
│     │  │  │  ├─ auth.service.ts
│     │  │  │  ├─ strategies/
│     │  │  │  │  ├─ jwt.strategy.ts
│     │  │  │  │  └─ local.strategy.ts
│     │  │  │  ├─ dto/
│     │  │  │  └─ otp/                   # Firebase/Twilio provider wrapper
│     │  │  ├─ users/
│     │  │  ├─ facilities/
│     │  │  │  ├─ facilities.module.ts
│     │  │  │  ├─ facilities.controller.ts
│     │  │  │  ├─ facilities.service.ts
│     │  │  │  ├─ queries/
│     │  │  │  │  └─ nearby.query.ts      # PostGIS logic
│     │  │  │  └─ dto/
│     │  │  ├─ availability/
│     │  │  │  ├─ availability.module.ts
│     │  │  │  ├─ availability.controller.ts
│     │  │  │  └─ availability.service.ts # grid + appended buffer logic
│     │  │  ├─ bookings/
│     │  │  │  ├─ bookings.module.ts
│     │  │  │  ├─ bookings.controller.ts
│     │  │  │  ├─ bookings.service.ts
│     │  │  │  ├─ booking.state.ts        # state machine helpers
│     │  │  │  ├─ locking/
│     │  │  │  │  └─ slot-lock.service.ts # Redis NX PX
│     │  │  │  ├─ dto/
│     │  │  │  └─ policies/
│     │  │  │     ├─ cancellation.policy.ts
│     │  │  │     └─ refund.policy.ts
│     │  │  ├─ payments/
│     │  │  │  ├─ payments.module.ts
│     │  │  │  ├─ sslcommerz/
│     │  │  │  │  ├─ sslcommerz.service.ts
│     │  │  │  │  ├─ sslcommerz.controller.ts
│     │  │  │  │  ├─ sslcommerz.webhook.ts
│     │  │  │  │  └─ verify.ts            # signature/validation
│     │  │  │  ├─ payments.service.ts
│     │  │  │  └─ dto/
│     │  │  ├─ ledger/
│     │  │  ├─ refunds/
│     │  │  ├─ subscriptions/
│     │  │  ├─ reviews/
│     │  │  ├─ notifications/
│     │  │  ├─ owner/
│     │  │  ├─ admin/
│     │  │  ├─ jobs/
│     │  │  │  ├─ jobs.module.ts
│     │  │  │  ├─ processors/
│     │  │  │  │  ├─ hold-expiry.processor.ts
│     │  │  │  │  ├─ auto-complete.processor.ts
│     │  │  │  │  └─ reminders.processor.ts
│     │  │  │  └─ schedulers/
│     │  │  │     └─ cron.scheduler.ts
│     │  │  └─ health/
│     │  └─ openapi/
│     │     └─ swagger.ts
│     ├─ prisma/
│     │  ├─ schema.prisma
│     │  ├─ migrations/
│     │  │  └─ ... raw SQL for postgis + exclusion constraint ...
│     │  └─ seed.ts
│     ├─ test/
│     │  ├─ unit/
│     │  ├─ integration/
│     │  └─ e2e/
│     ├─ Dockerfile
│     ├─ nest-cli.json
│     ├─ tsconfig.json
│     └─ package.json
│
├─ packages/
│  ├─ shared/
│  │  ├─ src/
│  │  │  ├─ types/                       # shared TS types
│  │  │  ├─ zod/                         # shared zod schemas
│  │  │  ├─ constants/                   # enums, roles
│  │  │  └─ utils/                       # money/time helpers
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  └─ eslint-config/
│
├─ infra/
│  ├─ docker/
│  │  ├─ docker-compose.yml              # postgres+postgis + redis
│  │  └─ postgres-init/
│  │     └─ 001-extensions.sql           # postgis, btree_gist
│  ├─ migrations/
│  │  └─ 001-exclusion-constraint.sql
│  ├─ scripts/
│  │  ├─ dev.sh
│  │  └─ reset-db.sh
│  └─ README.md
│
├─ .env.example
├─ package.json                           # workspace root
├─ turbo.json                             # turbo / nx optional
├─ tsconfig.base.json
└─ README.md

ROLE: ELITE SOFTWARE ENGINEERING SQUAD (10-PERSON TEAM)
You have already produced the SportZen/TurfFlow blueprint. Now you must convert the blueprint into a runnable, end-to-end MVP implementation plan + concrete code deliverables.

GOAL:
Turn the blueprint into a working product that can be run locally and demoed:
Search → Turf Detail → Availability Grid → HOLD Booking → SSLCommerz POST redirect → Webhook confirm → Owner notified → Owner calendar shows booking → QR check-in → Review eligibility.

NON-NEGOTIABLES (do not change):
- Appended buffer: buffer is appended AFTER end_at only; grid is fixed 30-min starts; unsold gaps are acceptable.
- DB exclusion constraint must use time_range = tstzrange(start_at, blocked_end_at) where blocked_end_at = end_at + buffer.
- Facility visibility: facility is visible/bookable only if Facility.is_approved = true AND OwnerSubscription.status IN (TRIAL, ACTIVE). Must be enforced server-side in search + facility detail + booking hold.
- Pricing model: explicit duration prices (duration_prices JSON map). No hourly multiplication.
- Payment confirmation: webhook only (never trust return URL). Webhook must be idempotent.
- Late webhook after expiry: attempt confirm; if conflict then mark LATE_SUCCESS_CONFLICT + create refund workflow.
- Reviews allowed only if booking COMPLETED AND checkin VERIFIED.
- No rescheduling in MVP; cancel + rebook only.

TASK:
Produce the NEXT IMPLEMENTATION MILESTONES with exact code outputs and acceptance criteria.

DELIVERABLES REQUIRED (output in this exact order):

1) “RUNNABLE MVP CHECKLIST”
   - List every command needed to run locally (docker compose, migrations, seed, start web/api).
   - List expected URLs and example credentials.

2) “GAP AUDIT AGAINST THE SPEC”
   - Identify which of these are fully implemented vs partially stubbed:
     a) SSLCommerz signature verification and webhook validation
     b) OTP provider integration (Firebase/Twilio adapter)
     c) OwnerLedger settlement math + payout tracking
     d) PDF + Excel export code
     e) Subscription enforcement across ALL endpoints
     f) Admin approval/refund/moderation flows
     g) Owner check-in UI/flow
     h) Audit logs + correlation IDs + consistent error shape
     i) Test coverage for concurrency + webhook retries + refunds

3) “MILESTONE PLAN (3 MILESTONES MAX)”
   - Milestone 1: End-to-end booking flow works locally WITHOUT real payments (use webhook simulator endpoint or mock).
   - Milestone 2: Real SSLCommerz flow working (POST form), real webhook verification and idempotency.
   - Milestone 3: Owner/admin operational tools (settlement exports, subscription enforcement everywhere, moderation) + tests.

For each milestone, include:
- Scope
- Exact file list to create/modify (path + purpose)
- Implementation steps
- Acceptance tests (manual + automated)

4) “CODE DELIVERABLES FOR THE NEXT MILESTONE”
   Provide actual production-quality code for the missing items needed to complete Milestone 1 first.
   - If anything is already implemented, do not rewrite; only patch and add missing pieces.
   - Output code grouped by file path.
   - Avoid placeholders like “TODO: verify signature” — implement it as far as possible, and if a gateway secret is required, clearly show how it is used and how to configure env vars.

Milestone 1 must include:
- A webhook simulator route (DEV ONLY) that can mark PaymentIntent SUCCESS and trigger the same internal confirm logic (so we can demo without SSLCommerz).
- Fully working end-to-end state transitions: HOLD → CONFIRMED → COMPLETED (time-based) + check-in verification + review gating.
- Facility visibility enforcement in API (nearby search + facility detail + booking/hold).
- Duration price map validation (reject invalid durations).
- Appended buffer logic enforced in availability grid and in DB time_range.
- Owner panel shows bookings calendar for a facility.

5) “TESTS FOR MILESTONE 1”
   - Provide at least:
     - a concurrency test for double booking (parallel HOLD requests)
     - an idempotency test for confirm logic (same payment simulated twice)
     - refund tier unit tests can be deferred to Milestone 3, but mention them

CONSTRAINTS:
- Do not invent new features.
- Do not change architecture.
- Keep outputs concise but complete. Prefer correctness and runnable code over huge walls of code.

