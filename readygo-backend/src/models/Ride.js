import mongoose from "mongoose";
const point = new mongoose.Schema({ latitude: Number, longitude: Number, address: String }, { _id: false });
const schema = new mongoose.Schema({
  riderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  quoteId: { type: mongoose.Schema.Types.ObjectId, ref: "FareQuote", required: true },
  categoryId: { type: String, required: true },
  pickup: point, dropoff: point,
  promoCode: String, paymentMethodId: String,
  fareBreakdown: {
    currency: { type: String, default: "INR" },
    baseFarePaise: Number, distanceFarePaise: Number, timeFarePaise: Number,
    surgePaise: Number, feesPaise: Number, discountPaise: Number, totalPaise: Number
  },
  status: { type: String, enum: ["REQUESTED", "SEARCHING_DRIVER", "DRIVER_ASSIGNED", "DRIVER_ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED_BY_RIDER", "CANCELLED_BY_DRIVER", "NO_DRIVER_FOUND"], default: "REQUESTED", index: true },
  cancelReason: String, startedAt: Date, completedAt: Date
}, { timestamps: true });
export default mongoose.model("Ride", schema);
