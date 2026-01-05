// backend/config/socket.js
const setupSocket = (server) => {
  const io = require("socket.io")(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Protección contra ataques
    maxHttpBufferSize: 1e6, // 1MB
    perMessageDeflate: false,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  const activeUsers = new Map();

  // Validar room (solo IDs de conversación válidos)
  const isValidRoom = (room) => /^[a-f0-9]{24}$/.test(room);

  io.use((socket, next) => {
    const userId = socket.handshake.query.userId;
    if (!userId || !/^[a-f0-9]{24}$/.test(userId)) {
      return next(new Error("ID de usuario inválido"));
    }
    socket.userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;

    // Cerrar sesión anterior
    if (activeUsers.has(userId)) {
      io.sockets.sockets.get(activeUsers.get(userId))?.disconnect(true);
    }
    activeUsers.set(userId, socket.id);

    socket.on("join", (room) => {
      if (isValidRoom(room)) {
        socket.join(room);
      }
    });

    // Limitar frecuencia (anti-spam)
    let typingTimeout;
    socket.on("typing", ({ conversationId, userId, userName }) => {
      if (!isValidRoom(conversationId)) return;
      clearTimeout(typingTimeout);
      socket.to(conversationId).emit("user_typing", { conversationId, userId, userName });
      typingTimeout = setTimeout(() => {
        socket.to(conversationId).emit("user_stopped_typing", { conversationId });
      }, 3000);
    });

    socket.on("message_read", ({ messageId, conversationId }) => {
      if (!isValidRoom(conversationId) || !/^[a-f0-9]{24}$/.test(messageId)) return;
      socket.to(conversationId).emit("message_read", { messageId, conversationId });
    });

    socket.on("disconnect", () => {
      if (activeUsers.get(userId) === socket.id) {
        activeUsers.delete(userId);
      }
    });
  });

  // NO usar global.io → exportar io
  return io;
};

module.exports = setupSocket;
