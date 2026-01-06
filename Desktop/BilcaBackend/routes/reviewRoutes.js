// backend/routes/reviewRoutes.js
const express = require("express");
const router = express.Router();
const { validateReviewToken, submitReview, getWorkerReviews } = require("../controllers/reviewController");

// ✅ Públicas: solo para reseñas post-trabajo con token
router.get("/validate/:token", validateReviewToken);
router.post("/submit", submitReview);

// ✅ Protegida: ver reseñas de trabajador (pública pero con límites)
router.get("/workers/:id/reviews", getWorkerReviews);

module.exports = router;
