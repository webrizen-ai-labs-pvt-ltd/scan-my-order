const { getPrismaClient } = require("../lib/prisma");
const { verifyJwt } = require("../lib/jwt");
const { userStatuses } = require("../constants/roles");
const { createHttpError } = require("./error-handler");

function readBearerToken(req) {
  const header = req.headers.authorization || "";

  if (header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }

  if (req.query && req.query.token) {
    return req.query.token;
  }

  return undefined;
}

async function authenticate(req, _res, next) {
  try {
    const token = readBearerToken(req);

    if (!token) {
      throw createHttpError(401, "Missing bearer token");
    }

    const payload = verifyJwt(token);
    const user = await getPrismaClient().user.findUnique({
      where: {
        id: payload.sub
      },
      include: {
        tenant: true,
        store: true
      }
    });

    if (!user || user.status !== userStatuses.active) {
      throw createHttpError(401, "Invalid or inactive user");
    }

    req.user = user;
    req.auth = payload;
    next();
  } catch (error) {
    next(error.statusCode ? error : createHttpError(401, "Invalid bearer token"));
  }
}

function authorizeRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(createHttpError(403, "You do not have permission for this action"));
      return;
    }

    next();
  };
}

module.exports = {
  authenticate,
  authorizeRoles,
  readBearerToken
};
