const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");

async function getTables(actor, storeId) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  return await prisma.table.findMany({
    where: { storeId },
    orderBy: { tableNumber: 'asc' }
  });
}

async function createTable(actor, storeId, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  const { tableNumber } = input;
  
  if (typeof tableNumber !== "number") {
    throw createHttpError(400, "tableNumber is required and must be a number");
  }
  
  // Check if tableNumber already exists for this store
  const existing = await prisma.table.findUnique({
    where: {
      storeId_tableNumber: {
        storeId,
        tableNumber
      }
    }
  });
  
  if (existing) {
    throw createHttpError(409, `Table number ${tableNumber} already exists`);
  }
  
  return await prisma.table.create({
    data: {
      storeId,
      tableNumber
    }
  });
}

async function deleteTable(actor, storeId, tableId) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const table = await prisma.table.findUnique({ where: { id: tableId } });
  if (!table || table.storeId !== storeId) {
    throw createHttpError(404, "Table not found");
  }
  
  // Alternatively, just mark isActive = false if you want soft delete
  return await prisma.table.delete({
    where: { id: tableId }
  });
}

module.exports = {
  getTables,
  createTable,
  deleteTable
};
