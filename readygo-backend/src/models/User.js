import mongoose from "mongoose";
const UserSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true },
  role: { type: String, enum: ["rider", "driver", "admin", "safety"], default: "rider" },
  fullName: { type: String, trim: true, maxlength: 100 },
  email: { type: String, lowercase: true, trim: true },
  avatarUrl: String,
  referralCode: String,
  preferences: {
    whatsAppUpdatesEnabled: { type: Boolean, default: false },
    ridePushEnabled: { type: Boolean, default: true }
  },
  profileCompleted: { type: Boolean, default: false },
  status: { type: String, enum: ["ACTIVE", "SUSPENDED", "DELETED"], default: "ACTIVE" }
}, { timestamps: true });
export default mongoose.model("User", UserSchema);
