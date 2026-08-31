import mongoose from "mongoose";

let connectionPromise;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI);
  }

  try {
    await connectionPromise;
    console.log("MongoDB connected");
    return mongoose.connection;
  } catch (error) {
    connectionPromise = undefined;
    console.error("MongoDB connection error:", error.message);
    throw error;
  }
};

export default connectDB;
