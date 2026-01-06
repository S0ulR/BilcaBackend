// backend/models/Invoice.js
const { Schema, model } = require("mongoose");

const invoiceSchema = new Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    worker: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hire: {
      type: Schema.Types.ObjectId,
      ref: "Hire",
      required: true,
    },
    items: [
      {
        description: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        total: { type: Number, required: true, min: 0 },
      },
    ],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "ARS",
    },
    status: {
      type: String,
      enum: ["draft", "sent", "viewed", "paid", "overdue", "cancelled"],
      default: "draft",
    },
    dueDate: {
      type: Date,
      required: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para búsquedas rápidas
invoiceSchema.index({ worker: 1, status: 1 });
invoiceSchema.index({ client: 1, status: 1 });
invoiceSchema.index({ invoiceNumber: 1 });

module.exports = model("Invoice", invoiceSchema);
