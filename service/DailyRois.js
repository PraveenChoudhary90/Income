// cron.js
import cron from "node-cron";
import Deposit from "../models/DepositeModel.js";
import User from "../models/UserModel.js";
import IncomeLedger from "../models/RefrralIncomebonusmodel.js";

// =====================
// DAILY ROI PERCENT LOGIC
// =====================
const getDailyROI = (amount) => {
  if (amount >= 50 && amount <= 500) return 0.0033;
  if (amount >= 600 && amount <= 1000) return 0.004;
  if (amount >= 1100 && amount <= 2500) return 0.005;
  if (amount >= 2600) return 0.006;
  return 0;
};

// =====================
// CRON JOB
// Runs every day at midnight
// =====================
cron.schedule("0 0 * * *", async () => {
  try {
    console.log("🚀 Cron Started: Daily ROI + Level Income");

    const deposits = await Deposit.find({ isActive: true });

    for (const dep of deposits) {
      const depositor = await User.findById(dep.userId);
      if (!depositor) continue;

      // -----------------------------
      // 1️⃣ DAILY ROI
      // -----------------------------
      const dailyProfit = dep.dailyProfit;

      depositor.wallet.balance += dailyProfit;
      depositor.wallet.DailyIncome = (depositor.wallet.DailyIncome || 0) + dailyProfit;

      depositor.markModified("wallet");
      await depositor.save();

      await IncomeLedger.create({
        fromUser: depositor._id,
        toUser: depositor._id,
        amount: dailyProfit,
        depositAmount: dep.amount,
        percent: getDailyROI(dep.amount) * 100,
        type: "DAILYINCOME",
        status: "credited",
        depositId: dep._id,
        note: `Daily ROI credited (Cron)`,
        currency: "INR",
      });

      // -----------------------------
      // 2️⃣ LEVEL INCOME
      // -----------------------------
      let currentUplineId = depositor.referredBy;
      let currentLevel = 1;

      while (currentUplineId && currentLevel <= 40) {
        const upline = await User.findById(currentUplineId);
        if (!upline) break;

        const directUsers = await User.find({ referredBy: upline._id });
        let qualifiedDirects = 0;

        for (const direct of directUsers) {
          const totalDeposit = await Deposit.aggregate([
            { $match: { userId: direct._id, isActive: true } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ]);
          const total = totalDeposit[0]?.total || 0;
          if (total >= 1100) qualifiedDirects++;
        }

        let requiredDirect;
        let percent;
        if (currentLevel === 1) { requiredDirect = 1; percent = 0.10; }
        else if (currentLevel === 2) { requiredDirect = 2; percent = 0.07; }
        else if (currentLevel === 3) { requiredDirect = 3; percent = 0.05; }
        else if (currentLevel === 4) { requiredDirect = 4; percent = 0.03; }
        else if (currentLevel >= 5 && currentLevel <= 10) { requiredDirect = 6; percent = 0.02; }
        else if (currentLevel >= 11 && currentLevel <= 30) { requiredDirect = 8; percent = 0.01; }
        else { requiredDirect = 11; percent = 0.005; }

        if (qualifiedDirects >= requiredDirect) {
          const income = dailyProfit * percent;
          upline.wallet.balance += income;
          upline.wallet.levelIncome = (upline.wallet.levelIncome || 0) + income;
          upline.markModified("wallet");
          await upline.save();

          const existing = await IncomeLedger.findOne({
            depositId: dep._id,
            toUser: upline._id,
            type: "LEVELINCOME",
            note: `Level ${currentLevel} income from ${depositor.name}`,
          });

          if (!existing) {
            await IncomeLedger.create({
              fromUser: depositor._id,
              toUser: upline._id,
              amount: income,
              depositAmount: dep.amount,
              percent: percent * 100,
              type: "LEVELINCOME",
              status: "credited",
              depositId: dep._id,
              note: `Level ${currentLevel} income from ${depositor.name}`,
              currency: "INR",
            });
          }
        }

        currentUplineId = upline.referredBy;
        currentLevel++;
      }
    }

    console.log("✅ Cron Finished: Daily ROI + Level Income");

  } catch (error) {
    console.error("❌ Cron Error:", error);
  }
});
