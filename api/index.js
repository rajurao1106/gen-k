import app, { initializeServer } from "../server/app.js";

export default async function handler(req, res) {
  try {
    await initializeServer();
    return app(req, res);
  } catch (error) {
    console.error("API initialization error:", error);
    return res.status(500).json({
      success: false,
      message: "Backend initialization failed",
    });
  }
}
