// backend/services/admin/AnalyticsService.js
const User = require("../../models/User");
const Hire = require("../../models/Hire");
const ApiCall = require("../../models/ApiCall");

class AnalyticsService {
  // ✅ 1. Métricas principales
  async getCoreStats() {
    const [
      totalUsers,
      totalWorkers,
      totalClients,
      totalHires,
      pendingHires,
      completedHires,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "worker" }),
      User.countDocuments({ role: "user" }),
      Hire.countDocuments(),
      Hire.countDocuments({ status: "pending" }),
      Hire.countDocuments({ status: "completed" }),
    ]);

    return {
      totalUsers,
      totalWorkers,
      totalClients,
      totalHires,
      pendingHires,
      completedHires,
    };
  }

  // ✅ 2. Crecimiento semanal de usuarios
  async getWeeklyUserGrowth() {
    const today = new Date();
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);

    const dailyCounts = await User.aggregate([
      { $match: { createdAt: { $gte: oneWeekAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const result = Array(7).fill(0);
    const dateToIndex = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(oneWeekAgo);
      date.setDate(oneWeekAgo.getDate() + i);
      const isoDate = date.toISOString().split("T")[0];
      dateToIndex[isoDate] = i;
    }

    dailyCounts.forEach((item) => {
      const idx = dateToIndex[item._id];
      if (idx !== undefined) result[idx] = item.count;
    });

    return result;
  }

  // ✅ 3. Uso de API últimos 30 días
  async getAPIUsageLast30Days() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const dailyUsage = await ApiCall.aggregate([
      { $match: { timestamp: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          totalCalls: { $sum: 1 },
          avgDuration: { $avg: "$durationMs" },
          errorRate: {
            $avg: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const result = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(thirtyDaysAgo.getDate() + i);
      const isoDate = date.toISOString().split("T")[0];
      const found = dailyUsage.find((d) => d._id === isoDate);
      result.push({
        date: isoDate,
        totalCalls: found?.totalCalls || 0,
        avgDuration: found?.avgDuration || 0,
        errorRate: found?.errorRate || 0,
      });
    }

    return result;
  }

  // ✅ 4. Distribución de roles (¡este era el que faltaba!)
  async getUserDistribution() {
    return await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);
  }

  // ✅ 5. Actividad de usuarios (DAU, WAU)
  async getUserActivity() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [dau, wau] = await Promise.all([
      User.countDocuments({ lastSeen: { $gte: oneDayAgo } }),
      User.countDocuments({ lastSeen: { $gte: sevenDaysAgo } }),
    ]);

    return { dau, wau };
  }

  // ✅ 6. Métricas de infraestructura
  getInfrastructureMetrics() {
    const usedMem = process.memoryUsage();
    return {
      memory: {
        rss: Math.round(usedMem.rss / 1024 / 1024),
        heapTotal: Math.round(usedMem.heapTotal / 1024 / 1024),
        heapUsed: Math.round(usedMem.heapUsed / 1024 / 1024),
      },
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      env: process.env.NODE_ENV || "development",
    };
  }
}

module.exports = new AnalyticsService();
