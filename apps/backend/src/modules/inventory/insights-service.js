const { getPrismaClient } = require("../../lib/prisma");
const inventory = require("./advanced-inventory-service");

/*
 * Alerts: what the stock, delivery, wastage and hygiene records say when read together.
 * Every alert is a plain rule over figures the store entered, and says which figures, so a
 * manager can check it. Nothing here is guessed, and nothing is stored: the list is worked out
 * each time from the records as they stand.
 *
 * A rule only speaks when there is enough behind it (two counts, not one; a price to compare
 * against), so a new store sees few alerts and none it can't act on.
 */

const DAY_MS = 86400000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;        // how far back losses, wastage and idle stock look
const USAGE_DAYS = 14;         // how far back "how fast is this used" looks
const SHORTFALL_SHARE = 0.05;  // missing stock worth flagging: 5% of what recipes used
const PRICE_RISE = 0.10;       // a price rise worth flagging
const PRICE_FRESH_DAYS = 14;   // ...when the dearer delivery is recent
const WASTE_SHARE = 0.10;      // thrown away, as a share of what was bought
const COVER_DAYS = 2;          // "will run out soon"
const IDLE_VALUE = 500;        // rupees of stock that hasn't moved
const HIGH_FOOD_COST = 40;     // percent of the selling price
const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, INFO: 2 };
const UNIT = { KG: "kg", GRAM: "g", LITER: "L", MILLILITER: "ml", PIECE: "pc", DOZEN: "dozen" };

const dayKey = (date = new Date()) => new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const num = (n) => Number(Number(n || 0).toFixed(n < 10 ? 2 : 1)).toLocaleString("en-IN");
const amount = (n, unit) => `${num(n)} ${UNIT[unit] || String(unit || "").toLowerCase()}`;
const rupees = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const percent = (share) => `${Math.round(share * 100)}%`;
const list = (names, max = 3) => (names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} and ${names.length - max} more`);
const times = (n) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/**
 * Works out a store's alerts.
 * @returns {Promise<{ alerts: object[], counts: { high: number, medium: number, info: number } }>}
 */
async function computeInsights(storeId) {
  const prisma = getPrismaClient();
  const now = Date.now();
  const since = new Date(now - WINDOW_DAYS * DAY_MS);
  const usageSince = new Date(now - USAGE_DAYS * DAY_MS);
  const weekAgoDay = dayKey(new Date(now - 7 * DAY_MS));
  const today = dayKey();

  const [materials, consumed, losses, lots, recipes, standing, checks, hygieneLogs] = await Promise.all([
    prisma.rawMaterial.findMany({ where: { storeId } }),
    // What recipes took out of stock as dishes were sold, per ingredient
    prisma.$queryRaw`
      SELECT t."materialId" AS id,
             SUM(ABS(t.quantity)) AS total,
             COALESCE(SUM(ABS(t.quantity)) FILTER (WHERE t."createdAt" >= ${usageSince}), 0) AS recent,
             COUNT(*) FILTER (WHERE t."createdAt" >= ${usageSince}) AS "recentRows"
      FROM "StockTransaction" t
      JOIN "RawMaterial" m ON m.id = t."materialId"
      WHERE m."storeId" = ${storeId} AND t.type::text = 'CONSUME' AND t."createdAt" >= ${since}
      GROUP BY t."materialId"`,
    prisma.stockTransaction.findMany({
      where: { type: { in: ["WASTE", "COUNT"] }, createdAt: { gte: since }, material: { storeId } },
      select: { materialId: true, type: true, quantity: true, reason: true }
    }),
    prisma.stockBatch.findMany({
      where: { storeId, kind: "RECEIVED", receivedAt: { gte: new Date(now - 120 * DAY_MS) } },
      orderBy: { receivedAt: "desc" },
      select: { materialId: true, originalQuantity: true, unitCost: true, receivedAt: true, supplier: { select: { name: true } } }
    }),
    prisma.menuItem.findMany({
      where: { storeId, recipe: { some: {} } },
      select: { id: true, name: true, price: true, recipe: { select: { quantity: true, rawMaterialId: true, rawMaterial: { select: { costPerUnit: true } } } } }
    }),
    prisma.standingDelivery.findMany({ where: { storeId, isActive: true }, select: { lines: true } }),
    prisma.hygieneCheck.findMany({ where: { storeId, isActive: true } }),
    prisma.hygieneLog.findMany({ where: { storeId, day: { gte: weekAgoDay, lt: today } } })
  ]);

  const usage = new Map(consumed.map(row => [row.id, { total: Number(row.total), recent: Number(row.recent), recentRows: Number(row.recentRows) }]));
  const lotsOf = new Map();
  for (const lot of lots) {
    if (!lotsOf.has(lot.materialId)) lotsOf.set(lot.materialId, []);
    lotsOf.get(lot.materialId).push(lot);
  }
  const lossesOf = new Map();
  for (const loss of losses) {
    if (!lossesOf.has(loss.materialId)) lossesOf.set(loss.materialId, []);
    lossesOf.get(loss.materialId).push(loss);
  }
  const inRecipe = new Set(recipes.flatMap(dish => dish.recipe.map(r => r.rawMaterialId)));
  const onStanding = new Set(standing.flatMap(s => (Array.isArray(s.lines) ? s.lines.map(l => l.materialId) : [])));

  // What each dish costs to make, where every ingredient has a price
  const dishes = recipes.map(dish => {
    const priced = dish.recipe.every(r => r.rawMaterial.costPerUnit);
    const cost = dish.recipe.reduce((sum, r) => sum + r.quantity * (r.rawMaterial.costPerUnit || 0), 0);
    return { id: dish.id, name: dish.name, price: dish.price, cost, costPercent: priced && dish.price > 0 ? (cost / dish.price) * 100 : null, uses: new Set(dish.recipe.map(r => r.rawMaterialId)) };
  });

  const alerts = [];
  const add = (alert) => alerts.push({ value: 0, ...alert });
  const unpriced = [];
  const noRecipe = [];

  for (const m of materials) {
    const stock = Math.max(0, m.currentStock);
    const cost = m.costPerUnit || 0;
    const used = usage.get(m.id) || { total: 0, recent: 0, recentRows: 0 };
    const mine = lossesOf.get(m.id) || [];
    const received = (lotsOf.get(m.id) || []).filter(l => l.receivedAt >= since);

    /* Stock going missing: counts keep finding less than the records say */
    const shortfalls = mine.filter(l => l.type === "COUNT" && l.quantity < 0);
    const missing = shortfalls.reduce((sum, l) => sum + Math.abs(l.quantity), 0);
    const overRecipe = used.total > 0 ? missing / used.total : null;
    if (shortfalls.length >= 2 || (shortfalls.length >= 1 && overRecipe !== null && overRecipe >= SHORTFALL_SHARE)) {
      const value = missing * cost;
      add({
        id: `LOSS:${m.id}`,
        kind: "LOSS",
        severity: shortfalls.length >= 3 || value >= 1000 ? "HIGH" : "MEDIUM",
        title: `${m.name} keeps coming up short`,
        text: `${amount(missing, m.unit)} was missing across ${shortfalls.length} ${shortfalls.length === 1 ? "count" : "counts"} in the last ${WINDOW_DAYS} days${cost ? ` (${rupees(value)})` : ""}.${overRecipe !== null ? ` That is ${percent(overRecipe)} on top of what recipes used.` : ""}`,
        advice: "Check portions against the recipe, and whether everything thrown away is being recorded as wastage.",
        value,
        tab: "wastage"
      });
    }

    /* Thrown away too often */
    const wasted = mine.filter(l => l.type === "WASTE");
    const wastedQty = wasted.reduce((sum, l) => sum + Math.abs(l.quantity), 0);
    const boughtQty = received.reduce((sum, l) => sum + l.originalQuantity, 0);
    const expiredTimes = wasted.filter(l => /^expired/i.test(l.reason || "")).length;
    const wasteShare = boughtQty > 0 ? wastedQty / boughtQty : null;
    if ((wasted.length >= 2 && wasteShare !== null && wasteShare >= WASTE_SHARE) || expiredTimes >= 2) {
      const reasons = new Map();
      for (const w of wasted) {
        const reason = (w.reason || "No reason").split(" — ")[0];
        reasons.set(reason, (reasons.get(reason) || 0) + Math.abs(w.quantity));
      }
      const top = [...reasons].sort((a, b) => b[1] - a[1])[0][0];
      const value = wastedQty * cost;
      add({
        id: `WASTE:${m.id}`,
        kind: "WASTE",
        severity: value >= 1000 || (wasteShare !== null && wasteShare >= 0.25) ? "HIGH" : "MEDIUM",
        title: `${m.name} is being thrown away`,
        text: `${amount(wastedQty, m.unit)} thrown away in ${WINDOW_DAYS} days${cost ? ` (${rupees(value)})` : ""}${wasteShare !== null ? `: ${percent(Math.min(wasteShare, 1))} of the ${amount(boughtQty, m.unit)} you bought` : ""}. Most often: ${top.toLowerCase()}.`,
        advice: /^expired|^spoiled/i.test(top) ? "Order less each time, or more often, so it is used before its date."
          : /^prepared/i.test(top) ? "Prepare smaller batches, closer to when they sell."
            : "See when it happens and who records it under Wastage.",
        value,
        tab: "wastage"
      });
    }

    /* A supplier's price went up */
    const priced = (lotsOf.get(m.id) || []).filter(l => l.unitCost > 0);
    if (priced.length >= 2 && priced[0].receivedAt.getTime() >= now - PRICE_FRESH_DAYS * DAY_MS) {
      const latest = priced[0];
      const earlier = priced.slice(1, 4);
      const before = earlier.reduce((sum, l) => sum + l.unitCost, 0) / earlier.length;
      const rise = (latest.unitCost - before) / before;
      if (rise >= PRICE_RISE) {
        // Dishes that use it and now cost more than they should to make
        const pushed = dishes.filter(d => d.uses.has(m.id) && d.costPercent !== null && d.costPercent > HIGH_FOOD_COST).map(d => d.name);
        const monthly = used.total * (latest.unitCost - before);
        add({
          id: `PRICE:${m.id}:${latest.receivedAt.toISOString().slice(0, 10)}`,
          kind: "PRICE",
          severity: rise >= 0.2 || monthly >= 2000 ? "HIGH" : "MEDIUM",
          title: `${m.name} costs ${percent(rise)} more`,
          text: `${rupees(latest.unitCost)} per ${UNIT[m.unit] || m.unit}${latest.supplier?.name ? ` from ${latest.supplier.name}` : ""}, up from about ${rupees(before)}.${monthly >= 1 ? ` At the rate you use it, that is about ${rupees(monthly)} more a month.` : ""}${pushed.length > 0 ? ` At this price ${list(pushed)} ${pushed.length === 1 ? "costs" : "cost"} over ${HIGH_FOOD_COST}% of ${pushed.length === 1 ? "its" : "their"} selling price to make.` : ""}`,
          advice: "Ask the supplier, compare another one, or look at the price of the dishes that use it.",
          value: monthly,
          tab: "food-cost"
        });
      }
    }

    /* About to run out, going by how fast it is being used */
    const daily = used.recent / USAGE_DAYS;
    if (stock > 0 && used.recentRows >= 5 && daily > 0 && !onStanding.has(m.id)) {
      const cover = stock / daily;
      if (cover < COVER_DAYS) {
        add({
          id: `COVER:${m.id}`,
          kind: "COVER",
          severity: cover < 1 ? "HIGH" : "MEDIUM",
          title: `${m.name} will run out ${cover < 1 ? "today" : "tomorrow"}`,
          text: `${amount(stock, m.unit)} left, and you have been using about ${amount(daily, m.unit)} a day. Dishes that need it go sold out when it does.`,
          advice: "Order it now. If it arrives the same way every time, set up a standing delivery.",
          value: daily * cost * 7,
          tab: "receive"
        });
      }
    }

    /* Money sitting on the shelf */
    if (inRecipe.has(m.id) && stock * cost >= IDLE_VALUE && used.total === 0 && wasted.length === 0 && received.length === 0) {
      add({
        id: `IDLE:${m.id}`,
        kind: "IDLE",
        severity: "INFO",
        title: `${m.name} hasn’t moved in ${WINDOW_DAYS} days`,
        text: `${amount(stock, m.unit)} worth ${rupees(stock * cost)} is in stock, and no dish that uses it has sold.`,
        advice: "Buy less of it next time, or push the dishes that use it.",
        value: stock * cost,
        tab: "stock"
      });
    }

    if (stock > 0 && !m.costPerUnit) unpriced.push(m.name);
    if (stock > 0 && !inRecipe.has(m.id)) noRecipe.push(m.name);
  }

  /* Dishes that lose money on every plate */
  for (const dish of dishes.filter(d => d.costPercent !== null && d.costPercent > 100)) {
    add({
      id: `DISH:${dish.id}`,
      kind: "DISH",
      severity: "HIGH",
      title: `${dish.name} sells at a loss`,
      text: `It sells for ${rupees(dish.price)} and its ingredients cost ${rupees(dish.cost)}.`,
      advice: "Check the recipe quantities first; if they are right, the price needs to go up.",
      value: dish.cost - dish.price,
      tab: "food-cost"
    });
  }

  /* Equipment that keeps failing its check, and checks that keep being skipped */
  const logsByCheck = new Map();
  for (const log of hygieneLogs) {
    if (!logsByCheck.has(log.checkId)) logsByCheck.set(log.checkId, []);
    logsByCheck.get(log.checkId).push(log);
  }
  for (const check of checks.filter(c => c.kind === "TEMPERATURE")) {
    const failed = (logsByCheck.get(check.id) || []).filter(l => !l.ok);
    if (failed.length >= 2) {
      const tooWarm = check.maxValue !== null && failed.some(l => l.value > check.maxValue);
      const worst = tooWarm ? Math.max(...failed.map(l => l.value)) : Math.min(...failed.map(l => l.value));
      add({
        id: `TEMP:${check.id}`,
        kind: "TEMP",
        severity: "HIGH",
        title: `${check.name} was out of range ${times(failed.length)} this week`,
        text: `The ${tooWarm ? "warmest" : "coldest"} reading was ${num(worst)} °C. Food kept at the wrong temperature spoils early and is what inspectors look for first.`,
        advice: "Get the equipment looked at before more stock is lost.",
        value: 5000,
        tab: "checks"
      });
    }
  }
  if (checks.length > 0) {
    const days = [];
    for (let back = 1; back <= 7; back += 1) days.push(dayKey(new Date(now - back * DAY_MS)));
    const expected = days.filter(day => checks.some(c => dayKey(c.createdAt) <= day));
    const skipped = expected.filter(day => !hygieneLogs.some(l => l.day === day)).length;
    if (skipped >= 2) {
      add({
        id: "CHECKS_SKIPPED",
        kind: "CHECKS",
        severity: skipped >= 4 ? "HIGH" : "MEDIUM",
        title: `Hygiene checks were skipped on ${skipped} of the last ${expected.length} days`,
        text: "A day with nothing recorded reads, to an inspector, as a day nothing was checked.",
        advice: "Give the checks to one person per shift; they take about two minutes.",
        value: 1000,
        tab: "checks"
      });
    }
  }

  /* Gaps that make the other figures less true */
  if (noRecipe.length > 0) {
    add({
      id: "NO_RECIPE",
      kind: "SETUP",
      severity: "INFO",
      title: `${noRecipe.length} ${noRecipe.length === 1 ? "ingredient isn’t" : "ingredients aren’t"} in any recipe`,
      text: `${list(noRecipe, 4)}: selling dishes doesn’t reduce ${noRecipe.length === 1 ? "it" : "them"}, so only a count shows what is really left.`,
      advice: "Add them to the recipes of the dishes that use them, in the menu editor.",
      tab: "stock"
    });
  }
  if (unpriced.length > 0) {
    add({
      id: "NO_PRICE",
      kind: "SETUP",
      severity: "INFO",
      title: `${unpriced.length} ${unpriced.length === 1 ? "ingredient has" : "ingredients have"} no price`,
      text: `${list(unpriced, 4)}: stock value, wastage and food cost leave ${unpriced.length === 1 ? "it" : "them"} out.`,
      advice: "Enter the price the next time each one is received.",
      tab: "receive"
    });
  }

  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.value - a.value);
  return {
    alerts: alerts.map(({ value, ...alert }) => ({ ...alert, value: Math.round(value) })),
    counts: {
      high: alerts.filter(a => a.severity === "HIGH").length,
      medium: alerts.filter(a => a.severity === "MEDIUM").length,
      info: alerts.filter(a => a.severity === "INFO").length
    },
    windowDays: WINDOW_DAYS
  };
}

/** A store's alerts, for its managers and owners */
async function getInsights(actor, storeId) {
  await inventory.assertAdvanced(actor, storeId, inventory.MANAGE_ROLES);
  return computeInsights(storeId);
}

/**
 * The morning brief for one store: what needs doing in the store room today and what the
 * records are warning about. Null when there is nothing to say.
 * @returns {Promise<{ title: string, body: string, items: string[] } | null>}
 */
async function getMorningBrief(storeId) {
  const [overview, insights] = await Promise.all([inventory.computeOverview(storeId, true), computeInsights(storeId)]);
  const items = [];
  const { expired, soon, low } = overview.attention;
  if (expired.length > 0) items.push(`${expired.length} expired ${expired.length === 1 ? "lot" : "lots"} still on the shelf`);
  if (soon.length > 0) items.push(`${soon.length} to use first`);
  if (low.length > 0) items.push(`${low.length} running low`);
  for (const licence of overview.compliance.licences) {
    items.push(licence.state === "EXPIRED" ? `${licence.name} has expired` : `${licence.name} expires in ${licence.daysLeft} ${licence.daysLeft === 1 ? "day" : "days"}`);
  }
  for (const alert of insights.alerts.filter(a => a.severity === "HIGH").slice(0, 3)) items.push(alert.title);
  if (items.length === 0) return null;
  return {
    title: `Store room: ${items.length} ${items.length === 1 ? "thing" : "things"} to look at today`,
    body: `${items.slice(0, 5).join(" · ")}${items.length > 5 ? ` · and ${items.length - 5} more` : ""}`,
    items
  };
}

module.exports = { computeInsights, getInsights, getMorningBrief };
