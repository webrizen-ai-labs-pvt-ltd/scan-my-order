const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");
const { broadcastToStore } = require("../orders/sse-service");

/**
 * Get reservations for a store with optional date, status, and table filters
 */
async function getReservations(actor, storeId, filters = {}) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();

  const where = { storeId };

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      where.status = { in: filters.status };
    } else {
      where.status = filters.status;
    }
  }

  if (filters.tableId) {
    where.tableId = filters.tableId;
  }

  if (filters.date) {
    const startDate = new Date(filters.date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(filters.date);
    endDate.setHours(23, 59, 59, 999);

    where.startsAt = {
      gte: startDate,
      lte: endDate
    };
  }

  return await prisma.tableReservation.findMany({
    where,
    include: {
      table: {
        select: {
          id: true,
          tableNumber: true,
          capacity: true,
          isActive: true
        }
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: { startsAt: 'asc' }
  });
}

/**
 * Check table availability for a specific time frame
 */
async function checkTableAvailability(actor, storeId, params = {}) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();

  const { startsAt: startStr, durationMinutes = 90, partySize } = params;
  if (!startStr) {
    throw createHttpError(400, "startsAt is required");
  }

  const startsAt = new Date(startStr);
  const endsAt = new Date(startsAt.getTime() + parseInt(durationMinutes, 10) * 60 * 1000);

  const tables = await prisma.table.findMany({
    where: { storeId, isActive: true },
    orderBy: { tableNumber: 'asc' }
  });

  // Find all conflicting reservations
  const conflicts = await prisma.tableReservation.findMany({
    where: {
      storeId,
      status: { in: ['CONFIRMED', 'SEATED'] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt }
    }
  });

  const conflictTableMap = new Map();
  conflicts.forEach(c => {
    conflictTableMap.set(c.tableId, c);
  });

  return tables.map(tbl => {
    const conflict = conflictTableMap.get(tbl.id);
    const isAvailable = !conflict && (!partySize || tbl.capacity >= parseInt(partySize, 10));
    return {
      tableId: tbl.id,
      tableNumber: tbl.tableNumber,
      capacity: tbl.capacity,
      isAvailable,
      conflictingReservation: conflict ? {
        id: conflict.id,
        guestName: conflict.guestName,
        startsAt: conflict.startsAt,
        endsAt: conflict.endsAt
      } : null
    };
  });
}

/**
 * Create a new table reservation with conflict detection
 */
async function createReservation(actor, storeId, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();

  const {
    tableId,
    guestName,
    guestPhone,
    partySize,
    startsAt: startsAtStr,
    durationMinutes = 90,
    notes
  } = input;

  if (!tableId || !guestName || !guestPhone || !startsAtStr) {
    throw createHttpError(400, "tableId, guestName, guestPhone, and startsAt are required");
  }

  const table = await prisma.table.findUnique({
    where: { id: tableId }
  });

  if (!table || table.storeId !== storeId) {
    throw createHttpError(404, "Table not found");
  }

  const startsAt = new Date(startsAtStr);
  if (isNaN(startsAt.getTime())) {
    throw createHttpError(400, "Invalid startsAt date format");
  }

  const duration = parseInt(durationMinutes, 10) || 90;
  const endsAt = input.endsAt ? new Date(input.endsAt) : new Date(startsAt.getTime() + duration * 60 * 1000);

  if (endsAt <= startsAt) {
    throw createHttpError(400, "Reservation end time must be after start time");
  }

  // Conflict detection: overlapping active reservations on the same table
  const conflict = await prisma.tableReservation.findFirst({
    where: {
      tableId,
      status: { in: ['CONFIRMED', 'SEATED'] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt }
    }
  });

  if (conflict) {
    const conflictStart = new Date(conflict.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const conflictEnd = new Date(conflict.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    throw createHttpError(409, `Table ${table.tableNumber} is already reserved by ${conflict.guestName} from ${conflictStart} to ${conflictEnd}`);
  }

  let validCreatedById = null;
  if (actor?.id) {
    const userExists = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true }
    });
    if (userExists) {
      validCreatedById = actor.id;
    }
  }

  const reservation = await prisma.tableReservation.create({
    data: {
      storeId,
      tableId,
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
      partySize: partySize ? parseInt(partySize, 10) : table.capacity || 2,
      notes: notes ? notes.trim() : null,
      startsAt,
      endsAt,
      status: 'CONFIRMED',
      createdById: validCreatedById
    },
    include: {
      table: {
        select: {
          id: true,
          tableNumber: true,
          capacity: true
        }
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  // Broadcast event via SSE to all active store listeners (floor plan, operations)
  broadcastToStore(storeId, 'RESERVATION_CREATED', reservation);

  return reservation;
}

/**
 * Update reservation details or status
 */
async function updateReservation(actor, storeId, reservationId, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();

  const reservation = await prisma.tableReservation.findUnique({
    where: { id: reservationId },
    include: { table: true }
  });

  if (!reservation || reservation.storeId !== storeId) {
    throw createHttpError(404, "Reservation not found");
  }

  const updateData = {};

  if (input.status !== undefined) {
    const validStatuses = ['CONFIRMED', 'SEATED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
    if (!validStatuses.includes(input.status)) {
      throw createHttpError(400, `Invalid status. Allowed values: ${validStatuses.join(', ')}`);
    }
    updateData.status = input.status;
  }

  if (input.guestName !== undefined) updateData.guestName = input.guestName.trim();
  if (input.guestPhone !== undefined) updateData.guestPhone = input.guestPhone.trim();
  if (input.partySize !== undefined) updateData.partySize = parseInt(input.partySize, 10);
  if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null;

  // Handle table or time changes with conflict check
  let targetTableId = reservation.tableId;
  let targetStartsAt = reservation.startsAt;
  let targetEndsAt = reservation.endsAt;

  if (input.tableId && input.tableId !== reservation.tableId) {
    const newTable = await prisma.table.findUnique({ where: { id: input.tableId } });
    if (!newTable || newTable.storeId !== storeId) throw createHttpError(404, "Target table not found");
    targetTableId = input.tableId;
    updateData.tableId = targetTableId;
  }

  if (input.startsAt) {
    targetStartsAt = new Date(input.startsAt);
    updateData.startsAt = targetStartsAt;
  }

  if (input.endsAt) {
    targetEndsAt = new Date(input.endsAt);
    updateData.endsAt = targetEndsAt;
  } else if (input.durationMinutes && input.startsAt) {
    targetEndsAt = new Date(targetStartsAt.getTime() + parseInt(input.durationMinutes, 10) * 60 * 1000);
    updateData.endsAt = targetEndsAt;
  }

  // If time or table changed and new status is active, check conflict
  const willBeActive = (updateData.status || reservation.status) === 'CONFIRMED' || (updateData.status || reservation.status) === 'SEATED';
  if ((input.tableId || input.startsAt || input.endsAt || input.durationMinutes) && willBeActive) {
    const conflict = await prisma.tableReservation.findFirst({
      where: {
        id: { not: reservationId },
        tableId: targetTableId,
        status: { in: ['CONFIRMED', 'SEATED'] },
        startsAt: { lt: targetEndsAt },
        endsAt: { gt: targetStartsAt }
      },
      include: { table: true }
    });

    if (conflict) {
      const conflictStart = new Date(conflict.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const conflictEnd = new Date(conflict.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      throw createHttpError(409, `Table ${conflict.table.tableNumber} is already reserved by ${conflict.guestName} from ${conflictStart} to ${conflictEnd}`);
    }
  }

  const updated = await prisma.tableReservation.update({
    where: { id: reservationId },
    data: updateData,
    include: {
      table: {
        select: {
          id: true,
          tableNumber: true,
          capacity: true
        }
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  // Broadcast update via SSE
  broadcastToStore(storeId, 'RESERVATION_UPDATED', updated);

  return updated;
}

/**
 * Delete / cancel a reservation
 */
async function deleteReservation(actor, storeId, reservationId) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();

  const reservation = await prisma.tableReservation.findUnique({
    where: { id: reservationId }
  });

  if (!reservation || reservation.storeId !== storeId) {
    throw createHttpError(404, "Reservation not found");
  }

  const deleted = await prisma.tableReservation.delete({
    where: { id: reservationId }
  });

  broadcastToStore(storeId, 'RESERVATION_DELETED', { id: reservationId, tableId: reservation.tableId });

  return deleted;
}

module.exports = {
  getReservations,
  checkTableAvailability,
  createReservation,
  updateReservation,
  deleteReservation
};
