const Hire = require("../models/Hire");
const User = require("../models/User");
const Notification = require("../models/Notification");
const sendNotificationEmail = require("../middleware/sendNotificationEmail");

// ✅ Verificar si puede generar contratos (solo featured)
const canGenerateContract = (user) => {
  return user.subscriptionTier === "featured";
};

// ✅ Validación robusta de contratación
const validateHire = (body) => {
  const { worker, service, description, budget } = body;

  if (!worker || !service || !description) {
    throw new Error("Faltan campos obligatorios: worker, service, description");
  }

  if (budget !== undefined && (isNaN(budget) || budget < 0)) {
    throw new Error("El presupuesto debe ser un número positivo");
  }

  if (typeof service !== "string" || service.trim().length === 0) {
    throw new Error("El servicio debe ser un texto válido");
  }

  if (typeof description !== "string" || description.trim().length === 0) {
    throw new Error("La descripción debe ser un texto válido");
  }
};

// ✅ Validación de estado
const validateStatus = (status) => {
  const validStatus = ["pendiente", "aceptado", "rechazado", "completado"];
  if (!validStatus.includes(status)) {
    throw new Error("Estado no válido");
  }
  return status;
};

exports.createHire = async (req, res) => {
  const { worker, service, description, budget } = req.body;
  const client = req.user.id;

  try {
    // ✅ Validación de datos
    validateHire({ worker, service, description, budget });

    const workerUser = await User.findById(worker);
    if (!workerUser || workerUser.role !== "worker") {
      return res.status(400).json({ msg: "Trabajador no válido" });
    }

    const clientUser = await User.findById(client);
    if (!clientUser) {
      return res.status(400).json({ msg: "Cliente no válido" });
    }

    if (!canGenerateContract(clientUser)) {
      return res.status(403).json({
        msg: 'Solo los profesionales con plan "Destacado" pueden generar contratos',
      });
    }

    const hire = new Hire({
      worker,
      client,
      service: service.trim(),
      description: description.trim(),
      budget: budget ? parseFloat(budget) : undefined,
      status: "pendiente",
    });

    await hire.save();

    try {
      const notification = new Notification({
        user: worker,
        message: `📩 ${clientUser.name} te ha contratado para: ${service}`,
        type: "hire",
        relatedId: hire._id,
        onModel: "Hire",
      });
      await notification.save();
      if (typeof sendNotificationEmail === "function") {
        await sendNotificationEmail(notification);
      }
    } catch (notifErr) {
      console.error("Error al enviar notificación:", notifErr.message);
    }

    res.status(201).json({ msg: "Contratación creada", hire });
  } catch (err) {
    console.error("Error en createHire:", err.message);

    if (
      err.message.includes("Faltan campos obligatorios") ||
      err.message.includes("presupuesto")
    ) {
      return res.status(400).json({ msg: err.message });
    }

    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.getHires = async (req, res) => {
  try {
    const { page = 1, limit = 3 } = req.query;
    const skip = (page - 1) * limit;

    // ✅ Asegurar que el usuario solo vea sus propias contrataciones
    const hires = await Hire.find({
      $or: [{ client: req.user.id }, { worker: req.user.id }],
    })
      .populate("worker", "name profession photo rating")
      .populate("client", "name photo")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Hire.countDocuments({
      $or: [{ client: req.user.id }, { worker: req.user.id }],
    });

    res.json({
      hires,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    console.error("Error en getHires:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  try {
    const hire = await Hire.findById(id);
    if (!hire)
      return res.status(404).json({ msg: "Contratación no encontrada" });

    // ✅ Solo el trabajador puede actualizar el estado
    if (hire.worker.toString() !== req.user.id) {
      return res.status(403).json({ msg: "No autorizado" });
    }

    const validatedStatus = validateStatus(status);
    hire.status = validatedStatus;
    await hire.save();

    res.json({ msg: "Estado actualizado", hire });
  } catch (err) {
    console.error("Error en updateStatus:", err.message);

    if (err.message.includes("Estado no válido")) {
      return res.status(400).json({ msg: err.message });
    }

    res.status(500).json({ msg: "Error del servidor" });
  }
};

// ✅ NUEVO: Cliente confirma finalización del trabajo
exports.confirmCompletion = async (req, res) => {
  try {
    const hire = await Hire.findById(req.params.id);
    if (!hire)
      return res.status(404).json({ msg: "Contratación no encontrada" });

    // ✅ Solo el cliente puede confirmar la finalización
    if (hire.client.toString() !== req.user.id) {
      return res.status(403).json({ msg: "No autorizado" });
    }

    // ✅ Solo se puede confirmar si el trabajador ya completó
    if (!hire.workerCompleted) {
      return res
        .status(400)
        .json({ msg: "El trabajador debe completar primero el trabajo" });
    }

    // ✅ Ya está completado
    if (hire.clientCompleted) {
      return res.status(400).json({ msg: "Ya confirmaste la finalización" });
    }

    hire.clientCompleted = true;

    // ✅ Si ambas partes completaron, marcar como completado
    if (hire.workerCompleted && hire.clientCompleted) {
      hire.status = "completado";
      hire.completedAt = new Date();
    }

    await hire.save();

    res.json({ msg: "Confirmación de finalización registrada", hire });
  } catch (err) {
    console.error("Error en confirmCompletion:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

// ✅ ACTUALIZADO: Trabajador marca como completado
exports.markAsCompleted = async (req, res) => {
  try {
    const hire = await Hire.findById(req.params.id);
    if (!hire)
      return res.status(404).json({ msg: "Contratación no encontrada" });

    // ✅ Solo el trabajador puede marcar como completado
    if (hire.worker._id.toString() !== req.user.id) {
      return res.status(403).json({ msg: "No autorizado" });
    }

    // ✅ Solo se puede completar si el estado es "aceptado"
    if (hire.status !== "aceptado") {
      return res
        .status(400)
        .json({ msg: "Solo se puede completar un trabajo aceptado" });
    }

    // ✅ Ya completado
    if (hire.workerCompleted) {
      return res
        .status(400)
        .json({ msg: "Ya marcaste este trabajo como completado" });
    }

    hire.workerCompleted = true;

    // ✅ Si el cliente ya confirmó, marcar como completado
    if (hire.clientCompleted && hire.workerCompleted) {
      hire.status = "completado";
      hire.completedAt = new Date();
    }

    await hire.save();

    res.json({ msg: "Trabajo marcado como completado", hire });
  } catch (err) {
    console.error("Error en markAsCompleted:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

// Obtener trabajos completados
exports.getCompletedHires = async (req, res) => {
  try {
    const { page = 1, limit = 6 } = req.query;
    const skip = (page - 1) * limit;

    // Solo trabajos donde el usuario es cliente Y están completados
    const hires = await Hire.find({
      client: req.user.id,
      status: "completado",
    })
      .populate("worker", "name profession photo rating")
      .populate("client", "name photo")
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Hire.countDocuments({
      client: req.user.id,
      status: "completado",
    });

    res.json({
      hires,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    console.error("Error en getCompletedHires:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};
