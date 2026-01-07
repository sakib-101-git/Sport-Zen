# SportZen RC1 - MANUAL QA CHECKLIST

Click-by-click manual testing guide for all critical flows.

---

## Pre-Test Setup

1. [ ] Docker containers running (`docker ps` shows postgres + redis)
2. [ ] API server running on http://localhost:3001
3. [ ] Web server running on http://localhost:3000
4. [ ] Database seeded with test data
5. [ ] Browser dev tools open (Network tab)

---

## 1. Authentication Flow

### 1.1 Player Registration

1. [ ] Open http://localhost:3000
2. [ ] Click "Sign Up" or "Register"
3. [ ] Enter:
   - Name: "QA Test Player"
   - Email: "qa-player@test.com"
   - Password: "TestPassword123"
4. [ ] Click "Register"
5. [ ] **VERIFY**: Redirected to dashboard/home
6. [ ] **VERIFY**: User name shown in header

### 1.2 Player Login

1. [ ] Log out (if logged in)
2. [ ] Click "Login"
3. [ ] Enter:
   - Email: "player@example.com"
   - Password: "password123"
4. [ ] Click "Login"
5. [ ] **VERIFY**: Redirected to player dashboard
6. [ ] **VERIFY**: JWT token in localStorage/cookies

### 1.3 Owner Login

1. [ ] Log out
2. [ ] Enter:
   - Email: "owner@example.com"
   - Password: "password123"
3. [ ] **VERIFY**: Redirected to owner dashboard
4. [ ] **VERIFY**: Owner navigation visible (Calendar, Bookings, etc.)

### 1.4 Admin Login

1. [ ] Log out
2. [ ] Enter:
   - Email: "admin@sportzen.com"
   - Password: "password123"
3. [ ] **VERIFY**: Redirected to admin dashboard
4. [ ] **VERIFY**: Admin navigation visible (Approvals, Refunds, etc.)

---

## 2. Search & Discovery Flow

### 2.1 Nearby Search

1. [ ] Login as player
2. [ ] On home page, enter/allow location (Chittagong area)
3. [ ] Set search radius (e.g., 10km)
4. [ ] **VERIFY**: Turf cards displayed
5. [ ] **VERIFY**: Distance shown on each card
6. [ ] **VERIFY**: Only approved facilities visible

### 2.2 Filters

1. [ ] Filter by sport type (e.g., "Football")
2. [ ] **VERIFY**: Results filtered correctly
3. [ ] Filter by price range
4. [ ] **VERIFY**: Results filtered correctly
5. [ ] Filter by rating (e.g., 4+ stars)
6. [ ] **VERIFY**: Results filtered correctly

### 2.3 Facility Detail

1. [ ] Click on a turf card
2. [ ] **VERIFY**: Facility detail page loads
3. [ ] **VERIFY**: Photo gallery visible
4. [ ] **VERIFY**: Location map visible
5. [ ] **VERIFY**: Amenities listed
6. [ ] **VERIFY**: Reviews section visible
7. [ ] **VERIFY**: Slot selection grid visible

---

## 3. Booking Flow (CRITICAL)

### 3.1 Slot Selection

1. [ ] On facility detail page, select a date
2. [ ] **VERIFY**: Slot grid loads with colors:
   - Green = Available
   - Red = Booked/Blocked
   - Gray = Past/Disabled
3. [ ] Select a green slot
4. [ ] **VERIFY**: Slot turns orange (selected)
5. [ ] Select duration (60/90/120 min)
6. [ ] **VERIFY**: Price updates correctly
7. [ ] **VERIFY**: "Book Now" button appears

### 3.2 Hold Creation

1. [ ] Click "Book Now"
2. [ ] Enter customer details if prompted
3. [ ] **VERIFY**: Hold created (Network: POST /bookings/hold returns 201)
4. [ ] **VERIFY**: Price breakdown shown:
   - Total price
   - Advance (10%)
   - Remaining (90% - to be paid at venue)
5. [ ] **VERIFY**: Timer shown (10 min hold expiry)

### 3.3 Payment Redirect (SSLCommerz)

**If SSLCommerz sandbox configured:**

1. [ ] Click "Pay Advance"
2. [ ] **VERIFY**: Redirected to SSLCommerz payment page
3. [ ] Complete sandbox payment
4. [ ] **VERIFY**: Redirected back to success page
5. [ ] **VERIFY**: Booking status shows "Pending Confirmation"

**If SSLCommerz NOT configured (webhook simulation):**

1. [ ] Note the booking ID from Network tab
2. [ ] Use Swagger to simulate webhook:
   - POST /api/v1/payments/simulate-webhook
   - Body: `{"bookingId": "<id>"}`
3. [ ] **VERIFY**: Booking status changes to CONFIRMED

### 3.4 Booking Confirmation

1. [ ] After payment/simulation
2. [ ] **VERIFY**: Status shows "CONFIRMED"
3. [ ] **VERIFY**: QR code generated
4. [ ] **VERIFY**: Booking details show:
   - Booking number (SZ-YYYYMMDD-XXXX)
   - Date/time
   - Venue details
   - Amount paid
5. [ ] Navigate to "My Bookings"
6. [ ] **VERIFY**: New booking appears in list

---

## 4. Double Booking Prevention (CRITICAL)

### 4.1 Concurrent Booking Test

1. [ ] Open two browser tabs/windows
2. [ ] Login as different players (or same player)
3. [ ] Navigate to same facility, same date
4. [ ] Select the SAME time slot in both windows
5. [ ] Click "Book Now" simultaneously
6. [ ] **VERIFY**: ONE succeeds, ONE fails
7. [ ] **VERIFY**: Failed attempt shows "Slot no longer available"

---

## 5. Cancellation Flow

### 5.1 Player Cancellation

1. [ ] Login as player with confirmed booking
2. [ ] Go to "My Bookings"
3. [ ] Click on a CONFIRMED booking
4. [ ] Click "Cancel Booking"
5. [ ] **VERIFY**: Cancellation warning shown with refund tier:
   - >24h before: "Full refund minus processing fee"
   - 6-24h before: "50% refund"
   - <6h before: "No refund"
6. [ ] Confirm cancellation
7. [ ] **VERIFY**: Booking status → CANCELED
8. [ ] **VERIFY**: Refund record created (if applicable)

---

## 6. QR Check-in Flow

### 6.1 Generate QR

1. [ ] Login as player
2. [ ] Go to confirmed booking (within check-in window)
3. [ ] **VERIFY**: QR code visible
4. [ ] **VERIFY**: Booking details on QR page

### 6.2 Owner Check-in

1. [ ] Login as owner in separate browser
2. [ ] Go to Owner Dashboard → Bookings
3. [ ] Find the booking
4. [ ] Click "Verify Check-in"
5. [ ] Enter QR code or scan
6. [ ] **VERIFY**: Check-in status → VERIFIED
7. [ ] **VERIFY**: checkin_verified_at timestamp set

---

## 7. Review Flow

### 7.1 Submit Review (Eligible)

1. [ ] Login as player with COMPLETED + VERIFIED booking
2. [ ] Go to past booking
3. [ ] **VERIFY**: "Write Review" button visible
4. [ ] Enter rating (1-5 stars)
5. [ ] Enter review text
6. [ ] Submit review
7. [ ] **VERIFY**: Review appears on facility page

### 7.2 Review Blocked (Ineligible)

1. [ ] Go to COMPLETED booking WITHOUT check-in
2. [ ] **VERIFY**: "Write Review" button NOT visible or disabled
3. [ ] **VERIFY**: Message explains check-in required

---

## 8. Owner Panel

### 8.1 Dashboard

1. [ ] Login as owner
2. [ ] **VERIFY**: Dashboard shows:
   - Today's bookings count
   - This week's revenue
   - Upcoming bookings
   - Quick stats

### 8.2 Calendar View

1. [ ] Navigate to Calendar
2. [ ] **VERIFY**: Calendar shows bookings
3. [ ] Click on a date
4. [ ] **VERIFY**: Day view shows time slots with bookings

### 8.3 Booking Management

1. [ ] Navigate to Bookings
2. [ ] **VERIFY**: List of bookings with filters
3. [ ] Click on a booking
4. [ ] **VERIFY**: Booking details visible
5. [ ] **VERIFY**: Can mark offline payment
6. [ ] Mark as "Full Paid Offline"
7. [ ] **VERIFY**: Payment stage updates

### 8.4 Blocks Management

1. [ ] Navigate to Blocks
2. [ ] Click "Add Block"
3. [ ] Select play area, date, time range
4. [ ] Enter reason
5. [ ] Save block
6. [ ] **VERIFY**: Block appears in list
7. [ ] **VERIFY**: Blocked time shows as red in slot grid

---

## 9. Admin Panel

### 9.1 Facility Approvals

1. [ ] Login as admin
2. [ ] Navigate to Facility Approvals
3. [ ] **VERIFY**: Pending facilities listed
4. [ ] Click on a facility
5. [ ] Review details
6. [ ] Click "Approve" or "Reject"
7. [ ] **VERIFY**: Status updates
8. [ ] **VERIFY**: Approved facility becomes searchable

### 9.2 Refund Management

1. [ ] Navigate to Refunds
2. [ ] **VERIFY**: Pending refunds listed
3. [ ] Click on a refund
4. [ ] Review details
5. [ ] Approve refund
6. [ ] **VERIFY**: Refund status updates

### 9.3 Review Moderation

1. [ ] Navigate to Reviews
2. [ ] **VERIFY**: Reported reviews flagged
3. [ ] Click on a reported review
4. [ ] Hide or approve
5. [ ] **VERIFY**: Review visibility updates

---

## 10. Edge Cases

### 10.1 Hold Expiry

1. [ ] Create a booking hold
2. [ ] Do NOT complete payment
3. [ ] Wait 10+ minutes
4. [ ] **VERIFY**: Booking status → EXPIRED
5. [ ] **VERIFY**: Slot becomes available again

### 10.2 Rate Limiting

1. [ ] Try to request OTP 6+ times in 1 minute
2. [ ] **VERIFY**: 429 Too Many Requests after 5 attempts
3. [ ] Wait 1 minute
4. [ ] **VERIFY**: Can request OTP again

### 10.3 Session Expiry

1. [ ] Login and note token expiry
2. [ ] Wait for access token to expire (15 min)
3. [ ] Make API request
4. [ ] **VERIFY**: Token automatically refreshed OR
5. [ ] **VERIFY**: Prompted to login again

---

## 11. Mobile Responsiveness

Test on mobile viewport (375px width):

1. [ ] Home page renders correctly
2. [ ] Search works
3. [ ] Facility cards stack properly
4. [ ] Facility detail readable
5. [ ] Slot grid scrollable
6. [ ] Bottom navigation visible
7. [ ] "Book Now" sticky footer works
8. [ ] Checkout form usable

---

## 12. Error Handling

### 12.1 Network Error

1. [ ] Stop API server
2. [ ] Try to load page
3. [ ] **VERIFY**: Error message shown
4. [ ] **VERIFY**: No crash

### 12.2 Invalid Input

1. [ ] Try registering with invalid email
2. [ ] **VERIFY**: Validation error shown
3. [ ] Try short password
4. [ ] **VERIFY**: Validation error shown

### 12.3 404 Page

1. [ ] Navigate to /nonexistent-page
2. [ ] **VERIFY**: 404 page shown

---

## Sign-Off

| Area | Tester | Date | Status |
|------|--------|------|--------|
| Authentication | | | |
| Search | | | |
| Booking | | | |
| Double-booking Prevention | | | |
| Cancellation | | | |
| QR Check-in | | | |
| Reviews | | | |
| Owner Panel | | | |
| Admin Panel | | | |
| Edge Cases | | | |
| Mobile | | | |
| Error Handling | | | |

---

## Bugs Found

| # | Area | Description | Severity | Status |
|---|------|-------------|----------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
