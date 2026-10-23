import mongoose from "mongoose";

const userDetailSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    legacyUnowned: {
      type: Boolean,
      default: false,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    dateOfBirth: {
      type: String,
      required: true,
    },
    timeOfBirth: {
      type: String,
      default: "",
    },
    placeOfBirth: {
      type: String,
      default: "",
      trim: true,
    },
    gender: {
      type: String,
      default: "",
    },
    readingLanguage: {
      type: String,
      enum: ["en", "hi"],
      default: "en",
    },
    relationshipStatus: { type: String, default: "" },
    birthTimeUnknown: { type: Boolean, default: false },
    birthLatitude: { type: Number, default: null },
    birthLongitude: { type: Number, default: null },
    birthTimezone: { type: String, default: "" },
    content: {
      type: String,
      default: "",
    },
    chart: {
      type: Object,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const UserDetail =
  mongoose.models.UserDetail || mongoose.model("UserDetail", userDetailSchema);

export default UserDetail;
