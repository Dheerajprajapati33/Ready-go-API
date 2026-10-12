import mongoose from "mongoose";
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, maxlength: 100 },
  phone: { type: String, required: true },
  relationship: { type: String, maxlength: 50 }
}, { timestamps: true });
export default mongoose.model("EmergencyContact", schema);
