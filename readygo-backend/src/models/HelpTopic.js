import mongoose from "mongoose";

const HelpTopicSchema = new mongoose.Schema(
  {
    topicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "RIDE_ISSUES",
        "PAYMENTS_PAYOUTS",
        "ACCOUNT_KYC",
        "RATINGS_REVIEWS",
        "SAFETY_INCIDENTS",
        "INCENTIVES_BONUSES",
        "GENERAL",
      ],
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    views: {
      type: Number,
      default: 0,
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

HelpTopicSchema.index({ title: "text", content: "text", tags: "text" });

export default mongoose.model("HelpTopic", HelpTopicSchema);

