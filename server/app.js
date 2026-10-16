import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import geminiRoutes from "./routes/geminiRoutes.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Gen-K backend is running",
  });
});

app.use("/api/users", userRoutes);
app.use("/api/gemini", geminiRoutes);

export const initializeServer = async () => {
  await connectDB();
};

export default app;