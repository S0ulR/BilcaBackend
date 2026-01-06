// backend/middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { JWT_SECRET } = process.env;

// Autenticación y validación de sesión
exports.auth = async (req, res, next) => {
  const token = req.header("x-auth-token");
  const sessionId = req.header("x-session-id");

  if (!token) {
    return res.status(401).json({ msg: "No hay token, acceso denegado" });
  }

  if (!sessionId) {
    return res.status(401).json({ msg: "No hay session_id, acceso denegado" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.user.id);

    if (!user) {
      return res.status(401).json({ msg: "Usuario no encontrado" });
    }

    if (user.activeSessionId !== sessionId) {
      return res
        .status(401)
        .json({ msg: "Sesión inválida o cerrada en otro dispositivo" });
    }

    req.user = {
      id: decoded.user.id,
      role: decoded.user.role,
    };

    next();
  } catch (err) {
    res.status(401).json({ msg: "Token no válido o sesión inválida" });
  }
};

// Verifica que el usuario sea el dueño del recurso o admin/superadmin
exports.isOwnerOrAdmin = (req, res, next) => {
  const id = req.params.id || req.user.id;
  const userId = req.user.id;
  const role = req.user.role;

  if (userId === id || role === "admin" || role === "superadmin") {
    return next();
  }

  return res.status(403).json({ msg: "Acceso denegado" });
};

// Solo clientes (role: "user") pueden acceder
exports.isClient = (req, res, next) => {
  if (req.user.role !== "user") {
    return res.status(403).json({ msg: "Solo clientes pueden acceder" });
  }
  next();
};

// Solo trabajadores (role: "worker") pueden acceder
exports.isWorker = (req, res, next) => {
  if (req.user.role !== "worker") {
    return res.status(403).json({ msg: "Solo trabajadores pueden acceder" });
  }
  next();
};

// Solo superadmin puede acceder
exports.isSuperAdmin = (req, res, next) => {
  if (req.user.role !== "superadmin") {
    return res.status(403).json({ msg: "Acceso restringido a superadmin" });
  }
  next();
};
