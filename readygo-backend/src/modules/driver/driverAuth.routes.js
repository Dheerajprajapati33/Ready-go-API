import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../../models/User.js";
import OtpChallenge from "../../models/OtpChallenge.js";
import Session from "../../models/Session.js";
import Device from "../../models/Device.js";
import DriverProfile from "../../models/DriverProfile.js";
import { generateOtp, hashToken, signAccessToken, signRefreshToken } from "../../utils/tokens.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";

const router = Router();
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "development" ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false
});

const sendSchema = z.object({
  countryCode: z.string().min(1).max(5),
  phone: z.string().min(7).max(15),
  purpose: z.enum(["login", "registration"]).default("login")
});

const verifySchema = z.object({
  countryCode: z.string().min(1).max(5),
  phone: z.string().min(7).max(15),
  purpose: z.enum(["login", "registration"]).default("login"),
  otp: z.string().length(6),
  deviceId: z.string().max(120).optional(),
  role: z.string().optional(),
  vehicleCategory: z.string().optional()
});

/**
 * POST /api/v1/driver/auth/otp/send
 * Sends OTP for Driver login or registration
 */
router.post("/otp/send", otpLimiter, validateBody(sendSchema), asyncHandler(async (req, res) => {
  const phone = `${req.body.countryCode}${req.body.phone}`.replace(/\s/g, "");
  const otp = generateOtp();
  const codeHash = await bcrypt.hash(otp, 10);

  await OtpChallenge.deleteMany({ phone, purpose: req.body.purpose });
  await OtpChallenge.create({
    phone,
    purpose: req.body.purpose,
    codeHash,
    expiresAt: new Date(Date.now() + Number(process.env.OTP_TTL_MINUTES || 5) * 60000)
  });

  if (process.env.OTP_DEV_MODE === "true") {
    console.log(`[DEV OTP] [DRIVER] ${phone}: ${otp}`);
  }

  return ok(res, {
    phone,
    role: "driver",
    expiresInSeconds: Number(process.env.OTP_TTL_MINUTES || 5) * 60
  }, "Driver OTP sent");
}));

/**
 * POST /api/v1/driver/auth/otp/verify
 * Verifies OTP, logs in or registers driver, auto-initializes DriverProfile to APPROVED and ONLINE
 */
router.post("/otp/verify", otpLimiter, validateBody(verifySchema), asyncHandler(async (req, res) => {
  const phone = `${req.body.countryCode}${req.body.phone}`.replace(/\s/g, "");
  const challenge = await OtpChallenge.findOne({
    phone,
    purpose: req.body.purpose,
    consumedAt: null
  }).sort({ createdAt: -1 });

  if (!challenge || challenge.expiresAt < new Date() || challenge.attempts >= 5) {
    return fail(res, 401, "OTP expired or unavailable", "UNAUTHENTICATED");
  }

  const valid = await bcrypt.compare(req.body.otp, challenge.codeHash);
  challenge.attempts += 1;
  if (!valid) {
    await challenge.save();
    return fail(res, 401, "Invalid OTP", "UNAUTHENTICATED");
  }

  challenge.consumedAt = new Date();
  await challenge.save();

  let user = await User.findOne({ phone });
  const isNewUser = !user;

  if (!user) {
    user = await User.create({
      phone,
      role: "driver"
    });
  } else {
    user.role = "driver";
    await user.save();
  }

  let driverProfile = await DriverProfile.findOne({ userId: user._id });
  if (!driverProfile) {
    driverProfile = await DriverProfile.create({
      userId: user._id,
      applicationStatus: "APPROVED",
      availability: "ONLINE",
      city: "Delhi NCR",
      vehicleCategory: req.body.vehicleCategory || "moto"
    });
  } else {
    driverProfile.applicationStatus = "APPROVED";
    driverProfile.availability = "ONLINE";
    if (req.body.vehicleCategory) {
      driverProfile.vehicleCategory = req.body.vehicleCategory;
    }
    await driverProfile.save();
  }

  const sessionId = crypto.randomUUID();
  const refreshToken = signRefreshToken(user, sessionId);
  const expiresAt = new Date(Date.now() + Number(process.env.REFRESH_TOKEN_DAYS || 30) * 86400000);

  await Session.create({
    _id: sessionId,
    userId: user._id,
    refreshTokenHash: hashToken(refreshToken),
    deviceId: req.body.deviceId,
    expiresAt
  });

  return ok(res, {
    accessToken: signAccessToken(user),
    refreshToken,
    isNewUser,
    role: user.role,
    user: {
      id: user._id,
      phone: user.phone,
      fullName: user.fullName || "Driver Partner",
      role: user.role,
      profileCompleted: user.profileCompleted
    },
    driverProfile: {
      id: driverProfile._id,
      applicationStatus: driverProfile.applicationStatus,
      availability: driverProfile.availability,
      vehicleCategory: driverProfile.vehicleCategory,
      averageRating: driverProfile.averageRating,
      totalRatings: driverProfile.totalRatings
    }
  }, "Driver login successful");
}));

/**
 * GET /api/v1/driver/auth/me
 * Retrieves authenticated driver info
 */
router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const profile = await DriverProfile.findOne({ userId: req.user._id });
  return ok(res, {
    user: {
      id: req.user._id,
      phone: req.user.phone,
      fullName: req.user.fullName || "Driver Partner",
      role: req.user.role,
      profileCompleted: req.user.profileCompleted
    },
    driverProfile: profile ? {
      id: profile._id,
      applicationStatus: profile.applicationStatus,
      availability: profile.availability,
      vehicleCategory: profile.vehicleCategory,
      averageRating: profile.averageRating,
      totalRatings: profile.totalRatings
    } : null
  }, "Driver info retrieved");
}));

/**
 * POST /api/v1/driver/auth/token/refresh
 * Refreshes access token for Driver
 */
router.post("/token/refresh", asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return fail(res, 401, "refreshToken required", "UNAUTHENTICATED");

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return fail(res, 401, "Invalid refresh token", "UNAUTHENTICATED");
  }

  const session = await Session.findById(payload.sid);
  if (!session || session.revokedAt || session.expiresAt < new Date() || session.refreshTokenHash !== hashToken(refreshToken)) {
    return fail(res, 401, "Session revoked or expired", "UNAUTHENTICATED");
  }

  const user = await User.findById(payload.sub);
  if (!user) return fail(res, 401, "User not found", "UNAUTHENTICATED");

  session.revokedAt = new Date();
  await session.save();

  const newSessionId = crypto.randomUUID();
  const newRefresh = signRefreshToken(user, newSessionId);

  await Session.create({
    _id: newSessionId,
    userId: user._id,
    refreshTokenHash: hashToken(newRefresh),
    deviceId: session.deviceId,
    expiresAt: new Date(Date.now() + Number(process.env.REFRESH_TOKEN_DAYS || 30) * 86400000)
  });

  return ok(res, {
    accessToken: signAccessToken(user),
    refreshToken: newRefresh
  }, "Token refreshed");
}));

/**
 * POST /api/v1/driver/auth/logout
 * Logs out driver and sets availability to OFFLINE
 */
router.post("/logout", requireAuth, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      await Session.updateOne({ _id: payload.sid, userId: req.user._id }, { $set: { revokedAt: new Date() } });
    } catch { /* idempotent logout */ }
  }

  await DriverProfile.updateOne({ userId: req.user._id }, { $set: { availability: "OFFLINE" } });
  return ok(res, {}, "Driver logged out successfully");
}));

/**
 * POST /api/v1/driver/auth/devices/register
 * Registers push notification device for driver
 */
router.post("/devices/register", requireAuth, validateBody(z.object({
  deviceId: z.string().min(1),
  platform: z.enum(["android", "ios", "web"]),
  pushToken: z.string().min(1)
})), asyncHandler(async (req, res) => {
  const device = await Device.findOneAndUpdate(
    { userId: req.user._id, deviceId: req.body.deviceId },
    { ...req.body, userId: req.user._id },
    { upsert: true, new: true, runValidators: true }
  );
  return ok(res, device, "Driver device registered");
}));

export default router;

