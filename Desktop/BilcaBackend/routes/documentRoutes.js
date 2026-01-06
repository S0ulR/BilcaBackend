// backend/routes/documentRoutes.js
const express = require("express");
const router = express.Router();
const { auth, isWorker } = require("../middleware/auth");
const upload = require("../middleware/multer");
const { sendDocumentEmail } = require("../controllers/documentController");

// ✅ Usa el middleware global isWorker
router.post("/send-email", auth, isWorker, upload.single("attachment"), sendDocumentEmail);

module.exports = router;
