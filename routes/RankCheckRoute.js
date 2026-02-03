// routes/rankRoutes.js
import express from "express";
import { processRanks } from "../controllers/RankController.js";
import { addDailyROI } from "../controllers/DepositeCOntroller.js";

const router = express.Router();

/* ==============================
   MANUAL TRIGGER: ROI + LEVEL + RANK
============================== */
router.get("/process-all", async (req, res) => {
  try {
    // 1️⃣ Daily ROI + Level Income
    await addDailyROI();

    // 2️⃣ Rank promotion
    await processRanks();

    res.status(200).json({ message: "✅ ROI, Level Income, and Rank processed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ Error processing ranks/ROI", error });
  }
});

export default router;
