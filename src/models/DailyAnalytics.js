const mongoose = require("mongoose");

const dailyAnalyticsSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
      index: true,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    completedOrders: {
      type: Number,
      default: 0,
    },
    cancelledOrders: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
    totalWasteCost: {
      type: Number,
      default: 0,
    },
    salesByWaitress: [
      {
        waitressId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        waitressName: String,
        orders: {
          type: Number,
          default: 0,
        },
        revenue: {
          type: Number,
          default: 0,
        },
        cancellations: {
          type: Number,
          default: 0,
        },
      },
    ],
    salesByHour: [
      {
        hour: {
          type: Number,
          min: 0,
          max: 23,
        },
        orders: {
          type: Number,
          default: 0,
        },
        revenue: {
          type: Number,
          default: 0,
        },
      },
    ],
    paymentMethods: {
      cash: {
        type: Number,
        default: 0,
      },
      card: {
        type: Number,
        default: 0,
      },
      mobileMoney: {
        type: Number,
        default: 0,
      },
    },
    topItems: [
      {
        itemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "MenuItem",
        },
        itemName: {
          en: String,
          am: String,
        },
        quantitySold: {
          type: Number,
          default: 0,
        },
        revenue: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("DailyAnalytics", dailyAnalyticsSchema);
