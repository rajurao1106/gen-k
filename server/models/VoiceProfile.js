import mongoose from "mongoose";

const voiceProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    referenceAudio: { type: Buffer, required: true },
    referenceAudioType: { type: String, required: true },
    label: { type: String, required: true, trim: true, maxlength: 40 },
    language: { type: String, required: true, enum: ["en", "hi"] },
    consentAt: { type: Date, required: true },
    consentVersion: { type: String, required: true },
    consentConfirmedBy: {
      type: String,
      enum: ["self", "has_permission"],
      required: true,
    },
  },
  { timestamps: true },
);

const VoiceProfile =
  mongoose.models.VoiceProfile || mongoose.model("VoiceProfile", voiceProfileSchema);

export default VoiceProfile;
