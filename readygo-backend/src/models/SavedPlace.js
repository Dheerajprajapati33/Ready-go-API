import mongoose from "mongoose";

const savedPlaceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ["HOME", "WORK", "GYM", "CAFE", "CUSTOM"],
    default: "CUSTOM",
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  address: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300
  },
  latitude: {
    type: Number,
    min: -90,
    max: 90,
    default: null
  },
  longitude: {
    type: Number,
    min: -180,
    max: 180,
    default: null
  },
  placeId: {
    type: String,
    trim: true,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      ret.id = ret._id.toString();
      delete ret.__v;
      return ret;
    }
  }
});

savedPlaceSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("SavedPlace", savedPlaceSchema);
