// backend/services/admin/SubscriptionService.js
const Subscription = require('../../models/Subscription');
const User = require('../../models/User');

class SubscriptionService {
  async getSubscriptionStats() {
    const [
      totalSubscriptions,
      activeSubscriptions,
      professionalSubs,
      featuredSubs,
      canceledSubs,
      failedSubs
    ] = await Promise.all([
      Subscription.countDocuments(),
      Subscription.countDocuments({ status: 'active' }),
      Subscription.countDocuments({ status: 'active', plan: 'professional' }),
      Subscription.countDocuments({ status: 'active', plan: 'featured' }),
      Subscription.countDocuments({ status: 'canceled' }),
      Subscription.countDocuments({ status: 'failed' })
    ]);

    const mrr = (professionalSubs * 299) + (featuredSubs * 499);

    return {
      totalSubscriptions,
      activeSubscriptions,
      professionalSubs,
      featuredSubs,
      canceledSubs,
      failedSubs,
      mrr
    };
  }

  async getSubscriptionGrowth() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const dailyGrowth = await Subscription.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          status: 'active'
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const result = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(thirtyDaysAgo.getDate() + i);
      const isoDate = date.toISOString().split('T')[0];
      const found = dailyGrowth.find(d => d._id === isoDate);
      result.push({
        date: isoDate,
        newSubscriptions: found ? found.count : 0
      });
    }

    return result;
  }

  async getTopSubscribedWorkers() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const workerSubs = await Subscription.aggregate([
      {
        $match: {
          status: 'active',
          createdAt: { $gte: oneWeekAgo }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 1,
          userId: 1,
          plan: 1,
          name: "$user.name",
          email: "$user.email",
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } },
      { $limit: 10 }
    ]);

    return workerSubs;
  }
}

module.exports = new SubscriptionService();
