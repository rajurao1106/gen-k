import mongoose from "mongoose";

const userDetailSchema = new mongoose.Schema(
  {
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
      required: true,
    },
    placeOfBirth: {
      type: String,
      required: true,
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

export default mongoose.model("UserDetail", userDetailSchema);
