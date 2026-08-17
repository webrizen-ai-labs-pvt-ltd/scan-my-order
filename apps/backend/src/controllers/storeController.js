const prisma = require("../config/prisma.js");
const { successResponse, errorResponse } = require("../utils/response.js");

async function createStore(req, res) {
  try {
    const ownerId = req.user.id;
    const { name, description, colorScheme, fontStyle, brandingLogo, operatingHours } = req.body;

    if (!name) {
      return errorResponse(res, "Store name is required", 400);
    }

    const store = await prisma.store.create({
      data: {
        name,
        description,
        ownerId,
        colorScheme,
        fontStyle,
        brandingLogo,
      },
    });
    return successResponse(res, "Store created successfully", store, 201);
  } catch (err) {
    console.error("createStore error:", err);
    return errorResponse(res, "Failed to create store", 500);
  }
}

async function onboardStore(req, res) {
  try {
    const ownerId = req.user.id;
    const {
      name,
      description,
      cuisineType,
      address,
      contactPhone,
      operatingHours,
      colorScheme,
      fontStyle,
      brandingLogo,
      tableCount,
      ownerName,
    } = req.body;

    if (!name) {
      return errorResponse(res, "Restaurant name is required for onboarding", 400);
    }

    // Optional: update owner name if provided
    if (ownerName) {
      await prisma.user.update({
        where: { id: ownerId },
        data: { name: ownerName },
      }).catch(() => {});
    }

    const fullDescription = [
      description,
      cuisineType ? `Cuisine: ${cuisineType}` : null,
      address ? `Address: ${address}` : null,
      contactPhone ? `Contact: ${contactPhone}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const store = await prisma.store.create({
      data: {
        name,
        description: fullDescription || description || "Modern Dining Outlet",
        ownerId,
        colorScheme: colorScheme || "amber",
        fontStyle: fontStyle || "inter",
        brandingLogo: brandingLogo || null,
        operatingHours: operatingHours || "10:00 AM - 11:00 PM",
      },
    });

    // Create default initial tables for QR ordering
    const numTables = parseInt(tableCount, 10) || 5;
    const tableData = Array.from({ length: Math.min(numTables, 50) }, (_, i) => ({
      number: String(i + 1).padStart(2, "0"),
      name: `Table ${String(i + 1).padStart(2, "0")}`,
      capacity: 4,
      section: "Main Dining",
      storeId: store.id,
    }));

    await prisma.table.createMany({
      data: tableData,
    }).catch(() => {});

    return successResponse(res, "Restaurant onboarded successfully", store, 201);
  } catch (err) {
    console.error("onboardStore error:", err);
    return errorResponse(res, "Failed to onboard store", 500);
  }
}

async function listStores(req, res) {
  try {
    const ownerId = req.user.role === "OWNER" ? req.user.id : undefined;

    const where = {};
    if (ownerId) where.ownerId = ownerId;

    const stores = await prisma.store.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { menuItems: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(res, "Stores retrieved successfully", stores);
  } catch (err) {
    console.error("listStores error:", err);
    return errorResponse(res, "Failed to retrieve stores", 500);
  }
}

async function getMyStore(req, res) {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let store = null;
    if (role === "OWNER") {
      store = await prisma.store.findFirst({
        where: { ownerId: userId },
        include: {
          _count: { select: { menuItems: true, tables: true } },
          subscriptions: { where: { status: "ACTIVE" }, include: { plan: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { store: { include: { store: true } } },
      });
      store = user?.store?.store || null;
    }

    return successResponse(res, "My store retrieved successfully", store);
  } catch (err) {
    console.error("getMyStore error:", err);
    return errorResponse(res, "Failed to retrieve store", 500);
  }
}

async function getStore(req, res) {
  try {
    const { id } = req.params;
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        menuItems: true,
        tables: true,
      },
    });

    if (!store) {
      return errorResponse(res, "Store not found", 404);
    }

    return successResponse(res, "Store details retrieved successfully", store);
  } catch (err) {
    console.error("getStore error:", err);
    return errorResponse(res, "Failed to retrieve store details", 500);
  }
}

async function updateStore(req, res) {
  try {
    const { id } = req.params;
    const { name, description, colorScheme, fontStyle, brandingLogo, operatingHours } = req.body;

    const existingStore = await prisma.store.findUnique({ where: { id } });
    if (!existingStore) {
      return errorResponse(res, "Store not found", 404);
    }

    if (req.user.role === "OWNER" && existingStore.ownerId !== req.user.id) {
      return errorResponse(res, "Unauthorized to update this store", 403);
    }

    const updatedStore = await prisma.store.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(colorScheme !== undefined ? { colorScheme } : {}),
        ...(fontStyle !== undefined ? { fontStyle } : {}),
        ...(brandingLogo !== undefined ? { brandingLogo } : {}),
        ...(operatingHours !== undefined ? { operatingHours } : {}),
      },
    });

    return successResponse(res, "Store updated successfully", updatedStore);
  } catch (err) {
    console.error("updateStore error:", err);
    return errorResponse(res, "Failed to update store", 500);
  }
}

// List all menu items for a store
async function listMenuItems(req, res) {
  try {
    const { id: storeId } = req.params;
    const menuItems = await prisma.menuItem.findMany({
      where: { storeId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return successResponse(res, "Store menu items retrieved", menuItems);
  } catch (err) {
    console.error("listMenuItems error:", err);
    return errorResponse(res, "Failed to retrieve menu items", 500);
  }
}

// Add new menu item to store
async function addMenuItem(req, res) {
  try {
    const { id: storeId } = req.params;
    const { name, description, price, image, category, isAvailable, dietaryType, spicinessLevel, prepTime, calories, allergens } = req.body;

    if (!name || price === undefined) {
      return errorResponse(res, "Menu item name and price are required", 400);
    }

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return errorResponse(res, "Store not found", 404);
    }

    const menuItem = await prisma.menuItem.create({
      data: {
        storeId,
        name,
        description,
        price: parseFloat(price),
        image,
        category: category || "Main Course",
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
        dietaryType: dietaryType || "VEG",
        spicinessLevel: spicinessLevel ? parseInt(spicinessLevel, 10) : 0,
        prepTime: prepTime ? parseInt(prepTime, 10) : 15,
        calories: calories ? parseInt(calories, 10) : undefined,
        allergens: allergens || "",
      },
    });

    return successResponse(res, "Menu item added successfully", menuItem, 201);
  } catch (err) {
    console.error("addMenuItem error:", err);
    return errorResponse(res, "Failed to add menu item", 500);
  }
}

// Update menu item
async function updateMenuItem(req, res) {
  try {
    const { itemId } = req.params;
    const { name, description, price, image, category, isAvailable, dietaryType, spicinessLevel, prepTime, calories, allergens } = req.body;

    const existingItem = await prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!existingItem) {
      return errorResponse(res, "Menu item not found", 404);
    }

    const updatedItem = await prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(image !== undefined && { image }),
        ...(category && { category }),
        ...(isAvailable !== undefined && { isAvailable: Boolean(isAvailable) }),
        ...(dietaryType && { dietaryType }),
        ...(spicinessLevel !== undefined && { spicinessLevel: parseInt(spicinessLevel, 10) }),
        ...(prepTime !== undefined && { prepTime: parseInt(prepTime, 10) }),
        ...(calories !== undefined && { calories: parseInt(calories, 10) }),
        ...(allergens !== undefined && { allergens }),
      },
    });

    return successResponse(res, "Menu item updated successfully", updatedItem);
  } catch (err) {
    console.error("updateMenuItem error:", err);
    return errorResponse(res, "Failed to update menu item", 500);
  }
}

// Delete menu item
async function deleteMenuItem(req, res) {
  try {
    const { itemId } = req.params;
    const existingItem = await prisma.menuItem.findUnique({ where: { id: itemId } });

    if (!existingItem) {
      return errorResponse(res, "Menu item not found", 404);
    }

    await prisma.menuItem.delete({ where: { id: itemId } });
    return successResponse(res, "Menu item deleted successfully");
  } catch (err) {
    console.error("deleteMenuItem error:", err);
    return errorResponse(res, "Failed to delete menu item", 500);
  }
}

module.exports = {
  createStore,
  onboardStore,
  listStores,
  getMyStore,
  getStore,
  updateStore,
  listMenuItems,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
};
