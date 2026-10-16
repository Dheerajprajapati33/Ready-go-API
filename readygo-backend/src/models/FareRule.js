import mongoose from "mongoose";

const schema = new mongoose.Schema({
  categoryId: { type: String, required: true, index: true },
  name: { type: String, default: "Standard Fare Rule" },
  city: { type: String, default: "Delhi NCR" },
  baseFarePaise: { type: Number, required: true, default: 5000 },
  perKmPaise: { type: Number, required: true, default: 1800 },
  perMinutePaise: { type: Number, default: 150 },
  minimumFarePaise: { type: Number, default: 5000 },
  surgeMultiplier: { type: Number, default: 1.0 },
  cancellationFeePaise: { type: Number, default: 3000 },
  isActive: { type: Boolean, default: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export default mongoose.model("FareRule", schema);
