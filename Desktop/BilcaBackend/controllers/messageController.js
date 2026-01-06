const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const Notification = require("../models/Notification");
const cloudinary = require("../config/cloudinary");
const sendNotificationEmail = require("../middleware/sendNotificationEmail");

// ✅ Validación de mensaje
const validateMessage = (content) => {
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new Error("El mensaje no puede estar vacío");
  }
  
  if (content.trim().length > 1000) {
    throw new Error("El mensaje no puede exceder los 1000 caracteres");
  }
};

// ✅ Validación de archivo
const validateFileUpload = (file) => {
  if (!file) {
    throw new Error("Archivo requerido");
  }
  
  const allowedTypes = [
    "image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"
  ];
  
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error("Tipo de archivo no soportado");
  }
  
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error("El archivo excede el tamaño máximo de 10MB");
  }
};

exports.sendMessage = async (req, res) => {
  const { recipient, content } = req.body;
  const sender = req.user.id;

  try {
    // ✅ Validación de datos
    validateMessage(content);

    if (!recipient) {
      return res.status(400).json({ msg: "Faltan datos: recipient" });
    }

    const recipientUser = await User.findById(recipient);
    if (!recipientUser) {
      return res.status(404).json({ msg: "Destinatario no encontrado" });
    }

    // ✅ Verificar que el remitente no se envíe mensaje a sí mismo
    if (sender === recipient) {
      return res.status(400).json({ msg: "No puedes enviarte mensajes a ti mismo" });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [sender, recipient], $size: 2 }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [sender, recipient],
      });
    }

    const message = new Message({
      sender,
      recipient,
      content: content.trim(),
      conversation: conversation._id,
    });

    await message.save();

    conversation.lastMessage = message._id;
    conversation.updatedAt = Date.now();
    await conversation.save();

    const notification = new Notification({
      user: recipient,
      message: `✉️ ${req.user.name} te envió un mensaje`,
      type: "message",
      relatedId: message._id,
      onModel: "Message",
    });

    await notification.save();
    if (typeof sendNotificationEmail === 'function') {
      await sendNotificationEmail(notification);
    }

    if (global.io) {
      global.io.to(conversation._id.toString()).emit("new_message", message);
      global.io.to(recipient.toString()).emit("notification", {
        message: notification.message,
        type: "message"
      });
    }

    res.status(201).json(message);
  } catch (err) {
    console.error("Error en sendMessage:", err.message);
    
    if (err.message.includes('mensaje no puede') || err.message.includes('No puedes enviarte')) {
      return res.status(400).json({ msg: err.message });
    }
    
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversations = await Conversation.find({ participants: userId })
      .populate("participants", "name photo")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (err) {
    console.error("Error en getConversations:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(403).json({ msg: "Acceso denegado" });
    }

    const messages = await Message.find({ conversation: conversationId })
      .populate("sender", "name photo")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("Error en getMessages:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // ✅ Verificar que la conversación pertenece al usuario
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(403).json({ msg: "Acceso denegado" });
    }

    await Message.updateMany(
      { conversation: conversationId, recipient: userId },
      { read: true }
    );
    res.json({ msg: 'Mensajes marcados como leídos' });
  } catch (err) {
    console.error("Error en markAsRead:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.uploadFile = async (req, res) => {
  try {
    const { conversation: conversationId } = req.body;
    const file = req.file;
    const sender = req.user.id;

    // ✅ Validación de datos
    validateFileUpload(file);

    if (!conversationId) {
      return res.status(400).json({ msg: "ID de conversación requerido" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ msg: "Conversación no encontrada" });
    }

    // ✅ Verificar que el usuario pertenece a la conversación
    if (!conversation.participants.includes(sender)) {
      return res.status(403).json({ msg: "No perteneces a esta conversación" });
    }

    const recipient = conversation.participants.find(p => p.toString() !== sender);
    if (!recipient) {
      return res.status(400).json({ msg: "Destinatario no válido" });
    }

    // Subir a Cloudinary
    let fileUrl = null;
    let fileType = 'file';
    let uploadPromise;

    if (file.mimetype.startsWith('image')) {
      fileType = 'image';
      uploadPromise = new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "bilca/messages", resource_type: "image" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(file.buffer);
      });
    } else if (file.mimetype === 'application/pdf') {
      uploadPromise = new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "bilca/messages", resource_type: "raw" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(file.buffer);
      });
    } else {
      return res.status(400).json({ msg: "Tipo de archivo no soportado" });
    }

    const result = await uploadPromise;
    fileUrl = result.secure_url;

    const message = new Message({
      sender,
      recipient,
      content: file.originalname,
      conversation: conversationId,
      fileUrl,
      fileName: file.originalname,
      fileType
    });

    await message.save();

    conversation.lastMessage = message._id;
    conversation.updatedAt = Date.now();
    await conversation.save();

    const notification = new Notification({
      user: recipient,
      message: `📎 ${req.user.name} te envió un archivo`,
      type: "message",
      relatedId: message._id,
      onModel: "Message",
    });

    await notification.save();
    if (typeof sendNotificationEmail === 'function') {
      await sendNotificationEmail(notification);
    }

    if (global.io) {
      global.io.to(conversationId.toString()).emit("new_message", message);
      global.io.to(recipient.toString()).emit("notification", {
        message: notification.message,
        type: "message"
      });
    }

    res.status(201).json(message);
  } catch (err) {
    console.error("Error en uploadFile:", err.message);
    
    if (err.message.includes('archivo no soportado') || err.message.includes('excede el tamaño') || err.message.includes('Archivo requerido')) {
      return res.status(400).json({ msg: err.message });
    }
    
    res.status(500).json({ msg: "Error al subir archivo" });
  }
};

exports.getTypingStatus = async (req, res) => {
  res.json({ typing: false, sender: null, senderName: "" });
};

exports.startConversation = async (req, res) => {
  const { recipient, content } = req.body;
  const sender = req.user.id;

  try {
    // ✅ Validación de datos
    validateMessage(content);

    if (!recipient) {
      return res.status(400).json({ msg: "Faltan datos" });
    }

    const recipientUser = await User.findById(recipient);
    if (!recipientUser) {
      return res.status(404).json({ msg: "Destinatario no encontrado" });
    }

    // ✅ Verificar que no es el mismo usuario
    if (sender === recipient) {
      return res.status(400).json({ msg: "No puedes iniciarte una conversación a ti mismo" });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [sender, recipient], $size: 2 }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [sender, recipient],
      });
    }

    const message = new Message({
      sender,
      recipient,
      content: content.trim(),
      conversation: conversation._id,
    });

    await message.save();

    conversation.lastMessage = message._id;
    conversation.updatedAt = Date.now();
    await conversation.save();

    const notification = new Notification({
      user: recipient,
      message: `✉️ ${req.user.name} inició una conversación contigo`,
      type: "message",
      relatedId: message._id,
      onModel: "Message",
    });

    await notification.save();
    if (typeof sendNotificationEmail === 'function') {
      await sendNotificationEmail(notification);
    }

    if (global.io) {
      global.io.to(conversation._id.toString()).emit("new_message", message);
      global.io.to(recipient.toString()).emit("notification", {
        message: notification.message,
        type: "message"
      });
    }

    res.status(201).json(message);
  } catch (err) {
    console.error("Error en startConversation:", err.message);
    
    if (err.message.includes('mensaje no puede') || err.message.includes('No puedes iniciarte')) {
      return res.status(400).json({ msg: err.message });
    }
    
    res.status(500).json({ msg: "Error del servidor" });
  }
};

// Devolver URL en lugar de binario
exports.getFileById = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message || !message.fileUrl) {
      return res.status(404).json({ msg: "Archivo no encontrado" });
    }

    const conversation = await Conversation.findOne({
      _id: message.conversation,
      participants: userId,
    });

    if (!conversation) {
      return res.status(403).json({ msg: "Acceso denegado" });
    }

    // Redirigir a Cloudinary
    return res.redirect(message.fileUrl);
  } catch (err) {
    console.error("Error en getFileById:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};
