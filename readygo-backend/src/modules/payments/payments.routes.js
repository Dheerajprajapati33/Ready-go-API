import { Router } from "express";
import { z } from "zod";
import Payment from "../../models/Payment.js";
import Ride from "../../models/Ride.js";
import { requireAuth, allowRoles } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
const router=Router();
router.get("/payments/methods",requireAuth,(req,res)=>ok(res,[{id:"upi",type:"UPI",enabled:true},{id:"card",type:"CARD",enabled:true},{id:"cash",type:"CASH",enabled:true}]));
router.post("/payments/intents",requireAuth,validateBody(z.object({purpose:z.enum(["RIDE_PAYMENT","WALLET_TOPUP"]),rideId:z.string().optional(),paymentMethodId:z.string().optional()})),asyncHandler(async(req,res)=>{
 let amountPaise=0;
 if(req.body.purpose==="RIDE_PAYMENT"){
  const ride=await Ride.findOne({_id:req.body.rideId,riderId:req.user._id});
  if(!ride)return fail(res,404,"Ride not found","NOT_FOUND");
  amountPaise=ride.fareBreakdown?.totalPaise||0;
 }
 const key=req.get("Idempotency-Key");
 if(key){const existing=await Payment.findOne({idempotencyKey:key});if(existing)return ok(res,existing,"Existing idempotent payment intent");}
 const payment=await Payment.create({userId:req.user._id,rideId:req.body.rideId,purpose:req.body.purpose,amountPaise,paymentMethodId:req.body.paymentMethodId,idempotencyKey:key,status:"PENDING"});
 return ok(res,{paymentId:payment._id,status:payment.status,amountPaise:payment.amountPaise,currency:"INR",provider:"mock",note:"No real charge is made. Configure and verify a payment gateway."},"Payment intent created",201);
}));
router.post("/payments/:paymentId/confirm",requireAuth,asyncHandler(async(req,res)=>{
 const p=await Payment.findOne({_id:req.params.paymentId,userId:req.user._id});
 if(!p)return fail(res,404,"Payment not found","NOT_FOUND");
 return ok(res,{paymentId:p._id,status:p.status,note:"Client confirmation cannot mark payment successful; implement provider verification/webhook."});
}));
router.get("/rider/wallet",requireAuth,(req,res)=>ok(res,{currency:"INR",balancePaise:0,note:"Wallet ledger not implemented"}));
router.get("/rider/wallet/transactions",requireAuth,(req,res)=>ok(res,{items:[],pagination:{page:1,limit:20,total:0}}));
router.post("/rider/wallet/topups",requireAuth,(req,res)=>fail(res,501,"Wallet top-up requires gateway integration","NOT_IMPLEMENTED"));
router.post("/payments/webhooks/:provider",(req,res)=>fail(res,501,"Webhook signature verification must be implemented for configured provider","NOT_IMPLEMENTED"));
router.post("/admin/payments/:paymentId/refund",requireAuth,allowRoles("admin"),(req,res)=>fail(res,501,"Refund provider integration is required","NOT_IMPLEMENTED"));
export default router;
