import express from "express";
import { getPublicPlans } from "../config/plans.js";

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({ success: true, data: getPublicPlans() });
});

export default router;
