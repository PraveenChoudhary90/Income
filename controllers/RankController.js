import User from "../models/UserModel.js";
import Deposit from "../models/DepositeModel.js";
import IncomeLedger from "../models/RefrralIncomebonusmodel.js";

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

/* ==============================
   🔁 FULL DOWNLINE BUSINESS
============================== */
async function getFullDownlineBusiness(userId) {
  let total = 0;

  const deposits = await Deposit.find({ userId });
  total += deposits.reduce((s, d) => s + d.amount, 0);

  const children = await User.find({ referredBy: userId });
  for (const child of children) {
    total += await getFullDownlineBusiness(child._id);
  }
  

  return total;
}

/* ==============================
   LEADERSHIP BUSINESS
   (MIN 3 LEGS, MAX 11 LEGS)
============================== */
async function calculateLeadershipBusiness(userId) {
  const directLegs = await User.find({ referredBy: userId });

  if (!directLegs || directLegs.length < 3) {
    return { total: 0, legs: [] };
  }

  let legs = [];

  for (const legUser of directLegs) {
    const legBusiness = await getFullDownlineBusiness(legUser._id);
    legs.push({
      userId: legUser._id,
      name: legUser.name,
      amount: legBusiness
    });
  console.log("aa raha hun",legBusiness);
  }

  // Sort high → low
  legs.sort((a, b) => b.amount - a.amount);

  // Max 11 legs
  legs = legs.slice(0, 11);

  const first = legs[0].amount * 0.40;
  const second = legs[1].amount * 0.30;
  const remainingSum = legs.slice(2).reduce((s, l) => s + l.amount, 0);
  const third = remainingSum * 0.30;

  return {
    total: parseFloat((first + second + third).toFixed(2)),
    legs
  };
}

/* ==============================
   PROCESS RANKS
   (INCOME ONLY ON FIRST ACHIEVE)
============================== */
export const processRanks = async () => {
  const users = await User.find();

  for (const user of users) {
    const { total, legs } = await calculateLeadershipBusiness(user._id);

    if (total <= 0) continue;

    const currentRankIndex = rankTable.findIndex(
      r => r.rank === user.rank
    );

    let achievedRank = null;

    // Highest eligible rank only
    for (let i = rankTable.length - 1; i >= 0; i--) {
      if (total >= rankTable[i].amount && i > currentRankIndex) {
        achievedRank = rankTable[i];
        break;
      }
    }

    if (!achievedRank) continue;

    // 🛑 SAFETY: Already credited?
    const alreadyCredited = await IncomeLedger.findOne({
      toUser: user._id,
      type: "RANKINCOME",
      note: `Rank Income for ${achievedRank.name}`
    });

    if (alreadyCredited) continue;

    const rankIncome = parseFloat(
      (achievedRank.amount * achievedRank.percent).toFixed(2)
    );

    // SAVE RANK & ADD INCOME
    user.rank = achievedRank.rank;
    user.wallet.rankIncome =
      (user.wallet.rankIncome || 0) + rankIncome;
    user.wallet.balance += rankIncome;

    user.markModified("wallet");
    await user.save();

    // LEDGER ENTRY
    await IncomeLedger.create({
      fromUser: user._id,
      toUser: user._id,
      amount: rankIncome,
      type: "RANKINCOME",
      status: "credited",
      note: `Rank Income for ${achievedRank.name}`,
      currency: "INR"
    });

    console.log("=================================");
    console.log(`USER: ${user.name}`);
    console.log(`NEW RANK: ${achievedRank.name}`);
    console.log(`TOTAL BUSINESS: ${total}`);
    console.log(`RANK INCOME CREDITED: ${rankIncome}`);
    console.log(
      "LEG WISE:",
      legs.map(l => `${l.name} → ${l.amount}`)
    );
    console.log("=================================");
  }
};
