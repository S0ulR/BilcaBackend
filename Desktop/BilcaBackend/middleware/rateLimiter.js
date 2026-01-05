// middleware/rateLimiter.js
const rateLimit = require("express-rate-limit");

const geocodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 solicitudes por IP
  message: { msg: "Demasiadas solicitudes, intenta más tarde" },
});

module.exports = { geocodeLimiter };
