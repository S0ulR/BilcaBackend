// backend/models/AuditLog.js
const { Schema, model } = require("mongoose");

const auditLogSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetType: {
      type: String,
      enum: ["User", "Subscription", "Hire"],
      required: true,
    },
    details: { type: Object },
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);

module.exports = model("AuditLog", auditLogSchema);
