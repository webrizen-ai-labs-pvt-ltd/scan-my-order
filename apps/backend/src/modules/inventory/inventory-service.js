const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");

// Raw Materials
async function getMaterials(actor, storeId) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  return await prisma.rawMaterial.findMany({
    where: { storeId },
    orderBy: { name: 'asc' }
  });
}

async function createMaterial(actor, storeId, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  const { name, unit, lowStockThreshold } = input;
  
  if (!name || !unit) {
    throw createHttpError(400, "name and unit are required");
  }
  
  return await prisma.rawMaterial.create({
    data: {
      storeId,
      name,
      unit,
      lowStockThreshold: lowStockThreshold || 0,
      currentStock: 0 // initially 0, needs RESTOCK transaction to add stock
    }
  });
}

// Recipes
async function createRecipeIngredient(actor, storeId, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const { rawMaterialId, menuItemId, modifierOptionId, quantity } = input;
  
  if (!rawMaterialId || !quantity) {
    throw createHttpError(400, "rawMaterialId and quantity are required");
  }
  
  if (!menuItemId && !modifierOptionId) {
    throw createHttpError(400, "Either menuItemId or modifierOptionId is required");
  }
  
  // Verify raw material belongs to this store
  const material = await prisma.rawMaterial.findUnique({ where: { id: rawMaterialId } });
  if (!material || material.storeId !== storeId) {
    throw createHttpError(404, "RawMaterial not found for this store");
  }
  
  // Verify menu item / modifier option belongs to this store
  if (menuItemId) {
    const item = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!item || item.storeId !== storeId) {
      throw createHttpError(404, "MenuItem not found for this store");
    }
  } else if (modifierOptionId) {
    const opt = await prisma.menuModifierOption.findUnique({ 
      where: { id: modifierOptionId },
      include: { group: { include: { menuItem: true } } }
    });
    if (!opt || opt.group.menuItem.storeId !== storeId) {
      throw createHttpError(404, "MenuModifierOption not found for this store");
    }
  }

  return await prisma.recipeIngredient.create({
    data: {
      rawMaterialId,
      menuItemId,
      modifierOptionId,
      quantity
    }
  });
}

async function deleteRecipeIngredient(actor, storeId, recipeId) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();

  const recipe = await prisma.recipeIngredient.findUnique({
    where: { id: recipeId },
    include: { rawMaterial: true }
  });

  if (!recipe || recipe.rawMaterial.storeId !== storeId) {
    throw createHttpError(404, "Recipe ingredient not found");
  }

  await prisma.recipeIngredient.delete({
    where: { id: recipeId }
  });

  return { success: true };
}

// Safety Net Evaluation
// Whenever stock goes down, check items and modifiers relying on it.
async function evaluateMenuItemAvailability(prisma, rawMaterialId) {
  // Find all recipes that use this material
  const recipes = await prisma.recipeIngredient.findMany({
    where: { rawMaterialId },
    include: {
      rawMaterial: true
    }
  });
  
  if (!recipes.length) return;
  
  for (const recipe of recipes) {
    const stock = recipe.rawMaterial.currentStock;
    // If we don't have enough stock for one unit of the recipe
    if (stock < recipe.quantity) {
      if (recipe.menuItemId) {
        await prisma.menuItem.update({
          where: { id: recipe.menuItemId },
          data: { isSystemDisabled: true }
        });
      }
      if (recipe.modifierOptionId) {
         const opt = await prisma.menuModifierOption.findUnique({
           where: { id: recipe.modifierOptionId },
           include: { group: true }
         });
         if (opt) {
           await prisma.menuItem.update({
             where: { id: opt.group.menuItemId },
             data: { isSystemDisabled: true }
           });
         }
      }
    } else {
      // If stock is sufficient, we should flip it back to false, BUT only if ALL recipes for this item are satisfied.
      // To properly verify this, we need to check all ingredients for this item.
      let allSatisfied = true;
      let targetMenuItemId = recipe.menuItemId;

      if (recipe.modifierOptionId) {
         const opt = await prisma.menuModifierOption.findUnique({
           where: { id: recipe.modifierOptionId },
           include: { group: true }
         });
         if (opt) targetMenuItemId = opt.group.menuItemId;
      }

      if (targetMenuItemId) {
        const itemWithRecipes = await prisma.menuItem.findUnique({
          where: { id: targetMenuItemId },
          include: { 
            recipe: { include: { rawMaterial: true } },
            modifierGroups: {
              include: {
                options: { include: { recipe: { include: { rawMaterial: true } } } }
              }
            }
          }
        });

        if (itemWithRecipes) {
          // Check base recipes
          for (const req of itemWithRecipes.recipe) {
            if (req.rawMaterial.currentStock < req.quantity) {
              allSatisfied = false;
              break;
            }
          }

          // Check modifier recipes
          if (allSatisfied) {
            for (const group of itemWithRecipes.modifierGroups) {
              for (const opt of group.options) {
                for (const req of opt.recipe) {
                  if (req.rawMaterial.currentStock < req.quantity) {
                    allSatisfied = false;
                    break;
                  }
                }
              }
            }
          }

          if (allSatisfied) {
            await prisma.menuItem.update({
              where: { id: targetMenuItemId },
              data: { isSystemDisabled: false }
            });
          }
        }
      }
    }
  }
}

// Stock Transactions
async function addStockTransaction(actor, storeId, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const { materialId, type, quantity, reference } = input;
  
  if (!materialId || !type || quantity == null) {
    throw createHttpError(400, "materialId, type, and quantity are required");
  }
  
  // Verify material
  const material = await prisma.rawMaterial.findUnique({ where: { id: materialId } });
  if (!material || material.storeId !== storeId) {
    throw createHttpError(404, "RawMaterial not found");
  }
  
  let stockChange = 0;
  if (type === "RESTOCK") {
    stockChange = quantity;
  } else if (type === "CONSUME") {
    stockChange = -quantity;
  } else if (type === "ADJUST") {
    stockChange = quantity; // could be negative or positive depending on UI, let's assume quantity is absolute and adjustment dictates new total? 
    // Or simpler: adjustment is just a diff. We will treat ADJUST as a diff.
  }
  
  const newStock = material.currentStock + stockChange;
  
  // Run transaction
  const result = await prisma.$transaction(async (tx) => {
    const txn = await tx.stockTransaction.create({
      data: {
        materialId,
        type,
        quantity: stockChange,
        reference
      }
    });
    
    await tx.rawMaterial.update({
      where: { id: materialId },
      data: { currentStock: newStock }
    });
    
    // Evaluate if this material went out of stock or back in stock
    await evaluateMenuItemAvailability(tx, materialId);
    
    return txn;
  });
  
  return result;
}

module.exports = {
  getMaterials,
  createMaterial,
  createRecipeIngredient,
  deleteRecipeIngredient,
  addStockTransaction,
  evaluateMenuItemAvailability
};
