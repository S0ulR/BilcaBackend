// backend/middleware/sendNotificationEmail.js
const User = require("../models/User");
const { sendEmail } = require("../config/nodemailer");
const notificationEmailTemplate = require("../templates/notificationEmail");
const generateUnsubscribeToken = require("./generateUnsubscribeToken");

const sendNotificationEmail = async (notification) => {
  if (!notification?.user || !notification.message) return;

  try {
    const user = await User.findById(notification.user).select("name email emailNotifications");
    
    if (!user || !user.email || !user.emailNotifications) return;

    const token = generateUnsubscribeToken(user._id.toString());
    const html = notificationEmailTemplate(user, notification, token);
    const text = `Tienes una nueva notificación: ${notification.message}`;

    await sendEmail({
      to: user.email,
      subject: "Tienes una nueva notificación - Bilca",
      text,
      html
    });
  } catch (error) {
    console.error("Error al enviar email de notificación:", error.message);
  }
};

module.exports = sendNotificationEmail;
