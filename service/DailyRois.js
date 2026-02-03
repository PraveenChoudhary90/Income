// cron.js
import cron from "node-cron";
import Deposit from "../models/DepositeModel.js";
import User from "../models/UserModel.js";
import IncomeLedger from "../models/RefrralIncomebonusmodel.js";

// Runs every day at midnight
cron.schedule("0 0 * * *", async () => {
  try {
    console.log("🚀 Cron Started: Daily ROI + Nested Level Income + Rank");

    const deposits = await Deposit.find({ isActive: true });

    for (const dep of deposits) {
      const depositor = await User.findById(dep.userId);
      if (!depositor) continue;

      /* ===============================
         1️⃣ DAILY ROI
      =============================== */
      depositor.wallet.balance += dep.dailyProfit;
      depositor.wallet.DailyIncome =
        (depositor.wallet.DailyIncome || 0) + dep.dailyProfit;

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
        currency: "INR"
      });

      console.log(`[Daily ROI] ${depositor.name} received ${dep.dailyProfit} INR`);

      /* ===============================
         2️⃣ NESTED LEVEL INCOME
      =============================== */

      const processUpline = async (currentUserId, currentLevel = 1) => {
        if (!currentUserId || currentLevel > 40) return;

        const upline = await User.findById(currentUserId);
        if (!upline) return;

        const directRefCount = await User.countDocuments({ referredBy: upline._id });

        // Minimum Direct Rule
        let minDirect;
        if (currentLevel === 1) minDirect = 1;
        else if (currentLevel === 2) minDirect = 2;
        else if (currentLevel === 3) minDirect = 3;
        else if (currentLevel === 4) minDirect = 4;
        else if (currentLevel >= 5 && currentLevel <= 10) minDirect = 6;
        else if (currentLevel >= 11 && currentLevel <= 30) minDirect = 8;
        else minDirect = 11;

        // Stop if minimum directs not satisfied
        if (directRefCount < minDirect) return;

        // Percent structure
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

        // Recursive call to next upline
        await processUpline(upline.referredBy, currentLevel + 1);
      };

      await processUpline(depositor.referredBy);

      /* ===============================
         3️⃣ RANK INCOME (ASSOCIATE)
      =============================== */
      const totalBusiness = await Deposit.aggregate([
        { $match: { userId: depositor._id } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);

      const business = totalBusiness[0]?.total || 0;

      if (business >= 10000 && depositor.rank === "NONE") {
        depositor.rank = "ASSOCIATE";
        await depositor.save();

        console.log(`🏆 ${depositor.name} achieved ASSOCIATE Rank`);

        if (depositor.referredBy) {
          const upline = await User.findById(depositor.referredBy);
          if (upline) {
            const bonus = 10000 * 0.10;
            upline.wallet.balance += bonus;
            upline.wallet.referralIncome = (upline.wallet.referralIncome || 0) + bonus;
            upline.markModified("wallet");
            await upline.save();

            await IncomeLedger.create({
              fromUser: depositor._id,
              toUser: upline._id,
              amount: bonus,
              type: "RANKINCOME",
              status: "credited",
              depositId: dep._id,
              note: `Associate Rank Bonus from ${depositor.name}`,
              currency: "INR"
            });

            console.log(`💰 ${upline.name} received ${bonus} Rank Bonus`);
          }
        }
      }
    }

    console.log("✅ Cron Finished Successfully");

  } catch (error) {
    console.error("❌ Cron Error:", error);
  }
});
