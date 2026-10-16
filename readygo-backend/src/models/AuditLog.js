import mongoose from "mongoose";

const schema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.Mixed, ref: "User", required: true, index: true },
  actorRole: { type: String, default: "admin" },
  actorName: { type: String, default: "Admin User" },
  action: { type: String, required: true, index: true },
  resourceType: { type: String, required: true, index: true },
  resourceId: { type: mongoose.Schema.Types.Mixed, index: true },
  details: { type: mongoose.Schema.Types.Mixed },
  status: { type: String, enum: ["SUCCESS", "FAILED"], default: "SUCCESS" }
}, { timestamps: true });

export default mongoose.model("AuditLog", schema);

