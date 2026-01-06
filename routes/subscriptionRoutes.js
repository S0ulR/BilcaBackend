// backend/routes/subscriptionRoutes.js
const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const {
  createSubscription
} = require("../controllers/subscriptionController");
const {
  handleMercadoPagoWebhook
} = require("../webhooks/webhookController");

// Ruta protegida: crear suscripción (solo usuarios logueados)
router.post("/subscribe", auth, createSubscription);

// Ruta pública: webhook de Mercado Pago (NO requiere auth)
router.post("/webhooks/mercadopago", handleMercadoPagoWebhook);

module.exports = router;
