const { env } = require("../../config/env");
const { createHttpError } = require("../../middleware/error-handler");
const { MemoryCache } = require("../../lib/cache");
const { verifyStoreAccess } = require("./menu-service");

// Dish catalog for the Smart Menu Builder, served by Chronon's regional menus API.
// The key stays on the server; the panels only talk to this proxy.

const REQUEST_TIMEOUT_MS = 8000;
const regionsCache = new MemoryCache(60 * 60 * 1000, 5); // 1 hour TTL

// Chronon diet → our DietaryPreference. Pescatarian dishes contain fish, so they're non-veg here.
const DIET_TO_DIETARY = {
  vegan: "VEGAN",
  vegetarian: "VEG",
  eggetarian: "EGG",
  pescatarian: "NON_VEG",
  non_vegetarian: "NON_VEG"
};

// Chronon spice 0–5 → our SpiceLevel.
const SPICE_TO_LEVEL = ["NONE", "MILD", "MEDIUM", "HOT", "HOT", "EXTRA_HOT"];

const PASS_THROUGH_PARAMS = ["q", "region", "course", "diet", "max_spice", "cursor", "limit"];

async function chrononGet(path, params = {}) {
  if (!env.chronon.apiKey) {
    throw createHttpError(503, "Dish catalog isn't configured. Set CHRONON_API_KEY on the backend.");
  }

  const url = new URL(`${env.chronon.baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  let response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${env.chronon.apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (err) {
    console.warn(`[Chronon] ${path} unreachable: ${err.message}`);
    throw createHttpError(502, "Dish catalog is unreachable right now. Please try again.");
  }

  const body = await response.json().catch(() => null);
  if (response.ok) return body;

  const upstream = body?.error?.message || `HTTP ${response.status}`;
  console.warn(`[Chronon] ${path} failed: ${response.status} ${upstream}`);
  // Never pass Chronon's 401/403 through: the panels treat a 401 as their own session expiring.
  if (response.status === 400) throw createHttpError(400, upstream);
  if (response.status === 429) throw createHttpError(429, "Dish catalog is busy. Please try again in a minute.");
  throw createHttpError(502, "Dish catalog is unavailable right now. Please try again.");
}

function toCatalogDish(dish) {
  return {
    slug: dish.slug,
    name: dish.name,
    localName: dish.local_name || null,
    description: dish.description || "",
    course: dish.course,
    diet: dish.diet,
    spice: dish.spice_level,
    ingredients: dish.ingredients || [],
    tags: dish.tags || [],
    region: dish.region ? { slug: dish.region.slug, name: dish.region.name } : null,
    // The catalog has no photos yet; picked up automatically if Chronon adds an image field.
    image: dish.image || dish.image_url || null,
    suggested: {
      dietary: DIET_TO_DIETARY[dish.diet] || "VEG",
      spiceLevel: SPICE_TO_LEVEL[dish.spice_level] || "NONE"
    }
  };
}

async function searchCatalogDishes(actor, storeId, query = {}) {
  await verifyStoreAccess(actor, storeId);
  const params = {};
  for (const key of PASS_THROUGH_PARAMS) {
    if (typeof query[key] === "string") params[key] = query[key].trim().slice(0, 64);
  }
  const body = await chrononGet("/v1/menus/dishes", params);
  return {
    dishes: (body?.data || []).map(toCatalogDish),
    total: body?.total ?? 0,
    nextCursor: body?.next_cursor || null
  };
}

async function listCatalogRegions(actor, storeId) {
  await verifyStoreAccess(actor, storeId);
  const cached = regionsCache.get("regions");
  if (cached) return cached;
  const body = await chrononGet("/v1/menus/regions");
  const regions = (body?.data || []).map((r) => ({
    slug: r.slug,
    name: r.name,
    country: r.country,
    dishCount: r.dish_count ?? null
  }));
  regionsCache.set("regions", regions);
  return regions;
}

module.exports = {
  searchCatalogDishes,
  listCatalogRegions
};
