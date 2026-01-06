const express = require("express");
const router = express.Router();
const { auth, isOwnerOrAdmin } = require("../middleware/auth");
const upload = require("../middleware/multer");

const {
  getUser,
  updateUser,
  updateSettings,
  changePassword,
  updateServices,
  removeService,
} = require("../controllers/userController");

/* =========================
   🔒 RUTAS ESPECÍFICAS PRIMERO
   ========================= */

// 👉 Servicios (ANTES que /:id)
router.put("/services", auth, isOwnerOrAdmin, updateServices);
router.delete("/services/:profession", auth, isOwnerOrAdmin, removeService);

// 👉 Configuración
router.put("/settings", auth, isOwnerOrAdmin, updateSettings);

// 👉 Password
router.post("/change-password", auth, changePassword);

/* =========================
   👤 RUTAS CON :id AL FINAL
   ========================= */

router.get("/:id", auth, isOwnerOrAdmin, getUser);
router.put("/:id", auth, isOwnerOrAdmin, upload.single("photo"), updateUser);

module.exports = router;
