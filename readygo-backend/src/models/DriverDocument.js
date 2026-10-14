import mongoose from "mongoose";

const DriverDocumentSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  documentType: { type: String, required: true }, // e.g. DRIVING_LICENSE, VEHICLE_RC, VEHICLE_INSURANCE, AADHAAR, PAN
  documentUrl: { type: String },
  fileUrl: { type: String },
  fileKey: { type: String },
  side: { type: String, enum: ["FRONT", "BACK", "SINGLE", "NONE"], default: "FRONT" },
  maskedNumber: { type: String },
  documentNumber: { type: String },
  expiryDate: { type: String },
  status: { type: String, enum: ["PENDING", "VERIFIED", "REJECTED", "UNDER_REVIEW"], default: "VERIFIED" },
  rejectionReason: { type: String },
  verifiedAt: { type: Date, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export default mongoose.model("DriverDocument", DriverDocumentSchema);

