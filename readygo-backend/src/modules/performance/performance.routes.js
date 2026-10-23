import { Router } from "express";
import { requireAuth, allowRoles } from "../../middleware/auth.js";
import Ride from "../../models/Ride.js";
import Rating from "../../models/Rating.js";
import { ok } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
const router=Router();
router.get("/driver/performance",requireAuth,allowRoles("driver"),asyncHandler(async(req,res)=>{
 const days=String(req.query.period||"30d").match(/^(\d+)d$/);
 const from=new Date(Date.now()-(Number(days?.[1]||30)*86400000));
 const [completed,cancelled,ratings,allAssigned]=await Promise.all([
  Ride.countDocuments({driverId:req.user._id,status:"COMPLETED",createdAt:{$gte:from}}),
  Ride.countDocuments({driverId:req.user._id,status:"CANCELLED_BY_DRIVER",createdAt:{$gte:from}}),
  Rating.aggregate([{$match:{driverId:req.user._id,moderationStatus:"PUBLISHED",createdAt:{$gte:from}}},{$group:{_id:null,avg:{$avg:"$stars"},count:{$sum:1}}}]),
  Ride.countDocuments({driverId:req.user._id,createdAt:{$gte:from}})
 ]);
 const average=Number((ratings[0]?.avg||0).toFixed(2));
 const cancellationRate=allAssigned?Number((cancelled/allAssigned*100).toFixed(1)):0;
 const score=Math.max(0,Math.min(100,Math.round((average/5)*50+(completed/Math.max(1,allAssigned))*30+(100-cancellationRate)*0.2)));
 return ok(res,{period:req.query.period||"30d",driverScore:score,scoreOutOf:100,tier:score>=90?"PRO_PILOT":score>=75?"PILOT":"STANDARD",metrics:{
  acceptanceRate:{value:null,change:null,unit:"PERCENT",note:"Requires dispatch offer events"},
  completionRate:{value:allAssigned?Number((completed/allAssigned*100).toFixed(1)):0,change:null,unit:"PERCENT"},
  onTimePickupRate:{value:null,change:null,unit:"PERCENT",note:"Requires driver-arrived timestamps and SLA definition"},
  averageRating:{value:average,change:null,outOf:5},
  cancellationRate:{value:cancellationRate,change:null,unit:"PERCENT"}
 },shiftAnalytics:{averageShiftHours:null,tripsPerHour:null,longestShiftHours:null,bestDay:null},definitionsVersion:"v1"});
}));
router.get("/driver/performance/trends",requireAuth,allowRoles("driver"),(req,res)=>ok(res,{period:req.query.period||"week",items:[]}));
router.get("/driver/performance/shifts",requireAuth,allowRoles("driver"),(req,res)=>ok(res,{items:[]}));
router.get("/driver/performance/score-breakdown",requireAuth,allowRoles("driver"),(req,res)=>ok(res,{version:"v1",description:"ReadyGo driver performance score"}));
export default router;
