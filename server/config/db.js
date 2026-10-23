import mongoose from "mongoose";
import User from "../models/User.js";
import VoiceProfile from "../models/VoiceProfile.js";

let connectionPromise;
let legacyIndexesPromise;

const removeLegacyUsernameIndex = async () => {
  const usersCollectionExists = await mongoose.connection.db
    .listCollections({ name: User.collection.name }, { nameOnly: true })
    .hasNext();
  if (!usersCollectionExists) return;

  const usernameIndex = (await User.collection.indexes()).find(
    (index) =>
      index.unique &&
      Object.keys(index.key).length === 1 &&
      index.key.username === 1,
  );
  if (!usernameIndex) return;

  await User.collection.dropIndex(usernameIndex.name);
  console.warn(
    `[database] Removed obsolete unique index "${usernameIndex.name}" from ${User.collection.name}.`,
  );
};

const ensureLegacyIndexesRemoved = () => {
  if (!legacyIndexesPromise) {
    legacyIndexesPromise = Promise.all([
      removeLegacyUsernameIndex(),
      removeLegacyVoiceIndexes(),
    ]).catch((error) => {
      legacyIndexesPromise = undefined;
      throw error;
    });
  }
  return legacyIndexesPromise;
};

const removeLegacyVoiceIndexes = async () => {
  const collectionExists = await mongoose.connection.db
    .listCollections({ name: VoiceProfile.collection.name }, { nameOnly: true })
    .hasNext();
  if (!collectionExists) return;

  const obsoleteIndexes = (await VoiceProfile.collection.indexes()).filter((index) =>
    index.unique && (
      index.key.providerVoiceId === 1 ||
      (index.key.userId === 1 && index.key.slot === 1)
    ),
  );
  for (const index of obsoleteIndexes) {
    await VoiceProfile.collection.dropIndex(index.name);
    console.warn(`[database] Removed obsolete voice index "${index.name}".`);
  }
};

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    await ensureLegacyIndexesRemoved();
    return mongoose.connection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (mongoose.connection.readyState !== 2) {
    connectionPromise = undefined;
  }
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI);
  }

  try {
    await connectionPromise;
    await ensureLegacyIndexesRemoved();
    console.log("MongoDB connected");
    return mongoose.connection;
  } catch (error) {
    connectionPromise = undefined;
    throw error;
  }
};

export default connectDB;
