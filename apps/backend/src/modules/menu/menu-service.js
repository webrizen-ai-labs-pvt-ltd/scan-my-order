const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { userRoles } = require("../../constants/roles");

// Helper to check if actor has access to modify a store's data
async function verifyStoreAccess(actor, storeId) {
  if (actor.role === userRoles.superAdmin) return;
  
  if (actor.role === userRoles.tenantAdmin) {
    const prisma = getPrismaClient();
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { tenantId: true }
    });
    if (!store || store.tenantId !== actor.tenantId) {
      throw createHttpError(403, "Forbidden");
    }
    return;
  }
  
  if ([userRoles.storeManager].includes(actor.role)) {
    if (actor.storeId !== storeId) {
      throw createHttpError(403, "Forbidden");
    }
    return;
  }
  
  throw createHttpError(403, "Forbidden");
}

async function getFullMenu(actor, storeId) {
  // If actor is provided, do access check
  if (actor) await verifyStoreAccess(actor, storeId);
  
  const prisma = getPrismaClient();
  const categories = await prisma.menuCategory.findMany({
    where: { storeId },
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        include: {
          recipe: { include: { rawMaterial: true } },
          modifierGroups: {
            include: {
              options: {
                include: { recipe: { include: { rawMaterial: true } } }
              }
            }
          }
        }
      }
    }
  });
  
  return categories;
}

// Menu Categories
async function createCategory(actor, storeId, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  const { name, description, sortOrder } = input;
  
  if (!name) throw createHttpError(400, "Category name is required");
  
  return await prisma.menuCategory.create({
    data: { storeId, name, description, sortOrder }
  });
}

async function updateCategory(actor, storeId, id, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  const { name, description, sortOrder } = input;
  
  const category = await prisma.menuCategory.findUnique({ where: { id } });
  if (!category || category.storeId !== storeId) throw createHttpError(404, "Category not found");
  
  return await prisma.menuCategory.update({
    where: { id },
    data: { name, description, sortOrder }
  });
}

async function deleteCategory(actor, storeId, id) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const category = await prisma.menuCategory.findUnique({ where: { id } });
  if (!category || category.storeId !== storeId) throw createHttpError(404, "Category not found");
  
  return await prisma.menuCategory.delete({ where: { id } });
}

// Menu Items
async function createMenuItem(actor, storeId, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  const { categoryId, name, description, price, image, dietary, spiceLevel } = input;
  
  if (!categoryId || !name || price == null) {
    throw createHttpError(400, "categoryId, name, and price are required");
  }
  
  // Verify category belongs to store
  const category = await prisma.menuCategory.findUnique({ where: { id: categoryId } });
  if (!category || category.storeId !== storeId) {
    throw createHttpError(404, "MenuCategory not found for this store");
  }
  
  return await prisma.menuItem.create({
    data: {
      storeId,
      categoryId,
      name,
      description,
      price,
      image,
      dietary,
      spiceLevel
    }
  });
}

async function updateMenuItem(actor, storeId, id, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  const { categoryId, name, description, price, image, dietary, spiceLevel, isManuallyDisabled } = input;
  
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item || item.storeId !== storeId) throw createHttpError(404, "MenuItem not found");
  
  if (categoryId) {
    const category = await prisma.menuCategory.findUnique({ where: { id: categoryId } });
    if (!category || category.storeId !== storeId) throw createHttpError(404, "MenuCategory not found");
  }
  
  return await prisma.menuItem.update({
    where: { id },
    data: { categoryId, name, description, price, image, dietary, spiceLevel, isManuallyDisabled }
  });
}

async function deleteMenuItem(actor, storeId, id) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item || item.storeId !== storeId) throw createHttpError(404, "MenuItem not found");
  
  return await prisma.menuItem.delete({ where: { id } });
}

// Modifier Groups
async function createModifierGroup(actor, storeId, itemId, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  // Verify item belongs to store
  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  if (!item || item.storeId !== storeId) {
    throw createHttpError(404, "MenuItem not found for this store");
  }
  
  const { name, isRequired, minSelections, maxSelections } = input;
  
  if (!name) throw createHttpError(400, "Group name is required");
  
  return await prisma.menuModifierGroup.create({
    data: {
      menuItemId: itemId,
      name,
      isRequired,
      minSelections,
      maxSelections
    }
  });
}

async function updateModifierGroup(actor, storeId, id, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const group = await prisma.menuModifierGroup.findUnique({ 
    where: { id }, include: { menuItem: true } 
  });
  if (!group || group.menuItem.storeId !== storeId) throw createHttpError(404, "Modifier group not found");
  
  const { name, isRequired, minSelections, maxSelections } = input;
  return await prisma.menuModifierGroup.update({
    where: { id },
    data: { name, isRequired, minSelections, maxSelections }
  });
}

async function deleteModifierGroup(actor, storeId, id) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const group = await prisma.menuModifierGroup.findUnique({ 
    where: { id }, include: { menuItem: true } 
  });
  if (!group || group.menuItem.storeId !== storeId) throw createHttpError(404, "Modifier group not found");
  
  return await prisma.menuModifierGroup.delete({ where: { id } });
}

// Modifier Options
async function createModifierOption(actor, storeId, groupId, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  // Verify group -> item -> store
  const group = await prisma.menuModifierGroup.findUnique({ 
    where: { id: groupId },
    include: { menuItem: true }
  });
  
  if (!group || group.menuItem.storeId !== storeId) {
    throw createHttpError(404, "MenuModifierGroup not found for this store");
  }
  
  const { name, price } = input;
  
  if (!name) throw createHttpError(400, "Option name is required");
  
  return await prisma.menuModifierOption.create({
    data: {
      groupId,
      name,
      price
    }
  });
}

async function updateModifierOption(actor, storeId, id, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const option = await prisma.menuModifierOption.findUnique({ 
    where: { id }, include: { group: { include: { menuItem: true } } } 
  });
  if (!option || option.group.menuItem.storeId !== storeId) throw createHttpError(404, "Modifier option not found");
  
  const { name, price } = input;
  return await prisma.menuModifierOption.update({
    where: { id },
    data: { name, price }
  });
}

async function deleteModifierOption(actor, storeId, id) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const option = await prisma.menuModifierOption.findUnique({ 
    where: { id }, include: { group: { include: { menuItem: true } } } 
  });
  if (!option || option.group.menuItem.storeId !== storeId) throw createHttpError(404, "Modifier option not found");
  
  return await prisma.menuModifierOption.delete({ where: { id } });
}

module.exports = {
  getFullMenu,
  createCategory, updateCategory, deleteCategory,
  createMenuItem, updateMenuItem, deleteMenuItem,
  createModifierGroup, updateModifierGroup, deleteModifierGroup,
  createModifierOption, updateModifierOption, deleteModifierOption,
  verifyStoreAccess
};
