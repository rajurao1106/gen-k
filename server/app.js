import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import meRoutes from "./routes/meRoutes.js";
import guideRoutes from "./routes/guideRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import geminiRoutes from "./routes/geminiRoutes.js";
import voiceRoutes from "./routes/voiceRoutes.js";
import devRoutes from "./routes/devRoutes.js";
import { requireAdmin, requireAuth } from "./middleware/auth.js";

const app = express();
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
}

app.use(helmet());
app.use(
  cors({
    exposedHeaders: ["X-Voice-Message"],
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS."));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.json({ success: true, message: "Gen-K backend is running" });
});
app.get("/api/health", async (_req, res) => {
  try {
    await connectDB();
    if (!mongoose.connection.db) throw new Error("MongoDB database handle is unavailable.");
    await mongoose.connection.db.admin().ping();
    return res.json({
      success: true,
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("[health] database ping failed:", {
      name: error?.name ?? "Error",
      code: error?.code ?? "UNKNOWN",
    });
    return res.status(503).json({
      success: false,
      status: "unavailable",
      database: "disconnected",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/me", requireAuth, meRoutes);
app.use("/api/guide", requireAuth, guideRoutes);
app.use("/api/payments", requireAuth, paymentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/gemini", requireAuth, geminiRoutes);
app.use("/api/voice", requireAuth, voiceRoutes);
if (process.env.NODE_ENV !== "production") {
  app.use("/api/dev", requireAuth, requireAdmin, devRoutes);
}

app.use((error, _req, res, _next) => {
  console.error("[server] request failed:", error?.message ?? error);
  res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: "The request could not be completed.",
  });
});

export const initializeServer = async () => {
  await connectDB();
};

export default app;
