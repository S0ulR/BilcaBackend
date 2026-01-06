// backend/server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const cron = require("node-cron");

dotenv.config();

const connectDB = require("./config/db");
const apiLogger = require("./middleware/apiLogger");
const sendReviewReminders = require("./jobs/sendReviewReminders");

// ✅ Redis (no debe tumbar el server si falla)
const { initRedis } = require("./utils/geocodeCache");

const app = express();

// ✅ Render / proxies: NECESARIO para rate-limit / IP / cookies
app.set("trust proxy", 1);

// =======================
// ✅ CORS "blindado"
// =======================
// ⚠️ Poner las origins EXACTAS (sin trailing slash)
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://bilca-frontend.vercel.app", // 👈 TU FRONT EN VERCEL
  // si tenés dominio propio:
  // "https://bilca.com",
].filter(Boolean);

// ✅ CORS Options (NO lanzar Error nunca)
const corsOptions = {
  origin: (origin, cb) => {
    // Permitir requests sin Origin (Postman, server-to-server)
    if (!origin) return cb(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);

    // NO tirar error: si tirás error, se rompe el preflight y no salen headers
    console.warn("❌ CORS bloqueado para:", origin);
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

// ✅ 1) CORS primero
app.use(cors(corsOptions));
// ✅ 2) Preflight global SIEMPRE (clave para Vercel)
app.options("*", cors(corsOptions));

// =======================
// ✅ Security / body parsers
// =======================
app.use(
  helmet({
    // IMPORTANTE: si usás sockets y recursos externos, no seas hiper restrictivo acá
    // Si el CSP te rompe cosas en prod, podés desactivar contentSecurityPolicy.
    contentSecurityPolicy: false,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// =======================
// ✅ Logger (si lo usás solo para /api, mantenelo)
// OJO: tus rutas NO están bajo /api, así que acá NO se ejecuta.
// =======================
app.use("/api", apiLogger);

// =======================
// ✅ Routes
// =======================
app.get("/", (req, res) => {
  res.json({ message: "Bienvenido a Bilca API 🛠️" });
});

app.use("/auth", require("./routes/authRoutes"));
app.use("/hires", require("./routes/hireRoutes"));
app.use("/messages", require("./routes/messageRoutes"));
app.use("/admin", require("./routes/adminRoutes"));
app.use("/users", require("./routes/userRoutes"));
app.use("/workers", require("./routes/workerRoutes"));
app.use("/notifications", require("./routes/notificationRoutes"));
app.use("/reviews", require("./routes/reviewRoutes"));
app.use("/unsubscribe", require("./routes/unsubscribe"));
app.use("/budget-requests", require("./routes/budgetRequestRoutes"));
app.use("/geocode", require("./routes/geocodeRoutes"));
app.use("/invoices", require("./routes/invoiceRoutes"));
app.use("/documents", require("./routes/documentRoutes"));
app.use("/subscriptions", require("./routes/subscriptionRoutes"));

// =======================
// ✅ 404 + error handler
// =======================
app.use((req, res) => {
  res.status(404).json({ msg: "Ruta no encontrada" });
});

app.use((err, req, res, next) => {
  console.error("Error global:", err);
  res.status(500).json({ msg: "Error del servidor" });
});

// =======================
// ✅ HTTP server + Socket.IO (UNA sola vez)
// =======================
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.on("join", (userId) => {
    socket.join(userId);
  });

  socket.on("disconnect", () => {
    console.log("Usuario desconectado:", socket.id);
  });
});

// =======================
// ✅ Init DB / Redis / Cron
// =======================
connectDB();

// ✅ Redis no debe tumbar el server (tu initRedis debe manejar try/catch)
initRedis();

cron.schedule("0 0 * * *", sendReviewReminders);

// =======================
// ✅ Listen
// =======================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
