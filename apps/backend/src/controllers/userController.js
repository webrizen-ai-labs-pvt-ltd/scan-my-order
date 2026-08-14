const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma.js");
const { successResponse, errorResponse } = require("../utils/response.js");

async function getProfile(req, res) {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatar: true,
        ownerId: true,
        storeId: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
        passkeys: {
          select: {
            id: true,
            credentialId: true,
            transports: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return errorResponse(res, "User profile not found", 404);
    }

    return successResponse(res, "Profile retrieved successfully", user);
  } catch (err) {
    console.error("getProfile error:", err);
    return errorResponse(res, "Failed to retrieve profile", 500);
  }
}

async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { name, avatar } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(avatar !== undefined && { avatar }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        updatedAt: true,
        passkeys: {
          select: {
            id: true,
            credentialId: true,
            transports: true,
            createdAt: true,
          },
        },
      },
    });

    return successResponse(res, "Profile updated successfully", user);
  } catch (err) {
    console.error("updateProfile error:", err);
    return errorResponse(res, "Failed to update profile", 500);
  }
}

async function deleteProfile(req, res) {
  try {
    const userId = req.user.id;
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        status: "INACTIVE",
      },
    });

    return successResponse(res, "Account deactivated successfully");
  } catch (err) {
    console.error("deleteProfile error:", err);
    return errorResponse(res, "Failed to deactivate account", 500);
  }
}

async function changePassword(req, res) {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return errorResponse(res, "Current password and new password are required", 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      return errorResponse(res, "Password login is not enabled for this account", 400);
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return errorResponse(res, "Current password is incorrect", 401);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return successResponse(res, "Password updated successfully");
  } catch (err) {
    console.error("changePassword error:", err);
    return errorResponse(res, "Failed to update password", 500);
  }
}

async function updateEmail(req, res) {
  try {
    const userId = req.user.id;
    const { email } = req.body;

    if (!email) {
      return errorResponse(res, "Email is required", 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.id !== userId) {
      return errorResponse(res, "This email address is already in use", 409);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { email },
      select: { id: true, email: true, name: true },
    });

    return successResponse(res, "Email updated successfully", user);
  } catch (err) {
    console.error("updateEmail error:", err);
    return errorResponse(res, "Failed to update email", 500);
  }
}

async function updateAvatar(req, res) {
  try {
    const userId = req.user.id;
    const { avatar } = req.body;

    if (!avatar) {
      return errorResponse(res, "Avatar URL is required", 400);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatar },
      select: { id: true, avatar: true },
    });

    return successResponse(res, "Avatar updated successfully", user);
  } catch (err) {
    console.error("updateAvatar error:", err);
    return errorResponse(res, "Failed to update avatar", 500);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  deleteProfile,
  changePassword,
  updateEmail,
  updateAvatar,
};
