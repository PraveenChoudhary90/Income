import User from "../models/UserModel.js";
import Withdraw from "../models/WithdrawModel.js";

export const withdraw = async (req, res) => {
  try {
    const { userId, amount, paymentMethod } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if ((user.wallet.balance || 0) < amount)
      return res.status(400).json({ message: "Insufficient balance" });

    const deduction = amount * 0.10; // 10% fee
    const credited = amount - deduction;

    // 🔹 Deduct from user wallet (total balance)
    user.wallet.balance -= amount;


    await user.save();

    // 🔹 Save withdraw record
    const withdrawRecord = await Withdraw.create({
      userId,
      amount,
      deducted: deduction,
      credited,
      status: "success",
      paymentMethod: paymentMethod || "wallet",
    });

    res.json({
      message: "Withdrawal request created",
      withdraw: withdrawRecord,
      walletBalance: user.wallet.balance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
