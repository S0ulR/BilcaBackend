// backend/routes/messageRoutes.js
const express = require("express");
const router = express.Router();
const upload = require("../middleware/multer");
const { auth } = require("../middleware/auth");
const {
  sendMessage,
  getConversations,
  getMessages,
  markAsRead,
  uploadFile,
  getTypingStatus,
  startConversation,
  getFileById
} = require("../controllers/messageController");

// ✅ Middleware para verificar que el mensaje pertenece al usuario
const isMessageOwner = async (req, res, next) => {
  const { messageId } = req.params;
  const message = await require("../models/Message").findById(messageId);
  if (!message || ![message.sender, message.recipient].includes(req.user.id)) {
    return res.status(403).json({ msg: "Acceso denegado" });
  }
  next();
};

// ✅ Middleware para verificar que la conversación pertenece al usuario
const isConversationOwner = async (req, res, next) => {
  const { conversationId } = req.params;
  const conversationExists = await require("../models/Message").exists({
    conversation: conversationId,
    $or: [{ sender: req.user.id }, { recipient: req.user.id }]
  });
  if (!conversationExists) {
    return res.status(403).json({ msg: "Acceso denegado" });
  }
  next();
};

router.post("/send", auth, sendMessage);
router.get("/conversations", auth, getConversations);
router.get("/:conversationId", auth, isConversationOwner, getMessages);
router.put("/:conversationId/read", auth, isConversationOwner, markAsRead);
router.post("/upload", auth, upload.single("file"), uploadFile);
router.get("/:conversationId/typing", auth, isConversationOwner, getTypingStatus);
router.post("/start", auth, startConversation);
router.get("/file/:messageId", auth, isMessageOwner, getFileById);

module.exports = router;
