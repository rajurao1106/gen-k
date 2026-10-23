import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { getJwtSecret } from "../config/authSecrets.js";

export const AUTH_COOKIE_NAME = "genk_session";

export function signAuthToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    getJwtSecret(),
    { expiresIn: "7d" },
  );
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({
      success: false,
      code: "UNAUTHENTICATED",
      message: "Please log in to continue.",
    });
  }

  try {
    const claims = jwt.verify(token, getJwtSecret());
    if (
      !claims ||
      typeof claims !== "object" ||
      typeof claims.sub !== "string"
    ) {
      throw new Error("Invalid session claims.");
    }
    const user = await User.findById(claims.sub).select("_id phone role");
    if (!user) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHENTICATED",
        message: "Please log in to continue.",
      });
    }
    req.user = user;
    next();
  } catch (error) {
    if (error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        code: "UNAUTHENTICATED",
        message: "Your session has expired. Please log in again.",
      });
    }
    next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      code: "FORBIDDEN",
      message: "Administrator access is required.",
    });
  }
  next();
}
