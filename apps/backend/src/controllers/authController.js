const prisma = require("../config/prisma.js");
const bcrypt = require("bcryptjs");
const { generateToken } = require("../utils/jwt.js");
const { successResponse, errorResponse } = require("../utils/response.js");
const { sendPasswordResetEmail, sendWelcomeEmail } = require("../utils/mailer.js");
const {
  getPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  getPasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
} = require("../utils/passkey.js");

async function register(req, res) {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return errorResponse(res, "Email, password, and name are required", 400);
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
        role: role || "WAITER",
        status: "ACTIVE",
      },
    });

    try {
      await sendWelcomeEmail(user.email, user.name);
    } catch (mailErr) {
      console.error("Failed to send welcome email:", mailErr);
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

    return successResponse(res, "Registration successful", { user: userPayload, token }, 201);
  } catch (err) {
    console.error("Registration error:", err);
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
    if (!user || !user.password) {
      return errorResponse(res, "Invalid email or password", 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return errorResponse(res, "Invalid email or password", 401);
    }

    if (user.status !== "ACTIVE") {
      return errorResponse(res, "Account is disabled. Please contact administrator.", 403);
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
    const { email, name, avatar, googleId } = req.body;

    if (!email) {
      return errorResponse(res, "Email is required for Google auth", 400);
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split("@")[0],
          avatar: avatar || null,
          role: "WAITER",
          status: "ACTIVE",
        },
      });

      try {
        await sendWelcomeEmail(user.email, user.name);
      } catch (mailErr) {
        console.error("Failed to send welcome email:", mailErr);
      }
    } else if (avatar && !user.avatar) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { avatar },
      });
    }

    if (user.status !== "ACTIVE") {
      return errorResponse(res, "Account is disabled. Please contact administrator.", 403);
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

    return successResponse(res, "Google authentication successful", { user: userPayload, token });
  } catch (err) {
    console.error("Google Auth error:", err);
    return errorResponse(res, "Internal server error during Google authentication", 500);
  }
}

async function passkeyAuthOptions(req, res) {
  try {
    const { email } = req.body;
    let passkeys = [];
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, include: { passkeys: true } });
      if (user) {
        passkeys = user.passkeys;
      }
    }
    const options = await getPasskeyAuthenticationOptions(passkeys);
    return successResponse(res, "Authentication options generated", options);
  } catch (err) {
    console.error("Passkey auth options error:", err);
    return errorResponse(res, "Failed to generate passkey authentication options", 500);
  }
}

async function passkeyAuthVerify(req, res) {
  try {
    const { credential, expectedChallenge } = req.body;
    const passkey = await prisma.passkey.findUnique({
      where: { credentialId: credential.id },
      include: { user: true },
    });

    if (!passkey) {
      return errorResponse(res, "Passkey not registered", 404);
    }

    const verification = await verifyPasskeyAuthentication(credential, passkey, expectedChallenge);
    if (!verification.verified) {
      return errorResponse(res, "Passkey verification failed", 401);
    }

    await prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    const user = passkey.user;
    const token = generateToken({ userId: user.id, role: user.role });
    const userPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatar: user.avatar,
    };

    return successResponse(res, "Passkey login successful", { user: userPayload, token });
  } catch (err) {
    console.error("Passkey auth verify error:", err);
    return errorResponse(res, "Failed to verify passkey", 500);
  }
}

async function passkeyRegisterOptions(req, res) {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return errorResponse(res, "User ID not found in token session", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    });

    if (!user) {
      return errorResponse(res, "User account not found", 404);
    }

    const options = await getPasskeyRegistrationOptions(user, user.passkeys);
    return successResponse(res, "Registration options generated", options);
  } catch (err) {
    console.error("Passkey register options error:", err);
    return errorResponse(res, "Failed to generate passkey registration options", 500);
  }
}

async function passkeyRegisterVerify(req, res) {
  try {
    const { credential, expectedChallenge } = req.body;
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return errorResponse(res, "User ID not found in token session", 401);
    }

    const verification = await verifyPasskeyRegistration(userId, credential, expectedChallenge);
    if (!verification.verified || !verification.registrationInfo) {
      return errorResponse(res, "Passkey verification failed", 400);
    }

    const { registrationInfo } = verification;

    const rawPublicKey =
      registrationInfo.credential?.publicKey ||
      registrationInfo.credentialPublicKey;

    if (!rawPublicKey) {
      return errorResponse(res, "Could not extract public key from passkey registration info", 400);
    }

    const publicKeyBuffer = Buffer.from(rawPublicKey);
    const counter = BigInt(
      registrationInfo.credential?.counter ?? registrationInfo.counter ?? 0
    );

    const credentialId =
      credential.id ||
      registrationInfo.credential?.id;

    const transportsList =
      credential.response?.transports ||
      registrationInfo.credential?.transports;

    const transports = transportsList
      ? (Array.isArray(transportsList) ? JSON.stringify(transportsList) : String(transportsList))
      : null;

    const createdPasskey = await prisma.passkey.create({
      data: {
        credentialId,
        publicKey: publicKeyBuffer,
        counter,
        transports,
        userId,
      },
    });

    return successResponse(res, "Passkey registered successfully", createdPasskey, 201);
  } catch (err) {
    console.error("Passkey register verify error:", err);
    return errorResponse(res, err.message || "Failed to register passkey", 500);
  }
}

async function listMyPasskeys(req, res) {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return errorResponse(res, "User ID not found in session", 401);
    }

    const passkeys = await prisma.passkey.findMany({
      where: { userId },
      select: {
        id: true,
        credentialId: true,
        transports: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedPasskeys = passkeys.map((p) => {
      let parsedTransports = ["internal"];
      if (p.transports) {
        try {
          parsedTransports = JSON.parse(p.transports);
        } catch {
          parsedTransports = [p.transports];
        }
      }
      return {
        id: p.id,
        credentialId: p.credentialId,
        deviceName: `Biometric Passkey (${p.credentialId.slice(0, 8)}...)`,
        createdAt: p.createdAt,
        transports: parsedTransports,
      };
    });

    return successResponse(res, "Passkeys retrieved successfully", formattedPasskeys);
  } catch (err) {
    console.error("listMyPasskeys error:", err);
    return errorResponse(res, "Failed to retrieve passkeys", 500);
  }
}

async function deleteMyPasskey(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return errorResponse(res, "User ID not found in session", 401);
    }

    const passkey = await prisma.passkey.findFirst({
      where: {
        OR: [{ id }, { credentialId: id }],
        userId,
      },
    });

    if (!passkey) {
      return errorResponse(res, "Passkey not found or unauthorized", 404);
    }

    await prisma.passkey.delete({ where: { id: passkey.id } });
    return successResponse(res, "Passkey removed successfully");
  } catch (err) {
    console.error("deleteMyPasskey error:", err);
    return errorResponse(res, "Failed to delete passkey", 500);
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return errorResponse(res, "Email is required", 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return successResponse(res, "If that email exists, a 6-digit password reset OTP has been sent.");
    }

    const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: resetOtp, resetTokenExpires },
    });

    await sendPasswordResetEmail(user.email, resetOtp);
    return successResponse(res, "Password reset OTP code sent to your email.");
  } catch (err) {
    console.error("Forgot password error:", err);
    return errorResponse(res, "Failed to process forgot password request", 500);
  }
}

async function resetPassword(req, res) {
  try {
    const { email, otp, token, newPassword } = req.body;
    const otpCode = otp || token;

    if (!otpCode || !newPassword) {
      return errorResponse(res, "OTP code and new password are required", 400);
    }

    const user = await prisma.user.findFirst({
      where: {
        ...(email ? { email } : {}),
        resetToken: otpCode,
        resetTokenExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return errorResponse(res, "Invalid or expired OTP code. Please request a new code.", 400);
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
    return errorResponse(res, "Failed to reset password", 500);
  }
}

async function logout(req, res) {
  return successResponse(res, "Logout successful");
}

module.exports = {
  register,
  login,
  googleAuth,
  passkeyAuthOptions,
  passkeyAuthVerify,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  listMyPasskeys,
  deleteMyPasskey,
  forgotPassword,
  resetPassword,
  logout,
};
