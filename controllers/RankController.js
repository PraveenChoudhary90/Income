import User from "../models/UserModel.js";
import Deposit from "../models/DepositeModel.js";
import IncomeLedger from "../models/RefrralIncomebonusmodel.js";

/* ================================
   RANK TABLE
================================ */
export const rankTable = [
  { rank: "A", name: "Associate", amount: 10000, percent: 0.10 },
  { rank: "B", name: "Senior Associate", amount: 25000, percent: 0.20 },
  { rank: "C", name: "Executive", amount: 50000, percent: 0.30 },
  { rank: "D", name: "Senior Executive", amount: 125000, percent: 0.40 },
  { rank: "E", name: "Director", amount: 350000, percent: 0.50 },
  { rank: "F", name: "Senior Director", amount: 1000000, percent: 0.60 },
  { rank: "G", name: "Vice President", amount: 2500000, percent: 0.70 },
  { rank: "H", name: "President", amount: 5000000, percent: 0.75 },
  { rank: "I", name: "Global Ambassador", amount: 10000000, percent: 0.80 }
];

/* ================================
   GET FULL DOWNLINE BUSINESS (BFS)
================================ */
async function getFullDownlineBusiness(rootUserId) {
  let total = 0;
  let queue = [rootUserId];

  while (queue.length) {
    const current = queue;
    queue = [];

    const deposits = await Deposit.find({
      userId: { $in: current },
      isActive: true
    });

    total += deposits.reduce((sum, d) => sum + d.amount, 0);

    const children = await User.find({
      referredBy: { $in: current }
    });

    children.forEach(c => queue.push(c._id));
  }

  return total;
}

/* ================================
   CALCULATE 40-30-30 LEADERSHIP AMOUNT
================================ */
async function calculateLeadershipAmount(userId) {
  const directLegs = await User.find({ referredBy: userId });
  if (directLegs.length < 3) return 0;

  let legBusiness = [];

  for (const leg of directLegs) {
    const business = await getFullDownlineBusiness(leg._id);
    legBusiness.push(business);
  }

  legBusiness.sort((a, b) => b - a);

  const top = legBusiness[0] || 0;
  const second = legBusiness[1] || 0;
  const remaining = legBusiness.slice(2).reduce((sum, v) => sum + v, 0);

  const leadershipAmount =
    (top * 0.40) +
    (second * 0.30) +
    (remaining * 0.30);

  return Number(leadershipAmount.toFixed(2));
}

/* ================================
   PROCESS RANK INCOME CRON
================================ */
export const processRanks = async () => {
  try {
    const deposits = await Deposit.find({ isActive: true });

    for (const dep of deposits) {
      const depositor = await User.findById(dep.userId);
      if (!depositor) continue;

      const dailyROI = dep.amount * 0.01; // ya phir koi fixed daily ROI, adjust karo

      let currentUplineId = depositor.referredBy;
      let previousRankPercent = 0;
      let previousRank = null;

      while (currentUplineId) {
        const upline = await User.findById(currentUplineId);
        if (!upline) break;

        // 🔹 Calculate leadership amount
        const leadershipAmount = await calculateLeadershipAmount(upline._id);

        // 🔹 Determine eligible rank
        const eligibleRank = rankTable.slice().reverse().find(r => leadershipAmount >= r.amount);
        if (!eligibleRank) {
          currentUplineId = upline.referredBy;
          continue;
        }

        upline.rank = eligibleRank.rank;
        await upline.save();

        let incomePercent = 0;
        const currentRankPercent = eligibleRank.percent;

        if (previousRankPercent === 0) incomePercent = currentRankPercent;
        else if (previousRank === eligibleRank.rank) incomePercent = 0.30;
        else if (currentRankPercent > previousRankPercent) incomePercent = currentRankPercent - previousRankPercent;
        else {
          currentUplineId = upline.referredBy;
          continue;
        }

        let income = dailyROI * incomePercent;

        // ✅ 2X CAPPING PER DEPOSIT
        const maxLimit = dep.amount * 2;
        const totalEarning = (upline.wallet.rankIncome || 0) +
                             (upline.wallet.DailyIncome || 0) +
                             (upline.wallet.levelIncome || 0) +
                             (upline.wallet.referralIncome || 0);

        const remainingLimit = maxLimit - totalEarning;
        const finalIncome = income > remainingLimit ? remainingLimit : income;

        if (finalIncome > 0) { // ✅ remove isActiveDeposit check
  upline.wallet.rankIncome = (upline.wallet.rankIncome || 0) + finalIncome;
  upline.wallet.balance += finalIncome;
  upline.markModified("wallet");
  await upline.save();
}


        // ✅ Ledger history
        const existingLedger = await IncomeLedger.findOne({
          depositId: dep._id,
          toUser: upline._id,
          type: "RANKINCOME"
        });

        if (!existingLedger) {
          await IncomeLedger.create({
            fromUser: depositor._id,
            toUser: upline._id,
            amount: finalIncome,
            depositAmount: dep.amount,
            percent: incomePercent * 100,
            type: "RANKINCOME",
            status: "credited",
            depositId: dep._id,
            rank: upline.rank,
            rankName: eligibleRank.name,
            rankPercent: eligibleRank.percent * 100,
            note: `Rank ROI Income`,
            currency: "INR"
          });
        }

        previousRankPercent = currentRankPercent;
        previousRank = eligibleRank.rank;
        currentUplineId = upline.referredBy;
      }
    }

    console.log("✅ Rank ROI Distribution Completed with 2X Capping");
  } catch (err) {
    console.error("❌ Rank Error:", err);
  }
};
