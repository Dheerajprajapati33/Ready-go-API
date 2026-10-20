import mongoose from "mongoose";

const WalletTransactionSchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ["CREDIT", "DEBIT"],
    required: true,
    index: true,
  },
  category: {
    type: String,
    enum: [
      "TRIP_PAYOUT",
      "SURGE_BONUS",
      "INCENTIVE",
      "BANK_TRANSFER",
      "WITHDRAWAL",
      "REVERSAL",
      "PLATFORM_FEE",
      "ADJUSTMENT"
    ],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  referenceId: {
    type: String,
    index: true,
  },
  amountPaise: {
    type: Number,
    required: true,
  },
  balanceAfterPaise: {
    type: Number,
  },
  currency: {
    type: String,
    default: "INR",
  },
}, { timestamps: true });

export default mongoose.model("WalletTransaction", WalletTransactionSchema);

