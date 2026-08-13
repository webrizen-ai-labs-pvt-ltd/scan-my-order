const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const prisma = require("../config/prisma.js");
const { generateToken } = require("../utils/jwt.js");
const { successResponse, errorResponse } = require("../utils/response.js");
const { sendPasswordResetEmail } = require("../utils/mailer.js");
const {
  getPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  getPasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
} = require("../utils/passkey.js");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function register(req, res) {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return errorResponse(res, "Email, password, and name are required fields", 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return errorResponse(res, "User with this email already exists", 409);
    }

    const allowedRoles = ["CUSTOMER", "OWNER"];
    const targetRole = allowedRoles.includes(role) ? role : "CUSTOMER";

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: targetRole,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    const token = generateToken({ userId: user.id, role: user.role });
    return successResponse(res, "Registration successful", { user, token }, 201);
  } catch (err) {
    console.error("Register error:", err);
    return errorResponse(res, "Internal server error during registration", 500);
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, "Email and password are required", 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) {
      return errorResponse(res, "Invalid email or password", 401);
    }

    if (user.status !== "ACTIVE") {
      return errorResponse(res, `Account is ${user.status.toLowerCase()}`, 403);
    }

    if (!user.password) {
      return errorResponse(res, "Please log in using Google OAuth or Passkey", 400);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return errorResponse(res, "Invalid email or password", 401);
    }

    const token = generateToken({ userId: user.id, role: user.role });
    const userPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatar: user.avatar,
    };

    return successResponse(res, "Login successful", { user: userPayload, token });
  } catch (err) {
    console.error("Login error:", err);
    return errorResponse(res, "Internal server error during login", 500);
  }
}

async function googleAuth(req, res) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return errorResponse(res, "Google ID token is required", 400);
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (e) {
      // Mock fallback for development if client ID is mock
      if (process.env.NODE_ENV === "development") {
        payload = {
          sub: `mock-google-id-${Date.now()}`,
          email: "mockuser@gmail.com",
          name: "Mock Google User",
          picture: "https://via.placeholder.com/150",
        };
      } else {
        return errorResponse(res, "Invalid Google ID token", 401);
      }
    }

    const { sub: googleId, email, name, picture } = payload;
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
    });

    if (user) {
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, avatar: picture || user.avatar },
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          email,
          name,
          googleId,
          avatar: picture,
          role: "CUSTOMER",
        },
      });
    }

    const token = generateToken({ userId: user.id, role: user.role });
    return successResponse(res, "Google authentication successful", {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
      token,
    });
  } catch (err) {
    console.error("Google OAuth error:", err);
    return errorResponse(res, "Internal server error during Google authentication", 500);
  }
}

async function passkeyRegisterOptions(req, res) {
  try {
    const user = req.user;
    const options = await getPasskeyRegistrationOptions(user);
    return successResponse(res, "Passkey registration options generated", options);
  } catch (err) {
    console.error("Passkey register options error:", err);
    return errorResponse(res, "Failed to generate passkey registration options", 500);
  }
}

async function passkeyRegisterVerify(req, res) {
  try {
    const user = req.user;
    const { response } = req.body;

    if (!response) {
      return errorResponse(res, "Passkey response is required", 400);
    }

    const verification = await verifyPasskeyRegistration(user, response);
    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;

      await prisma.passkey.create({
        data: {
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          transports: credential.transports ? credential.transports.join(",") : null,
          userId: user.id,
        },
      });

      return successResponse(res, "Passkey successfully registered");
    }

    return errorResponse(res, "Passkey registration verification failed", 400);
  } catch (err) {
    console.error("Passkey register verify error:", err);
    return errorResponse(res, err.message || "Passkey registration verification failed", 400);
  }
}

async function passkeyAuthOptions(req, res) {
  try {
    const { email } = req.body;
    let passkeys = [];
    if (email) {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { passkeys: true },
      });
      if (user) passkeys = user.passkeys;
    }

    const { options, challengeKey } = await getPasskeyAuthenticationOptions(passkeys);
    return successResponse(res, "Passkey authentication options generated", { options, challengeKey });
  } catch (err) {
    console.error("Passkey auth options error:", err);
    return errorResponse(res, "Failed to generate passkey authentication options", 500);
  }
}

async function passkeyAuthVerify(req, res) {
  try {
    const { response, challengeKey } = req.body;

    if (!response || !response.id || !challengeKey) {
      return errorResponse(res, "Response and challenge key are required", 400);
    }

    const passkey = await prisma.passkey.findUnique({
      where: { credentialId: response.id },
      include: { user: true },
    });

    if (!passkey || !passkey.user || passkey.user.deletedAt) {
      return errorResponse(res, "Passkey credential not found or account deactivated", 404);
    }

    const verification = await verifyPasskeyAuthentication(response, passkey, challengeKey);
    if (verification.verified) {
      await prisma.passkey.update({
        where: { id: passkey.id },
        data: { counter: BigInt(verification.authenticationInfo.newCounter) },
      });

      const token = generateToken({ userId: passkey.user.id, role: passkey.user.role });
      return successResponse(res, "Passkey login successful", {
        user: {
          id: passkey.user.id,
          email: passkey.user.email,
          name: passkey.user.name,
          role: passkey.user.role,
        },
        token,
      });
    }

    return errorResponse(res, "Passkey authentication verification failed", 400);
  } catch (err) {
    console.error("Passkey auth verify error:", err);
    return errorResponse(res, err.message || "Passkey authentication failed", 400);
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return errorResponse(res, "Email is required", 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) {
      // Return generic success to prevent email enumeration
      return successResponse(res, "If an account exists with this email, a reset link has been sent.");
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires },
    });

    await sendPasswordResetEmail(user.email, resetToken);
    return successResponse(res, "If an account exists with this email, a reset link has been sent.");
  } catch (err) {
    console.error("Forgot password error:", err);
    return errorResponse(res, "Internal server error during password reset request", 500);
  }
}

async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return errorResponse(res, "Token and new password are required", 400);
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return errorResponse(res, "Invalid or expired password reset token", 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    return successResponse(res, "Password reset successfully. You can now log in with your new password.");
  } catch (err) {
    console.error("Reset password error:", err);
    return errorResponse(res, "Internal server error during password reset", 500);
  }
}

async function logout(req, res) {
  return successResponse(res, "Logged out successfully");
}

module.exports = {
  register,
  login,
  googleAuth,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  passkeyAuthOptions,
  passkeyAuthVerify,
  forgotPassword,
  resetPassword,
  logout,
};
