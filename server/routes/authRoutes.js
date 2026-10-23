import crypto from "node:crypto";
import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import User from "../models/User.js";
import OtpCode from "../models/OtpCode.js";
import { getOtpSecret } from "../config/authSecrets.js";
import { AUTH_COOKIE_NAME, requireAuth, signAuthToken } from "../middleware/auth.js";
import { generateOtpCode, getSmsProvider } from "../services/smsProvider.js";
import { ensureReferralCode } from "../services/referrals.js";

const router = express.Router();
const OTP_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const phoneSchema = z.string().trim().min(10).max(20).regex(/^\+?[\d\s().-]+$/);
const requestOtpSchema = z.object({ phone: phoneSchema });
const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/),
});

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
}));

function normalizePhone(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

function hashOtp(phone, code) {
  return crypto.createHmac("sha256", getOtpSecret()).update(`${phone}:${code}`).digest("hex");
}

function safeHashEquals(expected, actual) {
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function configuredAdminPhones() {
  return new Set(
    (process.env.ADMIN_PHONES || "")
      .split(",")
      .map(normalizePhone)
      .filter(Boolean),
  );
}

const requestIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    code: "OTP_RATE_LIMITED",
    message: "Too many OTP requests. Please try again later.",
  },
});

const requestPhoneLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  keyGenerator: (req) => normalizePhone(req.body?.phone) || ipKeyGenerator(req.ip || "127.0.0.1"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    code: "OTP_RATE_LIMITED",
    message: "Too many OTP requests for this number. Please try again later.",
  },
});

function validationFailure(res, result) {
  return res.status(400).json({
    success: false,
    code: "BAD_REQUEST",
    message: "Enter a valid mobile number and verification code.",
    errors: result.error.issues.map(({ path, message }) => ({ path, message })),
  });
}

router.post("/request-otp", requestIpLimiter, requestPhoneLimiter, async (req, res, next) => {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) return validationFailure(res, parsed);

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return res.status(400).json({ success: false, message: "Enter a valid phone number." });

  try {
    const code = generateOtpCode();
    const codeHash = hashOtp(phone, code);
    await OtpCode.findOneAndUpdate(
      { phone },
      { codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0 },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    try {
      await getSmsProvider().sendOtp(phone, code);
    } catch {
      await OtpCode.deleteOne({ phone, codeHash });
      return res.status(503).json({
        success: false,
        code: "SMS_UNAVAILABLE",
        message: "Could not send the verification code. Please try again later.",
      });
    }
    return res.json({ success: true, message: "Verification code sent." });
  } catch (error) {
    next(error);
  }
});

router.post("/verify-otp", async (req, res, next) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) return validationFailure(res, parsed);

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return res.status(400).json({ success: false, message: "Enter a valid phone number." });

  try {
    const otp = await OtpCode.findOne({
      phone,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
    });
    if (!otp) {
      return res.status(400).json({
        success: false,
        code: "OTP_INVALID_OR_EXPIRED",
        message: "The code is invalid or expired. Request a new one.",
      });
    }

    if (!safeHashEquals(otp.codeHash, hashOtp(phone, parsed.data.code))) {
      const updated = await OtpCode.findOneAndUpdate(
        { _id: otp._id, attempts: { $lt: 5 } },
        { $inc: { attempts: 1 } },
        { new: true },
      );
      return res.status(400).json({
        success: false,
        code: updated?.attempts >= 5 ? "OTP_ATTEMPTS_EXCEEDED" : "OTP_INVALID",
        message: updated?.attempts >= 5
          ? "Too many incorrect codes. Request a new one."
          : "The verification code is incorrect.",
      });
    }

    const consumed = await OtpCode.findOneAndDelete({
      _id: otp._id,
      codeHash: otp.codeHash,
      attempts: { $lt: 5 },
      expiresAt: { $gt: new Date() },
    });
    if (!consumed) {
      return res.status(400).json({
        success: false,
        code: "OTP_INVALID_OR_EXPIRED",
        message: "The code is invalid or expired. Request a new one.",
      });
    }

    const isConfiguredAdmin = configuredAdminPhones().has(phone);
    let user = await User.findOne({ phone });
    let isNewAccount = false;
    if (!user) {
      isNewAccount = true;
      user = await User.create({
        phone,
        role: isConfiguredAdmin ? "admin" : "user",
        lastLoginAt: new Date(),
      });
    } else {
      user.lastLoginAt = new Date();
      user.role = isConfiguredAdmin ? "admin" : "user";
      await user.save();
    }
    const referralCode = await ensureReferralCode(user);

    res.cookie(AUTH_COOKIE_NAME, signAuthToken(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_MS,
    });
    return res.json({
      success: true,
      data: {
        id: user._id.toString(),
        phone: user.phone,
        role: user.role,
        referralCode,
        isNewAccount,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  res.json({ success: true, message: "Logged out." });
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const referralCode = await ensureReferralCode(req.user);
    return res.json({
      success: true,
      data: {
        id: req.user._id.toString(),
        phone: req.user.phone,
        role: req.user.role,
        referralCode,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
