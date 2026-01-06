// backend/config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // ✅ Opciones compatibles con Mongoose 8+
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxIdleTimeMS: 30000,
      // ✅ Protección contra NoSQL injection
      sanitizeFilter: true,
      // ⚠️ sanitizeProjection NO es una opción de conexión, sino de query
    });

    console.log(`✅ Conectado a MongoDB: ${conn.connection.host}`);
  } catch (err) {
    console.error("❌ Error al conectar a MongoDB:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
