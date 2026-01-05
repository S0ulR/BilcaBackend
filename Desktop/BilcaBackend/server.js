// backend/server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const { Server } = require("socket.io");
const cron = require("node-cron");

dotenv.config();
const connectDB = require("./config/db");

const app = express();
const server = http.createServer(app);
connectDB();

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);
  
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`Usuario ${userId} se unió a la sala`);
  });

  socket.on("disconnect", () => {
    console.log("Usuario desconectado:", socket.id);
  });
});

// Helmet con CSP seguro (corregido)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

const normalizeOrigins = (origins) => {
  if (!origins) return [];
  return origins
    .split(/[ ,]+/)
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...normalizeOrigins(process.env.CLIENT_URL),
  ...normalizeOrigins(process.env.CLIENT_URLS),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      // Verificar si el origin está permitido
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      return callback(new Error("CORS no permitido para este origen"), false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const apiLogger = require("./middleware/apiLogger");
app.use("/api", apiLogger);

const sendReviewReminders = require("./jobs/sendReviewReminders");
cron.schedule("0 0 * * *", sendReviewReminders);

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

// Webhook público de Mercado Pago (sin /api)
app.use("/subscriptions", require("./routes/subscriptionRoutes"));

app.use((req, res) => {
  res.status(404).json({ msg: "Ruta no encontrada" });
});

app.use((err, req, res, next) => {
  console.error("Error global:", err.stack);
  res.status(500).json({ msg: "Error del servidor" });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log("⏰ Cron job de reseñas programado para ejecutarse diariamente a medianoche.");
  console.log("📊 Middleware de logging de API activado para /api");
});
