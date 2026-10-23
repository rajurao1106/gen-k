import express from "express";
import mongoose from "mongoose";
import { z } from "zod";
import UserDetail from "../models/UserDetail.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { userRateLimit } from "../middleware/featureAccess.js";
import { applyReferralReward } from "../services/referrals.js";

const router = express.Router();
const limitProfileWrites = userRateLimit({
  limit: () => Number(process.env.PROFILE_WRITE_RATE_LIMIT_PER_MIN || 30),
  code: "PROFILE_RATE_LIMITED",
});
const saveSchema = z.object({
  fullName: z.string().trim().min(1).max(240),
  dateOfBirth: z.string().trim().min(1).max(60),
  timeOfBirth: z.string().trim().max(60).optional(),
  placeOfBirth: z.string().trim().max(400).optional(),
  gender: z.string().trim().max(40).optional(),
  readingLanguage: z.enum(["en", "hi"]).optional(),
  content: z.string().max(100_000).optional(),
  chart: z.record(z.string(), z.unknown()).nullable().optional(),
  relationshipStatus: z.string().trim().max(80).optional(),
  birthTimeUnknown: z.boolean().optional(),
  birthLatitude: z.number().finite().optional(),
  birthLongitude: z.number().finite().optional(),
  birthTimezone: z.string().trim().max(100).optional(),
  referralCode: z.string().trim().min(1).max(16).regex(/^[A-Za-z0-9]+$/).optional(),
});

router.post("/save", requireAuth, limitProfileWrites, async (req, res, next) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "BAD_REQUEST",
      message: "Name, birth date, birth time, and birth place are required.",
      errors: parsed.error.issues.map(({ path, message }) => ({ path, message })),
    });
  }

  const { referralCode, ...profileData } = parsed.data;
  const session = await mongoose.startSession();
  try {
    let userDetail;
    let referralApplied = false;
    await session.withTransaction(async () => {
      [userDetail] = await UserDetail.create(
        [{
          ...profileData,
          timeOfBirth: profileData.timeOfBirth ?? "",
          placeOfBirth: profileData.placeOfBirth ?? "",
          userId: req.user._id,
          legacyUnowned: false,
        }],
        { session },
      );
      if (referralCode) {
        referralApplied = await applyReferralReward({
          referredUser: req.user,
          referralCode,
          session,
        });
      }
    });
    return res.status(201).json({
      success: true,
      message: "User details saved successfully.",
      data: userDetail,
      referralApplied,
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    if (
      error?.code === 11000 &&
      (error?.keyPattern?.referredPhoneHash || error?.message?.includes("referredPhoneHash_1"))
    ) {
      return res.status(409).json({
        success: false,
        code: "REFERRAL_ALREADY_REWARDED",
        message: "This phone number has already received a referral reward.",
      });
    }
    next(error);
  } finally {
    await session.endSession();
  }
});

router.get("/me/profiles", requireAuth, async (req, res, next) => {
  try {
    const records = await UserDetail.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    next(error);
  }
});

router.put("/me/profiles/:id", requireAuth, limitProfileWrites, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid profile ID." });
  }
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "BAD_REQUEST",
      message: "Profile details are invalid.",
      errors: parsed.error.issues.map(({ path, message }) => ({ path, message })),
    });
  }
  try {
    const updatedRecord = await UserDetail.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: parsed.data },
      { new: true, runValidators: true },
    );
    if (!updatedRecord) {
      return res.status(404).json({ success: false, message: "Profile not found." });
    }
    return res.json({ success: true, data: updatedRecord });
  } catch (error) {
    next(error);
  }
});

router.delete("/me/profiles/:id", requireAuth, limitProfileWrites, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid profile ID." });
  }

  try {
    const deletedRecord = await UserDetail.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!deletedRecord) {
      return res.status(404).json({ success: false, message: "Profile not found." });
    }
    return res.json({
      success: true,
      message: "Profile deleted successfully.",
      data: deletedRecord,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/all", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const records = await UserDetail.find().sort({ createdAt: -1 });
    return res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    next(error);
  }
});

router.delete("/delete/:id", requireAuth, requireAdmin, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid user record ID." });
  }

  try {
    const deletedRecord = await UserDetail.findByIdAndDelete(req.params.id);
    if (!deletedRecord) {
      return res.status(404).json({ success: false, message: "User record not found." });
    }
    return res.json({
      success: true,
      message: "User record deleted successfully.",
      data: deletedRecord,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
