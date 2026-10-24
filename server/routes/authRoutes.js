import crypto from "node:crypto";
import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import User from "../models/User.js";
import { AUTH_COOKIE_NAME, requireAuth, signAuthToken } from "../middleware/auth.js";
import { ensureReferralCode } from "../services/referrals.js";

const router = express.Router();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const phoneSchema = z.string().trim().min(10).max(20).regex(/^\+?[\d\s().-]+$/);
const signupSchema = z.object({ phone: phoneSchema });
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

const signupLimiter = limiter("Too many account attempts. Please try again later.");
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

router.post("/signup", signupLimiter, async (req, res, next) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      code: "BAD_REQUEST",
      message: "Enter a valid mobile number.",
      errors: parsed.error.issues.map(({ path, message }) => ({ path, message })),
    });
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return res.status(400).json({ success: false, message: "Enter a valid mobile number." });
  if (configuredAdminPhones().has(phone)) {
    return res.status(409).json({
      success: false,
      code: "ADMIN_NUMBER_RESERVED",
      message: "This number is reserved for administrator access.",
    });
  }

  try {
    let user;
    try {
      user = await User.create({ phone, role: "user", lastLoginAt: new Date() });
    } catch (error) {
      if (error?.code === 11000 && error?.keyPattern?.phone) {
        return res.status(409).json({
          success: false,
          code: "PHONE_ALREADY_REGISTERED",
          message: "This number already has an account. Without verification, existing accounts cannot be signed in to.",
        });
      }
      throw error;
    }

    const referralCode = await ensureReferralCode(user);
    setSessionCookie(res, user);
    return res.status(201).json({
      success: true,
      data: authUser(user, referralCode, { isNewAccount: true }),
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
