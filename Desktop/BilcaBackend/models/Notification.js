// backend/models/Notification.js
const { Schema, model } = require("mongoose");

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    type: {
      type: String,
      enum: [
        "review",
        "message",
        "hire",
        "system",
        "budget_request",
        "budget_response",
        "contract_pending",
        "contract_accepted",
        "invoice_sent",
      ],
    },
    relatedId: { type: Schema.Types.ObjectId, refPath: "onModel" },
    onModel: {
      type: String,
      enum: [
        "Review",
        "Message",
        "Hire",
        "BudgetRequest",
        "Contract",
        "Invoice",
      ],
    },
  },
  { timestamps: true }
);

module.exports = model("Notification", notificationSchema);
