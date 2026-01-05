// backend/routes/invoiceRoutes.js
const express = require("express");
const router = express.Router();
const { auth, isWorker } = require("../middleware/auth");
const {
  createInvoice,
  sendInvoice,
  getSentInvoices,
  markAsPaid,
} = require("../controllers/invoiceController");

// ✅ Crear factura (solo worker)
router.post("/", auth, isWorker, createInvoice);

// ✅ Enviar factura (solo worker)
router.post("/send", auth, isWorker, sendInvoice);

// ✅ Obtener facturas enviadas (solo worker)
router.get("/sent", auth, isWorker, getSentInvoices);

// ✅ Marcar como pagada (cliente)
router.post("/:invoiceId/pay", auth, markAsPaid);

module.exports = router;
