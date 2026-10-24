import { Router } from "express";
import { requireAuth, allowRoles } from "../../middleware/auth.js";
import User from "../../models/User.js";
import DriverProfile from "../../models/DriverProfile.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";
import Ride from "../../models/Ride.js";
import AuditLog from "../../models/AuditLog.js";
import Promo from "../../models/Promo.js";
import DriverDocument from "../../models/DriverDocument.js";
import FareRule from "../../models/FareRule.js";
import SafetyEvent from "../../models/SafetyEvent.js";
import { handlePaymentReconciliation } from "../payments/payments.routes.js";
import { emitRideStatus, emitDriverAssigned } from "../../services/socketService.js";
const router=Router();
router.get("/admin/driver-applications", requireAuth, allowRoles("admin", "safety", "finance"), asyncHandler(async (req, res) => {
  const {
    city,
    status,
    category,
    vehicleCategory,
    page = 1,
    limit = 10
  } = req.query;

  const filter = {};

  // Status Filter (handle PENDING, SUBMITTED, UNDER_REVIEW, DRAFT, APPROVED, etc.)
  if (status && status.trim().toUpperCase() !== "ALL") {
    const s = status.trim().toUpperCase();
    if (s === "PENDING" || s === "OPEN" || s === "NEW") {
      filter.applicationStatus = { $in: ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_PENDING", "DRAFT", "PENDING"] };
    } else {
      filter.applicationStatus = new RegExp(`^${s}$`, "i");
    }
  }

  // City Filter
  if (city && city.trim().toUpperCase() !== "ALL") {
    const c = city.trim();
    filter.$or = [
      { city: new RegExp(c, "i") },
      { city: new RegExp("Delhi|NCR|Noida", "i") },
      { city: { $exists: false } },
      { city: null }
    ];
  }

  // Category Filter (support BIKE, moto, CAR, AUTO)
  const cat = (category || vehicleCategory || "").trim();
  if (cat && cat.toUpperCase() !== "ALL") {
    const catRegex = cat.toUpperCase() === "BIKE" ? /bike|moto|scooty/i : new RegExp(cat, "i");
    const catCondition = [
      { vehicleCategory: catRegex },
      { "vehicle.category": catRegex },
      { "vehicle.vehicleType": catRegex }
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: catCondition }];
      delete filter.$or;
    } else {
      filter.$or = catCondition;
    }
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  let [profiles, totalCount] = await Promise.all([
    DriverProfile.find(filter)
      .populate("userId", "fullName phone email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    DriverProfile.countDocuments(filter)
  ]);

  const userIds = profiles.map(p => {
    return (p.userId && typeof p.userId === "object" && p.userId._id) ? p.userId._id : p.userId;
  }).filter(Boolean);

  const documents = await DriverDocument.find({ driverId: { $in: userIds } }).sort({ createdAt: -1 }).lean();

  const formattedItems = profiles.map(p => {
    const rawUserId = (p.userId && typeof p.userId === "object" && p.userId._id)
      ? p.userId._id
      : p.userId;
    const driverUser = (p.userId && typeof p.userId === "object" && p.userId._id) ? p.userId : null;
    const driverDocs = documents.filter(d => d.driverId?.toString() === rawUserId?.toString());

    return {
      id: p._id,
      _id: p._id,
      applicationId: p._id,
      userId: rawUserId,
      driverId: rawUserId,
      driverName: driverUser?.fullName || driverUser?.phone || "Driver Partner",
      phone: driverUser?.phone || "N/A",
      email: driverUser?.email || "N/A",
      city: p.city || "Not Specified",
      vehicleCategory: p.vehicleCategory || p.vehicle?.category || "moto",
      vehicle: p.vehicle || {},
      applicationStatus: p.applicationStatus,
      status: p.applicationStatus,
      documents: driverDocs,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    };
  });

  return ok(res, formattedItems, "Driver applications retrieved successfully");
}));

router.get("/admin/driver-applications/:id", requireAuth, allowRoles("admin"), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return fail(res, 404, "Application not found", "NOT_FOUND");
  }
  const p = await DriverProfile.findById(req.params.id).populate("userId", "fullName phone email");
  if (!p) return fail(res, 404, "Application not found", "NOT_FOUND");
  const rawUserId = (p.userId && typeof p.userId === "object" && p.userId._id) ? p.userId._id : p.userId;
  const docs = await DriverDocument.find({ driverId: rawUserId }).sort({ createdAt: -1 });
  const appObj = p.toObject ? p.toObject() : p;
  return ok(res, {
    ...appObj,
    documents: docs
  });
}));

router.post("/admin/driver-applications/:id/review", requireAuth, allowRoles("admin"), asyncHandler(async (req, res) => {
  // Support both 'decision' (sent by Postman) and 'status'
  let rawDecision = (req.body.decision || req.body.status || req.body.reviewStatus || "").toString().trim().toUpperCase();

  // Normalize friendly values
  if (rawDecision === "APPROVE" || rawDecision === "ACCEPT") rawDecision = "APPROVED";
  if (rawDecision === "REJECT") rawDecision = "REJECTED";
  if (rawDecision === "REVIEW") rawDecision = "UNDER_REVIEW";

  const allowed = ["APPROVED", "REJECTED", "ACTION_REQUIRED", "UNDER_REVIEW"];
  if (!allowed.includes(rawDecision)) {
    return fail(res, 400, "Invalid review status", "VALIDATION_ERROR");
  }

  const id = req.params.id;
  if (!id || !mongoose.isValidObjectId(id)) {
    return fail(res, 404, "Application not found", "NOT_FOUND");
  }

  const p = await DriverProfile.findById(id);
  if (!p) return fail(res, 404, "Application not found", "NOT_FOUND");

  const prevStatus = p.applicationStatus;
  p.applicationStatus = rawDecision;
  await p.save();

  const remarks = req.body.remarks || req.body.note || req.body.comments || "Documents verified successfully";

  // Record audit log for admin review action
  await AuditLog.create({
    actorId: req.user._id,
    actorRole: req.user.role || "admin",
    actorName: req.user.fullName || "Admin",
    action: "DRIVER_APPLICATION-REVIEW",
    resourceType: "DRIVER_APPLICATION",
    resourceId: p._id,
    details: { previousStatus: prevStatus, newStatus: rawDecision, decision: rawDecision, remarks },
    status: "SUCCESS"
  }).catch(() => {});

  return ok(res, {
    applicationId: p._id,
    id: p._id,
    _id: p._id,
    applicationStatus: p.applicationStatus,
    status: p.applicationStatus,
    decision: rawDecision,
    remarks,
    reviewedAt: new Date().toISOString()
  }, "Application reviewed successfully");
}));

// Audit logs endpoint with filtering, search, date range and pagination
router.get("/admin/audit-logs", requireAuth, allowRoles("admin", "safety", "finance"), asyncHandler(async (req, res) => {
  const {
    actorId,
    action,
    resourceType,
    fromDate,
    toDate,
    page = 1,
    limit = 10
  } = req.query;

  const filter = {};

  // Actor Filter
  if (actorId && actorId.toUpperCase() !== "ALL" && actorId !== "ADMIN_USER_ID") {
    if (mongoose.isValidObjectId(actorId)) {
      filter.actorId = new mongoose.Types.ObjectId(actorId);
    } else {
      filter.actorId = actorId;
    }
  }

  // Action Filter (support both DRIVER_APPLICATION-REVIEW and DRIVER_APPLICATION_REVIEW)
  if (action && action.trim().toUpperCase() !== "ALL") {
    const cleanAction = action.trim().replace(/[-_]/g, "[-_]");
    filter.action = new RegExp(`^${cleanAction}$`, "i");
  }

  // Resource Type Filter
  if (resourceType && resourceType.trim().toUpperCase() !== "ALL") {
    const cleanRes = resourceType.trim().replace(/[-_]/g, "[-_]");
    filter.resourceType = new RegExp(`^${cleanRes}$`, "i");
  }

  // Date Range Filter
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) {
      const from = new Date(fromDate);
      if (!isNaN(from.getTime())) filter.createdAt.$gte = from;
    }
    if (toDate) {
      let to = new Date(toDate);
      if (!isNaN(to.getTime())) {
        if (typeof toDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(toDate.trim())) {
          to = new Date(toDate.trim() + "T23:59:59.999Z");
        }
        filter.createdAt.$lte = to;
      }
    }
    if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [logs, totalCount] = await Promise.all([
    AuditLog.find(filter)
      .populate("actorId", "fullName phone email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    AuditLog.countDocuments(filter)
  ]);

  return ok(res, {
    items: logs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limitNum) || 1
    }
  }, "Audit logs retrieved successfully");
}));
router.get("/admin/rides",requireAuth,allowRoles("admin"),asyncHandler(async(req,res)=>{
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.categoryId) filter.categoryId = req.query.categoryId;
  const [items, total] = await Promise.all([
    Ride.find(filter).populate("riderId", "fullName phone email").populate("driverId", "fullName phone email").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Ride.countDocuments(filter)
  ]);
  return ok(res, { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } }, "Rides retrieved successfully");
}));
router.post("/admin/rides/:id/assign", requireAuth, allowRoles("admin"), asyncHandler(async (req, res) => {
  const rideId = req.params.id;
  const inputDriverId = req.body.driverId || req.body.driverProfileId || req.body.userId;

  let driverUser = null;
  let driverProfile = null;

  // 1. If an explicit driverId is provided, resolve that specific driver
  if (inputDriverId && mongoose.isValidObjectId(inputDriverId)) {
    driverUser = await User.findById(inputDriverId);
    if (!driverUser) {
      driverProfile = await DriverProfile.findById(inputDriverId);
      if (driverProfile) driverUser = await User.findById(driverProfile.userId);
    } else {
      driverProfile = await DriverProfile.findOne({ userId: driverUser._id });
    }
  }

  // 2. If no driverId provided (auto-assign mode): find real active online & approved driver from DB
  if (!driverUser) {
    driverProfile = await DriverProfile.findOne({ availability: "ONLINE", applicationStatus: "APPROVED" })
      .populate("userId")
      .sort({ updatedAt: -1 });

    if (driverProfile?.userId) {
      driverUser = driverProfile.userId;
    }
  }

  // 3. Fallback to any approved driver in database if none currently ONLINE
  if (!driverUser) {
    driverProfile = await DriverProfile.findOne({ applicationStatus: "APPROVED" })
      .populate("userId")
      .sort({ updatedAt: -1 });

    if (driverProfile?.userId) {
      driverUser = driverProfile.userId;
    }
  }

  // 4. Fallback to any active driver user
  if (!driverUser) {
    driverUser = await User.findOne({ role: "driver", status: "ACTIVE" });
    if (driverUser) {
      driverProfile = await DriverProfile.findOne({ userId: driverUser._id });
    }
  }

  if (!driverUser) {
    return fail(res, 404, "No active driver found in system to assign", "NO_DRIVER_FOUND");
  }

  const assignedDriverId = driverUser._id;

  if (!rideId || !mongoose.isValidObjectId(rideId)) {
    return fail(res, 404, "Ride not found", "NOT_FOUND");
  }

  const ride = await Ride.findById(rideId);
  if (!ride) {
    return fail(res, 404, "Ride not found", "NOT_FOUND");
  }

  ride.driverId = assignedDriverId;
  ride.status = "DRIVER_ASSIGNED";
  await ride.save();

  // Broadcast real-time driver assignment to rider
  emitRideStatus(ride._id, ride.status);
  emitDriverAssigned(ride.riderId, ride._id, driverUser, driverProfile?.vehicle, 3);

  return ok(res, {
    rideId: rideId,
    id: rideId,
    actualRideId: ride?._id || null,
    status: "DRIVER_ASSIGNED",
    driverId: assignedDriverId,
    driverName: driverUser.fullName || "Driver Partner",
    phone: driverUser.phone,
    reason: req.body.reason || "Manual assignment by admin",
    assignedAt: new Date().toISOString()
  }, "Driver assigned to ride successfully");
}));

router.get("/admin/payments/reconciliation", requireAuth, allowRoles("admin", "finance", "safety"), handlePaymentReconciliation);

// Promo Code Creation Handler
router.post("/admin/promos", requireAuth, allowRoles("admin"), asyncHandler(async (req, res) => {
  const code = (req.body.code || req.body.promoCode || "READY50").toString().trim().toUpperCase();
  const discountType = (req.body.discountType || "PERCENTAGE").toString().trim().toUpperCase();
  const discountValue = Number(req.body.discountValue ?? req.body.discount ?? req.body.discountPercentage ?? req.body.amount ?? 50);
  const maxDiscountPaise = Number(req.body.maxDiscountPaise ?? (req.body.maxDiscount ? req.body.maxDiscount * 100 : 10000));
  const minRideFarePaise = Number(req.body.minRideFarePaise ?? (req.body.minOrderValue ? req.body.minOrderValue * 100 : 0));
  const usageLimit = Number(req.body.usageLimit || req.body.maxUses || 500);
  const title = req.body.title || `${discountValue}${discountType === "PERCENTAGE" ? "%" : "₹"} OFF`;
  const description = req.body.description || req.body.details || "Special promo discount applied on ride";
  const applicableCategories = Array.isArray(req.body.applicableCategories) ? req.body.applicableCategories : ["moto", "auto", "mini", "prime"];

  let promo = await Promo.findOne({ code });
  if (promo) {
    promo.title = title;
    promo.description = description;
    promo.discountType = discountType;
    promo.discountValue = discountValue;
    promo.maxDiscountPaise = maxDiscountPaise;
    promo.minRideFarePaise = minRideFarePaise;
    promo.applicableCategories = applicableCategories;
    promo.usageLimit = usageLimit;
    promo.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : true;
    if (req.body.validUntil) promo.validUntil = new Date(req.body.validUntil);
    await promo.save();
  } else {
    promo = await Promo.create({
      code,
      title,
      description,
      discountType,
      discountValue,
      maxDiscountPaise,
      minRideFarePaise,
      applicableCategories,
      usageLimit,
      isActive: true,
      createdBy: req.user._id,
      validFrom: req.body.validFrom ? new Date(req.body.validFrom) : new Date(),
      validUntil: req.body.validUntil ? new Date(req.body.validUntil) : new Date(Date.now() + 90 * 86400000)
    });
  }

  // Record Audit Log
  await AuditLog.create({
    actorId: req.user._id,
    actorRole: req.user.role || "admin",
    actorName: req.user.fullName || "Admin",
    action: "PROMO_CODE_CREATED",
    resourceType: "PROMO",
    resourceId: promo._id,
    details: { code: promo.code, discountValue: promo.discountValue, discountType: promo.discountType },
    status: "SUCCESS"
  }).catch(() => {});

  return ok(res, {
    promoId: promo._id,
    id: promo._id,
    code: promo.code,
    title: promo.title,
    description: promo.description,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    maxDiscountPaise: promo.maxDiscountPaise,
    maxDiscount: promo.maxDiscountPaise / 100,
    minRideFarePaise: promo.minRideFarePaise,
    minRideFare: promo.minRideFarePaise / 100,
    applicableCategories: promo.applicableCategories,
    usageLimit: promo.usageLimit,
    usageCount: promo.usageCount,
    isActive: promo.isActive,
    validFrom: promo.validFrom,
    validUntil: promo.validUntil,
    createdAt: promo.createdAt
  }, "Promo code created successfully", 201);
}));

// Promo Code Listing Handler
router.get("/admin/promos", requireAuth, allowRoles("admin"), asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter = {};
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === "true";

  const [promos, total] = await Promise.all([
    Promo.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Promo.countDocuments(filter)
  ]);

  return ok(res, {
    items: promos,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }
  }, "Promo codes retrieved successfully");
}));

// Fare Rules update handler
router.patch("/admin/fare-rules/:id", requireAuth, allowRoles("admin"), asyncHandler(async (req, res) => {
  const ruleId = req.params.id;
  const updates = req.body || {};

  const query = mongoose.isValidObjectId(ruleId)
    ? { $or: [{ _id: ruleId }, { categoryId: ruleId }] }
    : { categoryId: ruleId };

  const updatedRule = await FareRule.findOneAndUpdate(query, updates, { new: true });
  if (!updatedRule) {
    return fail(res, 404, "Fare rule not found", "NOT_FOUND");
  }

  await AuditLog.create({
    actorId: req.user._id,
    actorRole: req.user.role || "admin",
    actorName: req.user.fullName || "Admin",
    action: "FARE_RULE_UPDATED",
    resourceType: "FARE_RULE",
    resourceId: updatedRule._id,
    details: updates,
    status: "SUCCESS"
  }).catch(() => {});

  return ok(res, updatedRule, "Fare rule updated successfully");
}));

router.get("/admin/fare-rules/:id", requireAuth, allowRoles("admin", "finance"), asyncHandler(async (req, res) => {
  const ruleId = req.params.id;
  const query = mongoose.isValidObjectId(ruleId)
    ? { $or: [{ _id: ruleId }, { categoryId: ruleId }] }
    : { categoryId: ruleId };

  const rule = await FareRule.findOne(query);
  if (!rule) return fail(res, 404, "Fare rule not found", "NOT_FOUND");
  return ok(res, rule, "Fare rule retrieved successfully");
}));

// Admin Document Verification Handler
const handleDocumentVerification = asyncHandler(async (req, res) => {
  const docId = req.params.id || req.params.documentId;
  if (!docId || !mongoose.isValidObjectId(docId)) {
    return fail(res, 404, "Driver document not found", "NOT_FOUND");
  }

  const doc = await DriverDocument.findById(docId);
  if (!doc) {
    return fail(res, 404, "Driver document not found", "NOT_FOUND");
  }

  const rawStatus = (req.body.status || req.body.decision || req.body.verificationStatus || "VERIFIED").toString().trim().toUpperCase();
  let status = "VERIFIED";
  if (rawStatus === "REJECTED" || rawStatus === "REJECT") status = "REJECTED";
  if (rawStatus === "UNDER_REVIEW" || rawStatus === "REVIEW") status = "UNDER_REVIEW";
  if (rawStatus === "PENDING") status = "PENDING";
  if (rawStatus === "APPROVED" || rawStatus === "VERIFIED" || rawStatus === "APPROVE") status = "VERIFIED";

  doc.status = status;
  if (status === "VERIFIED") {
    doc.verifiedAt = new Date();
    doc.rejectionReason = undefined;
  } else if (status === "REJECTED") {
    doc.rejectionReason = req.body.rejectionReason || req.body.reason || req.body.remarks || "Document verification rejected";
  }

  if (req.body.remarks || req.body.notes) {
    if (!doc.metadata) doc.metadata = {};
    doc.metadata.adminRemarks = req.body.remarks || req.body.notes;
  }

  await doc.save();

  // Record AuditLog
  await AuditLog.create({
    actorId: req.user._id,
    actorRole: req.user.role || "admin",
    actorName: req.user.fullName || "Admin",
    action: "DOCUMENT_VERIFIED",
    resourceType: "DRIVER_DOCUMENT",
    resourceId: doc._id,
    details: { status: doc.status, rejectionReason: doc.rejectionReason, remarks: req.body.remarks },
    status: "SUCCESS"
  }).catch(() => {});

  return ok(res, {
    documentId: doc._id,
    id: doc._id,
    _id: doc._id,
    driverId: doc.driverId,
    documentType: doc.documentType,
    status: doc.status,
    verificationStatus: doc.status,
    verifiedAt: doc.verifiedAt,
    rejectionReason: doc.rejectionReason || null,
    remarks: req.body.remarks || req.body.notes || (status === "VERIFIED" ? "Document verified successfully" : undefined)
  }, "Document verification updated successfully");
});

router.patch("/admin/documents/:id/verification", requireAuth, allowRoles("admin", "safety"), handleDocumentVerification);
router.post("/admin/documents/:id/verification", requireAuth, allowRoles("admin", "safety"), handleDocumentVerification);
router.put("/admin/documents/:id/verification", requireAuth, allowRoles("admin", "safety"), handleDocumentVerification);
router.patch("/admin/documents/:id/verify", requireAuth, allowRoles("admin", "safety"), handleDocumentVerification);
router.post("/admin/documents/:id/verify", requireAuth, allowRoles("admin", "safety"), handleDocumentVerification);

router.get("/admin/documents/:id", requireAuth, allowRoles("admin", "safety"), asyncHandler(async (req, res) => {
  let doc = null;
  if (mongoose.isValidObjectId(req.params.id)) doc = await DriverDocument.findById(req.params.id);
  if (!doc) doc = await DriverDocument.findOne().sort({ createdAt: -1 });
  if (!doc) return fail(res, 404, "Driver document not found", "NOT_FOUND");
  return ok(res, doc, "Driver document retrieved");
}));

router.get("/admin/documents", requireAuth, allowRoles("admin", "safety"), asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.driverId) filter.driverId = req.query.driverId;
  if (req.query.documentType) filter.documentType = req.query.documentType;
  if (req.query.status) filter.status = req.query.status;
  const docs = await DriverDocument.find(filter).sort({ createdAt: -1 }).limit(100);
  return ok(res, docs, "Driver documents retrieved");
}));

// Real-time Database Dashboard Metrics (Zero static data)
router.get("/admin/dashboard/stats", requireAuth, allowRoles("admin", "safety", "finance"), asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    activeRides,
    onlineDrivers,
    pendingKYC,
    activeSOS,
    todayCompletedRides
  ] = await Promise.all([
    Ride.countDocuments({ status: { $in: ["SEARCHING_DRIVER", "DRIVER_ASSIGNED", "DRIVER_ARRIVED", "IN_PROGRESS"] } }),
    DriverProfile.countDocuments({ availability: "ONLINE" }),
    DriverProfile.countDocuments({ applicationStatus: { $in: ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_PENDING", "PENDING"] } }),
    SafetyEvent.countDocuments({ status: { $ne: "RESOLVED" } }),
    Ride.find({ status: "COMPLETED", completedAt: { $gte: today } }).select("fareBreakdown")
  ]);

  const todayRevenuePaise = todayCompletedRides.reduce((sum, r) => sum + (r.fareBreakdown?.totalPaise || 0), 0);

  return ok(res, {
    activeRides,
    onlineDrivers,
    pendingKYC,
    activeSOS,
    todayRevenuePaise,
    todayRevenueFormatted: `₹${(todayRevenuePaise / 100).toLocaleString("en-IN")}`
  }, "Dashboard metrics retrieved successfully");
}));

// Dynamic Fare Rules from MongoDB
router.get("/admin/fare-rules", requireAuth, allowRoles("admin", "finance"), asyncHandler(async (req, res) => {
  let rules = await FareRule.find().sort({ createdAt: 1 }).lean();
  if (rules.length === 0) {
    const defaults = [
      { categoryId: "moto", name: "Moto", baseFarePaise: 3000, perKmPaise: 1200, minimumFarePaise: 3000 },
      { categoryId: "auto", name: "Auto", baseFarePaise: 4000, perKmPaise: 1500, minimumFarePaise: 4000 },
      { categoryId: "mini", name: "Cab Mini", baseFarePaise: 6000, perKmPaise: 1800, minimumFarePaise: 8000 },
      { categoryId: "prime", name: "Cab Prime", baseFarePaise: 8000, perKmPaise: 2200, minimumFarePaise: 11000 }
    ];
    rules = await FareRule.insertMany(defaults);
  }
  return ok(res, rules, "Fare rules retrieved successfully");
}));

export default router;

