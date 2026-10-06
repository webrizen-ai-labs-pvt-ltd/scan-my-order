const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { invalidateMenuCache, invalidateStoreCache } = require("../../lib/cache");

// A store's venue, mode or location changed: menus and cached store details must follow
const storeChanged = (storeId) => { invalidateMenuCache(storeId); invalidateStoreCache(storeId); };

/**
 * Venues: a mall, food court or cinema where counters from different brands share one QR code.
 * Super admins create venues and add stores to them; guests see one card per counter and
 * order from that counter's own menu page.
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Slugs the menu app already uses at the top level
const RESERVED_SLUGS = new Set(['v', 'api', 'admin', 'login', 'menu', 'venues']);

function cleanVenueInput(input = {}, { partial = false } = {}) {
  const out = {};
  const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) || null : v === null ? null : undefined);

  if (!partial || input.name !== undefined) {
    const name = text(input.name, 80);
    if (!name || name.length < 2) throw createHttpError(400, "Enter the venue's name");
    out.name = name;
  }
  if (!partial || input.slug !== undefined) {
    const slug = String(input.slug || '').trim().toLowerCase();
    if (!SLUG_RE.test(slug) || slug.length < 3 || slug.length > 60) {
      throw createHttpError(400, "The link name can use lowercase letters, numbers and dashes (3–60 characters)");
    }
    if (RESERVED_SLUGS.has(slug)) throw createHttpError(400, "That link name is reserved. Pick another one.");
    out.slug = slug;
  }
  for (const [key, max] of [['city', 60], ['address', 200], ['description', 300], ['coverImage', 500]]) {
    const v = text(input[key], max);
    if (v !== undefined) out[key] = v;
  }
  if (typeof input.isActive === 'boolean') out.isActive = input.isActive;
  return out;
}

/** Same rule as the billing guard: can this brand's QR menus take orders? */
function subscriptionAllowsOrders(sub) {
  if (!sub) return true;
  if (sub.status === 'ACTIVE' || sub.status === 'TRIALING') return true;
  if (sub.status === 'PAST_DUE') return Boolean(sub.gracePeriodEndsAt && new Date() <= sub.gracePeriodEndsAt);
  return false;
}

/* ---------- public ---------- */

/** The venue page: one card per counter, in the order they were added */
async function getPublicVenue(slug) {
  const prisma = getPrismaClient();
  const venue = await prisma.venue.findUnique({
    where: { slug: String(slug || '').toLowerCase() },
    include: {
      stores: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, name: true, slug: true, banner: true, status: true, serviceMode: true, venueLocation: true,
          tenant: {
            select: {
              name: true, slug: true, logo: true, brandColor: true, status: true,
              subscription: { select: { status: true, gracePeriodEndsAt: true } },
              paymentGateways: { where: { provider: 'RAZORPAY', isActive: true }, select: { id: true } }
            }
          }
        }
      }
    }
  });
  if (!venue || !venue.isActive) throw createHttpError(404, "This place isn't on Scan My Order yet");

  const counters = venue.stores
    .filter(s => s.status !== 'DISABLED' && s.tenant.status === 'ACTIVE')
    .map(s => {
      const paymentsReady = s.tenant.paymentGateways.length > 0;
      const open = s.status === 'ACTIVE' && subscriptionAllowsOrders(s.tenant.subscription);
      return {
        id: s.id,
        name: s.name,
        storeSlug: s.slug,
        brandName: s.tenant.name,
        brandSlug: s.tenant.slug,
        logo: s.tenant.logo,
        brandColor: s.tenant.brandColor,
        banner: s.banner,
        location: s.venueLocation,
        serviceMode: s.serviceMode,
        // Counter stores take orders here (with online payment); table stores take them at their tables
        takingOrders: open && s.serviceMode === 'COUNTER' && paymentsReady,
        closedReason: !open ? 'Not taking orders right now' : (s.serviceMode === 'COUNTER' && !paymentsReady ? 'Online ordering coming soon' : null)
      };
    });

  return {
    name: venue.name,
    slug: venue.slug,
    city: venue.city,
    address: venue.address,
    description: venue.description,
    coverImage: venue.coverImage,
    counters
  };
}

/* ---------- super admin ---------- */

async function listVenues() {
  const venues = await getPrismaClient().venue.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { stores: true } } }
  });
  return venues.map(({ _count, ...v }) => ({ ...v, storeCount: _count.stores }));
}

async function getVenue(id) {
  const venue = await getPrismaClient().venue.findUnique({
    where: { id },
    include: {
      stores: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, name: true, slug: true, status: true, serviceMode: true, venueLocation: true,
          tenant: { select: { id: true, name: true, slug: true, logo: true } }
        }
      }
    }
  });
  if (!venue) throw createHttpError(404, "Venue not found");
  return venue;
}

async function createVenue(input) {
  const data = cleanVenueInput(input);
  const exists = await getPrismaClient().venue.findUnique({ where: { slug: data.slug } });
  if (exists) throw createHttpError(409, "Another venue already uses that link name");
  return getPrismaClient().venue.create({ data });
}

async function updateVenue(id, input) {
  const prisma = getPrismaClient();
  await getVenue(id);
  const data = cleanVenueInput(input, { partial: true });
  if (data.slug) {
    const clash = await prisma.venue.findFirst({ where: { slug: data.slug, id: { not: id } } });
    if (clash) throw createHttpError(409, "Another venue already uses that link name");
  }
  return prisma.venue.update({ where: { id }, data });
}

/** Removing a venue keeps its stores; they just stop being grouped */
async function deleteVenue(id) {
  await getVenue(id);
  await getPrismaClient().venue.delete({ where: { id } });
  return { success: true };
}

/** Stores a super admin can add, across every brand */
async function searchStoresForVenue(query = '') {
  const q = String(query).trim();
  return getPrismaClient().store.findMany({
    where: q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { tenant: { name: { contains: q, mode: 'insensitive' } } }
      ]
    } : {},
    orderBy: { name: 'asc' },
    take: 20,
    select: {
      id: true, name: true, slug: true, serviceMode: true, venueId: true,
      venue: { select: { name: true } },
      tenant: { select: { name: true } }
    }
  });
}

/** Adds a store to the venue. Venue counters default to counter mode (takeaway, prepaid). */
async function addStoreToVenue(venueId, storeId, input = {}) {
  const prisma = getPrismaClient();
  await getVenue(venueId);
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, venueId: true } });
  if (!store) throw createHttpError(404, "Store not found");
  if (store.venueId && store.venueId !== venueId) {
    throw createHttpError(409, "This store is already in another venue. Remove it there first.");
  }
  const updated = await prisma.store.update({
    where: { id: storeId },
    data: {
      venueId,
      serviceMode: input.serviceMode === 'TABLES' ? 'TABLES' : 'COUNTER',
      venueLocation: typeof input.venueLocation === 'string' ? input.venueLocation.trim().slice(0, 120) || null : undefined
    }
  });
  storeChanged(storeId);
  return updated;
}

async function removeStoreFromVenue(venueId, storeId) {
  const prisma = getPrismaClient();
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { venueId: true } });
  if (!store || store.venueId !== venueId) throw createHttpError(404, "This store isn't in the venue");
  // Back to normal table service outside the venue
  await prisma.store.update({ where: { id: storeId }, data: { venueId: null, venueLocation: null, serviceMode: 'TABLES' } });
  storeChanged(storeId);
  return { success: true };
}

/** How a venue store takes orders, and where its counter is */
async function updateVenueStore(venueId, storeId, input = {}) {
  const prisma = getPrismaClient();
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { venueId: true } });
  if (!store || store.venueId !== venueId) throw createHttpError(404, "This store isn't in the venue");
  const data = {};
  if (input.serviceMode !== undefined) {
    if (!['TABLES', 'COUNTER'].includes(input.serviceMode)) throw createHttpError(400, "serviceMode must be TABLES or COUNTER");
    data.serviceMode = input.serviceMode;
  }
  if (input.venueLocation !== undefined) {
    data.venueLocation = typeof input.venueLocation === 'string' ? input.venueLocation.trim().slice(0, 120) || null : null;
  }
  const updated = await prisma.store.update({ where: { id: storeId }, data });
  storeChanged(storeId);
  return updated;
}

module.exports = {
  getPublicVenue,
  listVenues,
  getVenue,
  createVenue,
  updateVenue,
  deleteVenue,
  searchStoresForVenue,
  addStoreToVenue,
  removeStoreFromVenue,
  updateVenueStore
};
