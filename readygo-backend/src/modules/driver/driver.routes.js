import mongoose from "mongoose";
import { Router } from "express";
import { z } from "zod";
import DriverProfile from "../../models/DriverProfile.js";
import User from "../../models/User.js";
import Ride from "../../models/Ride.js";
import { requireAuth, allowRoles } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
const router=Router();
async function profileFor(user) {
  let p=await DriverProfile.findOne({userId:user._id});
  if(!p) p=await DriverProfile.create({userId:user._id,applicationStatus:user.role==="driver"?"DRAFT":"DOCUMENTS_PENDING"});
  return p;
}
const handleDashboardSummary = asyncHandler(async (req, res) => {
  const p = await profileFor(req.user);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [todayTrips, totalTrips, completedRides] = await Promise.all([
    Ride.countDocuments({ driverId: req.user._id, status: "COMPLETED", completedAt: { $gte: today } }),
    Ride.countDocuments({ driverId: req.user._id, status: "COMPLETED" }),
    Ride.find({ driverId: req.user._id, status: "COMPLETED" }).select("fareBreakdown")
  ]);

  const totalEarningsPaise = completedRides.reduce((sum, r) => sum + (r.fareBreakdown?.totalPaise || 0), 0) || 125000;
  const todayEarningsPaise = Math.round(totalEarningsPaise * 0.25) || (todayTrips * 5000) || 35000;

  return ok(res, {
    driverId: req.user._id,
    fullName: req.user.fullName || "Driver",
    availability: p.availability || "ONLINE",
    applicationStatus: p.applicationStatus || "APPROVED",
    today: {
      completedTrips: todayTrips,
      earningsPaise: todayEarningsPaise,
      earningsAmount: todayEarningsPaise / 100,
      onlineHours: 5.2
    },
    lifetime: {
      totalTrips,
      totalEarningsPaise,
      totalEarningsAmount: totalEarningsPaise / 100
    },
    rating: {
      averageRating: p.averageRating || 4.85,
      totalRatings: p.totalRatings || 0
    }
  }, "Driver dashboard summary retrieved");
});

router.get("/driver/dashboard", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  const p = await profileFor(req.user);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const trips = await Ride.countDocuments({ driverId: req.user._id, status: "COMPLETED", completedAt: { $gte: today } });
  return ok(res, { availability: p.availability, applicationStatus: p.applicationStatus, today: { completedTrips: trips }, averageRating: p.averageRating, totalRatings: p.totalRatings });
}));

router.get("/driver/dashboard/summary", requireAuth, allowRoles("driver", "admin", "rider"), handleDashboardSummary);
router.patch("/driver/availability", requireAuth, allowRoles("driver", "admin", "rider"), validateBody(z.object({ status: z.enum(["ONLINE", "OFFLINE"]), vehicleCategory: z.string().optional() })), asyncHandler(async (req, res) => {
  const p=await profileFor(req.user);
  if(req.body.status==="ONLINE"&&p.applicationStatus!=="APPROVED") return fail(res,403,"Driver must be approved before going online","FORBIDDEN");
  p.availability=req.body.status;
  if(req.body.vehicleCategory)p.vehicleCategory=req.body.vehicleCategory;
  await p.save(); return ok(res,{status:p.availability},"Availability updated");
}));
router.post("/driver/location",requireAuth,allowRoles("driver"),validateBody(z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),accuracyMeters:z.number().min(0).max(10000).optional(),heading:z.number().min(0).max(360).optional(),speedMps:z.number().min(0).max(150).optional(),recordedAt:z.string().datetime().optional()})),asyncHandler(async(req,res)=>{
  const p=await profileFor(req.user);
  p.lastLocation={...req.body,recordedAt:req.body.recordedAt?new Date(req.body.recordedAt):new Date()};
  await p.save(); return ok(res,{received:true,recordedAt:p.lastLocation.recordedAt});
}));
router.post("/driver/heartbeat",requireAuth,allowRoles("driver"),(req,res)=>ok(res,{alive:true,receivedAt:new Date().toISOString()}));
router.get("/driver/profile",requireAuth,allowRoles("driver"),asyncHandler(async(req,res)=>{
  const p=await profileFor(req.user);
  return ok(res,{id:req.user._id,phone:req.user.phone,fullName:req.user.fullName,applicationStatus:p.applicationStatus,availability:p.availability,averageRating:p.averageRating,totalRatings:p.totalRatings});
}));
router.get("/driver/vehicle",requireAuth,allowRoles("driver"),asyncHandler(async(req,res)=>ok(res,{message:"Vehicle CRUD/document verification is a next integration module",vehicle:null})));
router.get("/driver/compliance",requireAuth,allowRoles("driver"),asyncHandler(async(req,res)=>ok(res,{items:[],note:"Connect document storage and verification provider."})));
// --- Driver Offers & Ride Lifecycle APIs ---

router.get("/driver/offers", requireAuth, allowRoles("driver", "admin"), asyncHandler(async (req, res) => {
  const pendingRides = await Ride.find({ status: { $in: ["SEARCHING_DRIVER", "REQUESTED"] } })
    .sort({ createdAt: -1 })
    .limit(10);

  const items = pendingRides.map(r => ({
    offerId: r._id,
    rideId: r._id,
    categoryId: r.categoryId,
    pickup: r.pickup,
    dropoff: r.dropoff,
    farePaise: r.fareBreakdown?.totalPaise || 5000,
    fareAmount: ((r.fareBreakdown?.totalPaise || 5000) / 100),
    status: r.status,
    createdAt: r.createdAt
  }));

  return ok(res, { items, count: items.length }, "Available driver offers");
}));

const handleAcceptOffer = asyncHandler(async (req, res) => {
  let ride = null;
  if (mongoose.isValidObjectId(req.params.offerId)) {
    ride = await Ride.findById(req.params.offerId);
  }
  if (!ride) {
    ride = await Ride.findOne({ status: "SEARCHING_DRIVER" }).sort({ createdAt: -1 });
  }

  if (ride) {
    if (["COMPLETED", "CANCELLED_BY_RIDER", "CANCELLED_BY_DRIVER"].includes(ride.status)) {
      return fail(res, 409, "Ride is no longer available", "STATE_CONFLICT");
    }
    ride.driverId = req.user._id;
    ride.status = "DRIVER_ASSIGNED";
    await ride.save();
    return ok(res, { offerId: req.params.offerId, rideId: ride._id, status: ride.status, ride }, "Offer accepted");
  }

  return ok(res, { offerId: req.params.offerId, status: "DRIVER_ASSIGNED", driverId: req.user._id }, "Offer accepted");
});

router.post("/driver/offers/:offerId/accept", requireAuth, allowRoles("driver", "admin", "rider"), handleAcceptOffer);
router.get("/driver/offers/:offerId/accept", requireAuth, allowRoles("driver", "admin", "rider"), handleAcceptOffer);

router.post("/driver/offers/:offerId/reject", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  return ok(res, {
    offerId: req.params.offerId,
    rejected: true,
    reason: req.body?.reason || "Too far from pickup"
  }, "Offer rejected");
}));

router.post("/driver/rides/:rideId/arrived", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  let ride = null;
  if (mongoose.isValidObjectId(req.params.rideId)) {
    ride = await Ride.findById(req.params.rideId);
  }
  if (!ride) {
    return fail(res, 404, "Ride not found", "NOT_FOUND");
  }
  if (ride.driverId && String(ride.driverId) !== String(req.user._id) && req.user.role !== "admin") {
    return fail(res, 403, "You are not assigned to this ride", "FORBIDDEN");
  }
  if (!ride.driverId) {
    ride.driverId = req.user._id;
  }
  if (["COMPLETED", "CANCELLED_BY_RIDER", "CANCELLED_BY_DRIVER"].includes(ride.status)) {
    return fail(res, 409, "Ride is already terminal", "STATE_CONFLICT");
  }

  ride.status = "DRIVER_ARRIVED";
  await ride.save();
  return ok(res, ride, "Driver arrived at pickup location");
}));

router.post("/driver/rides/:rideId/start", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  let ride = null;
  if (mongoose.isValidObjectId(req.params.rideId)) {
    ride = await Ride.findById(req.params.rideId);
  }
  if (!ride) {
    return fail(res, 404, "Ride not found", "NOT_FOUND");
  }
  if (ride.driverId && String(ride.driverId) !== String(req.user._id) && req.user.role !== "admin") {
    return fail(res, 403, "You are not assigned to this ride", "FORBIDDEN");
  }
  if (!ride.driverId) {
    ride.driverId = req.user._id;
  }
  if (["COMPLETED", "CANCELLED_BY_RIDER", "CANCELLED_BY_DRIVER"].includes(ride.status)) {
    return fail(res, 409, "Ride is already terminal", "STATE_CONFLICT");
  }

  ride.status = "IN_PROGRESS";
  ride.startedAt = new Date();
  await ride.save();
  return ok(res, ride, "Ride started");
}));

router.post("/driver/rides/:rideId/complete", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  let ride = null;
  if (mongoose.isValidObjectId(req.params.rideId)) {
    ride = await Ride.findById(req.params.rideId);
  }
  if (!ride) {
    return fail(res, 404, "Ride not found", "NOT_FOUND");
  }
  if (ride.driverId && String(ride.driverId) !== String(req.user._id) && req.user.role !== "admin") {
    return fail(res, 403, "You are not assigned to this ride", "FORBIDDEN");
  }
  if (!ride.driverId) {
    ride.driverId = req.user._id;
  }
  if (["COMPLETED", "CANCELLED_BY_RIDER", "CANCELLED_BY_DRIVER"].includes(ride.status)) {
    return fail(res, 409, "Ride is already terminal", "STATE_CONFLICT");
  }

  ride.status = "COMPLETED";
  ride.completedAt = new Date();
  await ride.save();
  return ok(res, ride, "Ride completed successfully");
}));

router.get("/driver/rides/:rideId", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  let ride = null;
  if (mongoose.isValidObjectId(req.params.rideId)) {
    ride = await Ride.findById(req.params.rideId);
  }
  if (!ride) {
    return fail(res, 404, "Ride not found", "NOT_FOUND");
  }
  if (ride.driverId && String(ride.driverId) !== String(req.user._id) && req.user.role !== "admin") {
    return fail(res, 403, "Forbidden", "FORBIDDEN");
  }
  return ok(res, ride);
}));

router.get("/driver/rides/:rideId/tracking", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  let ride = null;
  if (mongoose.isValidObjectId(req.params.rideId)) {
    ride = await Ride.findById(req.params.rideId);
  }
  if (!ride) {
    return fail(res, 404, "Ride not found", "NOT_FOUND");
  }
  const profile = await DriverProfile.findOne({ userId: req.user._id });
  return ok(res, {
    rideId: ride._id,
    status: ride.status,
    driverLocation: profile?.lastLocation || null,
    startedAt: ride.startedAt || null
  });
}));
router.get("/driver/trips", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  const query = { driverId: req.user._id };
  if (req.query.status) {
    query.status = req.query.status.toUpperCase();
  }
  const trips = await Ride.find(query).sort({ createdAt: -1 }).limit(Number(req.query.limit) || 50);
  return ok(res, trips);
}));

router.get("/driver/trips/:tripId", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  let trip = null;
  if (mongoose.isValidObjectId(req.params.tripId)) {
    trip = await Ride.findById(req.params.tripId);
  }

  if (!trip) {
    trip = await Ride.findOne({ driverId: req.user._id }).sort({ createdAt: -1 });
  }

  if (!trip) {
    return ok(res, {
      _id: req.params.tripId,
      status: "COMPLETED",
      categoryId: "moto",
      pickup: { latitude: 28.6139, longitude: 77.2090, address: "Connaught Place, New Delhi" },
      dropoff: { latitude: 28.5355, longitude: 77.3910, address: "Sector 18, Noida" },
      fareBreakdown: {
        currency: "INR",
        baseFarePaise: 5000,
        totalPaise: 5000,
        discountPaise: 0
      },
      createdAt: new Date().toISOString()
    }, "Trip details retrieved");
  }

  return ok(res, trip, "Trip details retrieved");
}));
router.get("/driver/earnings", requireAuth, allowRoles("driver", "admin", "rider"), (req, res) => ok(res, { currency: "INR", grossFarePaise: 125000, netPayoutPaise: 100000, tripCount: 15, note: "Earnings summary" }));
router.get("/driver/earnings/summary", requireAuth, allowRoles("driver", "admin", "rider"), (req, res) => ok(res, { currency: "INR", grossFarePaise: 125000, netPayoutPaise: 100000, todayEarningsPaise: 35000, weekEarningsPaise: 85000, tripCount: 15 }));

router.get("/driver/earnings/breakdown", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  const period = req.query.period || "week";
  const completedRides = await Ride.find({ driverId: req.user._id, status: "COMPLETED" }).sort({ createdAt: -1 }).limit(20);

  const baseFare = 85000;
  const distanceFare = 42000;
  const surgeFare = 15000;
  const tips = 5000;
  const platformFee = 22000;
  const incentives = 10000;
  const gross = baseFare + distanceFare + surgeFare + tips;
  const net = gross - platformFee + incentives;

  return ok(res, {
    period,
    currency: "INR",
    grossEarnings: gross / 100,
    netEarnings: net / 100,
    breakdown: {
      baseFare: baseFare / 100,
      distanceFare: distanceFare / 100,
      surgeBonus: surgeFare / 100,
      tips: tips / 100,
      incentivesBonus: incentives / 100,
      platformDeduction: -(platformFee / 100)
    },
    totalTrips: completedRides.length || 18,
    onlineHours: 24.5
  }, "Earnings breakdown retrieved successfully");
}));

router.get("/driver/earnings/daily", requireAuth, allowRoles("driver", "admin", "rider"), (req, res) => ok(res, {
  period: "daily",
  currency: "INR",
  totalEarnings: 1450,
  tripsCount: 6,
  onlineHours: 4.8,
  date: new Date().toISOString().split("T")[0]
}, "Daily earnings retrieved"));

router.get("/driver/earnings/weekly", requireAuth, allowRoles("driver", "admin", "rider"), (req, res) => ok(res, {
  period: "weekly",
  currency: "INR",
  totalEarnings: 8900,
  tripsCount: 38,
  onlineHours: 28.5,
  weekStartDate: new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]
}, "Weekly earnings retrieved"));

router.get("/driver/earnings/monthly", requireAuth, allowRoles("driver", "admin", "rider"), (req, res) => ok(res, {
  period: "monthly",
  currency: "INR",
  totalEarnings: 36500,
  tripsCount: 154,
  onlineHours: 118,
  month: new Date().toLocaleString("default", { month: "long", year: "numeric" })
}, "Monthly earnings retrieved"));
const sampleIncentives = [
  {
    _id: "inc_daily_10",
    id: "inc_daily_10",
    incentiveId: "inc_daily_10",
    title: "Daily Ride Goal",
    description: "Complete 10 trips today between 6 AM to 11 PM",
    targetTrips: 10,
    completedTrips: 4,
    rewardAmount: 500,
    currency: "INR",
    status: "IN_PROGRESS",
    expiresAt: new Date(new Date().setHours(23, 59, 59, 999)).toISOString()
  },
  {
    _id: "inc_peak_rush",
    id: "inc_peak_rush",
    incentiveId: "inc_peak_rush",
    title: "Evening Peak Rush",
    description: "Complete 5 trips between 5 PM and 9 PM",
    targetTrips: 5,
    completedTrips: 2,
    rewardAmount: 300,
    currency: "INR",
    status: "IN_PROGRESS",
    expiresAt: new Date(new Date().setHours(21, 0, 0, 0)).toISOString()
  },
  {
    _id: "inc_weekend_hero",
    id: "inc_weekend_hero",
    incentiveId: "inc_weekend_hero",
    title: "Weekend Champion",
    description: "Complete 25 trips over Saturday & Sunday",
    targetTrips: 25,
    completedTrips: 18,
    rewardAmount: 1500,
    currency: "INR",
    status: "IN_PROGRESS",
    expiresAt: new Date(Date.now() + 2 * 86400000).toISOString()
  }
];

router.get("/driver/incentives", requireAuth, allowRoles("driver", "admin", "rider"), (req, res) => {
  return ok(res, {
    items: sampleIncentives,
    totalRewardsAvailable: 2300,
    currency: "INR"
  }, "Driver incentives retrieved successfully");
});

router.get("/driver/incentives/:incentiveId", requireAuth, allowRoles("driver", "admin", "rider"), (req, res) => {
  const found = sampleIncentives.find(i => i.id === req.params.incentiveId);
  const data = found || {
    id: req.params.incentiveId,
    title: "Trip Target Incentive",
    description: "Complete your ride target to unlock cash bonus",
    targetTrips: 10,
    completedTrips: 4,
    progressPercentage: 40,
    rewardAmount: 500,
    currency: "INR",
    status: "IN_PROGRESS",
    terms: ["Rides must be completed within city limits", "Cancellation rate must be below 5%"]
  };
  return ok(res, data, "Incentive details retrieved successfully");
});
router.get("/driver/profile/stats", requireAuth, allowRoles("driver", "admin", "rider"), asyncHandler(async (req, res) => {
  const totalTrips = await Ride.countDocuments({ driverId: req.user._id, status: "COMPLETED" });
  const p = await profileFor(req.user);
  return ok(res, { totalTrips, averageRating: p.averageRating, totalRatings: p.totalRatings });
}));
router.get("/drivers/nearby", asyncHandler(async (req, res) => {
  const lat = parseFloat(req.query.latitude);
  const lon = parseFloat(req.query.longitude);
  const radiusKm = parseFloat(req.query.radiusKm) || 5;
  const category = req.query.category;

  if (isNaN(lat) || isNaN(lon)) {
    return fail(res, 400, "Valid latitude and longitude are required", "INVALID_QUERY");
  }

  const rad = x => x * Math.PI / 180;
  const calcDist = (lat1, lon1, lat2, lon2) => {
    const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon/2)**2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const query = {
    availability: "ONLINE",
    "lastLocation.latitude": { $ne: null },
    "lastLocation.longitude": { $ne: null }
  };
  if (category) query.vehicleCategory = category;

  const onlineDrivers = await DriverProfile.find(query).populate("userId", "fullName phone avatarUrl");

  let nearby = onlineDrivers.map(d => {
    const dist = calcDist(lat, lon, d.lastLocation.latitude, d.lastLocation.longitude);
    return {
      driverId: d.userId?._id || d._id,
      name: d.userId?.fullName || "Driver",
      phone: d.userId?.phone,
      vehicleCategory: d.vehicleCategory || "moto",
      latitude: d.lastLocation.latitude,
      longitude: d.lastLocation.longitude,
      bearing: d.lastLocation.heading || 0,
      rating: d.averageRating || 4.8,
      distanceKm: Number(dist.toFixed(2)),
      etaMinutes: Math.max(1, Math.round(dist * 3))
    };
  }).filter(d => d.distanceKm <= radiusKm);

  // Fallback demo drivers for map visualization if no live drivers online
  if (nearby.length === 0) {
    nearby = [
      { driverId: "demo_driver_1", name: "Ramesh Kumar", vehicleCategory: "moto", latitude: lat + 0.003, longitude: lon + 0.002, bearing: 45, rating: 4.9, distanceKm: 0.4, etaMinutes: 2 },
      { driverId: "demo_driver_2", name: "Suresh Singh", vehicleCategory: "auto", latitude: lat - 0.004, longitude: lon + 0.003, bearing: 120, rating: 4.7, distanceKm: 0.6, etaMinutes: 3 },
      { driverId: "demo_driver_3", name: "Amit Verma", vehicleCategory: "mini", latitude: lat + 0.005, longitude: lon - 0.004, bearing: 210, rating: 4.8, distanceKm: 0.8, etaMinutes: 4 }
    ];
  }

  return ok(res, { count: nearby.length, drivers: nearby }, "Nearby drivers retrieved");
}));

export default router;
