// backend/controllers/adminController.js
const analyticsService = require("../services/admin/AnalyticsService");
const userService = require("../services/admin/UserService");
const subscriptionService = require("../services/admin/SubscriptionService");
const alertService = require("../services/admin/AlertService");
const AuditLog = require("../models/AuditLog");

// ✅ Validar explícitamente que es superadmin
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== "superadmin") {
    return res.status(403).json({ msg: "Acceso denegado: solo superadmin" });
  }
  next();
};

// Dashboard modular: Overview
exports.getAdminOverview = async (req, res) => {
  try {
    requireSuperAdmin(req, res, () => {});

    const [stats, userActivity, userDist, infra, alerts] = await Promise.all([
      analyticsService.getCoreStats(),
      analyticsService.getUserActivity(),
      analyticsService.getUserDistribution(),
      Promise.resolve(analyticsService.getInfrastructureMetrics()),
      alertService.getActiveAlerts(),
    ]);

    res.json({
      ...stats,
      ...userActivity,
      userDistribution: userDist,
      infra,
      alerts,
    });
  } catch (err) {
    console.error("Error en getAdminOverview:", err);
    res.status(500).json({ msg: "Error al cargar resumen" });
  }
};

// Nueva ruta: Métricas de suscripciones
exports.getSubscriptionMetrics = async (req, res) => {
  try {
    requireSuperAdmin(req, res, () => {});

    const [growth, topWorkers] = await Promise.all([
      subscriptionService.getSubscriptionGrowth(),
      subscriptionService.getTopSubscribedWorkers(),
    ]);

    res.json({ growth, topWorkers });
  } catch (err) {
    console.error("Error en getSubscriptionMetrics:", err);
    res.status(500).json({ msg: "Error al cargar métricas de suscripción" });
  }
};

// Dashboard modular: Métricas
exports.getAdminMetrics = async (req, res) => {
  try {
    requireSuperAdmin(req, res, () => {});

    const [weeklyGrowth, apiUsage] = await Promise.all([
      analyticsService.getWeeklyUserGrowth(),
      analyticsService.getAPIUsageLast30Days(),
    ]);

    res.json({ weeklyGrowth, apiUsage });
  } catch (err) {
    console.error("Error en getAdminMetrics:", err);
    res.status(500).json({ msg: "Error al cargar métricas" });
  }
};

// Gestión de usuarios - todas las rutas requieren superadmin
exports.getUsers = async (req, res) => {
  try {
    requireSuperAdmin(req, res, () => {});

    const { page = 1, limit = 20, search, role } = req.query;
    const filters = {};
    if (search) filters.search = search;
    if (role && role !== "all") filters.role = role;

    const result = await userService.getAllUsers(
      parseInt(page),
      parseInt(limit),
      filters
    );
    res.json(result);
  } catch (err) {
    console.error("Error en getUsers:", err);
    res.status(500).json({ msg: "Error al cargar usuarios" });
  }
};

exports.getUserById = async (req, res) => {
  try {
    requireSuperAdmin(req, res, () => {});

    const user = await userService.getUserById(req.params.id);
    res.json(user);
  } catch (err) {
    console.error("Error en getUserById:", err.message);
    res.status(404).json({ msg: err.message || "Usuario no encontrado" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    requireSuperAdmin(req, res, () => {});

    const { id } = req.params;
    const updatedUser = await userService.updateUser(id, req.body);

    // Registrar en auditoría
    await AuditLog.create({
      adminId: req.user._id,
      action: "update_user",
      targetId: id,
      targetType: "User",
      details: { old: {}, new: req.body },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.json(updatedUser);
  } catch (err) {
    console.error("Error en updateUser:", err);
    res.status(400).json({ msg: err.message || "Error al actualizar usuario" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    requireSuperAdmin(req, res, () => {});

    const { id } = req.params;
    const result = await userService.deleteUser(id);

    // Registrar en auditoría
    await AuditLog.create({
      adminId: req.user._id,
      action: "delete_user",
      targetId: id,
      targetType: "User",
      details: {},
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.json(result);
  } catch (err) {
    console.error("Error en deleteUser:", err);
    res.status(400).json({ msg: err.message || "Error al eliminar usuario" });
  }
};

// Nueva acción: Suspender usuario
exports.suspendUser = async (req, res) => {
  try {
    requireSuperAdmin(req, res, () => {});

    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      {
        isActive: false,
        suspensionReason: reason,
        suspendedAt: new Date(),
      },
      { new: true }
    );

    if (!user) throw new Error("Usuario no encontrado");

    // Registrar en auditoría
    await AuditLog.create({
      adminId: req.user._id,
      action: "suspend_user",
      targetId: id,
      targetType: "User",
      details: { reason },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.json({ success: true, user });
  } catch (err) {
    console.error("Error en suspendUser:", err);
    res.status(400).json({ msg: err.message || "Error al suspender usuario" });
  }
};

// Nueva acción: Restaurar usuario
exports.restoreUser = async (req, res) => {
  try {
    requireSuperAdmin(req, res, () => {});

    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      {
        isActive: true,
        suspensionReason: null,
        suspendedAt: null,
      },
      { new: true }
    );

    if (!user) throw new Error("Usuario no encontrado");

    // Registrar en auditoría
    await AuditLog.create({
      adminId: req.user._id,
      action: "restore_user",
      targetId: id,
      targetType: "User",
      details: {},
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.json({ success: true, user });
  } catch (err) {
    console.error("Error en restoreUser:", err);
    res.status(400).json({ msg: err.message || "Error al restaurar usuario" });
  }
};
