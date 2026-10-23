import dotenv from "dotenv";
import mongoose from "mongoose";
import UserDetail from "../models/UserDetail.js";

dotenv.config();

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is not configured.");
}

await mongoose.connect(process.env.MONGODB_URI);
try {
  const result = await UserDetail.updateMany(
    { $or: [{ userId: { $exists: false } }, { userId: null }] },
    { $set: { legacyUnowned: true } },
  );
  console.info(`Flagged ${result.modifiedCount} legacy user-detail records as unowned.`);
} finally {
  await mongoose.disconnect();
}
