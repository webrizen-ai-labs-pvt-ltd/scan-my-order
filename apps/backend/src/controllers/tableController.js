const prisma = require("../config/prisma.js");
const { successResponse, errorResponse } = require("../utils/response.js");

// List all tables for a store
async function listStoreTables(req, res) {
  try {
    const { storeId } = req.query;
    const userId = req.user?.id || req.user?.userId;

    let targetStoreId = storeId;

    // If storeId not explicitly passed, find store linked to the user
    if (!targetStoreId && userId) {
      const ownedStore = await prisma.store.findFirst({
        where: { ownerId: userId },
        select: { id: true },
      });
      if (ownedStore) {
        targetStoreId = ownedStore.id;
      }
    }

    if (!targetStoreId) {
      return errorResponse(res, "Store ID is required to fetch tables", 400);
    }

    const tables = await prisma.table.findMany({
      where: { storeId: targetStoreId },
      orderBy: [{ section: "asc" }, { number: "asc" }],
    });

    return successResponse(res, "Store tables retrieved successfully", tables);
  } catch (err) {
    console.error("listStoreTables error:", err);
    return errorResponse(res, "Failed to retrieve store tables", 500);
  }
}

// Get single table by ID
async function getTableById(req, res) {
  try {
    const { id } = req.params;
    const table = await prisma.table.findUnique({
      where: { id },
      include: { store: { select: { id: true, name: true } } },
    });

    if (!table) {
      return errorResponse(res, "Table not found", 404);
    }

    return successResponse(res, "Table details retrieved", table);
  } catch (err) {
    console.error("getTableById error:", err);
    return errorResponse(res, "Failed to retrieve table details", 500);
  }
}

// Create new table
async function createTable(req, res) {
  try {
    const { storeId, number, name, capacity, section, status } = req.body;
    const userId = req.user?.id || req.user?.userId;

    let targetStoreId = storeId;

    if (!targetStoreId && userId) {
      const ownedStore = await prisma.store.findFirst({
        where: { ownerId: userId },
        select: { id: true },
      });
      if (ownedStore) targetStoreId = ownedStore.id;
    }

    if (!targetStoreId || !number) {
      return errorResponse(res, "Store ID and Table Number are required", 400);
    }

    // Check for duplicate table number within the same store
    const existingTable = await prisma.table.findFirst({
      where: {
        storeId: targetStoreId,
        number: String(number).trim(),
      },
    });

    if (existingTable) {
      return errorResponse(res, `Table number "${number}" already exists in this store`, 409);
    }

    const parsedCapacity = capacity ? parseInt(capacity, 10) : 4;
    const formattedNumber = String(number).trim();

    const table = await prisma.table.create({
      data: {
        storeId: targetStoreId,
        number: formattedNumber,
        name: name ? String(name).trim() : `Table ${formattedNumber}`,
        capacity: parsedCapacity,
        section: section ? String(section).trim() : "Main Dining",
        status: status || "AVAILABLE",
      },
    });

    return successResponse(res, "Table created successfully", table, 201);
  } catch (err) {
    console.error("createTable error:", err);
    return errorResponse(res, "Failed to create table", 500);
  }
}

// Update table details or seating status
async function updateTable(req, res) {
  try {
    const { id } = req.params;
    const { number, name, capacity, section, status } = req.body;

    const existingTable = await prisma.table.findUnique({ where: { id } });
    if (!existingTable) {
      return errorResponse(res, "Table not found", 404);
    }

    // If table number is changing, check for duplicate
    if (number && String(number).trim() !== existingTable.number) {
      const duplicate = await prisma.table.findFirst({
        where: {
          storeId: existingTable.storeId,
          number: String(number).trim(),
          id: { not: id },
        },
      });
      if (duplicate) {
        return errorResponse(res, `Table number "${number}" already exists in this store`, 409);
      }
    }

    const updatedTable = await prisma.table.update({
      where: { id },
      data: {
        ...(number && { number: String(number).trim() }),
        ...(name !== undefined && { name: String(name).trim() }),
        ...(capacity !== undefined && { capacity: parseInt(capacity, 10) }),
        ...(section !== undefined && { section: String(section).trim() }),
        ...(status && { status }),
      },
    });

    return successResponse(res, "Table updated successfully", updatedTable);
  } catch (err) {
    console.error("updateTable error:", err);
    return errorResponse(res, "Failed to update table", 500);
  }
}

// Delete table
async function deleteTable(req, res) {
  try {
    const { id } = req.params;
    const existingTable = await prisma.table.findUnique({ where: { id } });

    if (!existingTable) {
      return errorResponse(res, "Table not found", 404);
    }

    await prisma.table.delete({ where: { id } });
    return successResponse(res, "Table deleted successfully");
  } catch (err) {
    console.error("deleteTable error:", err);
    return errorResponse(res, "Failed to delete table", 500);
  }
}

module.exports = {
  listStoreTables,
  getTableById,
  createTable,
  updateTable,
  deleteTable,
};
