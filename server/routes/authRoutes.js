import crypto from "node:crypto";
import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import User from "../models/User.js";
import PhoneOtp from "../models/PhoneOtp.js";
import { AUTH_COOKIE_NAME, requireAuth, signAuthToken } from "../middleware/auth.js";
import { ensureReferralCode } from "../services/referrals.js";
import { getJwtSecret } from "../config/authSecrets.js";

const router = express.Router();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const phoneSchema = z.string().trim().min(10).max(20).regex(/^\+?[\d\s().-]+$/);
const otpRequestSchema = z.object({ phone: phoneSchema });
const otpVerifySchema = z.object({
  phone: phoneSchema,
  otp: z.string().trim().regex(/^\d{6}$/),
});

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_MAX_ATTEMPTS = 5;
// Dev mode: OTP is printed in the server console and returned in the response.
// Never enabled in production unless OTP_DEV_MODE=true is set explicitly.
const OTP_DEV_MODE = () =>
  process.env.OTP_DEV_MODE === "true" || process.env.NODE_ENV !== "production";
const adminLoginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(200),
});

function normalizePhone(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

function configuredAdminPhones() {
  return new Set(
    (process.env.ADMIN_PHONES || "")
      .split(",")
      .map(normalizePhone)
      .filter(Boolean),
  );
}

function limiter(message, limit = 10) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    keyGenerator: (req) => ipKeyGenerator(req.ip || "127.0.0.1"),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, code: "RATE_LIMITED", message },
  });
}

const otpRequestLimiter = limiter("Too many OTP requests. Please try again later.", 10);
const otpVerifyLimiter = limiter("Too many verification attempts. Please try again later.", 20);
const adminLoginLimiter = limiter("Too many administrator login attempts. Please try again later.", 5);

function setSessionCookie(res, user) {
  res.cookie(AUTH_COOKIE_NAME, signAuthToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

function authUser(user, referralCode, extra = {}) {
  return {
    id: user._id.toString(),
    phone: user.phone,
    role: user.role,
    referralCode,
    ...extra,
  };
}

function passwordsMatch(expected, actual) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function hashOtp(phone, otp) {
  return crypto.createHmac("sha256", getJwtSecret()).update(`${phone}:${otp}`).digest("hex");
}

function hashesMatch(expectedHex, actualHex) {
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(actualHex, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Plug your SMS provider (MSG91, Fast2SMS, Twilio, ...) in here.
async function sendOtpSms(phone, otp) {
  if (OTP_DEV_MODE()) {
    console.log(`[DEV OTP] ${phone} -> ${otp}`);
    return { devOtp: otp };
  }
  throw new Error("SMS provider is not configured.");
}

router.post("/otp/request", otpRequestLimiter, async (req, res, next) => {
  const parsed = otpRequestSchema.safeParse(req.body);
  const phone = parsed.success ? normalizePhone(parsed.data.phone) : null;
  if (!phone) {
    return res.status(400).json({
      success: false,
      code: "BAD_REQUEST",
      message: "Enter a valid mobile number.",
    });
  }
  if (configuredAdminPhones().has(phone)) {
    return res.status(409).json({
      success: false,
      code: "ADMIN_NUMBER_RESERVED",
      message: "This number is reserved for administrator access.",
    });
  }

  try {
    const existing = await PhoneOtp.findOne({ phone });
    if (existing && Date.now() - existing.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime())) / 1000);
      return res.status(429).json({
        success: false,
        code: "OTP_COOLDOWN",
        message: `Please wait ${wait}s before requesting another code.`,
      });
    }

    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const now = new Date();
    await PhoneOtp.findOneAndUpdate(
      { phone },
      {
        $set: {
          codeHash: hashOtp(phone, otp),
          attempts: 0,
          expiresAt: new Date(now.getTime() + OTP_TTL_MS),
          lastSentAt: now,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );

    let extra;
    try {
      extra = await sendOtpSms(phone, otp);
    } catch (smsError) {
      await PhoneOtp.deleteOne({ phone });
      console.error("OTP SMS failed:", smsError.message);
      return res.status(503).json({
        success: false,
        code: "OTP_SEND_FAILED",
        message: "Could not send the code right now. Please try again later.",
      });
    }

    return res.json({
      success: true,
      data: { sent: true, expiresInSeconds: OTP_TTL_MS / 1000, ...(extra?.devOtp ? { devOtp: extra.devOtp } : {}) },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/otp/verify", otpVerifyLimiter, async (req, res, next) => {
  const parsed = otpVerifySchema.safeParse(req.body);
  const phone = parsed.success ? normalizePhone(parsed.data.phone) : null;
  if (!phone) {
    return res.status(400).json({
      success: false,
      code: "BAD_REQUEST",
      message: "Enter the 6-digit code.",
    });
  }
  if (configuredAdminPhones().has(phone)) {
    return res.status(409).json({
      success: false,
      code: "ADMIN_NUMBER_RESERVED",
      message: "This number is reserved for administrator access.",
    });
  }

  try {
    const record = await PhoneOtp.findOne({ phone });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        code: "OTP_EXPIRED",
        message: "This code has expired. Please request a new one.",
      });
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await PhoneOtp.deleteOne({ phone });
      return res.status(429).json({
        success: false,
        code: "OTP_TOO_MANY_ATTEMPTS",
        message: "Too many wrong attempts. Please request a new code.",
      });
    }

    if (!hashesMatch(record.codeHash, hashOtp(phone, parsed.data.otp))) {
      await PhoneOtp.updateOne({ phone }, { $inc: { attempts: 1 } });
      return res.status(400).json({
        success: false,
        code: "OTP_INVALID",
        message: "Incorrect code. Please try again.",
      });
    }

    // Code is single-use.
    await PhoneOtp.deleteOne({ phone });

    let user = await User.findOne({ phone });
    let isNewAccount = false;
    if (user) {
      user.lastLoginAt = new Date();
      await user.save();
    } else {
      try {
        user = await User.create({ phone, role: "user", lastLoginAt: new Date() });
        isNewAccount = true;
      } catch (error) {
        if (error?.code === 11000) {
          user = await User.findOne({ phone });
        } else {
          throw error;
        }
      }
    }

    const referralCode = await ensureReferralCode(user);
    setSessionCookie(res, user);
    return res.status(isNewAccount ? 201 : 200).json({
      success: true,
      data: authUser(user, referralCode, { isNewAccount }),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/admin-login", adminLoginLimiter, async (req, res, next) => {
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "BAD_REQUEST",
      message: "Enter the administrator mobile number and password.",
    });
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return res.status(400).json({ success: false, message: "Enter a valid mobile number." });

  const configuredPassword = process.env.ADMIN_LOGIN_PASSWORD;
  if (!configuredPassword || configuredPassword.length < 32) {
    return res.status(503).json({
      success: false,
      code: "ADMIN_LOGIN_NOT_CONFIGURED",
      message: "Administrator password login is not configured.",
    });
  }
  if (!configuredAdminPhones().has(phone) || !passwordsMatch(configuredPassword, parsed.data.password)) {
    return res.status(401).json({
      success: false,
      code: "ADMIN_LOGIN_FAILED",
      message: "The administrator number or password is incorrect.",
    });
  }

  try {
    const user = await User.findOneAndUpdate(
      { phone },
      { $set: { role: "admin", lastLoginAt: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    const referralCode = await ensureReferralCode(user);
    setSessionCookie(res, user);
    return res.json({ success: true, data: authUser(user, referralCode) });
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
    return res.json({ success: true, data: authUser(req.user, referralCode) });
  } catch (error) {
    next(error);
  }
});

export default router;