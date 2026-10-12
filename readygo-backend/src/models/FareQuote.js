import mongoose from "mongoose";
const point = new mongoose.Schema({ latitude: Number, longitude: Number, address: String }, { _id: false });
const option = new mongoose.Schema({ categoryId: String, name: String, etaMinutes: Number, farePaise: Number }, { _id: false });
const schema = new mongoose.Schema({
  riderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  pickup: point, dropoff: point, distanceKm: Number, options: [option],
  pricingVersion: { type: String, default: "demo-v1" },
  expiresAt: { type: Date, required: true, index: true }
}, { timestamps: true });
export default mongoose.model("FareQuote", schema);
