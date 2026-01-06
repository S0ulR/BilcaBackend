// backend/routes/budgetRequestRoutes.js
const express = require("express");
const router = express.Router();
const { auth, isWorker, isClient } = require("../middleware/auth");
const {
  createBudgetRequest,
  getReceivedRequests,
  getSentRequests,
  respondToRequest,
  rejectBudgetRequest,
  getSentByWorker,
} = require("../controllers/budgetRequestController");

// ✅ Clientes y workers pueden crear solicitudes
router.post("/create", auth, createBudgetRequest);

// ✅ Solo trabajadores pueden ver solicitudes recibidas
router.get("/received", auth, isWorker, getReceivedRequests);

// ✅ Clientes y workers pueden ver solicitudes enviadas
router.get("/sent", auth, getSentRequests);

// ✅ Middleware para verificar propiedad de la solicitud
const isRequestOwner = async (req, res, next) => {
  const { requestId } = req.params;
  const request = await require("../models/BudgetRequest").findById(requestId);
  if (!request || request.worker.toString() !== req.user.id) {
    return res.status(403).json({ msg: "No autorizado" });
  }
  next();
};

router.post("/respond/:requestId", auth, isRequestOwner, respondToRequest);
// Rechazar
router.post("/reject/:requestId", auth, isRequestOwner, rejectBudgetRequest);

router.get("/sent-by-worker", auth, isWorker, getSentByWorker);

module.exports = router;
