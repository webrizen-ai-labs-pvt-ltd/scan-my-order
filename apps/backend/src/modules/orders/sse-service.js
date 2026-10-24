const crypto = require("crypto");
const { getPrismaClient } = require("../../lib/prisma");

/**
 * Live updates over Server-Sent Events.
 *
 * - Every connection gets a `ping` event every 25 s, so dead connections are noticed (by the browser
 *   and by proxies) and screens can tell they're still live.
 * - Staff streams are re-checked every minute: a deactivated user or a changed password closes them.
 * - All state is in this process's memory, so the backend must run as a single instance.
 */

const HEARTBEAT_MS = 25 * 1000;
const RECHECK_MS = 60 * 1000;

const clients = new Map();          // storeId -> Map(clientId -> { res, userId, role, tokenVersion })
const customerClients = new Map();  // customerId | sessionId -> Map(clientId -> { res })

function openStream(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no" // don't let proxies hold events back
  });
  res.flushHeaders?.();
  // Ask browsers to retry quickly if the connection drops
  res.write("retry: 3000\n\n");
}

function send(res, payload, event) {
  try {
    res.write(`${event ? `event: ${event}\n` : ""}data: ${JSON.stringify(payload)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

function register(map, key, entry, req) {
  const clientId = crypto.randomUUID();
  if (!map.has(key)) map.set(key, new Map());
  map.get(key).set(clientId, entry);
  const remove = () => {
    const group = map.get(key);
    if (!group) return;
    group.delete(clientId);
    if (group.size === 0) map.delete(key);
  };
  req.on("close", remove);
  entry.res.on("error", remove);
  return clientId;
}

/**
 * @param {{ userId?: string, role?: string, tokenVersion?: number }} [who] the staff member, re-checked every minute
 */
function subscribeToStore(storeId, req, res, who = {}) {
  openStream(req, res);
  const clientId = register(clients, storeId, { res, userId: who.userId || null, role: who.role || null, tokenVersion: who.tokenVersion || 0 }, req);
  send(res, { type: "CONNECTED", clientId });
}

function subscribeToCustomer(customerId, req, res) {
  openStream(req, res);
  const clientId = register(customerClients, customerId, { res }, req);
  send(res, { type: "CONNECTED", clientId });
}

function broadcast(group, eventType, payload) {
  if (!group) return;
  const message = `data: ${JSON.stringify({ type: eventType, data: payload })}\n\n`;
  for (const { res } of group.values()) {
    try { res.write(message); } catch { /* closed; removed on its close event */ }
  }
}

function broadcastToStore(storeId, eventType, payload) {
  broadcast(clients.get(storeId), eventType, payload);
}

/**
 * Store stream, but only to the staff an event is meant for.
 * @param {{ userId?: string, roles?: string[] }} [to] one user, or these roles; neither means all staff
 */
// Management sees every role-targeted event (same rule as the saved notification list)
const MANAGEMENT_ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "STORE_MANAGER"];

function broadcastToStoreStaff(storeId, eventType, payload, to = {}) {
  const group = clients.get(storeId);
  if (!group) return;
  const roles = to.roles?.length ? to.roles : null;
  const message = `data: ${JSON.stringify({ type: eventType, data: payload })}\n\n`;
  for (const entry of group.values()) {
    const roleMatch = !roles || roles.includes(entry.role) || MANAGEMENT_ROLES.includes(entry.role);
    if (to.userId ? entry.userId !== to.userId : !roleMatch) continue;
    try { entry.res.write(message); } catch { /* closed; removed on its close event */ }
  }
}

function broadcastToCustomer(customerId, eventType, payload) {
  broadcast(customerClients.get(customerId), eventType, payload);
}

/* ---------- keep-alive and access re-checks ---------- */

function heartbeat() {
  const at = Date.now();
  for (const map of [clients, customerClients]) {
    for (const group of map.values()) {
      for (const { res } of group.values()) send(res, { at }, "ping");
    }
  }
}

/** Closes staff streams whose user was deactivated or whose password changed since they connected */
async function recheckStaffStreams() {
  const entries = [];
  for (const group of clients.values()) {
    for (const entry of group.values()) if (entry.userId) entries.push(entry);
  }
  if (entries.length === 0) return;
  try {
    const ids = [...new Set(entries.map(e => e.userId))];
    const users = await getPrismaClient().user.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, tokenVersion: true }
    });
    const byId = new Map(users.map(u => [u.id, u]));
    for (const entry of entries) {
      const user = byId.get(entry.userId);
      if (!user || user.status !== "ACTIVE" || (user.tokenVersion || 0) !== entry.tokenVersion) {
        // Tell the screen why, then hang up; its reconnect will be refused
        send(entry.res, { type: "STREAM_REVOKED" });
        try { entry.res.end(); } catch { /* already gone */ }
      }
    }
  } catch (error) {
    console.warn("[SSE] access re-check failed:", error.message);
  }
}

const heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
const recheckTimer = setInterval(recheckStaffStreams, RECHECK_MS);
heartbeatTimer.unref?.();
recheckTimer.unref?.();

/** Ends every open stream (on shutdown, so the server can close instead of waiting forever) */
function closeAllStreams() {
  clearInterval(heartbeatTimer);
  clearInterval(recheckTimer);
  for (const map of [clients, customerClients]) {
    for (const group of map.values()) {
      for (const { res } of group.values()) {
        try { res.end(); } catch { /* ignore */ }
      }
    }
    map.clear();
  }
}

function streamStats() {
  const count = (map) => [...map.values()].reduce((s, g) => s + g.size, 0);
  return { staff: count(clients), customers: count(customerClients) };
}

module.exports = {
  subscribeToStore,
  subscribeToCustomer,
  broadcastToStore,
  broadcastToStoreStaff,
  broadcastToCustomer,
  closeAllStreams,
  streamStats
};
