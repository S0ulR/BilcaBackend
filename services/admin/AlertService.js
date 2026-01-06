// backend/services/admin/AlertService.js
const ApiCall = require("../../models/ApiCall");
const User = require("../../models/User");
const Subscription = require("../../models/Subscription");
const sendEmail = require("../../config/nodemailer").sendEmail;

class AlertService {
  async checkForAlerts() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [highErrorRate, slowQueries, spamUsers, paymentFailures] =
      await Promise.all([
        this.checkErrorRate(oneHourAgo),
        this.checkSlowQueries(oneHourAgo),
        this.checkSpamActivity(oneHourAgo),
        this.checkPaymentFailures(oneHourAgo),
      ]);

    const alerts = [
      ...highErrorRate,
      ...slowQueries,
      ...spamUsers,
      ...paymentFailures,
    ];

    if (alerts.length > 0) {
      await this.sendAlerts(alerts);
    }
  }

  async checkErrorRate(oneHourAgo) {
    const errorCount = await ApiCall.countDocuments({
      timestamp: { $gte: oneHourAgo },
      statusCode: { $gte: 500 },
    });

    if (errorCount > 10) {
      return [
        {
          type: "high_error_rate",
          severity: "critical",
          details: { count: errorCount },
        },
      ];
    }

    const clientErrorCount = await ApiCall.countDocuments({
      timestamp: { $gte: oneHourAgo },
      statusCode: { $gte: 400, $lt: 500 },
    });

    if (clientErrorCount > 50) {
      return [
        {
          type: "high_client_errors",
          severity: "warning",
          details: { count: clientErrorCount },
        },
      ];
    }

    return [];
  }

  async checkSlowQueries(oneHourAgo) {
    const slowCount = await ApiCall.countDocuments({
      timestamp: { $gte: oneHourAgo },
      durationMs: { $gt: 3000 },
    });

    if (slowCount > 5) {
      return [
        {
          type: "slow_queries",
          severity: "warning",
          details: { count: slowCount },
        },
      ];
    }

    return [];
  }

  async checkSpamActivity(oneHourAgo) {
    const spamUsers = await ApiCall.aggregate([
      { $match: { timestamp: { $gte: oneHourAgo }, userId: { $ne: null } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $match: { count: { $gt: 50 } } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 1,
          count: 1,
          name: "$user.name",
          email: "$user.email",
        },
      },
    ]);

    return spamUsers.map((user) => ({
      type: "spam_activity",
      severity: "high",
      details: {
        userId: user._id,
        name: user.name,
        email: user.email,
        count: user.count,
      },
    }));
  }

  async checkPaymentFailures(oneHourAgo) {
    const failedSubs = await Subscription.countDocuments({
      status: "failed",
      updatedAt: { $gte: oneHourAgo },
    });

    if (failedSubs > 3) {
      return [
        {
          type: "payment_failures",
          severity: "high",
          details: { count: failedSubs },
        },
      ];
    }

    return [];
  }

  async sendAlerts(alerts) {
    const alertMessages = alerts
      .map(
        (alert) =>
          `[${alert.severity.toUpperCase()}] ${alert.type}: ${JSON.stringify(
            alert.details
          )}`
      )
      .join("\n\n");

    // ✅ Opción 1: Email urgente
    try {
      await sendEmail({
        to: process.env.ADMIN_EMAIL || "admin@bilca.com",
        subject: `🚨 ALERTAS DEL SISTEMA - ${new Date().toLocaleString(
          "es-AR"
        )}`,
        html: `<pre>${alertMessages}</pre>`,
      });
    } catch (emailError) {
      console.error("Error sending alert email:", emailError);
    }

    // ✅ Opción 2: Notificación push (Telegram)
    // Implementa según tu proveedor
    // await this.sendTelegramAlert(alertMessages);

    // ✅ Opción 3: Webhook a tu panel de admin
    // Implementa según tu frontend
    // await this.sendWebhookAlert(alerts);
  }

  // Método para obtener alertas activas (usado en el dashboard)
  async getActiveAlerts() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [highErrorRate, slowQueries, spamUsers, paymentFailures] =
      await Promise.all([
        this.checkErrorRate(oneHourAgo),
        this.checkSlowQueries(oneHourAgo),
        this.checkSpamActivity(oneHourAgo),
        this.checkPaymentFailures(oneHourAgo),
      ]);

    return [...highErrorRate, ...slowQueries, ...spamUsers, ...paymentFailures];
  }
}

// Ejecutar verificación cada 5 minutos
const alertService = new AlertService();
setInterval(() => alertService.checkForAlerts(), 300000);

module.exports = alertService;
