import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

import UserRoutes from "./routes/UserRoutes.js";
import depositRoutes from "./routes/DepositeRoute.js";
import RankCheckRoute from "./routes/RankCheckRoute.js";
// import { addDailyROI } from "./controllers/DepositeCOntroller.js";
// import { processRanks } from "./controllers/RankController.js";
import WithdrawRoute  from "./routes/Withdrawroute.js";


import "./service/cron.js";
// import "./service/DailyRois.js";

dotenv.config();
connectDB();

const app = express();
app.use(express.json());


// await addDailyROI();
// await processRanks();

app.use("/api/auth", UserRoutes);
app.use("/api", depositRoutes);
app.use("/api/rank", RankCheckRoute);
app.use("/api", WithdrawRoute);


const port = process.env.PORT || 8000


app.listen(port, () =>{
  console.log(`SERVER IS RUNNING ON ${port} PORT`);
}
);
