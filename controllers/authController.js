const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const admin = require("../config/firebase");
const crypto = require("crypto");

const {
  sendPasswordResetEmail,
  sendPasswordChangedNotification,
} = require("../config/nodemailer");
const { JWT_SECRET, JWT_EXPIRES_IN } = process.env;
const Subscription = require("../models/Subscription");

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

// ✅ Función para devolver solo datos seguros del usuario
const getSafeUserResponse = (user, subscription = null) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  photo: user.photo,
  professions: user.professions,
  bio: user.bio,
  hourlyRate: user.hourlyRate,
  totalJobs: user.totalJobs,
  rating: user.rating,
  location: user.location
    ? {
        address: user.location.address,
        locality: user.location.locality,
        province: user.location.province,
        country: user.location.country,
        coordinates: user.location.coordinates,
      }
    : undefined,
  isPrivate: user.isPrivate,
  emailNotifications: user.emailNotifications,
  isVerified: !!subscription,
  subscriptionStatus: subscription ? subscription.status : null,
});

// Registro tradicional
exports.register = async (req, res) => {
  const {
    name,
    city,
    phone,
    country,
    birthday,
    email,
    password,
    role,
    services,
  } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({ msg: "Ya existe un usuario con este email" });
    }

    if (!["user", "worker", "admin"].includes(role)) {
      return res.status(400).json({ msg: "Rol no válido" });
    }

    // Validar servicios si es worker
    if (role === "worker") {
      if (!services || !Array.isArray(services) || services.length === 0) {
        return res
          .status(400)
          .json({ msg: "Debes agregar al menos un servicio." });
      }

      for (const svc of services) {
        if (!svc.profession || !VALID_PROFESSIONS.includes(svc.profession)) {
          return res
            .status(400)
            .json({ msg: "Profesión no válida en uno de los servicios." });
        }
      }
    }

    user = new User({
      name,
      city,
      phone,
      country,
      birthday: new Date(birthday),
      email,
      password,
      role,
      services:
        role === "worker"
          ? services.map((s) => ({
              profession: s.profession,
              hourlyRate: s.hourlyRate ? Number(s.hourlyRate) : undefined,
              bio: s.bio || undefined,
              isActive: true,
            }))
          : [],
      emailNotifications: true,
      isPrivate: false,
      photo: "/assets/default-avatar.png",
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    // Enviar email de bienvenida
    try {
      await require("../config/nodemailer").sendWelcomeEmail(
        user.email,
        user.name
      );
    } catch (emailErr) {
      console.warn(
        "📧 Email de bienvenida no enviado, pero registro exitoso:",
        emailErr.message
      );
    }

    const payload = { user: { id: user._id, role: user.role } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      token,
      user: getSafeUserResponse(user, null),
    });
  } catch (err) {
    console.error("Error en registro:", err.message);
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ msg: "Error de validación", errors: messages });
    }
    res.status(500).json({ msg: "Error del servidor" });
  }
};

// Login tradicional
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({ msg: "Credenciales inválidas" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Credenciales inválidas" });
    }

    // Generar un session_id único
    const sessionId = crypto.randomUUID();

    // Si ya tenía una sesión activa, se cierra la anterior
    if (user.activeSessionId) {
      // Opcional: aquí puedes registrar o hacer algo con la sesión anterior si es necesario
    }

    // Actualizar el activeSessionId y lastSeen del usuario
    user.activeSessionId = sessionId;
    user.lastSeen = new Date();
    await user.save();

    // 👇 Obtener estado de suscripción
    const subscription = await Subscription.findOne({
      userId: user._id,
      status: "active",
    });

    const payload = { user: { id: user._id, role: user.role } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      token,
      user: getSafeUserResponse(user, subscription),
      sessionId,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

// Cerrar sesión y limpiar registro activeSessionId
exports.logout = async (req, res) => {
  try {
    const userId = req.user.id;

    // Limpiar el activeSessionId del usuario
    await User.findByIdAndUpdate(userId, { activeSessionId: null });

    res.json({ msg: "Sesión cerrada exitosamente" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

// Cambiar contraseña
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ msg: "La contraseña actual es incorrecta" });
    }

    const passwordHistory = user.passwordHistory || [];
    for (let pwd of passwordHistory) {
      const match = await bcrypt.compare(newPassword, pwd.password);
      if (match) {
        return res.status(400).json({
          msg: "No puedes usar una contraseña ya usada anteriormente",
        });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.passwordHistory.unshift({ password: user.password });
    user.passwordHistory = user.passwordHistory.slice(0, 3);

    user.password = hashedPassword;
    await user.save();

    res.json({ msg: "Contraseña actualizada correctamente" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

// ====== FIREBASE LOGIN ======
// ====== FIREBASE LOGIN ======
exports.firebaseLogin = async (req, res) => {
  const { idToken } = req.body;

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture, provider_id } = decodedToken;

    if (!email) {
      return res.status(400).json({ msg: "El proveedor no proporcionó email" });
    }

    let user = await User.findOne({
      $or: [{ email }, { googleId: uid }, { appleId: uid }],
    });

    if (user) {
      if (!user.googleId && provider_id === "google.com") user.googleId = uid;
      if (!user.appleId && provider_id === "apple.com") user.appleId = uid;
      if (picture && user.photo === "/assets/default-avatar.png") {
        user.photo = picture;
      }
    } else {
      user = new User({
        name: name || email.split("@")[0],
        email,
        role: "user",
        photo: picture || "/assets/default-avatar.png",
        city: "Ciudad temporal",
        country: "País temporal",
        phone: "pendiente",
        birthday: new Date("1990-01-01"),
        password: "oauth",
        googleId: provider_id === "google.com" ? uid : undefined,
        appleId: provider_id === "apple.com" ? uid : undefined,
      });
    }

    // 🔐 SESIÓN (CLAVE)
    const sessionId = crypto.randomUUID();
    user.activeSessionId = sessionId;
    user.lastSeen = new Date();

    await user.save({ validateBeforeSave: false });

    const subscription = await Subscription.findOne({
      userId: user._id,
      status: "active",
    });

    const payload = { user: { id: user._id, role: user.role } };
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.json({
      token,
      user: getSafeUserResponse(user, subscription),
      sessionId,
    });
  } catch (err) {
    console.error("Error Firebase login:", err);
    res.status(401).json({ msg: "Token de autenticación inválido" });
  }
};

// ====== RESTABLECER CONTRASEÑA ======
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Buscar usuario por email
    const user = await User.findOne({ email });
    if (!user) {
      // No revelar si el email existe o no (seguridad)
      return res.json({
        msg: "Si el email está registrado, recibirás un enlace para restablecer tu contraseña.",
      });
    }

    // Generar token seguro
    const token = crypto.randomBytes(32).toString("hex");

    // Guardar token y expiración en la base de datos
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hora

    await user.save();

    // Enviar email con enlace
    const resetLink = `${
      process.env.CLIENT_URL || "http://localhost:3000"
    }/reset-password/${token}`;
    await sendPasswordResetEmail(user.email, resetLink);

    res.json({
      msg: "Te hemos enviado un enlace para restablecer tu contraseña.",
    });
  } catch (err) {
    console.error("Error en forgotPassword:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.checkResetToken = async (req, res) => {
  const { token } = req.params;

  try {
    // Buscar usuario con token y sin expiración
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // Mayor que ahora = no expirado
    });

    if (!user) {
      return res
        .status(400)
        .json({ valid: false, msg: "El enlace es inválido o ha expirado." });
    }

    // ✅ Token válido
    res.status(200).json({ valid: true, msg: "Token válido." });
  } catch (err) {
    console.error("Error en checkResetToken:", err);
    res.status(500).json({ valid: false, msg: "Error del servidor." });
  }
};

exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  // Validar contraseña
  if (!password || password.length < 6) {
    return res
      .status(400)
      .json({ msg: "La contraseña debe tener al menos 6 caracteres." });
  }

  // Obtener IP y User-Agent del cliente para notificación
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get("User-Agent") || "desconocido";

  try {
    // Buscar usuario con token y sin expiración
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ msg: "El enlace es inválido o ha expirado." });
    }

    // Encriptar nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Actualizar contraseña y limpiar token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    // Guardar usuario
    await user.save();

    // ✅ Enviar notificación de seguridad
    try {
      await require("../config/nodemailer").sendPasswordChangedNotification(
        user.email,
        clientIp,
        userAgent
      );
    } catch (emailErr) {
      console.warn(
        "📧 Notificación de cambio de contraseña no enviada:",
        emailErr.message
      );
    }

    res.json({ msg: "Contraseña actualizada correctamente." });
  } catch (err) {
    console.error("Error en resetPassword:", err);
    res.status(500).json({ msg: "Error del servidor." });
  }
};

// ====== VALIDAR TOKEN ======
exports.validateToken = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "Token no proporcionado" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    const subscription = await Subscription.findOne({
      userId: user._id,
      status: "active",
    });
    res.status(200).json({
      msg: "Token válido",
      user: {
        ...user.toObject(),
        isVerified: !!subscription,
        subscriptionStatus: subscription ? subscription.status : null,
      },
    });
  } catch (err) {
    res.status(401).json({ msg: "Token inválido o expirado" });
  }
};
