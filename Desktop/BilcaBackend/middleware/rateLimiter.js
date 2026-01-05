// middleware/rateLimiter.js
const rateLimit = require("express-rate-limit");

const geocodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 60, // 60 requests por IP (más realista)
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      msg: "Demasiadas solicitudes de geolocalización. Intenta nuevamente en unos minutos."
    });
  }
});

module.exports = { geocodeLimiter };

