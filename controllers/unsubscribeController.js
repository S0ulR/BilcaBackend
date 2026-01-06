const User = require("../models/User");
const generateUnsubscribeToken = require("../middleware/generateUnsubscribeToken");

// ✅ Validación de ObjectId
const isValidObjectId = (id) => {
  if (!id || typeof id !== 'string') return false;
  const objectidRegex = /^[0-9a-fA-F]{24}$/;
  return objectidRegex.test(id);
};

exports.unsubscribeNotifications = async (req, res) => {
  const { userId, token } = req.query;

  try {
    // ✅ Validación robusta de parámetros
    if (!userId || !token) {
      return res.status(400).send(`
        <h3 style="color: #dc3545;">Enlace inválido</h3>
        <p>El enlace no es válido. Por favor, verifica que estés usando el enlace completo.</p>
      `);
    }

    // ✅ Validar formato de userId
    if (!isValidObjectId(userId)) {
      return res.status(400).send(`
        <h3 style="color: #dc3545;">Enlace inválido</h3>
        <p>El identificador de usuario no es válido.</p>
      `);
    }

    const expectedToken = generateUnsubscribeToken(userId);
    if (token !== expectedToken) {
      return res.status(400).send(`
        <h3 style="color: #dc3545;">Enlace no válido o expirado</h3>
        <p>El enlace de desactivación no es válido. Si necesitas ayuda, contáctanos.</p>
      `);
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send(`
        <h3 style="color: #dc3545;">Usuario no encontrado</h3>
        <p>No se encontró el usuario asociado a este enlace.</p>
      `);
    }

    if (!user.emailNotifications) {
      return res.send(`
        <div style="font-family: 'Open Sans', sans-serif; text-align: center; max-width: 500px; margin: auto; padding: 2rem;">
          <h2 style="color: #2c3e50;">Notificaciones ya desactivadas</h2>
          <p>Ya no recibes notificaciones por email.</p>
          <p>Puedes volver a activarlas en cualquier momento en la sección de <strong>Configuración</strong> de tu cuenta.</p>
          <hr style="margin: 2rem 0; border: 1px solid #eee;" />
          <small style="color: #6c757d;">© 2025 Bilca. Todos los derechos reservados.</small>
        </div>
      `);
    }

    user.emailNotifications = false;
    await user.save();

    res.send(`
      <div style="font-family: 'Open Sans', sans-serif; text-align: center; max-width: 500px; margin: auto; padding: 2rem;">
        <h2 style="color: #2c3e50;">Notificaciones desactivadas</h2>
        <p>Hemos dejado de enviarte notificaciones por correo electrónico.</p>
        <p>Puedes volver a activarlas en cualquier momento en la sección de <strong>Configuración</strong> de tu cuenta.</p>
        <hr style="margin: 2rem 0; border: 1px solid #eee;" />
        <small style="color: #6c757d;">© 2025 Bilca. Todos los derechos reservados.</small>
      </div>
    `);
  } catch (err) {
    console.error("Error en unsubscribe:", err.message);
    res.status(500).send(`
      <div style="font-family: 'Open Sans', sans-serif; text-align: center; max-width: 500px; margin: auto; padding: 2rem;">
        <h3 style="color: #dc3545;">Error interno</h3>
        <p>Lo sentimos, ocurrió un error al procesar tu solicitud.</p>
        <p>Por favor, inténtalo nuevamente más tarde.</p>
      </div>
    `);
  }
};
