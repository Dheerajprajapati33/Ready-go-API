import mongoose from "mongoose";
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", index: true },
  location: { latitude: Number, longitude: Number, accuracyMeters: Number },
  message: { type: String, maxlength: 500 },
  triggerSource: { type: String, enum: ["HOLD_BUTTON", "IN_APP", "ADMIN"], default: "HOLD_BUTTON" },
  status: { type: String, enum: ["OPEN", "ACKNOWLEDGED", "RESPONDING", "RESOLVED", "CANCELLED"], default: "OPEN", index: true },
  responders: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  eventTimeline: [{ status: String, actorId: mongoose.Schema.Types.ObjectId, note: String, at: { type: Date, default: Date.now } }]
}, { timestamps: true });
export default mongoose.model("SafetyEvent", schema);
