const { verifyToken } = require("../utils/jwt.js");
const { errorResponse } = require("../utils/response.js");
const prisma = require("../config/prisma.js");

async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return errorResponse(res, "Access token is required", 401);
  }

  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    return errorResponse(res, "Invalid or expired access token", 401);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        ownerId: true,
        storeId: true,
        avatar: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      return errorResponse(res, "User account not found or has been deactivated", 401);
    }

    if (user.status !== "ACTIVE") {
      return errorResponse(res, `Account is ${user.status.toLowerCase()}`, 403);
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return errorResponse(res, "Internal authentication error", 500);
  }
}

module.exports = {
  authenticateToken,
};
