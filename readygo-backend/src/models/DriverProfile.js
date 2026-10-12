import mongoose from "mongoose";
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true, index: true },
  applicationStatus: { type: String, enum: ["DRAFT", "DOCUMENTS_PENDING", "SUBMITTED", "UNDER_REVIEW", "ACTION_REQUIRED", "APPROVED", "REJECTED", "SUSPENDED"], default: "DRAFT" },
  city: String, vehicleCategory: String, availability: { type: String, enum: ["ONLINE", "OFFLINE"], default: "OFFLINE" },
  lastLocation: { latitude: Number, longitude: Number, accuracyMeters: Number, heading: Number, speedMps: Number, recordedAt: Date },
  averageRating: { type: Number, default: 0 }, totalRatings: { type: Number, default: 0 }
}, { timestamps: true });
export default mongoose.model("DriverProfile", schema);
