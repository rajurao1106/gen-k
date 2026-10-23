import mongoose from "mongoose";

const generatedReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reportKey: { type: String, required: true },
    reportType: { type: String, enum: ["kundali", "milan"], required: true },
    content: { type: String, default: "" },
    status: {
      type: String,
      enum: ["generating", "ready", "failed"],
      default: "generating",
      index: true,
    },
    generationToken: { type: String, default: "" },
    lockExpiresAt: { type: Date, default: null },
    creditEntitlementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Entitlement",
      default: null,
    },
    errorCode: { type: String, default: "" },
  },
  { timestamps: true },
);

generatedReportSchema.index({ userId: 1, reportKey: 1 }, { unique: true });

const GeneratedReport =
  mongoose.models.GeneratedReport ||
  mongoose.model("GeneratedReport", generatedReportSchema);

export default GeneratedReport;
