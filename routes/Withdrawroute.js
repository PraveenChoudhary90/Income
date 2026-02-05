import express from "express";
import { withdraw } from "../controllers/WithdrawController.js";

const router = express.Router();

// POST /api/withdraw
router.post("/withdraw", withdraw);

export default router;
