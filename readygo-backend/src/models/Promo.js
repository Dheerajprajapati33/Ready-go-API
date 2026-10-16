import mongoose from "mongoose";

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  title: { type: String, default: "Promo Discount" },
  description: { type: String, default: "" },
  discountType: { type: String, enum: ["PERCENTAGE", "FLAT"], default: "PERCENTAGE" },
  discountValue: { type: Number, required: true, default: 20 },
  maxDiscountPaise: { type: Number, default: 10000 },
  minRideFarePaise: { type: Number, default: 0 },
  applicableCategories: { type: [String], default: ["moto", "auto", "mini", "prime"] },
  validFrom: { type: Date, default: Date.now },
  validUntil: { type: Date, default: () => new Date(Date.now() + 90 * 86400000) },
  usageLimit: { type: Number, default: 500 },
  usageCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.Mixed, ref: "User" }
}, { timestamps: true });

export default mongoose.model("Promo", schema);

