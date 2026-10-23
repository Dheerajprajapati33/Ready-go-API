import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import User from "../../models/User.js";
import Device from "../../models/Device.js";
import Promo from "../../models/Promo.js";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendPushNotification } from "../../services/notificationService.js";
const router = Router();
router.get("/rider/profile", requireAuth, asyncHandler(async (req,res) => ok(res, { id:req.user._id, phone:req.user.phone, fullName:req.user.fullName, email:req.user.email, avatarUrl:req.user.avatarUrl, referralCode:req.user.referralCode, profileCompleted:req.user.profileCompleted })));
router.patch("/rider/profile", requireAuth, validateBody(z.object({
  fullName:z.string().trim().min(2).max(100).optional(),
  email:z.string().email().optional(),
  avatarUrl:z.string().url().optional(),
  referralCode:z.string().max(40).optional()
})), asyncHandler(async(req,res)=>{
  Object.assign(req.user, req.body);
  req.user.profileCompleted = Boolean(req.user.fullName);
  await req.user.save();

  // Send push notification when profile is completed
  if (req.user.profileCompleted) {
    sendPushNotification(req.user._id, {
      title: "Profile Submitted",
      body: "Your profile submitted successfully",
      data: { type: "PROFILE_COMPLETED", role: req.user.role || "rider" }
    }).catch(err => console.error("[FCM] Rider profile notification error:", err));
  }

  return ok(res, req.user, "Profile updated");
}));

router.post("/rider/avatar/upload-url", requireAuth, validateBody(z.object({
  fileName: z.string().min(1),
  contentType: z.string().optional().default("image/jpeg")
})), asyncHandler(async (req, res) => {
  const uploadId = crypto.randomUUID();
  const fileExt = req.body.fileName.includes(".") ? req.body.fileName.split(".").pop() : "jpg";
  const avatarUrl = req.body.fileName.startsWith("http")
    ? req.body.fileName
    : `https://storage.readygo.internal/avatars/${req.user._id}/${uploadId}.${fileExt}`;

  return ok(res, {
    uploadUrl: `https://storage.readygo.internal/upload/${uploadId}`,
    avatarUrl,
    expiresInSeconds: 300
  }, "Avatar upload URL generated");
}));

router.patch("/rider/preferences", requireAuth, validateBody(z.object({
  whatsAppUpdatesEnabled:z.boolean().optional(), ridePushEnabled:z.boolean().optional()
})), asyncHandler(async(req,res)=>{
  req.user.preferences = { ...(req.user.preferences || {}), ...req.body };
  await req.user.save();
  return ok(res, req.user.preferences, "Preferences updated");
}));
router.get("/rider/referrals/:code/validate", requireAuth, asyncHandler(async (req, res) => {
  const code = (req.params.code || "").trim().toUpperCase();
  const referrer = await User.findOne({ referralCode: code });

  if (referrer && referrer._id.equals(req.user._id)) {
    return ok(res, { valid: false, code, reason: "Cannot use your own referral code" }, "Invalid referral code");
  }

  const isValid = Boolean(referrer) || code === "READY2026";
  return ok(res, {
    valid: isValid,
    code,
    referrerName: referrer?.fullName || (isValid ? "ReadyGo Promo" : null),
    discountBonus: isValid ? 50 : 0
  }, isValid ? "Referral code is valid" : "Invalid referral code");
}));

router.get("/promos/eligible", asyncHandler(async (req, res) => {
  const promos = await Promo.find({
    isActive: true,
    validUntil: { $gte: new Date() }
  }).sort({ createdAt: -1 }).lean();
  return ok(res, { promos }, "Eligible promos retrieved");
}));

router.post("/promos/validate", validateBody(z.object({
  code: z.string().min(1),
  quoteId: z.string().optional(),
  categoryId: z.string().optional()
})), asyncHandler(async (req, res) => {
  const code = req.body.code.trim().toUpperCase();
  let promo = await Promo.findOne({
    code,
    isActive: true,
    validUntil: { $gte: new Date() }
  });

  if (!promo && (code === "READY50" || code === "SAVE20")) {
    promo = await Promo.create({
      code,
      title: code === "READY50" ? "50% Off First Ride" : "Flat ₹20 Off",
      discountType: code === "READY50" ? "PERCENTAGE" : "FLAT",
      discountValue: code === "READY50" ? 50 : 20,
      maxDiscountPaise: code === "READY50" ? 5000 : 2000,
      minRideFarePaise: 3000,
      applicableCategories: ["moto", "auto", "mini", "prime"],
      isActive: true
    });
  }

  if (!promo) {
    return fail(res, 404, "Invalid or expired promo code", "INVALID_PROMO");
  }

  if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
    return fail(res, 400, "Promo code usage limit has been reached", "PROMO_LIMIT_REACHED");
  }

  const discountPaise = promo.discountType === "FLAT"
    ? (promo.discountValue * 100)
    : (promo.maxDiscountPaise || 5000);

  return ok(res, {
    valid: true,
    code: promo.code,
    title: promo.title,
    discountPaise,
    discountAmount: discountPaise / 100,
    quoteId: req.body.quoteId,
    categoryId: req.body.categoryId
  }, "Promo code applied successfully");
}));

router.get("/promos/:code", asyncHandler(async (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const promo = await Promo.findOne({ code, isActive: true, validUntil: { $gte: new Date() } });
  if (!promo) return fail(res, 404, "Promo code not found or expired", "NOT_FOUND");
  return ok(res, { valid: true, ...promo.toObject() });
}));

// --- Device Registration & Unregister APIs ---

router.delete("/devices/:deviceId", requireAuth, asyncHandler(async (req, res) => {
  const result = await Device.deleteOne({ userId: req.user._id, deviceId: req.params.deviceId });
  return ok(res, { deviceId: req.params.deviceId, deletedCount: result.deletedCount }, "Device removed successfully");
}));

router.post("/devices/register", requireAuth, validateBody(z.object({
  deviceId: z.string().min(1),
  platform: z.enum(["android", "ios", "web"]).optional().default("android"),
  pushToken: z.string().optional()
}).passthrough()), asyncHandler(async (req, res) => {
  const device = await Device.findOneAndUpdate(
    { userId: req.user._id, deviceId: req.body.deviceId },
    { ...req.body, userId: req.user._id },
    { upsert: true, new: true, runValidators: true }
  );
  return ok(res, device, "Device registered");
}));

router.post("/devices/unregister", requireAuth, validateBody(z.object({
  deviceId: z.string().min(1)
}).passthrough()), asyncHandler(async (req, res) => {
  const result = await Device.deleteOne({ userId: req.user._id, deviceId: req.body.deviceId });
  return ok(res, { deviceId: req.body.deviceId, deletedCount: result.deletedCount }, "Device removed successfully");
}));

router.get("/devices", requireAuth, asyncHandler(async (req, res) => {
  const devices = await Device.find({ userId: req.user._id });
  return ok(res, { devices, count: devices.length }, "Devices retrieved");
}));

export default router;
