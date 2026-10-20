import mongoose from "mongoose";

const DriverReferralSchema = new mongoose.Schema(
  {
    referralId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    referrerDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    referredDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    referralCode: {
      type: String,
      required: true,
      index: true,
    },
    completedEligibleRides: {
      type: Number,
      default: 0,
    },
    requiredEligibleRides: {
      type: Number,
      default: 20,
    },
    rewardPerEligibleDriverPaise: {
      type: Number,
      default: 150000, // ₹1,500 in paise
    },
    referrerRewardStatus: {
      type: String,
      enum: ["PENDING", "QUALIFIED", "CREDITED", "DISPUTED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    referredDriverRewardStatus: {
      type: String,
      enum: ["PENDING", "QUALIFIED", "CREDITED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    dispute: {
      isDisputed: { type: Boolean, default: false },
      reason: { type: String },
      description: { type: String },
      submittedAt: { type: Date },
      status: {
        type: String,
        enum: ["NONE", "SUBMITTED", "UNDER_REVIEW", "RESOLVED", "REJECTED"],
        default: "NONE",
      },
    },
    adminReview: {
      decision: {
        type: String,
        enum: ["NONE", "APPROVED", "REJECTED"],
        default: "NONE",
      },
      reason: { type: String },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reviewedAt: { type: Date },
    },
    creditedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model("DriverReferral", DriverReferralSchema);

