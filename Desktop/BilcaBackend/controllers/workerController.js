const User = require("../models/User");
const Review = require("../models/Review");

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ✅ ORDEN DE SUSCRIPCIÓN: featured > professional > none
const getSubscriptionOrder = (tier) => {
  const order = { featured: 3, professional: 2, none: 1 };
  return order[tier] || 1;
};

// ✅ Validación de profesiones
const VALID_PROFESSIONS = [
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

// ✅ Nueva función: Autocompletado de profesiones
exports.getProfessionSuggestions = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const query = q.trim().toLowerCase();
    const suggestions = VALID_PROFESSIONS.filter((prof) =>
      prof.toLowerCase().includes(query)
    )
      .slice(0, 8)
      .map((prof) => ({ type: "profession", name: prof }));

    res.json(suggestions);
  } catch (err) {
    console.error("Error en getProfessionSuggestions:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.getWorkers = async (req, res) => {
  try {
    const { profession, lat, lng, search, ubicacion, verifiedOnly } = req.query;

    const query = {
      role: "worker",
      isPrivate: { $ne: true },
    };

    // ✅ Solo verificados
    if (verifiedOnly === "true") {
      query.isVerified = true;
    }

    // ✅ Búsqueda general
    if (search && search.trim().length >= 2) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { name: regex },
        { "services.profession": regex },
        { "location.address": regex },
      ];
    }
    // ✅ Búsqueda por profesión exacta
    else if (profession) {
      query["services.profession"] = new RegExp(`^${profession}$`, "i");
    }

    // ✅ Filtro por ubicación textual
    if (ubicacion && ubicacion.trim().length >= 2) {
      query["location.address"] = new RegExp(ubicacion.trim(), "i");
    }

    // 🔹 1️⃣ Obtener trabajadores
    let workers = await User.find(query).select("-password -reviews").lean();

    // 🔹 2️⃣ Flags derivados (NO duplicar lógica en frontend)
    workers = workers.map((w) => {
      const isFeatured = w.subscriptionTier === "featured";
      const isProfessional = w.subscriptionTier === "professional";

      return {
        ...w,
        isRecommended: isFeatured,
        isVerified: isFeatured || isProfessional,
      };
    });

    // 🔹 3️⃣ Geolocalización (opcional)
    const hasGeo = lat && lng;
    if (hasGeo) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);

      if (!isNaN(userLat) && !isNaN(userLng)) {
        workers = workers.map((w) => {
          if (w.location?.coordinates?.length === 2) {
            const [wLng, wLat] = w.location.coordinates;
            const distance = getDistance(userLat, userLng, wLat, wLng);
            return {
              ...w,
              distance: Math.round(distance * 10) / 10,
            };
          }
          return w;
        });
      }
    }

    // 🔹 4️⃣ ORDEN FINAL (ÚNICO, DEFINITIVO)
    workers.sort((a, b) => {
      // 1️⃣ Suscripción (featured > professional > none)
      const subDiff =
        getSubscriptionOrder(b.subscriptionTier) -
        getSubscriptionOrder(a.subscriptionTier);
      if (subDiff !== 0) return subDiff;

      // 2️⃣ Rating (desc)
      const ratingA = a.rating || 0;
      const ratingB = b.rating || 0;
      if (ratingA !== ratingB) return ratingB - ratingA;

      // 3️⃣ Distancia (si existe)
      if (hasGeo) {
        if (a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance;
        }
        if (a.distance !== undefined) return -1;
        if (b.distance !== undefined) return 1;
      }

      return 0;
    });

    // 🔹 5️⃣ Límite de seguridad
    const MAX_WORKERS = 100;
    if (workers.length > MAX_WORKERS) {
      workers = workers.slice(0, MAX_WORKERS);
    }

    res.json(workers);
  } catch (err) {
    console.error("Error en getWorkers:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.updateWorkerProfile = async (req, res) => {
  const { professions, bio, hourlyRate, address } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    // ✅ Validar que el usuario actualice su propio perfil
    if (req.user.id !== user._id.toString()) {
      return res
        .status(403)
        .json({ msg: "No autorizado para actualizar este perfil" });
    }

    if (
      !Array.isArray(professions) ||
      professions.some((p) => !VALID_PROFESSIONS.includes(p.toLowerCase()))
    ) {
      return res
        .status(400)
        .json({ msg: "Una o más profesiones no son válidas" });
    }

    // ✅ Validar que no haya duplicados
    const normalizedProfessions = professions.map((p) => p.toLowerCase());
    const uniqueProfessions = [...new Set(normalizedProfessions)];
    if (uniqueProfessions.length !== normalizedProfessions.length) {
      return res.status(400).json({ msg: "No puedes repetir profesiones" });
    }

    user.role = "worker";
    user.professions = uniqueProfessions;
    if (bio !== undefined) user.bio = bio.trim();
    if (hourlyRate !== undefined) user.hourlyRate = parseFloat(hourlyRate);
    if (address !== undefined) {
      if (!user.location) user.location = {};
      user.location.address = address.trim();
    }

    // ✅ Actualizar profileCompleted
    const isProfileComplete =
      user.name &&
      user.city &&
      user.country &&
      user.phone &&
      user.birthday &&
      !["Ciudad temporal", "No especificada"].includes(
        String(user.city || "").trim()
      ) &&
      !["País temporal", "No especificado"].includes(
        String(user.country || "").trim()
      ) &&
      user.phone !== "123456789" &&
      new Date(user.birthday).getFullYear() !== 1990;
    user.profileCompleted = isProfileComplete;

    await user.save();

    res.json({
      msg: "Perfil actualizado como trabajador",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        professions: user.professions,
        bio: user.bio,
        hourlyRate: user.hourlyRate,
        location: user.location,
        photo: user.photo,
        rating: user.rating,
        totalJobs: user.totalJobs,
        subscriptionTier: user.subscriptionTier,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    console.error("Error en updateWorkerProfile:", err.message);
    res.status(500).send("Error del servidor");
  }
};

exports.getWorkerReviews = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validar ID
    if (!id) {
      return res.status(400).json({ msg: "ID de trabajador requerido" });
    }

    const reviews = await Review.find({ worker: id })
      .populate("user", "name photo")
      .sort({ createdAt: -1 });
    res.json(reviews || []);
  } catch (err) {
    console.error("Error en getWorkerReviews:", err.message);
    res.status(500).send("Error del servidor");
  }
};

exports.getWorkerById = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validar ID
    if (!id) {
      return res.status(400).json({ msg: "ID de trabajador requerido" });
    }

    const worker = await User.findById(id, "-password")
      .populate("reviews.user", "name photo")
      .populate("reviews");

    if (!worker || worker.role !== "worker") {
      return res.status(404).json({ msg: "Trabajador no encontrado" });
    }

    res.json(worker);
  } catch (err) {
    console.error("Error en getWorkerById:", err.message);
    res.status(500).send("Error del servidor");
  }
};
