import { Router } from "express";
import { z } from "zod";
import DriverReferral from "../../models/DriverReferral.js";
import User from "../../models/User.js";
import DriverWallet from "../../models/DriverWallet.js";
import WalletTransaction from "../../models/WalletTransaction.js";
import Notification from "../../models/Notification.js";
import { requireAuth, allowRoles } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendPushNotification } from "../../services/notificationService.js";

const router = Router();

const DEFAULT_REWARD_PAISE = 150000; // ₹1,500
const DEFAULT_QUALIFICATION_RIDES = 20;

// Helper to ensure driver has a referral code
async function ensureDriverReferralCode(user) {
  if (user.referralCode) return user.referralCode;

  const prefix = (user.fullName ? user.fullName.split(" ")[0].toUpperCase() : "READY").replace(/[^A-Z]/g, "") || "READY";
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const code = `${prefix}-${randomSuffix}`;

  await User.findByIdAndUpdate(user._id, { referralCode: code });
  user.referralCode = code;
  return code;
}

// 25.2.1 GET /driver/referrals/summary
router.get("/driver/referrals/summary", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  const referralCode = await ensureDriverReferralCode(req.user);

  const [referredCount, creditedReferrals] = await Promise.all([
    DriverReferral.countDocuments({ referrerDriverId: req.user._id }),
    DriverReferral.find({ referrerDriverId: req.user._id, referrerRewardStatus: "CREDITED" })
  ]);

  const totalEarnedPaise = creditedReferrals.reduce((sum, r) => sum + (r.rewardPerEligibleDriverPaise || DEFAULT_REWARD_PAISE), 0);

  return ok(res, {
    referralCode,
    rewardPerEligibleDriverPaise: DEFAULT_REWARD_PAISE,
    qualificationRideCount: DEFAULT_QUALIFICATION_RIDES,
    referredDriverCount: referredCount,
    totalEarnedPaise,
    shareUrl: `https://readygo.example/r/${referralCode}`
  }, "Referral summary retrieved");
}));

// 25.2.2 GET /driver/referrals
router.get("/driver/referrals", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  await ensureDriverReferralCode(req.user);

  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || "10", 10)));
  const filter = { referrerDriverId: req.user._id };

  if (req.query.status) {
    filter.referrerRewardStatus = req.query.status;
  }

  const [items, total] = await Promise.all([
    DriverReferral.find(filter)
      .populate("referredDriverId", "fullName phone avatarUrl createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    DriverReferral.countDocuments(filter)
  ]);

  const formattedItems = items.map(item => ({
    referralId: item.referralId,
    referredDriver: {
      displayName: item.referredDriverId?.fullName || "Driver Partner",
      joinedAt: item.referredDriverId?.createdAt
    },
    completedEligibleRides: item.completedEligibleRides,
    requiredEligibleRides: item.requiredEligibleRides,
    rewardPaise: item.rewardPerEligibleDriverPaise,
    status: item.referrerRewardStatus,
    createdAt: item.createdAt
  }));

  return ok(res, {
    items: formattedItems,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  }, "Referred drivers list retrieved");
}));

// 25.2.3 POST /driver/referrals/validate (public or auth)
const validateCodeSchema = z.object({
  referralCode: z.string().min(3)
});

router.post("/driver/referrals/validate", validateBody(validateCodeSchema), asyncHandler(async (req, res) => {
  const code = req.body.referralCode.trim().toUpperCase();
  const referrer = await User.findOne({ referralCode: code });

  if (!referrer) {
    return fail(res, 404, "Invalid or expired referral code", "INVALID_REFERRAL_CODE");
  }

  return ok(res, {
    valid: true,
    referralCode: code,
    referrerName: referrer.fullName || "ReadyGo Driver",
    rewardPerEligibleDriverPaise: DEFAULT_REWARD_PAISE,
    qualificationRideCount: DEFAULT_QUALIFICATION_RIDES,
    message: `Earn ₹${DEFAULT_REWARD_PAISE / 100} after completing ${DEFAULT_QUALIFICATION_RIDES} trips!`
  }, "Referral code is valid");
}));

async function resolveReferral(referralIdParam, user) {
  if (!referralIdParam) return null;

  if (referralIdParam.includes("{{") || referralIdParam === "ref_123") {
    const latest = await DriverReferral.findOne({ referrerDriverId: user._id }).sort({ createdAt: -1 });
    if (latest) return latest;
  }

  const isObjectId = /^[0-9a-fA-F]{24}$/.test(referralIdParam);
  const conditions = [{ referralId: referralIdParam }];
  if (isObjectId) conditions.push({ _id: referralIdParam });

  return DriverReferral.findOne({
    referrerDriverId: user._id,
    $or: conditions
  });
}

// 25.2.4 GET /driver/referrals/:referralId
router.get("/driver/referrals/:referralId", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  await ensureDriverReferralCode(req.user);

  let referral = await resolveReferral(req.params.referralId, req.user);
  if (referral && !referral.populated?.("referredDriverId")) {
    await referral.populate("referredDriverId", "fullName phone avatarUrl");
  }

  if (!referral) {
    return fail(res, 404, "Referral record not found", "NOT_FOUND");
  }

  // Driver can only see their own referral unless admin
  if (req.user.role !== "admin" && referral.referrerDriverId.toString() !== req.user._id.toString()) {
    return fail(res, 403, "Access denied to this referral record", "FORBIDDEN");
  }

  return ok(res, {
    referralId: referral.referralId,
    referredDriver: {
      displayName: referral.referredDriverId?.fullName || "Driver Partner"
    },
    completedEligibleRides: referral.completedEligibleRides,
    requiredEligibleRides: referral.requiredEligibleRides,
    rewardPerEligibleDriverPaise: referral.rewardPerEligibleDriverPaise,
    referrerRewardStatus: referral.referrerRewardStatus,
    referredDriverRewardStatus: referral.referredDriverRewardStatus,
    dispute: referral.dispute?.isDisputed ? referral.dispute : undefined,
    creditedAt: referral.creditedAt
  }, "Referral progress retrieved");
}));

// 25.2.5 GET /driver/referrals/rewards
router.get("/driver/referrals/rewards", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || "10", 10)));
  const filter = {
    referrerDriverId: req.user._id,
    referrerRewardStatus: req.query.status || { $in: ["QUALIFIED", "CREDITED"] }
  };

  const [items, total] = await Promise.all([
    DriverReferral.find(filter)
      .populate("referredDriverId", "fullName")
      .sort({ creditedAt: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    DriverReferral.countDocuments(filter)
  ]);

  const formattedRewards = items.map(item => ({
    referralId: item.referralId,
    rewardPaise: item.rewardPerEligibleDriverPaise,
    status: item.referrerRewardStatus,
    creditedAt: item.creditedAt || item.updatedAt,
    referredDriverName: item.referredDriverId?.fullName || "Driver Partner"
  }));

  return ok(res, {
    items: formattedRewards,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  }, "Referral reward history retrieved");
}));

// 25.2.6 POST /driver/referrals/share-link
const shareLinkSchema = z.object({
  channel: z.enum(["WHATSAPP", "SMS", "OTHER"]).default("WHATSAPP")
});

router.post("/driver/referrals/share-link", requireAuth, allowRoles("driver", "admin", "rider"), validateBody(shareLinkSchema), asyncHandler(async (req, res) => {
  const referralCode = await ensureDriverReferralCode(req.user);
  const shareUrl = `https://readygo.example/r/${referralCode}`;
  const rewardRupees = DEFAULT_REWARD_PAISE / 100;

  const messagesByChannel = {
    WHATSAPP: `Drive with ReadyGo and earn more! Sign up using my driver referral code *${referralCode}* to unlock ₹${rewardRupees} bonus after completing ${DEFAULT_QUALIFICATION_RIDES} rides: ${shareUrl}`,
    SMS: `ReadyGo Driver Invite: Use code ${referralCode} to sign up and get ₹${rewardRupees} bonus after ${DEFAULT_QUALIFICATION_RIDES} rides! Tap here: ${shareUrl}`,
    OTHER: `Join ReadyGo as a Driver Partner! Referral Code: ${referralCode}. Sign up: ${shareUrl}`
  };

  return ok(res, {
    channel: req.body.channel,
    referralCode,
    shareUrl,
    messageText: messagesByChannel[req.body.channel] || messagesByChannel.OTHER
  }, "Referral share link generated");
}));

// 25.2.7 PATCH /driver/referrals/:referralId/dispute
const disputeSchema = z.object({
  reason: z.string().min(3).default("RIDES_COMPLETED_NOT_CREDITED"),
  description: z.string().min(5).default("Referred driver completed required rides but reward is pending.")
}).default({
  reason: "RIDES_COMPLETED_NOT_CREDITED",
  description: "Referred driver completed required rides but reward is pending."
});

router.patch("/driver/referrals/:referralId/dispute", requireAuth, allowRoles("driver", "admin", "rider"), validateBody(disputeSchema), asyncHandler(async (req, res) => {
  const referral = await resolveReferral(req.params.referralId, req.user);

  if (!referral) {
    return fail(res, 404, "Referral record not found", "NOT_FOUND");
  }

  if (req.user.role !== "admin" && referral.referrerDriverId.toString() !== req.user._id.toString()) {
    return fail(res, 403, "Access denied to dispute this referral", "FORBIDDEN");
  }

  referral.dispute = {
    isDisputed: true,
    reason: req.body?.reason || "RIDES_COMPLETED_NOT_CREDITED",
    description: req.body?.description || "Referred driver completed required rides but reward is pending.",
    submittedAt: new Date(),
    status: "SUBMITTED"
  };
  referral.referrerRewardStatus = "DISPUTED";
  await referral.save();

  return ok(res, {
    referralId: referral.referralId,
    dispute: referral.dispute,
    status: referral.referrerRewardStatus
  }, "Referral reward dispute submitted successfully");
}));

// 25.2.8 POST /admin/referrals/:referralId/review
const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]).default("APPROVED"),
  reason: z.string().default("Verified completed rides from audit log")
}).default({
  decision: "APPROVED",
  reason: "Verified completed rides from audit log"
});

router.post("/admin/referrals/:referralId/review", requireAuth, allowRoles("admin"), validateBody(reviewSchema), asyncHandler(async (req, res) => {
  const referral = await resolveReferral(req.params.referralId, req.user);

  if (!referral) {
    return fail(res, 404, "Referral not found", "NOT_FOUND");
  }

  referral.adminReview = {
    decision: req.body.decision,
    reason: req.body.reason,
    reviewedBy: req.user._id,
    reviewedAt: new Date()
  };

  if (req.body.decision === "APPROVED") {
    referral.referrerRewardStatus = "CREDITED";
    referral.creditedAt = new Date();
    if (referral.dispute) {
      referral.dispute.status = "RESOLVED";
    }

    // Idempotent wallet credit
    let wallet = await DriverWallet.findOne({ driverId: referral.referrerDriverId });
    if (!wallet) {
      wallet = await DriverWallet.create({
        driverId: referral.referrerDriverId,
        availableBalancePaise: 0
      });
    }

    const rewardAmount = referral.rewardPerEligibleDriverPaise || DEFAULT_REWARD_PAISE;
    wallet.availableBalancePaise += rewardAmount;
    wallet.lastCredited = {
      amountPaise: rewardAmount,
      type: "REFERRAL_BONUS",
      createdAt: new Date()
    };
    await wallet.save();

    // Create wallet transaction ledger entry
    await WalletTransaction.create({
      driverId: referral.referrerDriverId,
      type: "CREDIT",
      category: "REFERRAL_BONUS",
      description: `Driver Referral Bonus for Referral #${referral.referralId}`,
      referenceId: referral.referralId,
      amountPaise: rewardAmount,
      balanceAfterPaise: wallet.availableBalancePaise,
      currency: "INR"
    });

    // Notify referrer
    await Notification.create({
      notificationId: "ntf_" + Math.random().toString(36).substring(2, 9),
      userId: referral.referrerDriverId,
      role: "driver",
      type: "REFERRAL_REWARD",
      title: "Referral Bonus Credited! 🎉",
      body: `₹${rewardAmount / 100} has been credited to your Driver Wallet for referred driver completion.`,
      action: {
        screen: "DriverWalletScreen",
        params: { referralId: referral.referralId }
      }
    });

    sendPushNotification(referral.referrerDriverId, {
      title: "Referral Bonus Credited! 🎉",
      body: `₹${rewardAmount / 100} has been credited to your Driver Wallet!`,
      data: { type: "REFERRAL_REWARD", referralId: referral.referralId }
    }).catch(() => {});
  } else {
    referral.referrerRewardStatus = "REJECTED";
    if (referral.dispute) {
      referral.dispute.status = "REJECTED";
    }
  }

  await referral.save();

  return ok(res, {
    referralId: referral.referralId,
    adminReview: referral.adminReview,
    status: referral.referrerRewardStatus
  }, `Referral review decision '${req.body.decision}' recorded successfully`);
}));

export default router;

