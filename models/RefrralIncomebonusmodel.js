import mongoose from "mongoose";

const incomeLedgerSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  amount: { type: Number, required: true },          // Earned income
  depositAmount: { type: Number, required: true },   // Original deposit amount
  percent: { type: Number, required: true },         // Percentage of deposit used to calculate income

  type: { 
    type: String, 
    enum: ["REFERRAL", "DAILYINCOME", "LEVELINCOME", "RANKINCOME"], 
    required: true 
  },

  status: { type: String, default: "credited" },
  date: { type: Date, default: Date.now },
  depositId: { type: mongoose.Schema.Types.ObjectId, ref: "Deposit" },

  rank: { type: String },
  rankName: { type: String },
  rankPercent: { type: Number },


  note: { type: String, default: "" },
  currency: { type: String, default: "INR" }
}, { timestamps: true });

incomeLedgerSchema.index(
  {
    depositId: 1,
    toUser: 1,
    type: 1
  },
  { unique: true }
);


export default mongoose.model("IncomeLedger", incomeLedgerSchema);
