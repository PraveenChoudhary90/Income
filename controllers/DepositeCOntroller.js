import Deposit from "../models/DepositeModel.js";
import User from "../models/UserModel.js";
import IncomeLedger from "../models/RefrralIncomebonusmodel.js";

/* ================================
   DAILY ROI PERCENT LOGIC
================================ */
const getDailyROI = (amount) => {
  if (amount >= 50 && amount <= 500) return 0.0033;
  if (amount >= 600 && amount <= 1000) return 0.004;
  if (amount >= 1100 && amount <= 2500) return 0.005;
  if (amount >= 2600) return 0.006;
  return 0;
};

/* ================================
   CREATE DEPOSIT
================================ */
export const createDeposit = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    const roi = getDailyROI(amount);
    if (!roi) return res.status(400).json({ message: "Invalid deposit amount" });

    const dailyProfit = amount * roi;

    const depositsCount = await Deposit.countDocuments({ userId });

    const deposit = await Deposit.create({
      userId,
      amount,
      dailyProfit,
      isActive: depositsCount === 0 ? true : false,
    });

    const user = await User.findById(userId);

    // 5% DIRECT REFERRAL BONUS
    if (user.referredBy) {
      const referrer = await User.findById(user.referredBy);
      if (referrer) {
        const bonus = amount * 0.05;
        referrer.wallet.balance += bonus;
        referrer.wallet.referralIncome = (referrer.wallet.referralIncome || 0) + bonus;
        referrer.markModified("wallet");
        await referrer.save();

        await IncomeLedger.create({
          fromUser: user._id,
          toUser: referrer._id,
          amount: bonus,
          type: "REFERRAL",
          status: "credited",
          depositId: deposit._id,
          note: `5% referral bonus from ${user.name}`,
          currency: "INR",
        });
      }
    }

    // FIRST DAY ROI CREDIT
    user.wallet.balance += dailyProfit;
    user.wallet.DailyIncome = (user.wallet.DailyIncome || 0) + dailyProfit;
    user.markModified("wallet");
    await user.save();

    await IncomeLedger.create({
      fromUser: user._id,
      toUser: user._id,
      amount: dailyProfit,
      type: "DAILYINCOME",
      status: "credited",
      depositId: deposit._id,
      note: `Daily ROI credited`,
      currency: "INR",
    });

    res.json({ message: "Deposit Successful", dailyProfit });
  } catch (error) {
    console.error("Deposit Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================================
   CRON JOB FUNCTION
   DAILY ROI + NESTED LEVEL INCOME
================================ */
export const addDailyROI = async () => {
  try {
    const deposits = await Deposit.find({ isActive: true });

    for (const dep of deposits) {
      const depositor = await User.findById(dep.userId);
      if (!depositor) continue;

      // 1️⃣ DAILY ROI
      depositor.wallet.balance += dep.dailyProfit;
      depositor.wallet.DailyIncome = (depositor.wallet.DailyIncome || 0) + dep.dailyProfit;
      depositor.markModified("wallet");
      await depositor.save();

      await IncomeLedger.create({
        fromUser: depositor._id,
        toUser: depositor._id,
        amount: dep.dailyProfit,
        type: "DAILYINCOME",
        status: "credited",
        depositId: dep._id,
        note: `Daily ROI credited (Cron)`,
        currency: "INR",
      });

      // 2️⃣ NESTED LEVEL INCOME
      const processUpline = async (currentUserId, currentLevel, maxDirects = 11) => {
        if (!currentUserId || currentLevel > 40) return;

        const upline = await User.findById(currentUserId);
        if (!upline) return;

        const directRefCount = await User.countDocuments({ referredBy: upline._id });

        // Minimum Directs per level
        let minDirect;
        if (currentLevel === 1) minDirect = 1;
        else if (currentLevel === 2) minDirect = 2;
        else if (currentLevel === 3) minDirect = 3;
        else if (currentLevel === 4) minDirect = 4;
        else if (currentLevel >= 5 && currentLevel <= 10) minDirect = 6;
        else if (currentLevel >= 11 && currentLevel <= 30) minDirect = 8;
        else minDirect = 11; // 31–40

        if (directRefCount < minDirect || directRefCount > maxDirects) return;

        // Percent per level
        let percent;
        if (currentLevel === 1) percent = 0.10;
        else if (currentLevel === 2) percent = 0.07;
        else if (currentLevel === 3) percent = 0.05;
        else if (currentLevel === 4) percent = 0.03;
        else if (currentLevel >= 5 && currentLevel <= 10) percent = 0.02;
        else if (currentLevel >= 11 && currentLevel <= 30) percent = 0.01;
        else percent = 0.005;

        const income = dep.dailyProfit * percent;

        upline.wallet.balance += income;
        upline.wallet.levelIncome = (upline.wallet.levelIncome || 0) + income;
        upline.markModified("wallet");
        await upline.save();

        await IncomeLedger.create({
          fromUser: depositor._id,
          toUser: upline._id,
          amount: income,
          type: "LEVELINCOME",
          status: "credited",
          depositId: dep._id,
          note: `Level ${currentLevel} income from ${depositor.name}`,
          currency: "INR",
        });

        console.log(`[Level ${currentLevel}] ${upline.name} received ${income} INR`);

        await processUpline(upline.referredBy, currentLevel + 1, maxDirects);
      };

      await processUpline(depositor.referredBy, 1, 11);
    }

    console.log("✅ Cron Finished: Daily ROI + Nested Level Income Added");
  } catch (error) {
    console.error("❌ Error in Cron:", error);
  }
};
