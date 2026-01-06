// backend/routes/workerRoutes.js
const express = require("express");
const router = express.Router();
const { auth, isOwnerOrAdmin } = require("../middleware/auth");
const {
  getWorkers,
  updateWorkerProfile,
  getWorkerById,
  getProfessionSuggestions,
} = require("../controllers/workerController");

// ✅ Pública: búsqueda de trabajadores
router.get("/", getWorkers);

// ✅ Pública: ver perfil completo
router.get("/:id", getWorkerById);

// ✅ Protegido: actualizar perfil (solo dueño)
router.put("/profile", auth, isOwnerOrAdmin, updateWorkerProfile);

// ✅ Pública: ruta para autocompletado de profesiones
router.get("/professions", getProfessionSuggestions);

module.exports = router;
