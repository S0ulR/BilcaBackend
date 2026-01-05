// backend/templates/notificationEmail.js
const generateUnsubscribeToken = require("../middleware/generateUnsubscribeToken");

const BRAND_LOGO = `${process.env.CLIENT_URL}/assets/email/logoBilcaSF.png`;

const notificationEmailTemplate = (user, notification) => {
  const token = generateUnsubscribeToken(user._id.toString());
  const unsubscribeLink = `${process.env.CLIENT_URL}/api/unsubscribe/notifications?userId=${user._id}&token=${token}`;
  const dashboardLink = `${process.env.CLIENT_URL}/dashboard/notifications`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Nueva notificación</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:24px 10px;">
        <table width="600" style="background:#ffffff;border-radius:8px;overflow:hidden;">
          
          <tr>
            <td style="padding:20px;text-align:center;">
              <img src="${BRAND_LOGO}" alt="Bilca" width="120" />
            </td>
          </tr>

          <tr>
            <td style="padding:24px;color:#2c3e50;font-size:14px;line-height:1.6;">
              <p>Hola ${user.name},</p>
              <p>Tienes una nueva notificación en tu cuenta:</p>

              <div style="border-left:4px solid #4a9d9c;padding-left:12px;margin:16px 0;">
                ${notification.message}
              </div>

              <div style="margin:24px 0;text-align:center;">
                <a href="${dashboardLink}"
                   style="background:#4a9d9c;color:#ffffff;
                          padding:12px 24px;
                          text-decoration:none;
                          border-radius:6px;
                          font-weight:bold;">
                  Ver notificaciones
                </a>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background:#f0f2f4;padding:16px;text-align:center;font-size:12px;color:#6c757d;">
              © ${new Date().getFullYear()} Bilca<br/>
              <a href="${unsubscribeLink}" style="color:#c0392b;">
                Desactivar notificaciones
              </a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

module.exports = notificationEmailTemplate;

//MODIFICAR href="http://localhost:3000/dashboard/notifications"
