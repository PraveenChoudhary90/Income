import mongoose from "mongoose";

const DepositSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    dailyProfit: {
      type: Number,
      required: true,
    },
    // referralGiven: {
    //   type: Boolean,
    //   default: false, // ensures referral bonus given only once per deposit
    // },
    isActive: {
      type: Boolean,
      default: false, // deposit is active and earning daily ROI
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date, // optional: if deposit has maturity or end date
    },
  },
  { timestamps: true } // automatically adds createdAt and updatedAt
);

export default mongoose.model("Deposit", DepositSchema);
