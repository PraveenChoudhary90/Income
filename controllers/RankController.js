import User from "../models/UserModel.js";
import Deposit from "../models/DepositeModel.js";
import IncomeLedger from "../models/RefrralIncomebonusmodel.js";

/* ==============================
   DAILY ROI LOGIC
============================== */
const getDailyROI = (amount) => {
  if (amount >= 50 && amount <= 500) return 0.0033;
  if (amount >= 600 && amount <= 1000) return 0.004;
  if (amount >= 1100 && amount <= 2500) return 0.005;
  if (amount >= 2600) return 0.006;
  return 0;
};

/* ==============================
   RANK TABLE
============================== */
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

/* ======================================================
   GET FULL DOWNLINE BUSINESS (BFS)
====================================================== */
async function getFullDownlineBusiness(rootUserId) {

  let total = 0;
  let queue = [rootUserId];

  while (queue.length) {

    const current = queue;
    queue = [];

    const deposits = await Deposit.find({
      userId: { $in: current }
    });

    total += deposits.reduce((sum, d) => sum + d.amount, 0);

    const children = await User.find({
      referredBy: { $in: current }
    });

    children.forEach(c => queue.push(c._id));
  }

  return total;
}

/* ======================================================
   40-30-30 LEADERSHIP CALCULATION
====================================================== */
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
  const remaining = legBusiness.slice(2)
    .reduce((sum, v) => sum + v, 0);

  const leadershipAmount =
    (top * 0.40) +
    (second * 0.30) +
    (remaining * 0.30);

  return Number(leadershipAmount.toFixed(2));
}

/* ======================================================
   PROCESS RANKS + DAILY ROI BASED RANK INCOME
====================================================== */
export const processRanks = async () => {

  try {

    const deposits = await Deposit.find({ isActive: true });

    for (const dep of deposits) {

      const depositor = await User.findById(dep.userId);
      if (!depositor) continue;

      const roiPercent = getDailyROI(dep.amount);
      if (!roiPercent) continue;

      const dailyROI = dep.amount * roiPercent;

      let currentUplineId = depositor.referredBy;
      let previousRankPercent = 0;
      let previousRank = null;

      while (currentUplineId) {

        const upline = await User.findById(currentUplineId);
        if (!upline) break;

        // 🔹 Rank eligibility check (40-30-30)
        const leadershipAmount =
          await calculateLeadershipAmount(upline._id);

        const eligibleRank = rankTable
          .slice()
          .reverse()
          .find(r => leadershipAmount >= r.amount);

        if (!eligibleRank) {
          currentUplineId = upline.referredBy;
          continue;
        }

        upline.rank = eligibleRank.rank;
        await upline.save();

        let incomePercent = 0;

        const currentRankPercent = eligibleRank.percent;

        // 🟢 First eligible
        if (previousRankPercent === 0) {
          incomePercent = currentRankPercent;
        }
        // 🟢 Same rank case → fixed 30%
        else if (previousRank === eligibleRank.rank) {
          incomePercent = 0.30;
        }
        // 🟢 Higher rank → differential
        else if (currentRankPercent > previousRankPercent) {
          incomePercent =
            currentRankPercent - previousRankPercent;
        }
        // 🔴 Lower rank → skip
        else {
          currentUplineId = upline.referredBy;
          continue;
        }

        const income = dailyROI * incomePercent;

        if (income > 0) {

          const existing = await IncomeLedger.findOne({
            depositId: dep._id,
            toUser: upline._id,
            type: "RANKINCOME"
          });

          if (!existing) {

            upline.wallet.rankIncome =
              (upline.wallet.rankIncome || 0) + income;

            upline.wallet.balance += income;

            upline.markModified("wallet");
            await upline.save();

            await IncomeLedger.create({
              fromUser: depositor._id,
              toUser: upline._id,
              amount: income,
              depositAmount: dep.dailyProfit,
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
        }

        previousRankPercent = currentRankPercent;
        previousRank = eligibleRank.rank;
        currentUplineId = upline.referredBy;
      }
    }

    console.log("✅ Rank ROI Distribution Completed");

  } catch (err) {
    console.error("❌ Rank Error:", err);
  }
};
