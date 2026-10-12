import { Router } from "express";
import { z } from "zod";
import SafetyEvent from "../../models/SafetyEvent.js";
import EmergencyContact from "../../models/EmergencyContact.js";
import { requireAuth, allowRoles } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
const router=Router();
router.get("/rider/emergency-contacts",requireAuth,asyncHandler(async(req,res)=>ok(res,await EmergencyContact.find({userId:req.user._id}))));
router.post("/rider/emergency-contacts",requireAuth,validateBody(z.object({name:z.string().min(1).max(100),phone:z.string().min(7).max(20),relationship:z.string().max(50).optional()})),asyncHandler(async(req,res)=>ok(res,await EmergencyContact.create({...req.body,userId:req.user._id}),"Contact added",201)));
router.patch("/rider/emergency-contacts/:contactId",requireAuth,validateBody(z.object({name:z.string().min(1).max(100).optional(),phone:z.string().min(7).max(20).optional(),relationship:z.string().max(50).optional()})),asyncHandler(async(req,res)=>{
 const c=await EmergencyContact.findOneAndUpdate({_id:req.params.contactId,userId:req.user._id},req.body,{new:true,runValidators:true});
 if(!c)return fail(res,404,"Contact not found","NOT_FOUND");return ok(res,c);
}));
router.delete("/rider/emergency-contacts/:contactId",requireAuth,asyncHandler(async(req,res)=>{await EmergencyContact.deleteOne({_id:req.params.contactId,userId:req.user._id});return ok(res,{},"Contact removed");}));
router.post("/safety/location-sharing",requireAuth,validateBody(z.object({enabled:z.boolean(),rideId:z.string().optional()})),asyncHandler(async(req,res)=>ok(res,{enabled:req.body.enabled,rideId:req.body.rideId||null,updatedAt:new Date().toISOString(),note:"Persist consent/location-sharing state before production"})));
router.post("/safety/sos",requireAuth,validateBody(z.object({
 rideId:z.string().optional(),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),
 accuracyMeters:z.number().min(0).max(10000).optional(),message:z.string().max(500).optional(),triggerSource:z.enum(["HOLD_BUTTON","IN_APP"]).default("HOLD_BUTTON")
})),asyncHandler(async(req,res)=>{
 const event=await SafetyEvent.create({userId:req.user._id,rideId:req.body.rideId||undefined,location:{latitude:req.body.latitude,longitude:req.body.longitude,accuracyMeters:req.body.accuracyMeters},message:req.body.message,triggerSource:req.body.triggerSource,eventTimeline:[{status:"OPEN",actorId:req.user._id,note:"SOS created"}]});
 // TODO: enqueue safety-desk and emergency-contact notifications; do not silently treat this as delivered.
 return ok(res,{eventId:event._id,status:event.status,locationShared:true,createdAt:event.createdAt,notificationStatus:"NOT_CONFIGURED"},"SOS received",201);
}));
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
