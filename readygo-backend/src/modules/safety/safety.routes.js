import mongoose from "mongoose";
import { Router } from "express";
import { z } from "zod";
import SafetyEvent from "../../models/SafetyEvent.js";
import EmergencyContact from "../../models/EmergencyContact.js";
import { requireAuth, allowRoles } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendPushNotification } from "../../services/notificationService.js";

const router=Router();

const contactSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(7).max(20),
  relationship: z.string().max(50).optional()
});

const updateContactSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(7).max(20).optional(),
  relationship: z.string().max(50).optional()
});

// Emergency Contacts Handlers
const handleGetContacts = asyncHandler(async (req, res) => {
  const contacts = await EmergencyContact.find({ userId: req.user._id }).sort({ createdAt: -1 });
  return ok(res, contacts, "Emergency contacts retrieved");
});

const handleCreateContact = asyncHandler(async (req, res) => {
  const contact = await EmergencyContact.create({ ...req.body, userId: req.user._id });
  return ok(res, contact, "Emergency contact added", 201);
});

const handleUpdateContact = asyncHandler(async (req, res) => {
  const c = await EmergencyContact.findOneAndUpdate(
    { _id: req.params.contactId, userId: req.user._id },
    req.body,
    { new: true, runValidators: true }
  );
  if (!c) return fail(res, 404, "Emergency contact not found", "NOT_FOUND");
  return ok(res, c, "Emergency contact updated");
});

const handleDeleteContact = asyncHandler(async (req, res) => {
  await EmergencyContact.deleteOne({ _id: req.params.contactId, userId: req.user._id });
  return ok(res, {}, "Emergency contact removed");
});

// Routes supporting both /rider/emergency-contacts and /safety/emergency-contacts
router.get("/rider/emergency-contacts", requireAuth, handleGetContacts);
router.get("/safety/emergency-contacts", requireAuth, handleGetContacts);
router.post("/rider/emergency-contacts", requireAuth, validateBody(contactSchema), handleCreateContact);
router.post("/safety/emergency-contacts", requireAuth, validateBody(contactSchema), handleCreateContact);
router.patch("/rider/emergency-contacts/:contactId", requireAuth, validateBody(updateContactSchema), handleUpdateContact);
router.patch("/safety/emergency-contacts/:contactId", requireAuth, validateBody(updateContactSchema), handleUpdateContact);
router.delete("/rider/emergency-contacts/:contactId", requireAuth, handleDeleteContact);
router.delete("/safety/emergency-contacts/:contactId", requireAuth, handleDeleteContact);

router.post("/safety/location-sharing", requireAuth, validateBody(z.object({
  enabled: z.boolean(),
  rideId: z.union([z.string(), z.number()]).optional().nullable()
})), asyncHandler(async (req, res) => {
  return ok(res, {
    enabled: req.body.enabled,
    rideId: req.body.rideId || null,
    updatedAt: new Date().toISOString(),
    note: "Location sharing status updated"
  }, "Location sharing updated");
}));

// SOS Emergency Trigger
const handleSosTrigger = asyncHandler(async (req, res) => {
  let rideId = req.body.rideId;
  if (typeof rideId === "string") {
    rideId = rideId.trim();
    if (rideId === "" || rideId.startsWith("{{")) {
      rideId = undefined;
    } else if (mongoose.isValidObjectId(rideId)) {
      rideId = new mongoose.Types.ObjectId(rideId);
    }
  }

  const event = await SafetyEvent.create({
    userId: req.user._id,
    rideId,
    location: {
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      accuracyMeters: req.body.accuracyMeters
    },
    message: req.body.message || "Emergency assistance requested",
    triggerSource: req.body.triggerSource || "HOLD_BUTTON",
    eventTimeline: [{ status: "OPEN", actorId: req.user._id, note: "SOS created" }]
  });

  // Send push notification to user
  sendPushNotification(req.user._id, {
    title: "SOS Alert Activated",
    body: "Emergency SOS assistance alert has been activated. Help is on the way.",
    data: { type: "SOS_ALERT", eventId: String(event._id) }
  }).catch(err => console.error("[FCM] SOS alert notification error:", err));

  return ok(res, {
    eventId: event._id,
    status: event.status,
    rideId: event.rideId || null,
    locationShared: true,
    createdAt: event.createdAt,
    notificationStatus: "QUEUED"
  }, "SOS emergency alert received successfully", 201);
});

router.post("/safety/sos", requireAuth, validateBody(z.object({
  rideId: z.union([z.string(), z.number()]).optional().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(10000).optional(),
  message: z.string().max(500).optional(),
  triggerSource: z.enum(["HOLD_BUTTON", "IN_APP", "ADMIN"]).default("HOLD_BUTTON")
})), handleSosTrigger);

router.post("/rider/safety/sos", requireAuth, validateBody(z.object({
  rideId: z.union([z.string(), z.number()]).optional().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(10000).optional(),
  message: z.string().max(500).optional(),
  triggerSource: z.enum(["HOLD_BUTTON", "IN_APP", "ADMIN"]).default("HOLD_BUTTON")
})), handleSosTrigger);
router.get("/safety/events/:eventId",requireAuth,asyncHandler(async(req,res)=>{
 const e=await SafetyEvent.findById(req.params.eventId);
 if(!e)return fail(res,404,"Safety event not found","NOT_FOUND");
 if(String(e.userId)!==String(req.user._id)&&!["admin","safety"].includes(req.user.role))return fail(res,403,"Forbidden","FORBIDDEN");
 return ok(res,e);
}));
router.post("/safety/events/:eventId/acknowledge",requireAuth,allowRoles("admin","safety"),asyncHandler(async(req,res)=>updateStatus(req,res,"ACKNOWLEDGED")));
router.post("/safety/events/:eventId/resolve",requireAuth,allowRoles("admin","safety"),asyncHandler(async(req,res)=>updateStatus(req,res,"RESOLVED")));
async function updateStatus(req,res,status){
 const e=await SafetyEvent.findById(req.params.eventId);if(!e)return fail(res,404,"Safety event not found","NOT_FOUND");
 e.status=status;e.eventTimeline.push({status,actorId:req.user._id,note:req.body?.note||""});await e.save();return ok(res,e);
}
router.get("/admin/safety/events",requireAuth,allowRoles("admin","safety"),asyncHandler(async(req,res)=>ok(res,await SafetyEvent.find({status:{$ne:"RESOLVED"}}).sort({createdAt:-1}).limit(100))));
export default router;
