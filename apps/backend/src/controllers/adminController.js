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
    const { name, email, avatar, ownerId } = req.body;

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

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changeUserRole,
  changeUserStatus,
};
