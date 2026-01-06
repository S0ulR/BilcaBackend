const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 intentos por IP (registro + login)
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 🔹 No limitar preflight
    if (req.method === "OPTIONS") return true;

    // 🔹 No limitar Firebase auth
    if (req.path.includes("/firebase")) return true;

    return false;
  },
  handler: (req, res) => {
    return res.status(429).json({
      msg: "Demasiados intentos. Intenta nuevamente en 15 minutos.",
    });
  },
});

module.exports = { authLimiter };
