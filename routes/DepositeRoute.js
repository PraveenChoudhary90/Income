import express from "express";
import { createDeposit } from "../controllers/DepositeCOntroller.js";

const router = express.Router();

router.post("/deposit", createDeposit);

export default router;
