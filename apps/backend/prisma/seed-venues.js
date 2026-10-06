/**
 * Sample venues (malls, food courts, cinemas) for trying the venue QR flow.
 * Safe to run again: venues are matched by their link name and updated, never duplicated.
 * Stores are not added here; add them from Admin → Stores → edit → Venue, or Admin → Venues.
 *
 *   npm run seed:venues --workspace=@smo/backend
 */
require('dotenv').config({ quiet: true });
const { getPrismaClient, disconnectPrisma } = require('../src/lib/prisma');

const VENUES = [
  {
    slug: 'city-centre-food-court',
    name: 'City Centre Food Court',
    city: 'Kolkata',
    address: '3rd floor, City Centre Mall, Salt Lake',
    description: 'Burgers, biryani, momos and more: 15 counters, open 11 am to 10 pm'
  },
  {
    slug: 'riverside-food-hall',
    name: 'Riverside Mall Food Hall',
    city: 'Mumbai',
    address: 'Level 2, Riverside Mall, Lower Parel',
    description: 'Street food to sit-down meals, all under one roof'
  },
  {
    slug: 'galaxy-cinemas-snacks',
    name: 'Galaxy Cinemas Snack Bar',
    city: 'Bengaluru',
    address: 'Galaxy Cinemas, 4th floor, Orion Avenue',
    description: 'Order popcorn, nachos and drinks from your seat, collect at the counter'
  },
  {
    slug: 'metro-junction-food-court',
    name: 'Metro Junction Food Court',
    city: 'Gurugram',
    address: 'Ground floor, Metro Junction Mall, Cyber City',
    description: 'Quick bites for the office crowd, 8 am to 11 pm'
  }
];

(async () => {
  const prisma = getPrismaClient();
  for (const venue of VENUES) {
    const { slug, ...data } = venue;
    const saved = await prisma.venue.upsert({
      where: { slug },
      create: { slug, ...data, isActive: true },
      update: data,
      include: { _count: { select: { stores: true } } }
    });
    console.log(`✓ ${saved.name} (/v/${saved.slug}) · ${saved._count.stores} stores`);
  }
  await disconnectPrisma();
})().catch(async (err) => {
  console.error('Seeding venues failed:', err.message);
  await disconnectPrisma().catch(() => {});
  process.exit(1);
});
