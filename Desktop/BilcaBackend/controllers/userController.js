// backend/controllers/userController.js
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const Subscription = require("../models/Subscription");

// ✅ Validación robusta de servicios
const isValidService = (service, validProfessions) => {
  if (!service.profession || !validProfessions.includes(service.profession)) {
    throw new Error(`Oficio no válido: ${service.profession}`);
  }

  if (service.hourlyRate === undefined || service.hourlyRate === null) {
    throw new Error("La tarifa por hora es requerida");
  }

  const rate = Number(service.hourlyRate);
  if (isNaN(rate) || rate < 0) {
    throw new Error("La tarifa por hora debe ser un número no negativo");
  }

  if (service.bio !== undefined && typeof service.bio !== "string") {
    throw new Error("La biografía debe ser texto");
  }

  return {
    profession: service.profession,
    hourlyRate: rate,
    bio: service.bio || "",
  };
};

const normalizeServices = (services = []) => {
  if (!Array.isArray(services)) return [];
  return services.map((s) => ({
    profession: s.profession || "",
    hourlyRate:
      s.hourlyRate === undefined || s.hourlyRate === null
        ? 0
        : Number(s.hourlyRate),
    bio: s.bio || "",
  }));
};

// ✅ Validación de perfil completo
const isProfileComplete = (user) => {
  if (!user) return false;

  const hasValidCity =
    user.city &&
    !["Ciudad temporal", "No especificada"].includes(String(user.city).trim());
  const hasValidCountry =
    user.country &&
    !["País temporal", "No especificado"].includes(String(user.country).trim());
  const hasValidPhone = user.phone && user.phone !== "123456789";
  const hasValidBirthday =
    user.birthday && new Date(user.birthday).getFullYear() !== 1990;

  return !!(
    // ✅ Forzar conversión a booleano
    (
      user.name &&
      hasValidCity &&
      hasValidCountry &&
      hasValidPhone &&
      hasValidBirthday &&
      user.email
    )
  );
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id, "-password");
    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    const subscription = await Subscription.findOne({
      userId: user._id,
      status: "active",
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      photo: user.photo,
      city: user.city,
      country: user.country,
      phone: user.phone,
      birthday: user.birthday,
      bio: user.bio,
      hourlyRate: user.hourlyRate,
      location: user.location,
      rating: user.rating,
      totalJobs: user.totalJobs,
      profileCompleted: user.profileCompleted,
      emailNotifications: user.emailNotifications,
      isPrivate: user.isPrivate,
      services: normalizeServices(user.services),
      isVerified: !!subscription,
      subscriptionStatus: subscription ? subscription.status : null,
    });
  } catch (err) {
    console.error("Error en getUser:", err.message);
    res.status(500).send("Error del servidor");
  }
};

exports.updateUser = async (req, res) => {
  let {
    name,
    city,
    country,
    phone,
    birthday,
    bio,
    hourlyRate,
    address,
    services,
  } = req.body;

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    // ✅ Validar que el usuario actualice su propio perfil
    if (req.user.id !== user._id.toString()) {
      return res
        .status(403)
        .json({ msg: "No autorizado para actualizar este perfil" });
    }

    if (name) user.name = name.trim();
    if (city) user.city = city.trim();
    if (country) user.country = country.trim();
    if (phone) user.phone = phone.trim();
    if (birthday) user.birthday = new Date(birthday);
    if (bio !== undefined) user.bio = bio ? bio.trim() : "";
    if (hourlyRate !== undefined) user.hourlyRate = parseFloat(hourlyRate);
    if (address) {
      if (!user.location) user.location = {};
      user.location.address = address.trim();
    }

    // ✅ Guardar foto directamente en MongoDB como base64
    if (req.file) {
      try {
        // Convertir Buffer a base64
        const base64Data = req.file.buffer.toString("base64");
        const mimeType = req.file.mimetype;
        user.photo = `data:${mimeType};base64,${base64Data}`;
      } catch (uploadErr) {
        console.error("Error al procesar archivo:", uploadErr);
        // Si falla, mantener la foto actual
      }
    }

    if (services !== undefined) {
      if (typeof services === "string") {
        try {
          services = JSON.parse(services);
        } catch (e) {
          return res
            .status(400)
            .json({ msg: "Formato inválido para services" });
        }
      }
      if (!Array.isArray(services)) {
        return res
          .status(400)
          .json({ msg: "Los servicios deben ser una lista" });
      }

      const validProfessions = [
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

      const validatedServices = [];
      const professions = [];

      for (let s of services) {
        const validated = isValidService(s, validProfessions);
        validatedServices.push(validated);
        professions.push(validated.profession);
      }

      const duplicates = professions.filter(
        (p, i) => professions.indexOf(p) !== i
      );
      if (duplicates.length > 0) {
        return res.status(400).json({
          msg: `Ya estás ofreciendo este servicio: ${duplicates.join(
            ", "
          )}. No puedes repetirlo.`,
        });
      }

      user.services = validatedServices;
      user.role = user.services.length > 0 ? "worker" : "user";
    }

    user.profileCompleted = isProfileComplete(user);
    await user.save();

    const subscription = await Subscription.findOne({
      userId: user._id,
      status: "active",
    });

    res.json({
      msg: "Perfil actualizado correctamente",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        photo: user.photo,
        city: user.city,
        country: user.country,
        phone: user.phone,
        birthday: user.birthday,
        bio: user.bio,
        hourlyRate: user.hourlyRate,
        location: user.location,
        rating: user.rating,
        totalJobs: user.totalJobs,
        profileCompleted: user.profileCompleted,
        emailNotifications: user.emailNotifications,
        isPrivate: user.isPrivate,
        services: normalizeServices(user.services),
        isVerified: !!subscription,
        subscriptionStatus: subscription ? subscription.status : null,
      },
    });
  } catch (err) {
    console.error("Error en updateUser:", err.message || err);
    res.status(500).json({ msg: "Error del servidor al actualizar el perfil" });
  }
};

exports.updateSettings = async (req, res) => {
  const { emailNotifications, isPrivate } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    // ✅ Validar que el usuario actualice su propia configuración
    if (req.user.id !== user._id.toString()) {
      return res
        .status(403)
        .json({ msg: "No autorizado para actualizar esta configuración" });
    }

    if (emailNotifications !== undefined) {
      if (typeof emailNotifications !== "boolean") {
        return res
          .status(400)
          .json({ msg: "emailNotifications debe ser booleano" });
      }
      user.emailNotifications = emailNotifications;
    }

    if (isPrivate !== undefined) {
      if (typeof isPrivate !== "boolean") {
        return res.status(400).json({ msg: "isPrivate debe ser booleano" });
      }
      user.isPrivate = isPrivate;
    }

    await user.save();

    const subscription = await Subscription.findOne({
      userId: user._id,
      status: "active",
    });

    res.json({
      msg: "Configuración actualizada",
      settings: {
        emailNotifications: user.emailNotifications,
        isPrivate: user.isPrivate,
      },
      user: {
        _id: user._id,
        profileCompleted: user.profileCompleted,
        services: normalizeServices(user.services),
        isVerified: !!subscription,
        subscriptionStatus: subscription ? subscription.status : null,
      },
    });
  } catch (err) {
    console.error("Error en updateSettings:", err.message);
    res.status(500).send("Error del servidor");
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ msg: "Faltan campos obligatorios" });
  }

  // ✅ Validar longitud de contraseña
  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ msg: "La nueva contraseña debe tener al menos 6 caracteres" });
  }

  const userId = req.user.id;
  try {
    const user = await User.findById(userId).select("+password");
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ msg: "Contraseña actual incorrecta" });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    res.json({ msg: "Contraseña actualizada correctamente" });
  } catch (err) {
    console.error("Error en changePassword:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.updateServices = async (req, res) => {
  const { services } = req.body;
  const userId = req.user.id;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    // ✅ Validar que el usuario actualice sus propios servicios
    if (req.user.id !== user._id.toString()) {
      return res
        .status(403)
        .json({ msg: "No autorizado para actualizar estos servicios" });
    }

    const validProfessions = [
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
    if (!Array.isArray(services))
      return res.status(400).json({ msg: "Los servicios deben ser una lista" });

    const validatedServices = [];
    const professions = [];

    for (let s of services) {
      const validated = isValidService(s, validProfessions);
      validatedServices.push(validated);
      professions.push(validated.profession);
    }

    const duplicates = professions.filter(
      (p, i) => professions.indexOf(p) !== i
    );
    if (duplicates.length > 0) {
      return res.status(400).json({
        msg: `Ya estás ofreciendo este servicio: ${duplicates.join(", ")}.`,
      });
    }

    user.services = validatedServices;
    user.role = user.services.length > 0 ? "worker" : "user";
    user.profileCompleted = isProfileComplete(user);
    await user.save();

    const subscription = await Subscription.findOne({
      userId: user._id,
      status: "active",
    });
    res.json({
      msg: "Servicios actualizados",
      user: {
        _id: user._id,
        role: user.role,
        services: normalizeServices(user.services),
        profileCompleted: user.profileCompleted,
        isVerified: !!subscription,
        subscriptionStatus: subscription ? subscription.status : null,
      },
    });
  } catch (err) {
    console.error("Error en updateServices:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.removeService = async (req, res) => {
  const { profession } = req.params;
  const userId = req.user.id;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    // ✅ Validar que el usuario elimine sus propios servicios
    if (req.user.id !== user._id.toString()) {
      return res
        .status(403)
        .json({ msg: "No autorizado para eliminar este servicio" });
    }

    const validProfessions = [
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
    if (!validProfessions.includes(profession))
      return res.status(400).json({ msg: "Profesión no válida" });
    const currentServices = Array.isArray(user.services) ? user.services : [];
    const filteredServices = currentServices.filter(
      (s) => s.profession !== profession
    );
    if (filteredServices.length === currentServices.length) {
      return res.status(404).json({
        msg: `No tienes un servicio de "${profession}" para eliminar.`,
      });
    }
    user.services = filteredServices;
    if (user.services.length === 0) user.role = "user";
    user.profileCompleted = isProfileComplete(user);
    await user.save();
    const subscription = await Subscription.findOne({
      userId: user._id,
      status: "active",
    });
    res.json({
      msg: `Servicio de "${profession}" eliminado`,
      user: {
        _id: user._id,
        role: user.role,
        services: normalizeServices(user.services),
        profileCompleted: user.profileCompleted,
        isVerified: !!subscription,
        subscriptionStatus: subscription ? subscription.status : null,
      },
    });
  } catch (err) {
    console.error("Error en removeService:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};
