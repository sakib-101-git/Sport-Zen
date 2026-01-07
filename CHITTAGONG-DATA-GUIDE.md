# SportZen - Chittagong Real-Time Turf Data Integration Guide

Guide for integrating real turf data from Chittagong, Bangladesh into SportZen.

---

## 1. Chittagong Geography Overview

Chittagong (চট্টগ্রাম) is the second-largest city in Bangladesh. Key areas for turf facilities:

### Major Areas

| Area | Approximate Coordinates | Popular For |
|------|------------------------|-------------|
| Agrabad | 22.3252, 91.8123 | Commercial, central |
| GEC Circle | 22.3598, 91.8318 | Residential, schools |
| Nasirabad | 22.3714, 91.8234 | Residential |
| Khulshi | 22.3633, 91.8099 | Upscale residential |
| Panchlaish | 22.3617, 91.8336 | Mixed |
| Halishahar | 22.3411, 91.7965 | Residential, port area |
| Bayezid | 22.3894, 91.8294 | Industrial edge |
| Pahartali | 22.3652, 91.7743 | Hill area |
| EPZ | 22.3506, 91.7788 | Export zone |
| Chattogram University | 22.4711, 91.7921 | University area |

### GPS Bounds for Chittagong

For search constraints:
```
North: 22.50
South: 22.25
East: 91.90
West: 91.70
```

---

## 2. Turf Data Collection Template

Use this template to collect real turf data:

### Facility Information

```json
{
  "name": "ABC Football Arena",
  "nameLocal": "এবিসি ফুটবল এরিনা",
  "description": "Premium artificial turf with floodlights",
  "address": {
    "line1": "House 45, Road 3",
    "area": "Agrabad",
    "city": "Chittagong",
    "postalCode": "4100"
  },
  "coordinates": {
    "latitude": 22.3252,
    "longitude": 91.8123
  },
  "contact": {
    "phone": "+8801812345678",
    "whatsapp": "+8801812345678",
    "email": "info@abcarena.com"
  },
  "owner": {
    "name": "Mohammad Ali",
    "phone": "+8801712345678"
  },
  "amenities": [
    "parking",
    "changing_room",
    "restroom",
    "drinking_water",
    "floodlights",
    "gallery"
  ],
  "photos": [
    "https://example.com/turf1.jpg",
    "https://example.com/turf2.jpg"
  ],
  "operatingHours": {
    "weekday": { "open": "06:00", "close": "23:00" },
    "weekend": { "open": "06:00", "close": "00:00" }
  }
}
```

### Play Area Information

```json
{
  "name": "Pitch A - Full Size",
  "sportTypes": ["FOOTBALL", "FUTSAL"],
  "surface": "artificial_grass",
  "dimensions": {
    "length": 100,
    "width": 64,
    "unit": "meters"
  },
  "capacity": {
    "playersPerTeam": 11,
    "totalPlayers": 22
  },
  "pricing": {
    "currency": "BDT",
    "durations": {
      "60": 2000,
      "90": 2800,
      "120": 3500
    },
    "peakHours": {
      "weekday": ["17:00-22:00"],
      "weekend": ["08:00-12:00", "16:00-22:00"]
    },
    "peakPricing": {
      "60": 2500,
      "90": 3500,
      "120": 4500
    }
  }
}
```

---

## 3. Data Collection Methods

### Method 1: Google Maps Scraping (Manual)

1. Search "turf" or "football ground" in Google Maps for Chittagong
2. For each result, note:
   - Name
   - Address
   - Phone number
   - Coordinates (from URL)
   - Photos
   - Reviews

### Method 2: Facebook Groups

Popular Facebook groups for Chittagong turfs:
- "Chittagong Turf Booking"
- "চট্টগ্রাম টার্ফ বুকিং"
- "Chittagong Football Community"

### Method 3: Field Survey

1. Visit known turf locations
2. Interview owners
3. Get accurate pricing
4. Take photos
5. Collect contact information

### Method 4: Phone Calls

Call existing turfs and collect:
- Current pricing
- Available time slots
- Booking process
- Owner interest in joining platform

---

## 4. Seed Data Format

### Create Seed File: `prisma/seed-chittagong.ts`

```typescript
import { PrismaClient, UserRole, SportType } from '@prisma/client';

const prisma = new PrismaClient();

const CHITTAGONG_TURFS = [
  {
    owner: {
      name: 'Mohammad Rafiq',
      email: 'rafiq@example.com',
      phone: '+8801812345678',
    },
    facility: {
      name: 'Green Valley Turf',
      slug: 'green-valley-turf-agrabad',
      description: 'Premium artificial turf in the heart of Agrabad',
      address: 'House 123, Road 5, Block B, Agrabad',
      city: 'Chittagong',
      postalCode: '4100',
      latitude: 22.3252,
      longitude: 91.8123,
      amenities: ['parking', 'changing_room', 'floodlights', 'drinking_water'],
      photos: [
        'https://example.com/green-valley-1.jpg',
        'https://example.com/green-valley-2.jpg',
      ],
    },
    playAreas: [
      {
        name: 'Main Pitch',
        sportType: SportType.FOOTBALL,
        surface: 'artificial_grass',
        durations: [60, 90, 120],
        durationPrices: { '60': 2000, '90': 2800, '120': 3500 },
        peakDurationPrices: { '60': 2500, '90': 3500, '120': 4500 },
        peakRules: [
          { dayOfWeek: 5, startHour: 17, endHour: 22 }, // Friday evening
          { dayOfWeek: 6, startHour: 8, endHour: 22 },  // Saturday all day
        ],
      },
    ],
  },
  {
    owner: {
      name: 'Kamal Hossain',
      email: 'kamal@example.com',
      phone: '+8801723456789',
    },
    facility: {
      name: 'Champion Arena',
      slug: 'champion-arena-gec',
      description: 'Multi-sport facility near GEC Circle',
      address: 'GEC More, OR Nizam Road',
      city: 'Chittagong',
      postalCode: '4100',
      latitude: 22.3598,
      longitude: 91.8318,
      amenities: ['parking', 'changing_room', 'restroom', 'canteen'],
      photos: ['https://example.com/champion-1.jpg'],
    },
    playAreas: [
      {
        name: 'Football Pitch',
        sportType: SportType.FOOTBALL,
        surface: 'artificial_grass',
        durations: [60, 90],
        durationPrices: { '60': 1800, '90': 2500 },
        peakDurationPrices: { '60': 2200, '90': 3000 },
        peakRules: [
          { dayOfWeek: 5, startHour: 16, endHour: 22 },
          { dayOfWeek: 6, startHour: 10, endHour: 22 },
        ],
      },
      {
        name: 'Futsal Court',
        sportType: SportType.FUTSAL,
        surface: 'artificial_grass',
        durations: [60],
        durationPrices: { '60': 1200 },
        peakDurationPrices: { '60': 1500 },
        peakRules: [
          { dayOfWeek: 5, startHour: 16, endHour: 22 },
        ],
      },
    ],
  },
  // Add more turfs...
];

async function seedChittagong() {
  console.log('Seeding Chittagong turf data...');

  for (const turf of CHITTAGONG_TURFS) {
    // Create owner
    const owner = await prisma.user.upsert({
      where: { email: turf.owner.email },
      update: {},
      create: {
        email: turf.owner.email,
        name: turf.owner.name,
        phone: turf.owner.phone,
        role: UserRole.OWNER,
        passwordHash: '$2b$10$...', // Default password hash
      },
    });

    // Create subscription
    const subscription = await prisma.ownerSubscription.create({
      data: {
        ownerId: owner.id,
        planId: 'trial-plan-id',
        status: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Create facility
    const facility = await prisma.facility.create({
      data: {
        ...turf.facility,
        ownerId: owner.id,
        isApproved: true, // Pre-approved for seed data
      },
    });

    // Create play areas
    for (const playArea of turf.playAreas) {
      const pa = await prisma.playArea.create({
        data: {
          name: playArea.name,
          facilityId: facility.id,
          surface: playArea.surface,
        },
      });

      // Create sport profile
      await prisma.sportProfile.create({
        data: {
          playAreaId: pa.id,
          sportType: playArea.sportType,
          allowedDurations: playArea.durations,
          durationPrices: playArea.durationPrices,
          peakDurationPrices: playArea.peakDurationPrices,
          peakRules: playArea.peakRules,
          slotIntervalMinutes: 30,
        },
      });
    }

    console.log(`Created: ${turf.facility.name}`);
  }

  console.log('Chittagong seed complete!');
}

seedChittagong()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## 5. Known Chittagong Turfs (Sample Data)

### Real turfs to research (names may vary):

| Name | Area | Approximate Location |
|------|------|---------------------|
| Millennium Turf | Agrabad | 22.325, 91.812 |
| Champions Ground | GEC | 22.359, 91.831 |
| Dream Field | Nasirabad | 22.371, 91.823 |
| Goal Turf | Panchlaish | 22.361, 91.833 |
| Strike Arena | Khulshi | 22.363, 91.809 |
| Kick Off | Halishahar | 22.341, 91.796 |
| Victory Ground | Bayezid | 22.389, 91.829 |
| Hill View Turf | Pahartali | 22.365, 91.774 |
| Export Zone Sports | EPZ | 22.350, 91.778 |
| University Turf | CU Area | 22.471, 91.792 |

**Note**: These are placeholder names. Real research needed to get actual facility names and details.

---

## 6. Pricing Research (Chittagong Market)

Typical pricing ranges in Chittagong (2024):

| Time Slot | Duration | Price Range (BDT) |
|-----------|----------|-------------------|
| Off-peak | 60 min | 1,500 - 2,000 |
| Off-peak | 90 min | 2,000 - 2,800 |
| Off-peak | 120 min | 2,500 - 3,500 |
| Peak (evening/weekend) | 60 min | 2,000 - 3,000 |
| Peak (evening/weekend) | 90 min | 2,800 - 4,000 |
| Peak (evening/weekend) | 120 min | 3,500 - 5,000 |

Peak hours typically:
- Weekdays: 5 PM - 10 PM
- Weekends: 8 AM - 12 PM, 4 PM - 10 PM
- Friday: Often premium pricing all day

---

## 7. Import Script

To bulk import turf data from CSV/JSON:

### CSV Format

```csv
name,address,latitude,longitude,phone,email,amenities
"Green Valley Turf","Agrabad, Chittagong",22.3252,91.8123,+8801812345678,owner@example.com,"parking,floodlights"
```

### Import Command

```bash
cd apps/api
npx ts-node scripts/import-turfs.ts --file=turfs.csv
```

---

## 8. Data Validation Checklist

Before importing, verify:

- [ ] Coordinates are within Chittagong bounds
- [ ] Phone numbers are valid Bangladesh format (+880...)
- [ ] Prices are in BDT (integers)
- [ ] Photos URLs are accessible
- [ ] Operating hours are realistic
- [ ] Owner contact information verified
- [ ] No duplicate facilities
- [ ] Address matches coordinates (roughly)

---

## 9. API Endpoints for Data Management

### Admin Import Endpoint

```bash
# Bulk import facilities
POST /api/v1/admin/facilities/import
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "facilities": [...]
}
```

### Owner Registration Endpoint

```bash
# Owner self-registration
POST /api/v1/owner/register
Content-Type: application/json

{
  "email": "owner@example.com",
  "password": "securepassword",
  "name": "Owner Name",
  "phone": "+8801812345678",
  "facility": {
    "name": "My Turf",
    ...
  }
}
```

---

## 10. Go-Live Checklist for Chittagong

1. [ ] Collect data for minimum 10 turfs
2. [ ] Verify all coordinates on map
3. [ ] Contact all owners for permission
4. [ ] Get signed agreements/contracts
5. [ ] Seed database with verified data
6. [ ] Test bookings for each facility
7. [ ] Set up real payment processing
8. [ ] Configure SMS notifications
9. [ ] Launch marketing campaign
10. [ ] Monitor and gather feedback

---

## 11. Local Partners

Consider partnering with:

- Chittagong Sports Association
- Local football clubs
- University sports departments
- Corporate sports committees
- Real estate developers with recreational facilities
