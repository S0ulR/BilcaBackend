// backend/config/nodemailer.js
const nodemailer = require("nodemailer");
require("dotenv").config();

const isDev = process.env.NODE_ENV === "development";

const BRAND = {
  name: "Bilca",
  primaryColor: "#4a9d9c",
  logoUrl: `${process.env.CLIENT_URL}/assets/email/logoBilcaSF.png`,
  welcomeHeroUrl: `${process.env.CLIENT_URL}/assets/email/welcome-hero.png`,
  videoIntroUrl: `${process.env.CLIENT_URL}/intro`,
};

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  if (!isDev) {
    console.error("EMAIL_USER y EMAIL_PASS son obligatorios en producción.");
    process.exit(1);
  }
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: isDev ? { rejectUnauthorized: false } : { minVersion: "TLSv1.2" },
});

// Rate limiting básico
const emailCooldown = new Map();

const isEmailAllowed = (email) => {
  if (isDev) return true;
  const lastSent = emailCooldown.get(email);
  const now = Date.now();
  if (lastSent && now - lastSent < 60000) return false;
  emailCooldown.set(email, now);
  return true;
};

const sendEmail = async ({ to, subject, text = "", html = "" }) => {
  if (!to || !subject) {
    throw new Error("Faltan campos obligatorios: to / subject");
  }

  const recipient = Array.isArray(to) ? to[0] : to;
  if (!isEmailAllowed(recipient)) {
    throw new Error("Demasiados correos enviados recientemente.");
  }

  const mailOptions = {
    from: `"${BRAND.name}" <${process.env.EMAIL_USER}>`,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    text,
    html,
    headers: {
      "X-Mailer": "BilcaApp/1.0",
    },
  };

  return transporter.sendMail(mailOptions);
};

/* ======================================================
   TEMPLATE BASE CORPORATIVO
   ====================================================== */

const baseTemplate = ({ title, body, ctaText, ctaLink }) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:24px 10px;">
        <table width="600" style="background:#ffffff;border-radius:8px;overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding:20px;text-align:center;">
              <img
                src="${BRAND.logoUrl}"
                alt="${BRAND.name}"
                width="120"
                style="display:block;margin:0 auto;"
              />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:24px;color:#2c3e50;font-size:14px;line-height:1.6;">
              <h1 style="font-size:20px;color:#2c3e50;margin-top:0;">
                ${title}
              </h1>
              ${body}

              ${
                ctaLink
                  ? `
                <div style="margin:32px 0;text-align:center;">
                  <a href="${ctaLink}"
                     style="
                       background:${BRAND.primaryColor};
                       color:#ffffff;
                       padding:12px 24px;
                       text-decoration:none;
                       border-radius:6px;
                       font-weight:bold;
                       display:inline-block;
                     ">
                    ${ctaText}
                  </a>
                </div>
              `
                  : ""
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f0f2f4;padding:16px;text-align:center;color:#6c757d;font-size:12px;">
              © ${new Date().getFullYear()} ${
  BRAND.name
}. Todos los derechos reservados.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/* ======================================================
   EMAILS
   ====================================================== */

const sendWelcomeEmail = async (to, name) => {
  const dashboardLink = `${process.env.CLIENT_URL}/dashboard`;

  const body = `
    <p>Hola ${name},</p>

    <p>
      Gracias por crear tu cuenta en <strong>${BRAND.name}</strong>.
      Desde aquí podrás ofrecer o contratar servicios de forma simple,
      segura y transparente.
    </p>

    <!-- Hero image -->
    <div style="margin:24px 0;text-align:center;">
      <img
        src="${BRAND.welcomeHeroUrl}"
        alt="Profesionales trabajando con Bilca"
        style="max-width:100%;border-radius:6px;border:1px solid #ddd;"
      />
    </div>

    <p>
      Para comenzar, te recomendamos ver una breve introducción
      donde explicamos cómo aprovechar la plataforma.
    </p>

    <p>
      <a href="${BRAND.videoIntroUrl}" target="_blank" style="color:${BRAND.primaryColor};font-weight:bold;">
        Ver introducción y primeros pasos
      </a>
    </p>
  `;

  await sendEmail({
    to,
    subject: "Bienvenido a Bilca",
    text: `Hola ${name}, bienvenido a Bilca.`,
    html: baseTemplate({
      title: "Bienvenido a Bilca",
      body,
      ctaText: "Ir al panel",
      ctaLink: dashboardLink,
    }),
  });
};

const sendPasswordResetEmail = async (to, resetLink) => {
  const body = `
    <p>
      Recibimos una solicitud para restablecer la contraseña de tu cuenta.
    </p>
    <p>
      Si fuiste tú, utiliza el botón a continuación.
      Este enlace es válido por 1 hora.
    </p>
    <p>
      Si no solicitaste este cambio, puedes ignorar este mensaje.
    </p>
  `;

  await sendEmail({
    to,
    subject: "Restablecer contraseña",
    text: `Restablece tu contraseña: ${resetLink}`,
    html: baseTemplate({
      title: "Restablecer contraseña",
      body,
      ctaText: "Restablecer contraseña",
      ctaLink: resetLink,
    }),
  });
};

const sendHireNotification = async (to, clientName, serviceName, hireLink) => {
  const body = `
    <p>
      Has recibido una nueva contratación.
    </p>
    <p>
      <strong>${clientName}</strong> te contrató para el servicio:
      <strong>${serviceName}</strong>.
    </p>
    <p>
      Ingresa al panel para ver los detalles.
    </p>
  `;

  await sendEmail({
    to,
    subject: "Nueva contratación recibida",
    text: `${clientName} te contrató para ${serviceName}.`,
    html: baseTemplate({
      title: "Nueva contratación",
      body,
      ctaText: "Ver detalles",
      ctaLink: hireLink,
    }),
  });
};

const sendPasswordChangedNotification = async (to, clientIp, userAgent) => {
  const body = `
    <p>
      La contraseña de tu cuenta fue actualizada correctamente.
    </p>
    <ul>
      <li><strong>IP:</strong> ${clientIp || "desconocida"}</li>
      <li><strong>Dispositivo:</strong> ${userAgent || "desconocido"}</li>
    </ul>
    <p>
      Si no reconoces esta acción, te recomendamos cambiar tu contraseña inmediatamente.
    </p>
  `;

  await sendEmail({
    to,
    subject: "Cambio de contraseña realizado",
    text: "Tu contraseña fue actualizada.",
    html: baseTemplate({
      title: "Cambio de contraseña",
      body,
    }),
  });
};

const sendReviewReminderEmail = async (
  to,
  clientName,
  workerName,
  serviceName,
  reviewLink
) => {
  const body = `
    <p>Hola ${clientName},</p>
    <p>
      Contrataste a <strong>${workerName}</strong> para
      <em>${serviceName}</em>.
    </p>
    <p>
      Tu valoración ayuda a mantener la calidad de la comunidad.
    </p>
  `;

  await sendEmail({
    to,
    subject: "Valora tu experiencia en Bilca",
    text: `Deja tu reseña sobre ${workerName}.`,
    html: baseTemplate({
      title: "Valora tu experiencia",
      body,
      ctaText: "Dejar reseña",
      ctaLink: reviewLink,
    }),
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendHireNotification,
  sendPasswordChangedNotification,
  sendReviewReminderEmail,
};
