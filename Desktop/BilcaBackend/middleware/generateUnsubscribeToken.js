// backend/utils/generateUnsubscribeToken.js
const crypto = require("crypto");

const generateUnsubscribeToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    console.warn("⚠️ JWT_SECRET no definido. Usando clave insegura en desarrollo.");
  }
  const secret = process.env.JWT_SECRET || "fallback-secret-for-dev-only";
  const payload = userId;
  const hmac = crypto.createHmac("sha256", secret);
  return hmac.update(payload).digest("hex");
};

module.exports = generateUnsubscribeToken;
