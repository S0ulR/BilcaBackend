const { sendEmail } = require("../config/nodemailer");

exports.sendDocumentEmail = async (req, res) => {
  try {
    const { to, subject, html } = req.body;
    const file = req.file;

    // ✅ Validación robusta
    if (!to || !subject) {
      return res.status(400).json({ msg: "Faltan campos obligatorios (to, subject)" });
    }

    // ✅ Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ msg: "Email inválido" });
    }

    const attachments = file
      ? [
          {
            filename: file.originalname || "documento.pdf",
            content: file.buffer,
          },
        ]
      : [];

    await sendEmail({
      to,
      subject,
      html,
      attachments,
    });

    res.json({ msg: "Documento enviado por email correctamente." });
  } catch (err) {
    console.error("Error en sendDocumentEmail:", err.message);
    res.status(500).json({ msg: "Error al enviar el email." });
  }
};
