import mongoose from "mongoose";

const LiveChatSessionSchema = new mongoose.Schema(
  {
    sessionId: {
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
      required: true,
    },
    initialMessage: {
      type: String,
    },
    status: {
      type: String,
      enum: ["QUEUED", "ASSIGNED", "ACTIVE", "CLOSED"],
      default: "QUEUED",
      index: true,
    },
    queuePosition: {
      type: Number,
      default: 1,
    },
    estimatedWaitSeconds: {
      type: Number,
      default: 45,
    },
    agent: {
      agentId: { type: String, default: "agent_402" },
      agentName: { type: String, default: "Priya Sharma (ReadyGo Partner Support)" },
      avatarUrl: { type: String, default: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150" },
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model("LiveChatSession", LiveChatSessionSchema);

