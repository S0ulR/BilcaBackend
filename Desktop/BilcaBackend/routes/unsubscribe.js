// backend/routes/unsubscribe.js
const express = require("express");
const router = express.Router();
const {
  unsubscribeNotifications,
} = require("../controllers/unsubscribeController");

// Ruta pública: desactivar notificaciones
router.get("/notifications", unsubscribeNotifications);

module.exports = router;
