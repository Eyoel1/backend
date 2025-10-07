const DailyAnalytics = require("../models/DailyAnalytics");
const Order = require("../models/Order");
const CancellationLog = require("../models/CancellationLog");
const Payment = require("../models/Payment");
const logger = require("../utils/logger");

const getTodayAnalytics = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let analytics = await DailyAnalytics.findOne({ date: today });

    const totalOrders = await Order.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow },
    });

    const completedOrders = await Order.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow },
      status: "completed",
    });

    const cancelledOrders = await Order.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow },
      status: "cancelled",
    });

    const activeOrders = await Order.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow },
      status: { $in: ["pending", "confirmed", "in-progress", "ready"] },
    });

    const revenueData = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
        },
      },
    ]);

    const totalRevenue = revenueData[0]?.total || 0;
    const averageOrderValue =
      completedOrders > 0 ? totalRevenue / completedOrders : 0;
    const customerCount = totalOrders;

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalOrders,
          completedOrders,
          cancelledOrders,
          activeOrders,
          totalRevenue,
          averageOrderValue,
          customerCount,
        },
        analytics: analytics || {
          salesByWaitress: [],
          salesByHour: [],
          paymentMethods: { cash: 0, card: 0, mobileMoney: 0 },
          topItems: [],
        },
      },
    });
  } catch (error) {
    logger.error("Get today analytics error:", error);
    next(error);
  }
};

const getPeriodAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end },
    });

    const completedOrders = orders.filter((o) => o.status === "completed");
    const cancelledOrders = orders.filter((o) => o.status === "cancelled");

    const payments = await Payment.find({
      createdAt: { $gte: start, $lte: end },
    });

    const totalRevenue = payments.reduce((sum, p) => sum + p.totalAmount, 0);

    const paymentMethods = { cash: 0, card: 0, mobileMoney: 0 };

    payments.forEach((payment) => {
      if (payment.paymentMethod === "cash") {
        paymentMethods.cash += payment.totalAmount;
      } else if (payment.paymentMethod === "card") {
        paymentMethods.card += payment.totalAmount;
      } else if (payment.paymentMethod === "mobile-money") {
        paymentMethods.mobileMoney += payment.totalAmount;
      } else if (payment.paymentMethod === "split") {
        payment.splitPayments.forEach((split) => {
          if (split.method === "cash") paymentMethods.cash += split.amount;
          if (split.method === "card") paymentMethods.card += split.amount;
          if (split.method === "mobile-money")
            paymentMethods.mobileMoney += split.amount;
        });
      }
    });

    const salesByWaitress = {};
    orders.forEach((order) => {
      const waitressId = order.waitressId.toString();
      if (!salesByWaitress[waitressId]) {
        salesByWaitress[waitressId] = {
          waitressId: order.waitressId,
          waitressName: order.waitressName,
          orders: 0,
          revenue: 0,
          cancellations: 0,
        };
      }

      salesByWaitress[waitressId].orders += 1;
      if (order.status === "completed") {
        salesByWaitress[waitressId].revenue += order.grandTotal;
      }
      if (order.status === "cancelled") {
        salesByWaitress[waitressId].cancellations += 1;
      }
    });

    const itemCounts = {};
    completedOrders.forEach((order) => {
      order.items.forEach((item) => {
        const itemId = item.itemId.toString();
        if (!itemCounts[itemId]) {
          itemCounts[itemId] = {
            itemId: item.itemId,
            itemName: item.name,
            quantitySold: 0,
            revenue: 0,
          };
        }
        itemCounts[itemId].quantitySold += item.quantity;
        itemCounts[itemId].revenue += item.subtotal;
      });
    });

    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const cancellations = await CancellationLog.find({
      timestamp: { $gte: start, $lte: end },
    });

    const totalWasteCost = cancellations.reduce(
      (sum, c) => sum + (c.wasteCost || 0),
      0
    );

    res.status(200).json({
      success: true,
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      data: {
        summary: {
          totalOrders: orders.length,
          completedOrders: completedOrders.length,
          cancelledOrders: cancelledOrders.length,
          totalRevenue,
          averageOrderValue:
            completedOrders.length > 0
              ? totalRevenue / completedOrders.length
              : 0,
          totalWasteCost,
        },
        paymentMethods,
        salesByWaitress: Object.values(salesByWaitress),
        topItems,
        cancellations: {
          count: cancellations.length,
          totalWasteCost,
        },
      },
    });
  } catch (error) {
    logger.error("Get period analytics error:", error);
    next(error);
  }
};

const getWaitressPerformance = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const waitressId = req.params.id;

    const query = { waitressId };

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const orders = await Order.find(query);
    const completedOrders = orders.filter((o) => o.status === "completed");
    const cancelledOrders = orders.filter((o) => o.status === "cancelled");

    const payments = await Payment.find({ waitressId });
    const totalRevenue = payments.reduce((sum, p) => sum + p.totalAmount, 0);

    const averageOrderValue =
      completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
    const cancellationRate =
      orders.length > 0 ? (cancelledOrders.length / orders.length) * 100 : 0;

    const ordersByDay = {};
    orders.forEach((order) => {
      const day = order.createdAt.toISOString().split("T")[0];
      if (!ordersByDay[day]) {
        ordersByDay[day] = { date: day, orders: 0, revenue: 0 };
      }
      ordersByDay[day].orders += 1;
      if (order.status === "completed") {
        ordersByDay[day].revenue += order.grandTotal;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalOrders: orders.length,
          completedOrders: completedOrders.length,
          cancelledOrders: cancelledOrders.length,
          totalRevenue,
          averageOrderValue,
          cancellationRate,
        },
        ordersByDay: Object.values(ordersByDay).sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        ),
      },
    });
  } catch (error) {
    logger.error("Get waitress performance error:", error);
    next(error);
  }
};

const getCancellations = async (req, res, next) => {
  try {
    const { requiresReview, startDate, endDate } = req.query;

    const query = {};

    if (requiresReview !== undefined) {
      query.requiresReview = requiresReview === "true";
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      query.timestamp = { $gte: start, $lte: end };
    }

    const cancellations = await CancellationLog.find(query)
      .sort({ timestamp: -1 })
      .populate("cancelledBy", "fullName username");

    const summary = {
      total: cancellations.length,
      requiresReview: cancellations.filter((c) => c.requiresReview).length,
      totalWasteCost: cancellations.reduce(
        (sum, c) => sum + (c.wasteCost || 0),
        0
      ),
      byPhase: {
        grace_window: cancellations.filter((c) => c.phase === "grace_window")
          .length,
        confirmed: cancellations.filter((c) => c.phase === "confirmed").length,
        in_progress: cancellations.filter((c) => c.phase === "in_progress")
          .length,
        ready: cancellations.filter((c) => c.phase === "ready").length,
      },
    };

    res.status(200).json({
      success: true,
      summary,
      data: cancellations,
    });
  } catch (error) {
    logger.error("Get cancellations error:", error);
    next(error);
  }
};

const reviewCancellation = async (req, res, next) => {
  try {
    const cancellation = await CancellationLog.findById(req.params.id);

    if (!cancellation) {
      return res.status(404).json({
        success: false,
        message: "Cancellation log not found",
      });
    }

    cancellation.reviewedBy = req.user._id;
    cancellation.reviewedAt = new Date();
    cancellation.requiresReview = false;

    await cancellation.save();

    logger.info(
      `Cancellation ${req.params.id} reviewed by ${req.user.username}`
    );

    res.status(200).json({
      success: true,
      message: "Cancellation marked as reviewed",
      data: cancellation,
    });
  } catch (error) {
    logger.error("Review cancellation error:", error);
    next(error);
  }
};

module.exports = {
  getTodayAnalytics,
  getPeriodAnalytics,
  getWaitressPerformance,
  getCancellations,
  reviewCancellation,
};
