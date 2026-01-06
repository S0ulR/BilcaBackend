// backend/models/ApiCall.js
const { Schema, model } = require("mongoose");

const apiCallSchema = new Schema({
  endpoint: String,
  method: String,
  statusCode: Number,
  durationMs: Number,
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  ipAddress: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now },
});

apiCallSchema.index({ timestamp: 1 });
apiCallSchema.index({ userId: 1, timestamp: 1 });
apiCallSchema.index({ statusCode: 1, timestamp: 1 });

module.exports = model("ApiCall", apiCallSchema);
