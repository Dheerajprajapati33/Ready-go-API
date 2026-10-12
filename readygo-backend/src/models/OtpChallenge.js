import mongoose from "mongoose";
const schema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  purpose: { type: String, required: true, enum: ["login", "registration"] },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 },
  consumedAt: Date
}, { timestamps: true });
export default mongoose.model("OtpChallenge", schema);
