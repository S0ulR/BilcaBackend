// backend/controllers/BudgetRequestController.js
const BudgetRequest = require("../models/BudgetRequest");
const User = require("../models/User");
const Notification = require("../models/Notification");
const sendNotificationEmail = require("../middleware/sendNotificationEmail");

// ✅ Validación robusta de presupuesto
const validateBudgetRequest = (body) => {
  const required = [
    "worker",
    "profession",
    "description",
    "address",
    "locality",
    "province",
    "country",
  ];
  const missing = required.filter(
    (field) => !body[field] || body[field].toString().trim() === ""
  );

  if (missing.length > 0) {
    throw new Error(`Campos obligatorios faltantes: ${missing.join(", ")}`);
  }

  if (body.urgent && !["si", "no"].includes(body.urgent)) {
    throw new Error('El campo "urgent" debe ser "si" o "no"');
  }
};

// ✅ Validación de respuesta a presupuesto
const validateBudgetResponse = (body) => {
  if (!body.message || body.message.trim() === "") {
    throw new Error("El mensaje es obligatorio");
  }

  const budget = parseFloat(body.budget);
  if (isNaN(budget) || budget <= 0) {
    throw new Error("El presupuesto debe ser un número positivo");
  }

  if (!body.estimatedTime || body.estimatedTime.trim() === "") {
    throw new Error("El tiempo estimado es obligatorio");
  }
};

// 📝 Crear una solicitud de presupuesto
exports.createBudgetRequest = async (req, res) => {
  const {
    worker,
    profession,
    startDate,
    description,
    address,
    locality,
    province,
    country,
    urgent = "no",
  } = req.body;
  const client = req.user.id;

  try {
    // ✅ Validación de datos
    validateBudgetRequest({
      worker,
      profession,
      description,
      address,
      locality,
      province,
      country,
    });

    const clientUser = await User.findById(client);
    if (!clientUser) {
      return res.status(404).json({ msg: "Cliente no encontrado" });
    }

    const workerUser = await User.findById(worker);
    if (!workerUser || workerUser.role !== "worker") {
      return res.status(404).json({ msg: "Trabajador no válido" });
    }

    // ✅ Prevención de solicitudes duplicadas
    const recentRequest = await BudgetRequest.findOne({
      client,
      worker,
      profession,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      status: "pendiente",
    });

    if (recentRequest) {
      return res.status(409).json({
        msg: "Ya enviaste una solicitud similar en las últimas 24 horas",
      });
    }

    const request = new BudgetRequest({
      client,
      worker,
      profession: profession.trim(),
      startDate: startDate ? new Date(startDate) : undefined,
      description: description.trim(),
      address: address.trim(),
      locality: locality.trim(),
      province: province.trim(),
      country: country.trim(),
      urgent,
    });

    await request.save();

    // ✅ Notificaciones condicionales
    if (workerUser.emailNotifications !== false) {
      const notification = new Notification({
        user: worker,
        message: `📄 ${clientUser.name} te solicitó un presupuesto para: ${profession}`,
        type: "budget_request",
        relatedId: request._id,
        onModel: "BudgetRequest",
      });

      await notification.save();
      if (typeof sendNotificationEmail === "function") {
        sendNotificationEmail(notification).catch((err) =>
          console.error("Notification email async error:", err.message)
        );
      }
    }

    // ✅ Respuesta con datos poblados
    const populatedRequest = await BudgetRequest.findById(request._id)
      .populate("client", "name email")
      .populate("worker", "name");

    res.status(201).json({
      msg: "Solicitud de presupuesto enviada",
      request: populatedRequest,
    });
  } catch (err) {
    console.error("Error en createBudgetRequest:", err.message);

    if (
      err.message.includes("Campos obligatorios") ||
      err.message.includes("urgent")
    ) {
      return res.status(400).json({ msg: err.message });
    }

    res.status(500).json({ msg: "Error al crear la solicitud de presupuesto" });
  }
};

// 📥 Obtener solicitudes recibidas (trabajador)
exports.getReceivedRequests = async (req, res) => {
  try {
    // ✅ Verificar que el usuario sea trabajador
    if (req.user.role !== "worker") {
      return res.status(403).json({ msg: "Acceso denegado" });
    }

    const requests = await BudgetRequest.find({ worker: req.user.id })
      .populate("client", "name photo email")
      .sort({ createdAt: -1 });

    // ✅ Filtrar solicitudes inválidas+
    const validRequests = requests.filter(
      (req) => req.client && req.client.name
    );

    res.json(validRequests);
  } catch (err) {
    console.error("Error en getReceivedRequests:", err.message);
    res.status(500).json({ msg: "Error al cargar solicitudes recibidas" });
  }
};

// 📤 Obtener solicitudes enviadas (cliente)
exports.getSentRequests = async (req, res) => {
  try {
    const requests = await BudgetRequest.find({ client: req.user.id })
      .populate("worker", "name photo profession rating")
      .sort({ createdAt: -1 });

    // ✅ Filtrar solicitudes inválidas
    const validRequests = requests.filter(
      (req) => req.worker && req.worker.name
    );

    res.json(validRequests);
  } catch (err) {
    console.error("Error en getSentRequests:", err.message);
    res.status(500).json({ msg: "Error al cargar solicitudes enviadas" });
  }
};

// ✅ Responder a una solicitud
exports.respondToRequest = async (req, res) => {
  const { requestId } = req.params;
  const { message, budget, estimatedTime } = req.body;
  const workerId = req.user.id;

  try {
    // ✅ Validación de respuesta
    validateBudgetResponse({ message, budget, estimatedTime });

    const request = await BudgetRequest.findById(requestId)
      .populate("worker", "name role")
      .populate("client", "name email");

    if (!request) {
      return res.status(404).json({ msg: "Solicitud no encontrada" });
    }

    if (request.worker._id.toString() !== workerId) {
      return res
        .status(403)
        .json({ msg: "No autorizado para responder esta solicitud" });
    }

    if (request.status !== "pendiente") {
      return res
        .status(400)
        .json({ msg: "La solicitud ya fue respondida o rechazada" });
    }

    request.status = "respondido";
    request.response = {
      message: message.trim(),
      budget: parseFloat(budget),
      estimatedTime: estimatedTime.trim(),
    };
    await request.save();

    // ✅ Notificaciones condicionales
    if (request.client.emailNotifications !== false) {
      const notification = new Notification({
        user: request.client._id,
        message: `📬 ${request.worker.name} respondió a tu solicitud de presupuesto`,
        type: "budget_response",
        relatedId: request._id,
        onModel: "BudgetRequest",
      });

      await notification.save();

      if (typeof sendNotificationEmail === "function") {
        sendNotificationEmail(notification).catch((err) =>
          console.error("Notification email async error:", err.message)
        );
      }
    }

    // ✅ Respuesta con datos completos
    const populatedRequest = await BudgetRequest.findById(request._id)
      .populate("client", "name email")
      .populate("worker", "name");

    res.json({
      msg: "Respuesta enviada exitosamente",
      request: populatedRequest,
    });
  } catch (err) {
    console.error("Error en respondToRequest:", err.message);

    if (
      err.message.includes("Campos obligatorios") ||
      err.message.includes("presupuesto")
    ) {
      return res.status(400).json({ msg: err.message });
    }

    res.status(500).json({ msg: "Error al responder la solicitud" });
  }
};

// ❌ Rechazar una solicitud de presupuesto
exports.rejectBudgetRequest = async (req, res) => {
  const { requestId } = req.params;
  const { reason } = req.body;
  const workerId = req.user.id;

  if (!reason || reason.trim() === "") {
    return res
      .status(400)
      .json({ msg: "El motivo del rechazo es obligatorio" });
  }

  try {
    const request = await BudgetRequest.findById(requestId)
      .populate("client", "name email")
      .populate("worker", "name");

    if (!request) {
      return res.status(404).json({ msg: "Solicitud no encontrada" });
    }

    if (request.worker._id.toString() !== workerId) {
      return res
        .status(403)
        .json({ msg: "No autorizado para rechazar esta solicitud" });
    }

    if (request.status !== "pendiente") {
      return res
        .status(400)
        .json({ msg: "La solicitud ya fue respondida o rechazada" });
    }

    request.status = "rechazado";
    request.response = {
      message: reason.trim(),
      budget: null,
      estimatedTime: null,
      rejectedAt: new Date(),
    };
    await request.save();

    // Notificar al cliente
    if (request.client.emailNotifications !== false) {
      const notification = new Notification({
        user: request.client._id,
        message: `❌ ${request.worker.name} rechazó tu solicitud de presupuesto para: ${request.profession}`,
        type: "budget_rejected",
        relatedId: request._id,
        onModel: "BudgetRequest",
      });
      await notification.save();

      if (typeof sendNotificationEmail === "function") {
        sendNotificationEmail(notification).catch((err) =>
          console.error("Notification email async error:", err.message)
        );
      }
    }

    res.json({ msg: "Solicitud rechazada exitosamente", request });
  } catch (err) {
    console.error("Error en rejectBudgetRequest:", err.message);
    res.status(500).json({ msg: "Error al rechazar la solicitud" });
  }
};

exports.getSentByWorker = async (req, res) => {
  try {
    const requests = await BudgetRequest.find({
      worker: req.user.id,
      status: { $in: ["respondido", "aceptado", "rechazado"] },
    })
      .populate("client", "name photo email")
      .sort({ createdAt: -1 });

    res.json(requests.filter((r) => r.client));
  } catch (err) {
    res.status(500).json({ msg: "Error al cargar presupuestos enviados" });
  }
};
