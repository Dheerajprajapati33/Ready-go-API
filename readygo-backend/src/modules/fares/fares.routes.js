import { Router } from "express";
import { z } from "zod";
import FareQuote from "../../models/FareQuote.js";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
const router = Router();
const categories = [
  { id:"moto", name:"ReadyGo Moto", baseFarePaise:5000, perKmPaise:1800, etaMinutes:3 },
  { id:"auto", name:"ReadyGo Auto", baseFarePaise:7000, perKmPaise:2500, etaMinutes:5 },
  { id:"mini", name:"ReadyGo Mini", baseFarePaise:10000, perKmPaise:3500, etaMinutes:7 },
  { id:"prime", name:"ReadyGo Prime", baseFarePaise:15000, perKmPaise:4800, etaMinutes:10 }
];
router.get("/vehicle-categories", (req,res)=>ok(res,categories.map(({baseFarePaise,perKmPaise,...x})=>x)));
router.get("/vehicle-categories/:categoryId", (req, res) => {
  const cat = categories.find(c => c.id.toLowerCase() === req.params.categoryId.toLowerCase());
  if (!cat) return fail(res, 404, "Vehicle category not found", "NOT_FOUND");
  const { baseFarePaise, perKmPaise, ...rest } = cat;
  return ok(res, { ...rest, baseFarePaise, perKmPaise });
});
const point = z.object({latitude:z.number().min(-90).max(90), longitude:z.number().min(-180).max(180), address:z.string().max(300).optional()});
router.post("/fares/quote", requireAuth, validateBody(z.object({pickup:point,dropoff:point})), asyncHandler(async(req,res)=>{
  const {pickup,dropoff}=req.body;
  const rad = x => x * Math.PI / 180;
  const dLat=rad(dropoff.latitude-pickup.latitude), dLon=rad(dropoff.longitude-pickup.longitude);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(pickup.latitude))*Math.cos(rad(dropoff.latitude))*Math.sin(dLon/2)**2;
  const distanceKm=Math.max(0.5,6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
  const options=categories.map(c=>({categoryId:c.id,name:c.name,etaMinutes:c.etaMinutes,farePaise:Math.round(c.baseFarePaise+distanceKm*c.perKmPaise)}));
  const quote=await FareQuote.create({riderId:req.user._id,pickup,dropoff,distanceKm,options,expiresAt:new Date(Date.now()+10*60000)});
  return ok(res,{quoteId:quote._id,currency:"INR",distanceKm:Number(distanceKm.toFixed(2)),expiresAt:quote.expiresAt,options,pricingVersion:"demo-v1"},"Fare quote created",201);
}));
router.get("/fares/quotes/:quoteId",requireAuth,asyncHandler(async(req,res)=>{
  const q=await FareQuote.findOne({_id:req.params.quoteId,riderId:req.user._id});
  if(!q) return fail(res,404,"Fare quote not found","NOT_FOUND");
  if(q.expiresAt < new Date()) return fail(res,410,"Fare quote expired","QUOTE_EXPIRED");
  return ok(res,q);
}));
router.post("/routes/estimate",requireAuth,validateBody(z.object({pickup:point,dropoff:point})),asyncHandler(async(req,res)=>{
  return ok(res,{provider:"straight-line-demo",distanceKm:null,etaMinutes:null,note:"Configure a routing provider for road distance and ETA."});
}));
router.get("/places/search",requireAuth,(req,res)=>ok(res,{items:[],query:req.query.q||"",note:"Configure a geocoding provider."}));
export default router;
