import mongoose from "mongoose";
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  rideId: { type: mongoose.Schema.Types.Mixed, ref: "Ride" },
  purpose: { type: String, enum: ["RIDE_PAYMENT", "WALLET_TOPUP"], required: true },
  amountPaise: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "INR" },
  paymentMethodId: String,
  gatewayRef: String,
  status: { type: String, enum: ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"], default: "PENDING", index: true },
  idempotencyKey: { type: String, index: true, sparse: true, unique: true }
}, { timestamps: true });
export default mongoose.model("Payment", schema);
