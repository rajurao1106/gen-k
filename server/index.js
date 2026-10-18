import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import geminiRoutes from "./routes/geminiRoutes.js";
import voiceRoutes from "./routes/voiceRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Behind nginx / a hosting proxy? Set TRUST_PROXY=1 so per-IP rate limiting
// sees the real client IP instead of the proxy's.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

await connectDB();

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Gen-K backend is running",
  });
});

app.use("/api/users", userRoutes);
app.use("/api/gemini", geminiRoutes);
app.use("/api/voice", voiceRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});