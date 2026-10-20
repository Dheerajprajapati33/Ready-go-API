import mongoose from "mongoose";

const PayoutRequestSchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  destinationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PayoutAccount",
    required: true,
  },
  amountPaise: {
    type: Number,
    required: true,
    min: 100, // Minimum payout ₹1.00
  },
  currency: {
    type: String,
    default: "INR",
  },
  mode: {
    type: String,
    enum: ["STANDARD", "INSTANT"],
    default: "STANDARD",
  },
  status: {
    type: String,
    enum: ["REQUESTED", "PROCESSING", "PAID", "FAILED", "REVERSED"],
    default: "REQUESTED",
    index: true,
  },
  idempotencyKey: {
    type: String,
    index: true,
  },
  failureReason: {
    type: String,
  },
  processedAt: {
    type: Date,
  },
}, { timestamps: true });

export default mongoose.model("PayoutRequest", PayoutRequestSchema);

