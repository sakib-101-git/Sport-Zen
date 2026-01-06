import { PrismaClient, UserRole, SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create subscription plan
  const basicPlan = await prisma.subscriptionPlan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Basic',
      description: 'Basic plan for single facility owners',
      monthlyPriceBdt: 2000,
      trialDays: 14,
      maxFacilities: 1,
      maxPlayAreas: 5,
      isActive: true,
    },
  });
  console.log('Created subscription plan:', basicPlan.name);

  // Create sport types
  const footballType = await prisma.sportType.upsert({
    where: { slug: 'football' },
    update: {},
    create: {
      id: randomUUID(),
      name: 'Football',
      slug: 'football',
      icon: 'football',
      description: '5-a-side or 7-a-side football',
      isActive: true,
    },
  });

  const cricketType = await prisma.sportType.upsert({
    where: { slug: 'cricket' },
    update: {},
    create: {
      id: randomUUID(),
      name: 'Cricket',
      slug: 'cricket',
      icon: 'cricket',
      description: 'Box cricket or practice nets',
      isActive: true,
    },
  });

  const badmintonType = await prisma.sportType.upsert({
    where: { slug: 'badminton' },
    update: {},
    create: {
      id: randomUUID(),
      name: 'Badminton',
      slug: 'badminton',
      icon: 'badminton',
      description: 'Indoor badminton courts',
      isActive: true,
    },
  });
  console.log('Created sport types');

  // Create users
  const passwordHash = await bcrypt.hash('password123', 12);

  // Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@sportzen.com' },
    update: {},
    create: {
      id: randomUUID(),
      email: 'admin@sportzen.com',
      emailVerified: true,
      phone: '+8801700000000',
      phoneVerified: true,
      passwordHash,
      name: 'Super Admin',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log('Created super admin:', superAdmin.email);

  // Owner
  const owner = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: {
      id: randomUUID(),
      email: 'owner@example.com',
      emailVerified: true,
      phone: '+8801711111111',
      phoneVerified: true,
      passwordHash,
      name: 'Turf Owner',
      role: UserRole.OWNER,
      isActive: true,
    },
  });
  console.log('Created owner:', owner.email);

  // Player
  const player = await prisma.user.upsert({
    where: { email: 'player@example.com' },
    update: {},
    create: {
      id: randomUUID(),
      email: 'player@example.com',
      emailVerified: true,
      phone: '+8801722222222',
      phoneVerified: true,
      passwordHash,
      name: 'Test Player',
      role: UserRole.PLAYER,
      isActive: true,
    },
  });
  console.log('Created player:', player.email);

  // Create owner subscription (ACTIVE so facility is bookable)
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const subscription = await prisma.ownerSubscription.upsert({
    where: { ownerId: owner.id },
    update: {},
    create: {
      id: randomUUID(),
      ownerId: owner.id,
      planId: basicPlan.id,
      status: SubscriptionStatus.TRIAL,
      trialEndsAt,
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndsAt,
    },
  });
  console.log('Created owner subscription');

  // Create facility
  const facility = await prisma.facility.upsert({
    where: { slug: 'green-field-sports' },
    update: {},
    create: {
      id: randomUUID(),
      ownerId: owner.id,
      name: 'Green Field Sports Complex',
      slug: 'green-field-sports',
      description:
        'Premium turf facility in Gulshan with well-maintained artificial grass pitches. Open 7 days a week with night lighting.',
      address: 'House 45, Road 12, Gulshan 1',
      city: 'Dhaka',
      area: 'Gulshan',
      latitude: 23.7925,
      longitude: 90.4078,
      contactPhone: '+8801711111111',
      contactEmail: 'owner@example.com',
      openingTime: '06:00',
      closingTime: '23:00',
      amenities: ['parking', 'washroom', 'changing_room', 'night_lights', 'drinking_water'],
      policies: {
        cancellation:
          'Full refund if canceled 24+ hours before. 50% refund for 6-24 hours. No refund within 6 hours.',
        rules: 'No metal studs allowed. Proper sports attire required.',
      },
      isApproved: true,
      approvedAt: new Date(),
      approvedBy: superAdmin.id,
    },
  });
  console.log('Created facility:', facility.name);

  // Create facility photos
  await prisma.facilityPhoto.createMany({
    skipDuplicates: true,
    data: [
      {
        id: randomUUID(),
        facilityId: facility.id,
        url: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800',
        caption: 'Main pitch with night lighting',
        sortOrder: 0,
        isPrimary: true,
      },
      {
        id: randomUUID(),
        facilityId: facility.id,
        url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
        caption: 'View from the stands',
        sortOrder: 1,
        isPrimary: false,
      },
    ],
  });
  console.log('Created facility photos');

  // Create play area (conflict group = play area id by default)
  const playAreaId = randomUUID();
  const playArea = await prisma.playArea.upsert({
    where: { id: playAreaId },
    update: {},
    create: {
      id: playAreaId,
      facilityId: facility.id,
      conflictGroupId: playAreaId, // Same as ID (isolated)
      name: 'Pitch A',
      description: 'Full-size 5-a-side artificial turf pitch',
      surfaceType: 'artificial_grass',
      dimensions: '40m x 20m',
      capacity: 14,
      isIndoor: false,
      isActive: true,
    },
  });
  console.log('Created play area:', playArea.name);

  // Create second play area
  const playAreaBId = randomUUID();
  const playAreaB = await prisma.playArea.upsert({
    where: { id: playAreaBId },
    update: {},
    create: {
      id: playAreaBId,
      facilityId: facility.id,
      conflictGroupId: playAreaBId,
      name: 'Pitch B',
      description: '7-a-side pitch with premium turf',
      surfaceType: 'artificial_grass',
      dimensions: '60m x 30m',
      capacity: 18,
      isIndoor: false,
      isActive: true,
    },
  });
  console.log('Created play area:', playAreaB.name);

  // Create sport profile for Pitch A - Football
  const sportProfile = await prisma.sportProfile.upsert({
    where: {
      playAreaId_sportTypeId: {
        playAreaId: playArea.id,
        sportTypeId: footballType.id,
      },
    },
    update: {},
    create: {
      id: randomUUID(),
      playAreaId: playArea.id,
      sportTypeId: footballType.id,
      slotIntervalMinutes: 30,
      bufferMinutes: 10,
      minLeadTimeMinutes: 60,
      maxAdvanceDays: 14,
      allowedDurations: [60, 90, 120],
      durationPrices: {
        '60': 1200,
        '90': 1700,
        '120': 2200,
      },
      peakDurationPrices: {
        '60': 1500,
        '90': 2100,
        '120': 2700,
      },
      isActive: true,
    },
  });
  console.log('Created sport profile for Pitch A');

  // Create peak pricing rules (weekday evenings and weekends)
  const peakRulesData = [
    // Weekday evenings (Mon-Thu: 17:00-22:00)
    { dayOfWeek: 1, startTime: '17:00', endTime: '22:00' }, // Monday
    { dayOfWeek: 2, startTime: '17:00', endTime: '22:00' }, // Tuesday
    { dayOfWeek: 3, startTime: '17:00', endTime: '22:00' }, // Wednesday
    { dayOfWeek: 4, startTime: '17:00', endTime: '22:00' }, // Thursday
    // Friday (full day peak)
    { dayOfWeek: 5, startTime: '06:00', endTime: '23:00' }, // Friday
    // Weekend (full day peak)
    { dayOfWeek: 6, startTime: '06:00', endTime: '23:00' }, // Saturday
    { dayOfWeek: 0, startTime: '06:00', endTime: '23:00' }, // Sunday
  ];

  for (const rule of peakRulesData) {
    await prisma.peakPricingRule.create({
      data: {
        id: randomUUID(),
        sportProfileId: sportProfile.id,
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        isActive: true,
      },
    });
  }
  console.log('Created peak pricing rules');

  // Create sport profile for Pitch B - Football
  await prisma.sportProfile.upsert({
    where: {
      playAreaId_sportTypeId: {
        playAreaId: playAreaB.id,
        sportTypeId: footballType.id,
      },
    },
    update: {},
    create: {
      id: randomUUID(),
      playAreaId: playAreaB.id,
      sportTypeId: footballType.id,
      slotIntervalMinutes: 30,
      bufferMinutes: 10,
      minLeadTimeMinutes: 60,
      maxAdvanceDays: 14,
      allowedDurations: [60, 90, 120],
      durationPrices: {
        '60': 1500,
        '90': 2100,
        '120': 2700,
      },
      peakDurationPrices: {
        '60': 1800,
        '90': 2500,
        '120': 3200,
      },
      isActive: true,
    },
  });
  console.log('Created sport profile for Pitch B');

  // Create a second facility for testing
  const secondOwnerId = randomUUID();
  const secondOwner = await prisma.user.upsert({
    where: { email: 'owner2@example.com' },
    update: {},
    create: {
      id: secondOwnerId,
      email: 'owner2@example.com',
      emailVerified: true,
      phone: '+8801733333333',
      phoneVerified: true,
      passwordHash,
      name: 'Second Owner',
      role: UserRole.OWNER,
      isActive: true,
    },
  });

  // Create subscription for second owner (but SUSPENDED - not bookable)
  await prisma.ownerSubscription.upsert({
    where: { ownerId: secondOwner.id },
    update: {},
    create: {
      id: randomUUID(),
      ownerId: secondOwner.id,
      planId: basicPlan.id,
      status: SubscriptionStatus.SUSPENDED, // This facility should NOT be bookable
      trialEndsAt: new Date('2024-01-01'),
      currentPeriodStart: new Date('2024-01-01'),
      currentPeriodEnd: new Date('2024-01-31'),
      suspendedAt: new Date(),
    },
  });

  const suspendedFacility = await prisma.facility.upsert({
    where: { slug: 'suspended-sports' },
    update: {},
    create: {
      id: randomUUID(),
      ownerId: secondOwner.id,
      name: 'Suspended Sports Center',
      slug: 'suspended-sports',
      description: 'This facility has a suspended subscription (for testing visibility)',
      address: 'Road 5, Dhanmondi',
      city: 'Dhaka',
      area: 'Dhanmondi',
      latitude: 23.7465,
      longitude: 90.3762,
      contactPhone: '+8801733333333',
      openingTime: '08:00',
      closingTime: '22:00',
      amenities: ['parking'],
      isApproved: true,
      approvedAt: new Date(),
      approvedBy: superAdmin.id,
    },
  });
  console.log('Created suspended facility (should NOT appear in search)');

  // Create platform config
  await prisma.platformConfig.upsert({
    where: { key: 'advance_percentage' },
    update: {},
    create: {
      id: randomUUID(),
      key: 'advance_percentage',
      value: { percentage: 0.1 },
      description: 'Advance payment percentage (10%)',
    },
  });

  await prisma.platformConfig.upsert({
    where: { key: 'platform_commission_rate' },
    update: {},
    create: {
      id: randomUUID(),
      key: 'platform_commission_rate',
      value: { rate: 0.05 },
      description: 'Platform commission rate (5%)',
    },
  });

  await prisma.platformConfig.upsert({
    where: { key: 'hold_expiry_minutes' },
    update: {},
    create: {
      id: randomUUID(),
      key: 'hold_expiry_minutes',
      value: { minutes: 10 },
      description: 'Hold expiry time in minutes',
    },
  });

  console.log('Created platform config');

  console.log('\n========================================');
  console.log('SEED DATA CREATED SUCCESSFULLY');
  console.log('========================================\n');
  console.log('Test Credentials:');
  console.log('  Admin:  admin@sportzen.com / password123');
  console.log('  Owner:  owner@example.com / password123');
  console.log('  Player: player@example.com / password123');
  console.log('\nBookable Facility: Green Field Sports Complex');
  console.log('  - Pitch A (Football, 60/90/120 min, Peak pricing configured)');
  console.log('  - Pitch B (Football, 60/90/120 min)');
  console.log('\nNon-bookable Facility: Suspended Sports Center');
  console.log('  - Owner subscription is SUSPENDED');
  console.log('\n');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
