import mongoose from "mongoose";

const PayoutAccountSchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ["UPI", "BANK"],
    required: true,
  },
  accountHolderName: {
    type: String,
    trim: true,
  },
  accountNumber: {
    type: String,
    trim: true,
  },
  maskedAccountNumber: {
    type: String,
  },
  ifscCode: {
    type: String,
    uppercase: true,
    trim: true,
  },
  upiId: {
    type: String,
    trim: true,
    lowercase: true,
  },
  maskedUpiId: {
    type: String,
  },
  verificationStatus: {
    type: String,
    enum: ["PENDING", "VERIFIED", "FAILED"],
    default: "PENDING",
    index: true,
  },
  verificationReference: {
    type: String,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

export default mongoose.model("PayoutAccount", PayoutAccountSchema);

