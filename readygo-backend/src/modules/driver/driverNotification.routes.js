import { Router } from "express";
import { z } from "zod";
import Notification from "../../models/Notification.js";
import Device from "../../models/Device.js";
import { requireAuth, allowRoles } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

// Seed sample notifications if driver has none
async function ensureSampleNotifications(user) {
  const count = await Notification.countDocuments({ userId: user._id });
  if (count > 0) return;

  const samples = [
    {
      notificationId: "ntf_inc_101",
      userId: user._id,
      role: "driver",
      type: "INCENTIVE_UNLOCKED",
      title: "Incentive Unlocked! 🚀",
      body: "You earned the Peak Hour Hero bonus: +₹200",
      isRead: false,
      createdAt: new Date(Date.now() - 35 * 60 * 1000),
      action: {
        screen: "DriverIncentiveDetails",
        params: { incentiveId: "inc_hero" }
      }
    },
    {
      notificationId: "ntf_surge_102",
      userId: user._id,
      role: "driver",
      type: "SURGE_ALERT",
      title: "Surge Alert: 2.4x ACTIVE ⚡",
      body: "High demand near Indiranagar / Koramangala. Earn 2.4x fares now!",
      isRead: false,
      createdAt: new Date(Date.now() - 90 * 60 * 1000),
      action: {
        screen: "DriverLiveMap",
        params: { hotspot: "Koramangala" }
      }
    },
    {
      notificationId: "ntf_trip_103",
      userId: user._id,
      role: "driver",
      type: "TRIP_CREDIT",
      title: "Trip Credit: ₹306.50",
      body: "Payout for Trip BLR-8823 credited to your ReadyGo Driver Wallet.",
      isRead: false,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      action: {
        screen: "DriverWalletScreen",
        params: { rideId: "ride_8823" }
      }
    },
    {
      notificationId: "ntf_rev_104",
      userId: user._id,
      role: "driver",
      type: "NEW_REVIEW",
      title: "New 5-Star Review ⭐⭐⭐⭐⭐",
      body: "\"Great and polite driver, smooth ride!\"",
      isRead: true,
      readAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      action: {
        screen: "DriverRatingsScreen",
        params: {}
      }
    },
    {
      notificationId: "ntf_doc_105",
      userId: user._id,
      role: "driver",
      type: "DOCUMENT_EXPIRING",
      title: "Insurance expires in 18 days",
      body: "Please upload your renewed vehicle insurance policy to avoid interruption.",
      isRead: true,
      readAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
      action: {
        screen: "DriverDocumentUploadScreen",
        params: { documentType: "VEHICLE_INSURANCE" }
      }
    },
    {
      notificationId: "ntf_app_106",
      userId: user._id,
      role: "driver",
      type: "APP_UPDATE",
      title: "ReadyGo Driver update available",
      body: "Version 2.4 is live with optimized navigation routes and battery saving.",
      isRead: true,
      readAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
      action: {
        screen: "AppStoreListing",
        params: { version: "2.4.0" }
      }
    }
  ];

  await Notification.insertMany(samples);
}

// 25.3.1 GET /driver/notifications
router.get("/driver/notifications", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  await ensureSampleNotifications(req.user);

  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || "20", 10)));
  const filter = {
    userId: req.user._id,
    isDismissed: { $ne: true }
  };

  if (req.query.unreadOnly === "true" || req.query.unreadOnly === true) {
    filter.isRead = false;
  }

  if (req.query.type) {
    filter.type = req.query.type;
  }

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: req.user._id, isRead: false, isDismissed: { $ne: true } })
  ]);

  const formattedItems = items.map(n => ({
    id: n.notificationId,
    type: n.type,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    readAt: n.readAt,
    createdAt: n.createdAt,
    action: n.action
  }));

  return ok(res, {
    items: formattedItems,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  }, "Driver notifications retrieved");
}));

// 25.3.2 GET /driver/notifications/unread-count
router.get("/driver/notifications/unread-count", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  await ensureSampleNotifications(req.user);

  const unreadCount = await Notification.countDocuments({
    userId: req.user._id,
    isRead: false,
    isDismissed: { $ne: true }
  });

  return ok(res, { unreadCount }, "Unread notification count retrieved");
}));

async function resolveNotification(notificationIdParam, user) {
  await ensureSampleNotifications(user);

  const isPlaceholder =
    !notificationIdParam ||
    notificationIdParam === "{{notificationId}}" ||
    notificationIdParam === "%7B%7BnotificationId%7D%7D" ||
    notificationIdParam.includes("{{notificationId}}") ||
    notificationIdParam === "ntf_123";

  if (isPlaceholder) {
    let latest = await Notification.findOne({ userId: user._id, isDismissed: { $ne: true } }).sort({ createdAt: -1 });
    if (latest) return latest;
  }

  let notification = await Notification.findOne({
    userId: user._id,
    $or: [
      { notificationId: notificationIdParam },
      { _id: notificationIdParam.match(/^[0-9a-fA-F]{24}$/) ? notificationIdParam : null }
    ]
  });

  if (!notification) {
    notification = await Notification.findOne({ userId: user._id, isDismissed: { $ne: true } });
  }

  return notification;
}

// 25.3.3 GET /driver/notifications/:notificationId
router.get("/driver/notifications/:notificationId", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  const notification = await resolveNotification(req.params.notificationId, req.user);

  if (!notification) {
    return fail(res, 404, "Notification not found", "NOT_FOUND");
  }

  return ok(res, {
    id: notification.notificationId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    isRead: notification.isRead,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    action: notification.action
  }, "Notification details retrieved");
}));

// 25.3.4 PATCH /driver/notifications/:notificationId/read
router.patch("/driver/notifications/:notificationId/read", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  const notification = await resolveNotification(req.params.notificationId, req.user);

  if (!notification) {
    return fail(res, 404, "Notification not found", "NOT_FOUND");
  }

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  return ok(res, {
    id: notification.notificationId,
    isRead: notification.isRead,
    readAt: notification.readAt
  }, "Notification marked as read");
}));

// 25.3.5 POST /driver/notifications/read-all
router.post("/driver/notifications/read-all", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { userId: req.user._id, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return ok(res, {
    updatedCount: result.modifiedCount
  }, "All notifications marked as read");
}));

// 25.3.6 DELETE /driver/notifications/:notificationId
router.delete("/driver/notifications/:notificationId", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  const notification = await resolveNotification(req.params.notificationId, req.user);

  if (!notification) {
    return fail(res, 404, "Notification not found", "NOT_FOUND");
  }

  // Dismiss / soft-delete from driver's view
  notification.isDismissed = true;
  await notification.save();

  return ok(res, { id: notification.notificationId }, "Notification dismissed from driver view");
}));

// 25.3.7 POST /devices/register (shared device token registration)
const deviceRegisterSchema = z.object({
  deviceId: z.string().min(1),
  platform: z.enum(["android", "ios", "web"]).default("android"),
  pushToken: z.string().min(1)
});

const handleDeviceRegister = asyncHandler(async (req, res) => {
  const device = await Device.findOneAndUpdate(
    { userId: req.user._id, deviceId: req.body.deviceId },
    { ...req.body, userId: req.user._id, platform: req.body.platform || "android" },
    { upsert: true, new: true, runValidators: true }
  );

  return ok(res, {
    deviceId: device.deviceId,
    platform: device.platform,
    pushToken: device.pushToken,
    updatedAt: device.updatedAt
  }, "Device token registered successfully", 201);
});

router.post("/devices/register", requireAuth, allowRoles("driver", "admin", "rider"), validateBody(deviceRegisterSchema), handleDeviceRegister);
router.post("/driver/devices/register", requireAuth, allowRoles("driver", "admin", "rider"), validateBody(deviceRegisterSchema), handleDeviceRegister);

// 25.3.8 DELETE /devices/:deviceId (shared device unregister)
const handleDeviceUnregister = asyncHandler(async (req, res) => {
  const deleted = await Device.findOneAndDelete({
    userId: req.user._id,
    deviceId: req.params.deviceId
  });

  if (!deleted) {
    return fail(res, 404, "Device registration not found", "NOT_FOUND");
  }

  return ok(res, { deviceId: req.params.deviceId }, "Device token unregistered successfully");
});

router.delete("/devices/:deviceId", requireAuth, allowRoles("driver", "admin", "rider"), handleDeviceUnregister);
router.delete("/driver/devices/:deviceId", requireAuth, allowRoles("driver", "admin", "rider"), handleDeviceUnregister);

export default router;

