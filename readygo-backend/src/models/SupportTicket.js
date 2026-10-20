import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    default: () => "msg_" + Math.random().toString(36).substring(2, 9),
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  senderRole: {
    type: String,
    enum: ["driver", "agent", "system", "admin"],
    default: "driver",
  },
  senderName: {
    type: String,
    default: "Driver",
  },
  message: {
    type: String,
    required: true,
  },
  attachmentKeys: [
    {
      type: String,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const SupportTicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        "RIDE_ISSUES",
        "PAYMENTS_PAYOUTS",
        "ACCOUNT_KYC",
        "RATINGS_REVIEWS",
        "SAFETY_INCIDENTS",
        "INCENTIVES_BONUSES",
        "OTHER",
      ],
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    rideId: {
      type: String,
      trim: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "NORMAL", "HIGH", "URGENT"],
      default: "NORMAL",
    },
    status: {
      type: String,
      enum: [
        "OPEN",
        "IN_PROGRESS",
        "WAITING_FOR_DRIVER",
        "RESOLVED",
        "CLOSED",
      ],
      default: "OPEN",
      index: true,
    },
    messages: [MessageSchema],
    closingNote: {
      type: String,
    },
    closedAt: {
      type: Date,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("SupportTicket", SupportTicketSchema);

