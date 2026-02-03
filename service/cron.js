import cron from "node-cron";
import { addDailyROI } from "../controllers/DepositeCOntroller.js";
import { processRanks } from "../controllers/RankController.js";

cron.schedule("0 0 * * *", async () => {
  console.log("🚀 Cron Started");

  await addDailyROI();    // ROI + Level
  await processRanks();   // Rank Check

  console.log("✅ Cron Finished");
});


