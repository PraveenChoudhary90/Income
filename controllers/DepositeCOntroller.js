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
   Referral + DailyIncome (once)
================================ */
export const createDeposit = async (req, res) => {
  try {
    const { userId, amount } = req.body;
    const roi = getDailyROI(amount);
    if (!roi) return res.status(400).json({ message: "Invalid deposit amount" });

    const dailyProfit = amount * roi;
    const depositsCount = await Deposit.countDocuments({ userId });
    const user = await User.findById(userId);

    const isFirstDeposit = !user.isActiveDeposit;

    const deposit = await Deposit.create({
      userId,
      amount,
      dailyProfit,
      isActive: depositsCount === 0 ? true : false,
    });

    // Update user for first deposit
    if (isFirstDeposit) {
      user.isActiveDeposit = true;
      user.activationDate = new Date();
    }

    user.totalDepositAmount = (user.totalDepositAmount || 0) + amount;
    await user.save();

    // 5% DIRECT REFERRAL BONUS (Duplicate-safe)
    if (user.referredBy) {
      const referrer = await User.findById(user.referredBy);
      if (referrer) {
        const existingReferral = await IncomeLedger.findOne({
          depositId: deposit._id,
          toUser: referrer._id,
          type: "REFERRAL",
        });

        if (!existingReferral) {
          const bonus = amount * 0.05;
          referrer.wallet.balance += bonus;
          referrer.wallet.referralIncome = (referrer.wallet.referralIncome || 0) + bonus;
          referrer.markModified("wallet");
          await referrer.save();

          await IncomeLedger.create({
            fromUser: user._id,
            toUser: referrer._id,
            amount: bonus,
            depositAmount: amount,
            percent: 0.05 * 100,
            type: "REFERRAL",
            status: "credited",
            depositId: deposit._id,
            note: `5% referral bonus from ${user.name}`,
            currency: "INR",
          });
        }
      }
    }

    // FIRST DAY ROI CREDIT (Duplicate-safe)
    const existingDaily = await IncomeLedger.findOne({
      depositId: deposit._id,
      toUser: user._id,
      type: "DAILYINCOME",
    });

    if (!existingDaily) {
      user.wallet.balance += dailyProfit;
      user.wallet.DailyIncome = (user.wallet.DailyIncome || 0) + dailyProfit;
      user.markModified("wallet");
      await user.save();

      await IncomeLedger.create({
        fromUser: user._id,
        toUser: user._id,
        amount: dailyProfit,
        depositAmount: deposit.amount,
        percent: roi * 100,
        type: "DAILYINCOME",
        status: "credited",
        depositId: deposit._id,
        note: `Daily ROI credited`,
        currency: "INR",
      });
    }

    res.json({ message: "Deposit Successful", dailyProfit });
  } catch (error) {
    console.error("Deposit Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================================
   CRON JOB: LEVEL INCOME ONLY
================================ */
export const addDailyROI = async () => {
  try {
    const deposits = await Deposit.find({ isActive: true });

    for (const dep of deposits) {
      const depositor = await User.findById(dep.userId);
      if (!depositor) continue;

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
        if (currentLevel === 1) requiredDirect = 1;
        else if (currentLevel === 2) requiredDirect = 2;
        else if (currentLevel === 3) requiredDirect = 3;
        else if (currentLevel === 4) requiredDirect = 4;
        else if (currentLevel >= 5 && currentLevel <= 10) requiredDirect = 6;
        else if (currentLevel >= 11 && currentLevel <= 30) requiredDirect = 8;
        else requiredDirect = 11;

        let percent;
        if (currentLevel === 1) percent = 0.10;
        else if (currentLevel === 2) percent = 0.07;
        else if (currentLevel === 3) percent = 0.05;
        else if (currentLevel === 4) percent = 0.03;
        else if (currentLevel >= 5 && currentLevel <= 10) percent = 0.02;
        else if (currentLevel >= 11 && currentLevel <= 30) percent = 0.01;
        else percent = 0.005;

        // LevelIncome Duplicate Check
        if (qualifiedDirects >= requiredDirect) {
          const existingLevel = await IncomeLedger.findOne({
            depositId: dep._id,
            toUser: upline._id,
            type: "LEVELINCOME",
            note: `Level ${currentLevel} income from ${depositor.name}`,
          });

          if (!existingLevel) {
            const income = dep.dailyProfit * percent;
            upline.wallet.balance += income;
            upline.wallet.levelIncome = (upline.wallet.levelIncome || 0) + income;
            upline.markModified("wallet");
            await upline.save();

            await IncomeLedger.create({
              fromUser: depositor._id,
              toUser: upline._id,
              amount: income,
              depositAmount: dep.dailyProfit,
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

    console.log("✅ Cron Finished: Level Income Added");
  } catch (error) {
    console.error("❌ Error in Cron:", error);
  }
};
