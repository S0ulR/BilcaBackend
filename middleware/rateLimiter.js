const rateLimit = require("express-rate-limit");

const geocodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      msg: "Demasiadas solicitudes de geolocalización. Intenta más tarde.",
    });
  },
});

module.exports = { geocodeLimiter };
