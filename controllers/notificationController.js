const Notification = require("../models/Notification");

// ✅ Validación de IDs
const validateNotificationIds = (ids) => {
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new Error("IDs requeridos y deben ser un array");
  }
  
  // Verificar que todos los IDs sean strings válidos
  const invalidIds = ids.filter(id => typeof id !== 'string' || id.trim().length === 0);
  if (invalidIds.length > 0) {
    throw new Error("IDs inválidos en la lista");
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const notifs = await Notification.find({ user: req.user.id }).sort({
      read: 1,
      createdAt: -1,
    });
    res.json(notifs);
  } catch (err) {
    console.error("Error en getNotifications:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { ids } = req.body;
    const userId = req.user.id;

    if (ids?.length) {
      // ✅ Validar IDs antes de la operación
      validateNotificationIds(ids);
      
      await Notification.updateMany(
        { _id: { $in: ids }, user: userId },
        { read: true }
      );
    } else {
      await Notification.updateMany(
        { user: userId, read: false },
        { read: true }
      );
    }

    res.json({ msg: "Notificaciones marcadas como leídas" });
  } catch (err) {
    console.error("Error en markAsRead:", err.message);
    
    if (err.message.includes('IDs requeridos') || err.message.includes('IDs inválidos')) {
      return res.status(400).json({ msg: err.message });
    }
    
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.deleteNotifications = async (req, res) => {
  try {
    const { ids } = req.body;
    const userId = req.user.id;

    // ✅ Validar IDs
    validateNotificationIds(ids);

    const result = await Notification.deleteMany({
      _id: { $in: ids },
      user: userId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ msg: "Notificaciones no encontradas" });
    }

    res.json({ msg: "Notificaciones eliminadas" });
  } catch (err) {
    console.error("Error en deleteNotifications:", err.message);
    
    if (err.message.includes('IDs requeridos') || err.message.includes('IDs inválidos')) {
      return res.status(400).json({ msg: err.message });
    }
    
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await Notification.deleteMany({ user: userId });
    res.json({ 
      msg: `Todas las notificaciones eliminadas (${result.deletedCount})` 
    });
  } catch (err) {
    console.error("Error en deleteAllNotifications:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};
