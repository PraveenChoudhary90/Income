import express from "express";
import { register,getUser,getAllUsers,getReferrals } from "../controllers/UserController.js";

const router = express.Router();

router.post("/register", register);
router.get("/:userId", getUser);              // get single user
router.get("/alluser", getAllUsers);                 // get all users
router.get("/referrals/:referralCode", getReferrals);

export default router;
