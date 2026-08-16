const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma.js");
const { successResponse, errorResponse } = require("../utils/response.js");

async function listUsers(req, res) {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "10", 10);
    const search = req.query.search || "";
    const role = req.query.role;
    const status = req.query.status;

    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          avatar: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    const meta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    return successResponse(res, "Users retrieved successfully", users, 200, meta);
  } catch (err) {
    console.error("Admin listUsers error:", err);
    return errorResponse(res, "Failed to retrieve users", 500);
  }
}

async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatar: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        employees: {
          select: { id: true, name: true, email: true, role: true, status: true },
        },
        ownedStores: {
          select: { id: true, name: true, description: true },
        },
      },
    });

    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    return successResponse(res, "User details retrieved successfully", user);
  } catch (err) {
    console.error("Admin getUserById error:", err);
    return errorResponse(res, "Failed to retrieve user details", 500);
  }
}

async function createUser(req, res) {
  try {
    const { email, password, name, role, ownerId, storeId } = req.body;

    if (!email || !password || !name || !role) {
      return errorResponse(res, "Email, password, name, and role are required", 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return errorResponse(res, "User with this email already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        ownerId: ownerId || null,
        storeId: storeId || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        ownerId: true,
        createdAt: true,
      },
    });

    return successResponse(res, "User created successfully", user, 201);
  } catch (err) {
    console.error("Admin createUser error:", err);
    return errorResponse(res, "Failed to create user", 500);
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { name, email, avatar, ownerId, role, status } = req.body;

    const existingUser = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existingUser) {
      return errorResponse(res, "User not found", 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(avatar !== undefined && { avatar }),
        ...(ownerId !== undefined && { ownerId }),
        ...(role && { role }),
        ...(status && { status }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatar: true,
        ownerId: true,
        updatedAt: true,
      },
    });

    return successResponse(res, "User updated successfully", updatedUser);
  } catch (err) {
    console.error("Admin updateUser error:", err);
    return errorResponse(res, "Failed to update user", 500);
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });

    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    // Soft delete
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: "INACTIVE",
      },
    });

    return successResponse(res, "User deactivated/deleted successfully");
  } catch (err) {
    console.error("Admin deleteUser error:", err);
    return errorResponse(res, "Failed to delete user", 500);
  }
}

async function changeUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return errorResponse(res, "Role is required", 400);
    }

    const validRoles = ["ADMIN", "OWNER", "MANAGER", "WAITER", "KITCHEN", "CUSTOMER"];
    if (!validRoles.includes(role)) {
      return errorResponse(res, `Invalid role. Must be one of: ${validRoles.join(", ")}`, 400);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });

    return successResponse(res, "User role updated successfully", user);
  } catch (err) {
    console.error("Admin changeUserRole error:", err);
    return errorResponse(res, "Failed to update user role", 500);
  }
}

async function changeUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return errorResponse(res, "Status is required", 400);
    }

    const validStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED"];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, `Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, name: true, email: true, status: true },
    });

    return successResponse(res, "User status updated successfully", user);
  } catch (err) {
    console.error("Admin changeUserStatus error:", err);
    return errorResponse(res, "Failed to update user status", 500);
  }
}

async function listStores(req, res) {
  try {
    const stores = await prisma.store.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { menuItems: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(res, "Stores retrieved successfully", stores);
  } catch (err) {
    console.error("Admin listStores error:", err);
    return errorResponse(res, "Failed to retrieve stores", 500);
  }
}

async function getStoreById(req, res) {
  try {
    const { id } = req.params;
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
        menuItems: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!store) {
      return errorResponse(res, "Store not found", 404);
    }

    return successResponse(res, "Store details retrieved successfully", store);
  } catch (err) {
    console.error("Admin getStoreById error:", err);
    return errorResponse(res, "Failed to retrieve store details", 500);
  }
}

async function updateStore(req, res) {
  try {
    const { id } = req.params;
    const { name, description, brandingLogo, colorScheme, fontStyle, operatingHours, ownerId } = req.body;

    const existingStore = await prisma.store.findUnique({ where: { id } });
    if (!existingStore) {
      return errorResponse(res, "Store not found", 404);
    }

    const updatedStore = await prisma.store.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(brandingLogo !== undefined && { brandingLogo }),
        ...(colorScheme !== undefined && { colorScheme }),
        ...(fontStyle !== undefined && { fontStyle }),
        ...(operatingHours !== undefined && { operatingHours }),
        ...(ownerId && { ownerId }),
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    return successResponse(res, "Store details updated successfully", updatedStore);
  } catch (err) {
    console.error("Admin updateStore error:", err);
    return errorResponse(res, "Failed to update store details", 500);
  }
}

async function deleteStore(req, res) {
  try {
    const { id } = req.params;
    const store = await prisma.store.findUnique({ where: { id } });
    if (!store) {
      return errorResponse(res, "Store not found", 404);
    }

    await prisma.store.delete({ where: { id } });
    return successResponse(res, "Store deleted successfully");
  } catch (err) {
    console.error("Admin deleteStore error:", err);
    return errorResponse(res, "Failed to delete store", 500);
  }
}

async function onboardStore(req, res) {
  try {
    const { name, description, ownerId, newOwner, colorScheme, fontStyle, brandingLogo, operatingHours } = req.body;

    if (!name) {
      return errorResponse(res, "Store name is required", 400);
    }

    let finalOwnerId = ownerId;

    if (newOwner && newOwner.email && newOwner.password && newOwner.name) {
      const existingUser = await prisma.user.findUnique({ where: { email: newOwner.email } });
      if (existingUser) {
        return errorResponse(res, "User with this email already exists", 409);
      }

      const hashedPassword = await bcrypt.hash(newOwner.password, 10);
      const createdOwner = await prisma.user.create({
        data: {
          email: newOwner.email,
          password: hashedPassword,
          name: newOwner.name,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      finalOwnerId = createdOwner.id;
    }

    if (!finalOwnerId) {
      return errorResponse(res, "Store owner ID or new owner credentials are required", 400);
    }

    const store = await prisma.store.create({
      data: {
        name,
        description,
        ownerId: finalOwnerId,
        colorScheme,
        fontStyle,
        brandingLogo,
        operatingHours,
      },
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return successResponse(res, "Store onboarded successfully", store, 201);
  } catch (err) {
    console.error("Admin onboardStore error:", err);
    return errorResponse(res, "Failed to onboard store", 500);
  }
}

async function createMenuItem(req, res) {
  try {
    const { id: storeId } = req.params;
    const {
      name,
      description,
      price,
      image,
      category,
      isAvailable,
      dietaryType,
      spicinessLevel,
      prepTime,
      calories,
      allergens,
    } = req.body;

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
        category: category || "General",
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
        dietaryType: dietaryType || "VEG",
        spicinessLevel: spicinessLevel !== undefined ? parseInt(spicinessLevel, 10) : 0,
        prepTime: prepTime !== undefined && prepTime !== "" ? parseInt(prepTime, 10) : null,
        calories: calories !== undefined && calories !== "" ? parseInt(calories, 10) : null,
        allergens: allergens || null,
      },
    });

    return successResponse(res, "Menu item created successfully", menuItem, 201);
  } catch (err) {
    console.error("Admin createMenuItem error:", err);
    return errorResponse(res, "Failed to create menu item", 500);
  }
}

async function updateMenuItem(req, res) {
  try {
    const { id: storeId, itemId } = req.params;
    const {
      name,
      description,
      price,
      image,
      category,
      isAvailable,
      dietaryType,
      spicinessLevel,
      prepTime,
      calories,
      allergens,
    } = req.body;

    const existingItem = await prisma.menuItem.findFirst({
      where: { id: itemId, storeId },
    });

    if (!existingItem) {
      return errorResponse(res, "Menu item not found for this store", 404);
    }

    const updatedItem = await prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(image !== undefined && { image }),
        ...(category !== undefined && { category }),
        ...(isAvailable !== undefined && { isAvailable: Boolean(isAvailable) }),
        ...(dietaryType && { dietaryType }),
        ...(spicinessLevel !== undefined && { spicinessLevel: parseInt(spicinessLevel, 10) }),
        ...(prepTime !== undefined && { prepTime: prepTime !== "" ? parseInt(prepTime, 10) : null }),
        ...(calories !== undefined && { calories: calories !== "" ? parseInt(calories, 10) : null }),
        ...(allergens !== undefined && { allergens }),
      },
    });

    return successResponse(res, "Menu item updated successfully", updatedItem);
  } catch (err) {
    console.error("Admin updateMenuItem error:", err);
    return errorResponse(res, "Failed to update menu item", 500);
  }
}

async function deleteMenuItem(req, res) {
  try {
    const { id: storeId, itemId } = req.params;
    const existingItem = await prisma.menuItem.findFirst({
      where: { id: itemId, storeId },
    });

    if (!existingItem) {
      return errorResponse(res, "Menu item not found", 404);
    }

    await prisma.menuItem.delete({ where: { id: itemId } });
    return successResponse(res, "Menu item deleted successfully");
  } catch (err) {
    console.error("Admin deleteMenuItem error:", err);
    return errorResponse(res, "Failed to delete menu item", 500);
  }
}

async function toggleMenuItemAvailability(req, res) {
  try {
    const { id: storeId, itemId } = req.params;
    const existingItem = await prisma.menuItem.findFirst({
      where: { id: itemId, storeId },
    });

    if (!existingItem) {
      return errorResponse(res, "Menu item not found", 404);
    }

    const updatedItem = await prisma.menuItem.update({
      where: { id: itemId },
      data: { isAvailable: !existingItem.isAvailable },
    });

    return successResponse(res, "Menu item availability toggled", updatedItem);
  } catch (err) {
    console.error("Admin toggleMenuItemAvailability error:", err);
    return errorResponse(res, "Failed to toggle menu item availability", 500);
  }
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changeUserRole,
  changeUserStatus,
  listStores,
  getStoreById,
  updateStore,
  deleteStore,
  onboardStore,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleMenuItemAvailability,
};
