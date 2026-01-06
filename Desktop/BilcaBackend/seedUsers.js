// seed.js
require("dotenv").config(); // 🔴 CLAVE

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("./models/User");
const ApiCall = require("./models/ApiCall");
const Review = require("./models/Review");
const BudgetRequest = require("./models/BudgetRequest");
const Hire = require("./models/Hire");
const Message = require("./models/Message");
const Conversation = require("./models/Conversation");
const Subscription = require("./models/Subscription");

// =======================
// HELPERS
// =======================
const SAN_LORENZO = { lat: -32.6333, lng: -60.95 };

const generateNearbyCoords = (center, maxKm = 20) => {
  const randomDistance = maxKm * Math.sqrt(Math.random());
  const randomAngle = Math.random() * 2 * Math.PI;
  const dx = (randomDistance * Math.cos(randomAngle)) / 111;
  const dy = (randomDistance * Math.sin(randomAngle)) / 111;
  return [center.lng + dx, center.lat + dy];
};

const generateAvatarUrl = (name) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

const generateBirthday = () => {
  const start = new Date();
  start.setFullYear(start.getFullYear() - 65);
  const end = new Date();
  end.setFullYear(end.getFullYear() - 18);
  return new Date(start.getTime() + Math.random() * (end - start));
};

const generatePhone = () =>
  `${["11", "341", "351"][Math.floor(Math.random() * 3)]}${Math.floor(
    10000000 + Math.random() * 90000000
  )}`;

const professions = [
  "plomero",
  "electricista",
  "niñero",
  "albañil",
  "jardinero",
  "carpintero",
  "pintor",
  "limpieza",
  "paseador de perros",
  "cuidadores de adultos",
  "mudanzas",
  "gasista",
];

// =======================
// SEED
// =======================
const runSeed = async () => {
  console.log("🌱 Iniciando seed...");

  try {
    // 🟢 LIMPIEZA
    await Promise.all([
      User.deleteMany({}),
      ApiCall.deleteMany({}),
      Review.deleteMany({}),
      BudgetRequest.deleteMany({}),
      Hire.deleteMany({}),
      Message.deleteMany({}),
      Conversation.deleteMany({}),
      Subscription.deleteMany({}),
    ]);

    console.log("🗑️ Base limpia");

    const users = [];

    // SUPERADMIN
    users.push({
      name: "Superadmin Bilca",
      email: "admin@bilca.com",
      password: "123456",
      role: "superadmin",
      city: "San Lorenzo",
      country: "Argentina",
      phone: generatePhone(),
      birthday: generateBirthday(),
      photo: generateAvatarUrl("admin"),
      profileCompleted: true,
      isVerified: true,
    });

    // CLIENTES
    for (let i = 1; i <= 14; i++) {
      users.push({
        name: `Usuario ${i}`,
        email: `user${i}@test.com`,
        password: "123456",
        role: "user",
        city: "San Lorenzo",
        country: "Argentina",
        phone: generatePhone(),
        birthday: generateBirthday(),
        photo: generateAvatarUrl(`user${i}`),
        profileCompleted: true,
      });
    }

    // WORKERS
    for (let i = 1; i <= 50; i++) {
      const tier = i <= 5 ? "featured" : i <= 15 ? "professional" : "none";

      users.push({
        name: `Trabajador ${i}`,
        email: `worker${i}@test.com`,
        password: "123456",
        role: "worker",
        city: "San Lorenzo",
        country: "Argentina",
        phone: generatePhone(),
        birthday: generateBirthday(),
        photo: generateAvatarUrl(`worker${i}`),
        services: [
          {
            profession: professions[i % professions.length],
            hourlyRate: Math.floor(Math.random() * 50) + 20,
            bio: "Profesional responsable y puntual.",
          },
        ],
        subscriptionTier: tier,
        isVerified: tier !== "none",
        profileCompleted: true,
      });
    }

    // 🔐 HASH
    for (const u of users) {
      u.password = await bcrypt.hash(u.password, 10);
    }

    const savedUsers = await User.insertMany(users);
    console.log(`✅ ${savedUsers.length} usuarios creados`);

    const workers = savedUsers.filter((u) => u.role === "worker");
    const clients = savedUsers.filter((u) => u.role === "user");

    // 💳 SUBSCRIPTIONS
    const subs = workers
      .filter((w) => w.subscriptionTier !== "none")
      .map((w) => ({
        userId: w._id,
        plan: w.subscriptionTier,
        status: "active",
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }));

    await Subscription.insertMany(subs);
    console.log(`💳 ${subs.length} suscripciones`);

    // 🤝 HIRES + ⭐ REVIEWS
    for (const client of clients.slice(0, 8)) {
      const worker = workers[Math.floor(Math.random() * workers.length)];

      const hire = await Hire.create({
        client: client._id,
        worker: worker._id,
        service: worker.services[0].profession,
        budget: 200,
        status: "completado",
        completedAt: new Date(),
      });

      await Review.create({
        worker: worker._id,
        user: client._id,
        hire: hire._id,
        rating: Math.floor(Math.random() * 3) + 3,
        comment: "Excelente profesional.",
      });
    }

    console.log("⭐ Hires y reseñas creadas");

    console.log("🎉 SEED COMPLETADO");
  } catch (err) {
    console.error("❌ Error seed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

// =======================
// CONEXIÓN SEGURA
// =======================
(async () => {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: false,
      serverSelectionTimeoutMS: 10000,
    });
    console.log("✅ MongoDB conectado");
    await runSeed();
  } catch (err) {
    console.error("❌ No se pudo conectar a MongoDB:", err.message);
    process.exit(1);
  }
})();
