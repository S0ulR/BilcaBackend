// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, login, firebaseLogin, logout, forgotPassword, checkResetToken, resetPassword, validateToken } = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { msg: "Demasiados intentos. Intenta en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post("/forgotpassword", authLimiter, forgotPassword);
router.post('/logout', auth, logout);
router.get("/reset-password/:token", checkResetToken);
router.post("/reset-password/:token", resetPassword);
router.post('/firebase', firebaseLogin);
router.get('/validate-token', auth, validateToken); 

module.exports = router;
