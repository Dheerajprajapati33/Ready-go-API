import mongoose from "mongoose";
const schema = new mongoose.Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true },
  raterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  stars: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 1000, default: "" },
  moderationStatus: { type: String, enum: ["PUBLISHED", "HIDDEN", "UNDER_REVIEW"], default: "PUBLISHED" },
  reportedAt: Date
}, { timestamps: true });
schema.index({ rideId: 1, raterId: 1 }, { unique: true });
export default mongoose.model("Rating", schema);
