const Hire = require("../models/Hire");
const User = require("../models/User");
const { sendReviewReminderEmail } = require("../config/nodemailer");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, CLIENT_URL } = process.env; 

async function sendReviewReminders() {
  console.log("📅 Iniciando tarea de recordatorios de reseña...");

  // ✅ Exactamente 5 días después de la finalización
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  
  // ✅ Solo procesar contrataciones de hoy (evitar duplicados)
  const startOfDay = new Date(fiveDaysAgo);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(fiveDaysAgo);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    // ✅ Buscar contrataciones completadas hace exactamente 5 días
    // ✅ Ambas partes deben haber completado
    // ✅ Aún no se ha enviado el email de reseña
    const hires = await Hire.find({
      status: "completado",
      clientCompleted: true,
      workerCompleted: true,
      completedAt: { $gte: startOfDay, $lte: endOfDay },
      reviewEmailSent: false
    }).populate("client worker");

    if (hires.length === 0) {
      console.log("✅ No hay trabajos para enviar recordatorios de reseña hoy.");
      return;
    }

    console.log(`📧 Enviando ${hires.length} recordatorios de reseña...`);

    for (const hire of hires) {
      try {
        // ✅ Validar datos necesarios
        if (!hire.client?.email || !hire.worker?.name || !hire._id) {
          console.warn(`⚠️ Datos incompletos para hire ${hire._id}, saltando...`);
          continue;
        }

        // ✅ Generar token de reseña único
        const reviewToken = jwt.sign(
          { hireId: hire._id, clientId: hire.client._id },
          JWT_SECRET,
          { expiresIn: "7d" } // ✅ Expira en 7 días
        );

        const reviewLink = `${CLIENT_URL}/review/${reviewToken}`;

        // ✅ Enviar email de reseña
        await sendReviewReminderEmail(
          hire.client.email,
          hire.client.name,
          hire.worker.name,
          hire.service || "Servicio",
          reviewLink
        );

        // ✅ Marcar que el email fue enviado
        hire.reviewEmailSent = true;
        hire.reviewSentAt = new Date();
        await hire.save();

        console.log(`✅ Email de reseña enviado a ${hire.client.email} para hire ${hire._id}`);
      } catch (err) {
        console.error(`❌ Error al enviar email de reseña a ${hire.client?.email}:`, err.message);
      }
    }
    
    console.log(`✅ Tarea de recordatorios de reseña completada. Emails enviados: ${hires.length}`);
  } catch (err) {
    console.error("❌ Error general en el job de reseñas:", err.message);
  }
}

module.exports = sendReviewReminders;
