// routes/geocodeRoutes.js
const express = require("express");
const router = express.Router();
const { geocodeLimiter } = require("../middleware/rateLimiter");
const geocodeController = require("../controllers/geocodeController");

router.get("/search", geocodeLimiter, geocodeController.search);
router.get("/reverse", geocodeLimiter, geocodeController.reverse);

module.exports = router;
