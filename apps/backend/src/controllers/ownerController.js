const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma.js");
const { successResponse, errorResponse } = require("../utils/response.js");

async function listEmployees(req, res) {
  try {
    const ownerId = req.user.id;
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "10", 10);
    const role = req.query.role;
    const status = req.query.status;

    const skip = (page - 1) * limit;

    const where = {
      ownerId,
      deletedAt: null,
      role: { in: ["MANAGER", "WAITER", "KITCHEN"] },
    };

    if (role) where.role = role;
    if (status) where.status = status;

    const [employees, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          avatar: true,
          createdAt: true,
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

    return successResponse(res, "Employees retrieved successfully", employees, 200, meta);
  } catch (err) {
    console.error("Owner listEmployees error:", err);
    return errorResponse(res, "Failed to retrieve employees", 500);
  }
}

async function getEmployeeById(req, res) {
  try {
    const ownerId = req.user.id;
    const { id } = req.params;

    const employee = await prisma.user.findFirst({
      where: {
        id,
        ownerId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!employee) {
      return errorResponse(res, "Employee not found or does not belong to your account", 404);
    }

    return successResponse(res, "Employee details retrieved successfully", employee);
  } catch (err) {
    console.error("Owner getEmployeeById error:", err);
    return errorResponse(res, "Failed to retrieve employee details", 500);
  }
}

async function createEmployee(req, res) {
  try {
    const ownerId = req.user.id;
    const { email, password, name, role } = req.body;

    if (!email || !password || !name || !role) {
      return errorResponse(res, "Email, password, name, and role are required", 400);
    }

    const allowedRoles = ["MANAGER", "WAITER", "KITCHEN"];
    if (!allowedRoles.includes(role)) {
      return errorResponse(res, `Invalid employee role. Must be one of: ${allowedRoles.join(", ")}`, 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return errorResponse(res, "User with this email already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const employee = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        ownerId,
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

    return successResponse(res, "Employee account created successfully", employee, 201);
  } catch (err) {
    console.error("Owner createEmployee error:", err);
    return errorResponse(res, "Failed to create employee account", 500);
  }
}

async function updateEmployee(req, res) {
  try {
    const ownerId = req.user.id;
    const { id } = req.params;
    const { name, email, avatar } = req.body;

    const employee = await prisma.user.findFirst({
      where: { id, ownerId, deletedAt: null },
    });

    if (!employee) {
      return errorResponse(res, "Employee not found or unauthorized", 404);
    }

    const updatedEmployee = await prisma.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(avatar !== undefined && { avatar }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatar: true,
        updatedAt: true,
      },
    });

    return successResponse(res, "Employee details updated successfully", updatedEmployee);
  } catch (err) {
    console.error("Owner updateEmployee error:", err);
    return errorResponse(res, "Failed to update employee details", 500);
  }
}

async function removeEmployee(req, res) {
  try {
    const ownerId = req.user.id;
    const { id } = req.params;

    const employee = await prisma.user.findFirst({
      where: { id, ownerId, deletedAt: null },
    });

    if (!employee) {
      return errorResponse(res, "Employee not found or unauthorized", 404);
    }

    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: "INACTIVE",
        ownerId: null,
      },
    });

    return successResponse(res, "Employee removed successfully");
  } catch (err) {
    console.error("Owner removeEmployee error:", err);
    return errorResponse(res, "Failed to remove employee", 500);
  }
}

async function changeEmployeeRole(req, res) {
  try {
    const ownerId = req.user.id;
    const { id } = req.params;
    const { role } = req.body;

    const allowedRoles = ["MANAGER", "WAITER", "KITCHEN"];
    if (!role || !allowedRoles.includes(role)) {
      return errorResponse(res, `Invalid role. Allowed employee roles: ${allowedRoles.join(", ")}`, 400);
    }

    const employee = await prisma.user.findFirst({
      where: { id, ownerId, deletedAt: null },
    });

    if (!employee) {
      return errorResponse(res, "Employee not found or unauthorized", 404);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });

    return successResponse(res, "Employee role updated successfully", updated);
  } catch (err) {
    console.error("Owner changeEmployeeRole error:", err);
    return errorResponse(res, "Failed to update employee role", 500);
  }
}

async function changeEmployeeStatus(req, res) {
  try {
    const ownerId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED"];
    if (!status || !validStatuses.includes(status)) {
      return errorResponse(res, `Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400);
    }

    const employee = await prisma.user.findFirst({
      where: { id, ownerId, deletedAt: null },
    });

    if (!employee) {
      return errorResponse(res, "Employee not found or unauthorized", 404);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, name: true, email: true, status: true },
    });

    return successResponse(res, "Employee status updated successfully", updated);
  } catch (err) {
    console.error("Owner changeEmployeeStatus error:", err);
    return errorResponse(res, "Failed to update employee status", 500);
  }
}

module.exports = {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  removeEmployee,
  changeEmployeeRole,
  changeEmployeeStatus,
};
