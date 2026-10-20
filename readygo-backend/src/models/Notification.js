import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["driver", "rider", "admin", "all"],
      default: "driver",
      index: true,
    },
    type: {
      type: String,
      enum: [
        "SURGE_ALERT",
        "INCENTIVE_UNLOCKED",
        "TRIP_CREDIT",
        "NEW_REVIEW",
        "DOCUMENT_EXPIRING",
        "APP_UPDATE",
        "REFERRAL_REWARD",
        "SUPPORT_UPDATE",
        "GENERAL",
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    isDismissed: {
      type: Boolean,
      default: false,
      index: true,
    },
    action: {
      screen: { type: String },
      params: { type: mongoose.Schema.Types.Mixed },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", NotificationSchema);

