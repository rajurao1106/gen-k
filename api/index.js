import app, { initializeServer } from "../server/app.js";

export default async function handler(req, res) {
  try {
    await initializeServer();
    return app(req, res);
  } catch {
    return res.status(500).json({
      success: false,
      message: "Service temporarily unavailable. Please try again later.",
    });
  }
}
