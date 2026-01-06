// backend/models/BudgetRequest.js

const { Schema, model } = require("mongoose");

const budgetRequestSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    worker: { type: Schema.Types.ObjectId, ref: "User", required: true },
    profession: { type: String, required: true },
    startDate: { type: Date },
    description: { type: String, required: true },
    address: { type: String, required: true },
    locality: { type: String, required: true },
    province: { type: String, required: true },
    country: { type: String, required: true },
    urgent: { type: String, enum: ["no", "si"], default: "no" },
    status: {
      type: String,
      enum: ["pendiente", "respondido", "rechazado"],
      default: "pendiente",
    },
    response: {
      message: String,
      budget: Number,
      estimatedTime: String,
      createdAt: { type: Date, default: Date.now },
    },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

budgetRequestSchema.index({ client: 1, worker: 1 });
budgetRequestSchema.index({ worker: 1, status: 1 });

module.exports = model("BudgetRequest", budgetRequestSchema);
