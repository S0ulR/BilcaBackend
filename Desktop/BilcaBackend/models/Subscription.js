// backend/models/Subscription.js
const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  plan: {
    type: String,
    enum: ["professional", "featured"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "active", "canceled", "expired", "failed"],
    default: "pending",
  },
  paymentMethod: {
    type: String,
    enum: ["mercadopago"],
    default: "mercadopago",
  },
  mercadopagoSubscriptionId: {
    type: String,
    unique: true,
    sparse: true,
  },
  mercadopagoPreferenceId: {
    type: String,
  },
  nextBillingDate: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

subscriptionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model("Subscription", subscriptionSchema);
