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
        operatingHours,
      },
    });

    return successResponse(res, "Store created successfully", store, 201);
  } catch (err) {
    console.error("createStore error:", err);
    return errorResponse(res, "Failed to create store", 500);
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
          _count: { select: { menuItems: true } },
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

async function addMenuItem(req, res) {
  try {
    const { id: storeId } = req.params;
    const { name, description, price, image, category, isAvailable } = req.body;

    if (!name || price === undefined) {
      return errorResponse(res, "Menu item name and price are required", 400);
    }

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return errorResponse(res, "Store not found", 404);
    }

    if (req.user.role === "OWNER" && store.ownerId !== req.user.id) {
      return errorResponse(res, "Unauthorized to add menu items to this store", 403);
    }

    const menuItem = await prisma.menuItem.create({
      data: {
        storeId,
        name,
        description,
        price: parseFloat(price),
        image,
        category,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
      },
    });

    return successResponse(res, "Menu item added successfully", menuItem, 201);
  } catch (err) {
    console.error("addMenuItem error:", err);
    return errorResponse(res, "Failed to add menu item", 500);
  }
}

module.exports = {
  createStore,
  listStores,
  getMyStore,
  getStore,
  updateStore,
  addMenuItem,
};
