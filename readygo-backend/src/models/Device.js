import mongoose from "mongoose";
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  deviceId: { type: String, required: true },
  platform: { type: String, enum: ["android", "ios", "web"], required: true },
  pushToken: { type: String, required: true }
}, { timestamps: true });
schema.index({ userId: 1, deviceId: 1 }, { unique: true });
export default mongoose.model("Device", schema);
