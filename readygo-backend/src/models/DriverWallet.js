import mongoose from "mongoose";

const DriverWalletSchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true,
  },
  availableBalancePaise: {
    type: Number,
    required: true,
    default: 483250, // Default seed balance ₹4,832.50 for seamless testing
    min: 0,
  },
  currency: {
    type: String,
    default: "INR",
  },
  lastCredited: {
    amountPaise: { type: Number, default: 30650 },
    type: { type: String, default: "TRIP_PAYOUT" },
    createdAt: { type: Date, default: Date.now },
  },
  status: {
    type: String,
    enum: ["ACTIVE", "FROZEN", "SUSPENDED"],
    default: "ACTIVE",
  },
}, { timestamps: true });

export default mongoose.model("DriverWallet", DriverWalletSchema);

