import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,

  referralCode: String,

  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  // 🔹 Track first deposit
  isActiveDeposit: { type: Boolean, default: false },
  activationDate: { type: Date, default: null },

  // 🔹 Total deposit amount for user
  totalDepositAmount: { type: Number, default: 0 },

  // 🔥 NEW FIELDS FOR RANK SYSTEM
  rank: {
    type: String,
    default: "none"
  },

  selfBusiness: {
    type: Number,
    default: 0
  },

  totalBusiness: {
    type: Number,
    default: 0
  },

  wallet: {
    balance: { type: Number, default: 0 },
    DailyIncome: { type: Number, default: 0 },
    referralIncome: { type: Number, default: 0 },
    levelIncome: { type: Number, default: 0 },
    rankIncome: { type: Number, default: 0 } // 🔥 new
  }

}, { timestamps: true });

export default mongoose.model("User", userSchema);
