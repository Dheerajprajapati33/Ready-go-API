import mongoose from "mongoose";
import { Router } from "express";
import { z } from "zod";
import SavedPlace from "../../models/SavedPlace.js";
import Ride from "../../models/Ride.js";
import Rating from "../../models/Rating.js";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

const createSavedPlaceSchema = z.object({
  type: z.enum(["HOME", "WORK", "GYM", "CAFE", "CUSTOM"]).default("CUSTOM"),
  name: z.string().trim().max(100).optional(),
  address: z.string().trim().min(1, "Address is required").max(300),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  placeId: z.string().trim().max(255).optional().nullable()
}).refine(data => {
  if (data.type === "CUSTOM" && (!data.name || data.name.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Name is required for CUSTOM saved places",
  path: ["name"]
});

const updateSavedPlaceSchema = z.object({
  type: z.enum(["HOME", "WORK", "GYM", "CAFE", "CUSTOM"]).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  address: z.string().trim().min(1).max(300).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  placeId: z.string().trim().max(255).optional().nullable()
});

const formatPlace = (p) => {
  const idStr = p._id ? p._id.toString() : (p.id || "");
  const pId = p.placeId && p.placeId !== "null" ? p.placeId : idStr;
  return {
    id: idStr,
    placeId: pId,
    type: p.type,
    name: p.name,
    address: p.address,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  };
};

// GET /rider/account/overview - Load My Account screen summary
router.get(
  "/rider/account/overview",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;

    // 1. Calculate rider ratings if any
    const ratingAgg = await Rating.aggregate([
      { $match: { raterId: user._id, moderationStatus: "PUBLISHED" } },
      { $group: { _id: null, avgStars: { $avg: "$stars" }, count: { $sum: 1 } } }
    ]);
    const averageRating = ratingAgg[0]?.avgStars ? Number(ratingAgg[0].avgStars.toFixed(1)) : 4.9;
    const totalRatings = ratingAgg[0]?.count || 0;

    // 2. Count total rides & completed rides
    const [totalRides, completedRides] = await Promise.all([
      Ride.countDocuments({ riderId: user._id }),
      Ride.countDocuments({ riderId: user._id, status: "COMPLETED" })
    ]);

    // 3. Available account menu items
    const menuItems = [
      { id: "saved_places", title: "Saved Places", subtitle: "Manage favorite locations", route: "/rider/saved-places", icon: "bookmark" },
      { id: "payment_methods", title: "Payment Methods", subtitle: "UPI, Cards, Cash", route: "/rider/payments/methods", icon: "credit-card" },
      { id: "emergency_contacts", title: "Emergency Contacts", subtitle: "Trusted safety contacts", route: "/rider/safety/contacts", icon: "shield" },
      { id: "help_support", title: "Help & Support", subtitle: "FAQs, chat & tickets", route: "/rider/support", icon: "help-circle" },
      { id: "refer_earn", title: "Refer & Earn", subtitle: "Share & get ride discounts", route: "/rider/referrals", icon: "gift" },
      { id: "settings", title: "Settings", subtitle: "Privacy & notification preferences", route: "/rider/preferences", icon: "settings" }
    ];

    return ok(res, {
      profile: {
        id: user._id,
        phone: user.phone,
        fullName: user.fullName || "ReadyGo Rider",
        email: user.email || "",
        avatarUrl: user.avatarUrl || null,
        referralCode: user.referralCode || "",
        profileCompleted: Boolean(user.profileCompleted)
      },
      rating: {
        averageRating,
        totalRatings
      },
      rides: {
        total: totalRides,
        completed: completedRides
      },
      menuItems
    }, "Account overview retrieved successfully");
  })
);

// GET /rider/saved-places - List current rider's saved places
router.get(
  "/rider/saved-places",
  requireAuth,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filter = { userId: req.user._id };

    const [items, total] = await Promise.all([
      SavedPlace.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      SavedPlace.countDocuments(filter)
    ]);

    return ok(res, {
      items: items.map(formatPlace),
      pagination: { page, limit, total }
    }, "Saved places fetched");
  })
);

// POST /rider/saved-places - Create a saved place
router.post(
  "/rider/saved-places",
  requireAuth,
  validateBody(createSavedPlaceSchema),
  asyncHandler(async (req, res) => {
    const { type, name, address, latitude, longitude, placeId } = req.body;

    const defaultNames = {
      HOME: "Home",
      WORK: "Work / Office",
      GYM: "Gym",
      CAFE: "Cafe",
      CUSTOM: "Favorite Place"
    };

    const finalName = name && name.trim() ? name.trim() : (defaultNames[type] || "Saved Place");
    const id = new mongoose.Types.ObjectId();
    const finalPlaceId = placeId && placeId.trim() ? placeId.trim() : id.toString();

    const place = await SavedPlace.create({
      _id: id,
      userId: req.user._id,
      type: type || "CUSTOM",
      name: finalName,
      address,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      placeId: finalPlaceId
    });

    return ok(res, formatPlace(place), "Saved place created successfully", 201);
  })
);

// GET /rider/saved-places/:placeId - Fetch one saved place for edit/details
router.get(
  "/rider/saved-places/:placeId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { placeId } = req.params;
    const isObjectId = mongoose.isValidObjectId(placeId);
    const query = isObjectId
      ? { $or: [{ _id: placeId }, { placeId: placeId }], userId: req.user._id }
      : { placeId: placeId, userId: req.user._id };

    const place = await SavedPlace.findOne(query);

    if (!place) {
      return fail(res, 404, "Saved place not found", "NOT_FOUND");
    }

    return ok(res, formatPlace(place), "Saved place fetched successfully");
  })
);

// PATCH /rider/saved-places/:placeId - Edit a saved place
router.patch(
  "/rider/saved-places/:placeId",
  requireAuth,
  validateBody(updateSavedPlaceSchema),
  asyncHandler(async (req, res) => {
    const { placeId } = req.params;
    const isObjectId = mongoose.isValidObjectId(placeId);
    const query = isObjectId
      ? { $or: [{ _id: placeId }, { placeId: placeId }], userId: req.user._id }
      : { placeId: placeId, userId: req.user._id };

    const place = await SavedPlace.findOne(query);

    if (!place) {
      return fail(res, 404, "Saved place not found", "NOT_FOUND");
    }

    if (req.body.type !== undefined) place.type = req.body.type;
    if (req.body.name !== undefined) place.name = req.body.name.trim();
    if (req.body.address !== undefined) place.address = req.body.address.trim();
    if (req.body.latitude !== undefined) place.latitude = req.body.latitude;
    if (req.body.longitude !== undefined) place.longitude = req.body.longitude;
    if (req.body.placeId !== undefined) place.placeId = req.body.placeId;

    await place.save();

    return ok(res, formatPlace(place), "Saved place updated successfully");
  })
);

// DELETE /rider/saved-places/:placeId - Delete a saved place
router.delete(
  "/rider/saved-places/:placeId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { placeId } = req.params;
    const isObjectId = mongoose.isValidObjectId(placeId);
    const query = isObjectId
      ? { $or: [{ _id: placeId }, { placeId: placeId }], userId: req.user._id }
      : { placeId: placeId, userId: req.user._id };

    const place = await SavedPlace.findOne(query);

    if (!place) {
      return fail(res, 404, "Saved place not found", "NOT_FOUND");
    }

    await SavedPlace.deleteOne({ _id: place._id });

    return ok(res, { id: place._id.toString() }, "Saved place deleted successfully");
  })
);

export default router;

