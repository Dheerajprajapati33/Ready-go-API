import { Router } from "express";
import { z } from "zod";
import FareQuote from "../../models/FareQuote.js";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getDirections, getPlaceAutocomplete } from "../../services/googleMapsService.js";
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
  let distanceKm;
  let durationMinutes = null;
  let polyline = null;

  try {
    const route = await getDirections(pickup, dropoff, { mode: "driving" });
    distanceKm = route.distanceKm;
    durationMinutes = route.durationMinutes;
    polyline = route.polyline;
  } catch (err) {
    // Fallback to straight-line Haversine distance if Google Maps API key / billing is inactive
    const rad = x => x * Math.PI / 180;
    const dLat=rad(dropoff.latitude-pickup.latitude), dLon=rad(dropoff.longitude-pickup.longitude);
    const a=Math.sin(dLat/2)**2+Math.cos(rad(pickup.latitude))*Math.cos(rad(dropoff.latitude))*Math.sin(dLon/2)**2;
    distanceKm=Math.max(0.5,6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
  }

  const options=categories.map(c=>({
    categoryId:c.id,
    name:c.name,
    etaMinutes:c.etaMinutes,
    farePaise:Math.round(c.baseFarePaise+distanceKm*c.perKmPaise)
  }));

  const quote=await FareQuote.create({riderId:req.user._id,pickup,dropoff,distanceKm,options,expiresAt:new Date(Date.now()+10*60000)});
  return ok(res,{
    quoteId:quote._id,
    currency:"INR",
    distanceKm:Number(distanceKm.toFixed(2)),
    durationMinutes,
    polyline,
    expiresAt:quote.expiresAt,
    options,
    pricingVersion:"v1-google-maps"
  },"Fare quote created",201);
}));
router.get("/fares/quotes/:quoteId",requireAuth,asyncHandler(async(req,res)=>{
  const q=await FareQuote.findOne({_id:req.params.quoteId,riderId:req.user._id});
  if(!q) return fail(res,404,"Fare quote not found","NOT_FOUND");
  if(q.expiresAt < new Date()) return fail(res,410,"Fare quote expired","QUOTE_EXPIRED");
  return ok(res,q);
}));
router.post("/routes/estimate",requireAuth,validateBody(z.object({pickup:point,dropoff:point})),asyncHandler(async(req,res)=>{
  try {
    const route = await getDirections(req.body.pickup, req.body.dropoff, { mode: "driving" });
    return ok(res, {
      provider: "google-maps",
      distanceKm: route.distanceKm,
      distanceMeters: route.distanceMeters,
      durationMinutes: route.durationMinutes,
      durationText: route.durationText,
      polyline: route.polyline
    }, "Route estimated successfully");
  } catch (err) {
    return fail(res, err.statusCode || 500, err.message, err.code || "ESTIMATE_FAILED");
  }
}));
router.get("/places/search",requireAuth,asyncHandler(async(req,res)=>{
  const query = req.query.q || req.query.input || "";
  if (!query.trim()) return ok(res, { items: [], query: "" });
  try {
    const items = await getPlaceAutocomplete(query);
    return ok(res, { items, query }, "Places found");
  } catch (err) {
    return fail(res, err.statusCode || 500, err.message, err.code || "SEARCH_FAILED");
  }
}));
export default router;
