// backend/routes/hireRoutes.js
const express = require("express");
const router = express.Router();
const { auth, isOwnerOrAdmin, isClient } = require("../middleware/auth");
const {
  createHire,
  getHires,
  updateStatus,
  markAsCompleted,
  getCompletedHires,
  confirmCompletion,
} = require("../controllers/hireController");

// ✅ Solo clientes pueden crear contrataciones
router.post("/", auth, isClient, createHire);

// ✅ Cada usuario solo ve sus propias contrataciones
router.get("/", auth, getHires);
router.get("/completed", auth, getCompletedHires);

// ✅ Solo el trabajador dueño puede actualizar
router.put("/:id/status", auth, isOwnerOrAdmin, updateStatus);

router.post("/:id/confirm-completion", auth, isOwnerOrAdmin, confirmCompletion);

router.put("/:id/status/completed", auth, isOwnerOrAdmin, markAsCompleted);

module.exports = router;
