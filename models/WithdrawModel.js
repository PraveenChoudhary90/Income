import mongoose from "mongoose";

const withdrawSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },       // Requested amount
  deducted: { type: Number, required: true },     // 10% fee
  credited: { type: Number, required: true },     // Amount user gets after fee
  status: { type: String, default: "pending" },  // pending, approved, rejected
  paymentMethod: { type: String, default: "wallet" }, // optional
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

const Withdraw = mongoose.model("Withdraw", withdrawSchema);
export default Withdraw;
