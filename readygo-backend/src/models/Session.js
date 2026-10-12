import mongoose from "mongoose";
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  refreshTokenHash: { type: String, required: true },
  deviceId: String,
  expiresAt: { type: Date, required: true, expires: 0 },
  revokedAt: Date
}, { timestamps: true, _id: false });
export default mongoose.model("Session", schema);
