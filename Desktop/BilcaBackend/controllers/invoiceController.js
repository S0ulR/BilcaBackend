// backend/controllers/invoiceController.js
const Invoice = require("../models/Invoice");
const Hire = require("../models/Hire");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { sendEmail } = require("../config/nodemailer");

// ✅ Validación de datos de factura
const validateInvoiceData = (data) => {
  const { client, worker, invoiceNumber, totalAmount, items, dueDate } = data;

  if (!client || !worker || !invoiceNumber || totalAmount === undefined) {
    throw new Error("Faltan datos obligatorios");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("La factura debe tener al menos un ítem");
  }

  if (new Date(dueDate) <= new Date()) {
    throw new Error("La fecha de vencimiento debe ser futura");
  }

  const amount = parseFloat(totalAmount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error("El monto total debe ser positivo");
  }
};

// ✅ Crear una factura
exports.createInvoice = async (req, res) => {
  const { hireId, items, notes, dueDate } = req.body;
  const workerId = req.user.id;

  try {
    // Validar contratación
    const hire = await Hire.findById(hireId)
      .populate("client", "name email")
      .populate("worker", "name");

    if (!hire) {
      return res.status(404).json({ msg: "Contratación no encontrada" });
    }

    if (hire.worker.toString() !== workerId) {
      return res.status(403).json({ msg: "No autorizado" });
    }

    if (hire.status !== "completado") {
      return res
        .status(400)
        .json({ msg: "Solo se pueden facturar trabajos completados" });
    }

    // Calcular totales
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const totalAmount = subtotal; // Sin impuestos por ahora

    // Generar número de factura único
    const invoiceNumber = `FAC-${Date.now()}-${workerId.toString().slice(-4)}`;

    const invoiceData = {
      invoiceNumber,
      client: hire.client._id,
      worker: workerId,
      hire: hireId,
      items,
      subtotal,
      totalAmount,
      dueDate,
      notes,
      status: "draft",
    };

    validateInvoiceData(invoiceData);

    const invoice = new Invoice(invoiceData);
    await invoice.save();

    // Poblar para la respuesta
    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate("client", "name email")
      .populate("worker", "name");

    res.status(201).json({ msg: "Factura creada", invoice: populatedInvoice });
  } catch (err) {
    console.error("Error en createInvoice:", err.message);
    res.status(500).json({ msg: "Error al crear la factura" });
  }
};

// ✅ Enviar factura por email
exports.sendInvoice = async (req, res) => {
  const { invoiceId } = req.body;
  const workerId = req.user.id;

  try {
    const invoice = await Invoice.findById(invoiceId)
      .populate("client", "name email")
      .populate("worker", "name")
      .populate("hire", "service");

    if (!invoice) {
      return res.status(404).json({ msg: "Factura no encontrada" });
    }

    if (invoice.worker.toString() !== workerId) {
      return res.status(403).json({ msg: "No autorizado" });
    }

    if (invoice.status === "sent" || invoice.status === "paid") {
      return res.status(400).json({ msg: "La factura ya fue enviada" });
    }

    // Enviar email
    const html = `
      <h2>Factura ${invoice.invoiceNumber}</h2>
      <p>Hola <strong>${invoice.client.name}</strong>,</p>
      <p>Adjunto encontrarás la factura por el servicio de <strong>${
        invoice.hire.service
      }</strong> prestado por <strong>${invoice.worker.name}</strong>.</p>
      <p><strong>Total: $${invoice.totalAmount.toFixed(2)}</strong></p>
      <p><strong>Fecha de vencimiento: ${new Date(
        invoice.dueDate
      ).toLocaleDateString("es-AR")}</strong></p>
      ${invoice.notes ? `<p>Notas: ${invoice.notes}</p>` : ""}
      <p>Gracias por su pago.</p>
      <hr>
      <small>Este correo fue generado automáticamente.</small>
    `;

    await sendEmail({
      to: invoice.client.email,
      subject: `Factura ${invoice.invoiceNumber} - ${invoice.worker.name}`,
      html,
    });

    // Actualizar estado
    invoice.status = "sent";
    invoice.sentAt = new Date();
    await invoice.save();

    // Notificación
    const notification = new Notification({
      user: invoice.client._id,
      message: `📄 Nueva factura de ${invoice.worker.name}: ${invoice.invoiceNumber}`,
      type: "invoice_sent",
      relatedId: invoice._id,
      onModel: "Invoice",
    });
    await notification.save();

    res.json({ msg: "Factura enviada correctamente", invoice });
  } catch (err) {
    console.error("Error en sendInvoice:", err.message);
    res.status(500).json({ msg: "Error al enviar la factura" });
  }
};

// ✅ Obtener facturas enviadas (por worker)
exports.getSentInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 6 } = req.query;
    const skip = (page - 1) * limit;

    const invoices = await Invoice.find({ worker: req.user.id })
      .populate("client", "name email photo")
      .populate("worker", "name")
      .populate("hire", "service")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments({ worker: req.user.id });

    res.json({
      invoices,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (err) {
    console.error("Error en getSentInvoices:", err.message);
    res.status(500).json({ msg: "Error al cargar facturas" });
  }
};

// ✅ Marcar como pagada (simulado por ahora)
exports.markAsPaid = async (req, res) => {
  const { invoiceId } = req.params;
  const clientId = req.user.id;

  try {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ msg: "Factura no encontrada" });
    }

    if (invoice.client.toString() !== clientId) {
      return res.status(403).json({ msg: "No autorizado" });
    }

    if (invoice.status !== "sent" && invoice.status !== "viewed") {
      return res
        .status(400)
        .json({ msg: "La factura no se puede marcar como pagada" });
    }

    invoice.status = "paid";
    invoice.paidAt = new Date();
    await invoice.save();

    res.json({ msg: "Factura marcada como pagada", invoice });
  } catch (err) {
    console.error("Error en markAsPaid:", err.message);
    res.status(500).json({ msg: "Error al marcar como pagada" });
  }
};
