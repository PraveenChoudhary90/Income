import mongoose from "mongoose";

const incomeLedgerSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Jisse income aayi
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },   // Jisko income mili

  amount: { type: Number, required: true },          // Kitna mila
  type: { 
    type: String, 
    enum: ["REFERRAL", "DAILYINCOME", "LEVELINCOME", "RANKINCOME"], 
    required: true 
  }, // Type of income

  status: { type: String, default: "credited" },     // credited / pending / failed
  date: { type: Date, default: Date.now },           // Transaction date

  depositId: { type: mongoose.Schema.Types.ObjectId, ref: "Deposit" }, // agar deposit related ho
  note: { type: String, default: "" },               // extra info
  currency: { type: String, default: "INR" }        // currency
}, { timestamps: true });

export default mongoose.model("IncomeLedger", incomeLedgerSchema);
