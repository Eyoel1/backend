// src/controllers/paymentController.js
const Payment = require("../models/Payment");
const Order = require("../models/Order");
const DailyAnalytics = require("../models/DailyAnalytics");
const logger = require("../utils/logger");

/**
 * @desc    Process payment and complete order
 * @route   POST /api/payments
 * @access  Private (Waitress)
 */
const processPayment = async (req, res, next) => {
  try {
    const {
      orderId,
      paymentMethod,
      amountReceived,
      splitPayments,
      transactionId,
    } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.waitressId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to process payment for this order",
      });
    }

    if (order.status !== "ready" && order.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Order must be ready before payment",
      });
    }

    const totalAmount = order.grandTotal;
    let paidAmount = 0;
    let changeDue = 0;

    if (paymentMethod === "split") {
      if (!splitPayments || splitPayments.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Split payments are required",
        });
      }

      paidAmount = splitPayments.reduce((sum, p) => sum + p.amount, 0);
      if (Math.abs(paidAmount - totalAmount) > 0.01) {
        return res.status(400).json({
          success: false,
          message: "Split payment total must equal order total",
        });
      }
    } else {
      paidAmount = amountReceived || totalAmount;

      if (paymentMethod === "cash" && paidAmount < totalAmount) {
        return res.status(400).json({
          success: false,
          message: "Insufficient payment amount",
        });
      }

      changeDue = paymentMethod === "cash" ? paidAmount - totalAmount : 0;
    }

    const payment = await Payment.create({
      orderId: order._id,
      orderNumber: order.orderNumber,
      paymentMethod,
      totalAmount,
      amountReceived: paidAmount,
      changeDue,
      splitPayments: paymentMethod === "split" ? splitPayments : [],
      waitressId: req.user._id,
      transactionId,
    });

    order.status = "completed";
    order.paymentStatus = "paid";
    order.completedAt = new Date();
    await order.save();

    await updateDailyAnalytics(order, payment);

    const io = req.app.get("io");
    if (io) {
      io.to("owner").emit("order-completed", {
        orderNumber: order.orderNumber,
        waitressName: order.waitressName,
        total: totalAmount,
        paymentMethod,
      });
    }

    logger.info(
      `Payment processed for order ${order.orderNumber} by ${req.user.username}`
    );

    res.status(201).json({
      success: true,
      message: "Payment processed successfully",
      data: {
        payment,
        order,
        change:
          changeDue > 0
            ? {
                amount: changeDue,
                breakdown: calculateChangeBreakdown(changeDue),
              }
            : null,
      },
    });
  } catch (error) {
    logger.error("Process payment error:", error);
    next(error);
  }
};

const getDailyPayments = async (req, res, next) => {
  try {
    const { date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const payments = await Payment.find({
      createdAt: { $gte: targetDate, $lt: nextDay },
    })
      .populate("waitressId", "fullName username")
      .populate("orderId", "orderNumber tableNumber status")
      .sort({ createdAt: -1 });

    const summary = payments.reduce(
      (acc, payment) => {
        acc.total += payment.totalAmount;
        acc.count += 1;

        if (payment.paymentMethod === "cash") acc.cash += payment.totalAmount;
        else if (payment.paymentMethod === "card")
          acc.card += payment.totalAmount;
        else if (payment.paymentMethod === "mobile-money")
          acc.mobileMoney += payment.totalAmount;
        else if (payment.paymentMethod === "split") {
          payment.splitPayments.forEach((split) => {
            if (split.method === "cash") acc.cash += split.amount;
            if (split.method === "card") acc.card += split.amount;
            if (split.method === "mobile-money")
              acc.mobileMoney += split.amount;
          });
        }

        return acc;
      },
      { total: 0, count: 0, cash: 0, card: 0, mobileMoney: 0 }
    );

    res.status(200).json({
      success: true,
      date: targetDate.toISOString().split("T")[0],
      data: {
        payments,
        summary,
      },
    });
  } catch (error) {
    logger.error("Get daily payments error:", error);
    next(error);
  }
};

const updateDailyAnalytics = async (order, payment) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let analytics = await DailyAnalytics.findOne({ date: today });
    if (!analytics) {
      analytics = await DailyAnalytics.create({
        date: today,
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
        totalWasteCost: 0,
        salesByWaitress: [],
        salesByHour: [],
        paymentMethods: { cash: 0, card: 0, mobileMoney: 0 },
        topItems: [],
      });
    }

    analytics.completedOrders += 1;
    analytics.totalRevenue += order.grandTotal;

    if (payment.paymentMethod === "cash")
      analytics.paymentMethods.cash += payment.totalAmount;
    else if (payment.paymentMethod === "card")
      analytics.paymentMethods.card += payment.totalAmount;
    else if (payment.paymentMethod === "mobile-money")
      analytics.paymentMethods.mobileMoney += payment.totalAmount;
    else if (payment.paymentMethod === "split")
      payment.splitPayments.forEach((split) => {
        if (split.method === "cash")
          analytics.paymentMethods.cash += split.amount;
        if (split.method === "card")
          analytics.paymentMethods.card += split.amount;
        if (split.method === "mobile-money")
          analytics.paymentMethods.mobileMoney += split.amount;
      });

    const waitressIndex = analytics.salesByWaitress.findIndex(
      (w) => w.waitressId.toString() === order.waitressId.toString()
    );
    if (waitressIndex >= 0) {
      analytics.salesByWaitress[waitressIndex].orders += 1;
      analytics.salesByWaitress[waitressIndex].revenue += order.grandTotal;
    } else {
      analytics.salesByWaitress.push({
        waitressId: order.waitressId,
        waitressName: order.waitressName,
        orders: 1,
        revenue: order.grandTotal,
        cancellations: 0,
      });
    }

    const hour = order.createdAt.getHours();
    const hourIndex = analytics.salesByHour.findIndex((h) => h.hour === hour);
    if (hourIndex >= 0) {
      analytics.salesByHour[hourIndex].orders += 1;
      analytics.salesByHour[hourIndex].revenue += order.grandTotal;
    } else {
      analytics.salesByHour.push({
        hour,
        orders: 1,
        revenue: order.grandTotal,
      });
    }

    order.items.forEach((item) => {
      const itemIndex = analytics.topItems.findIndex(
        (i) => i.itemId.toString() === item.itemId.toString()
      );
      if (itemIndex >= 0) {
        analytics.topItems[itemIndex].quantitySold += item.quantity;
        analytics.topItems[itemIndex].revenue += item.subtotal;
      } else {
        analytics.topItems.push({
          itemId: item.itemId,
          itemName: item.name,
          quantitySold: item.quantity,
          revenue: item.subtotal,
        });
      }
    });

    await analytics.save();
  } catch (error) {
    logger.error("Update daily analytics error:", error);
  }
};

const calculateChangeBreakdown = (amount) => {
  const denominations = [100, 50, 20, 10, 5, 1, 0.25, 0.1, 0.05, 0.01];
  const breakdown = [];
  let remaining = Math.round(amount * 100) / 100;

  denominations.forEach((denom) => {
    if (remaining >= denom) {
      const count = Math.floor(remaining / denom);
      breakdown.push({ denomination: denom, count });
      remaining = Math.round((remaining - count * denom) * 100) / 100;
    }
  });

  return breakdown;
};

module.exports = { processPayment, getDailyPayments };
