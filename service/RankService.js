import User from "../models/UserModel.js";
import Deposit from "../models/DepositeModel.js";
import IncomeLedger from "../models/RefrralIncomebonusmodel.js";

/* ==============================
   RANK TABLE (IMAGE BASED)
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
   GET FULL DOWNLINE BUSINESS (BFS - NO RECURSION)
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

  if (directLegs.length < 3) return 0; // image rule

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
   PROCESS RANKS
====================================================== */
export const processRanks = async () => {

  try {

    const users = await User.find();

    for (const user of users) {

      const leadershipAmount =
        await calculateLeadershipAmount(user._id);

      if (leadershipAmount <= 0) continue;

      const currentIndex = rankTable.findIndex(
        r => r.rank === user.rank
      );

      let achievedRank = null;

      // highest eligible rank check
      for (let i = rankTable.length - 1; i >= 0; i--) {

        if (
          leadershipAmount >= rankTable[i].amount &&
          i > currentIndex
        ) {
          achievedRank = rankTable[i];
          break;
        }
      }

      if (!achievedRank) continue;

      // prevent duplicate rank income
      const existing = await IncomeLedger.findOne({
        toUser: user._id,
        type: "RANKINCOME",
        note: `Rank Income - ${achievedRank.rank}`
      });

      if (existing) continue;

      const rankIncome =
        achievedRank.amount * achievedRank.percent;

      // update user
      user.rank = achievedRank.rank;

      user.wallet.rankIncome =
        (user.wallet.rankIncome || 0) + rankIncome;

      user.wallet.balance += rankIncome;

      user.markModified("wallet");
      await user.save();

      // ledger entry
      await IncomeLedger.create({
        toUser: user._id,
        amount: rankIncome,
        depositAmount: leadershipAmount, // total downline business used to calculate rank income
       percent: achievedRank.percent * 100,
        type: "RANKINCOME",
        status: "credited",
        note: `Rank Income - ${achievedRank.rank}`,
        currency: "INR"
      });

      console.log("==================================");
      console.log(`USER: ${user.name}`);
      console.log(`LEADERSHIP: ${leadershipAmount}`);
      console.log(`RANK: ${achievedRank.name}`);
      console.log(`INCOME: ${rankIncome}`);
      console.log("==================================");
    }

    console.log("✅ Rank Processing Completed");

  } catch (err) {
    console.error("❌ Rank Error:", err);
  }
};
