// src/controllers/settingsController.js
const RestaurantSettings = require("../models/RestaurantSettings");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const DailyAnalytics = require("../models/DailyAnalytics");
const logger = require("../utils/logger");

const getSettings = async (req, res, next) => {
  try {
    const settings = await RestaurantSettings.getSettings();

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    logger.error("Get settings error:", error);
    next(error);
  }
};

const updateAppearance = async (req, res, next) => {
  try {
    const { language, theme } = req.body;

    const settings = await RestaurantSettings.getSettings();

    if (language) {
      if (!["en", "am"].includes(language)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid language. Must be "en" or "am"',
        });
      }
      settings.language = language;
    }

    if (theme) {
      if (!["light", "dark", "auto"].includes(theme)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid theme. Must be "light", "dark", or "auto"',
        });
      }
      settings.theme = theme;
    }

    settings.updatedBy = req.user._id;
    await settings.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("settings-updated", {
        language: settings.language,
        theme: settings.theme,
      });
    }

    logger.info(`Appearance settings updated by ${req.user.username}`);

    res.status(200).json({
      success: true,
      message: "Appearance settings updated",
      data: settings,
    });
  } catch (error) {
    logger.error("Update appearance error:", error);
    next(error);
  }
};

const updateOrderManagement = async (req, res, next) => {
  try {
    const { graceWindowMinutes } = req.body;

    if (
      !graceWindowMinutes ||
      graceWindowMinutes < 1 ||
      graceWindowMinutes > 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Grace window must be between 1 and 5 minutes",
      });
    }

    const settings = await RestaurantSettings.getSettings();
    settings.graceWindowMinutes = graceWindowMinutes;
    settings.updatedBy = req.user._id;
    await settings.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("settings-updated", {
        graceWindowMinutes: settings.graceWindowMinutes,
      });
    }

    logger.info(
      `Grace window updated to ${graceWindowMinutes} minutes by ${req.user.username}`
    );

    res.status(200).json({
      success: true,
      message: "Order management settings updated",
      data: settings,
    });
  } catch (error) {
    logger.error("Update order management error:", error);
    next(error);
  }
};

const updateTakeawayPricing = async (req, res, next) => {
  try {
    const { policy, discountPercentage, applyToExisting } = req.body;

    if (
      !["same-as-dinein", "percentage-discount", "custom-per-item"].includes(
        policy
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid policy",
      });
    }

    const settings = await RestaurantSettings.getSettings();
    settings.takeawayPricing.policy = policy;

    if (policy === "percentage-discount") {
      if (
        !discountPercentage ||
        discountPercentage < 0 ||
        discountPercentage > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Discount percentage must be between 0 and 100",
        });
      }
      settings.takeawayPricing.discountPercentage = discountPercentage;
    }

    settings.updatedBy = req.user._id;
    await settings.save();

    if (applyToExisting) {
      const menuItems = await MenuItem.find();

      for (const item of menuItems) {
        if (policy === "same-as-dinein") {
          item.pricing.takeaway = item.pricing.dineIn;
          item.pricing.hasDifferentTakeawayPrice = false;
        } else if (policy === "percentage-discount") {
          const discount = item.pricing.dineIn * (discountPercentage / 100);
          item.pricing.takeaway = item.pricing.dineIn - discount;
          item.pricing.hasDifferentTakeawayPrice = true;
        }
        await item.save();
      }

      logger.info(`Takeaway pricing applied to ${menuItems.length} items`);
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("settings-updated", {
        takeawayPricing: settings.takeawayPricing,
      });

      if (applyToExisting) {
        io.emit("menu-updated", {
          action: "bulk-price-update",
          message: "Prices updated for all items",
        });
      }
    }

    logger.info(`Takeaway pricing updated by ${req.user.username}`);

    res.status(200).json({
      success: true,
      message: "Takeaway pricing policy updated",
      data: settings,
    });
  } catch (error) {
    logger.error("Update takeaway pricing error:", error);
    next(error);
  }
};

const clearKitchenDisplay = async (req, res, next) => {
  try {
    const { pin } = req.body;

    const isPinCorrect = await req.user.comparePin(pin);
    if (!isPinCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid PIN",
      });
    }

    const result = await Order.updateMany(
      {
        status: { $in: ["pending", "confirmed", "in-progress"] },
        "items.prepStation": "kitchen",
      },
      {
        $set: { status: "cancelled" },
      }
    );

    const io = req.app.get("io");
    if (io) {
      io.to("kitchen").emit("clear-display", {
        message: "Kitchen display cleared by owner",
      });
    }

    logger.warn(
      `Kitchen display cleared by ${req.user.username} - ${result.modifiedCount} orders affected`
    );

    res.status(200).json({
      success: true,
      message: `Kitchen display cleared. ${result.modifiedCount} orders cancelled.`,
    });
  } catch (error) {
    logger.error("Clear kitchen display error:", error);
    next(error);
  }
};

const clearJuicebarDisplay = async (req, res, next) => {
  try {
    const { pin } = req.body;

    const isPinCorrect = await req.user.comparePin(pin);
    if (!isPinCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid PIN",
      });
    }

    const result = await Order.updateMany(
      {
        status: { $in: ["pending", "confirmed", "in-progress"] },
        "items.prepStation": "juicebar",
      },
      {
        $set: { status: "cancelled" },
      }
    );

    const io = req.app.get("io");
    if (io) {
      io.to("juicebar").emit("clear-display", {
        message: "Juice bar display cleared by owner",
      });
    }

    logger.warn(
      `Juice bar display cleared by ${req.user.username} - ${result.modifiedCount} orders affected`
    );

    res.status(200).json({
      success: true,
      message: `Juice bar display cleared. ${result.modifiedCount} orders cancelled.`,
    });
  } catch (error) {
    logger.error("Clear juice bar display error:", error);
    next(error);
  }
};

const resetAnalytics = async (req, res, next) => {
  try {
    const { pin, confirmation } = req.body;

    if (confirmation !== "DELETE ALL DATA") {
      return res.status(400).json({
        success: false,
        message: 'Invalid confirmation. Type "DELETE ALL DATA" exactly.',
      });
    }

    const isPinCorrect = await req.user.comparePin(pin);
    if (!isPinCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid PIN",
      });
    }

    const analyticsResult = await DailyAnalytics.deleteMany({});

    logger.warn(`⚠️ ALL ANALYTICS DATA RESET by ${req.user.username}`);
    logger.warn(`   - ${analyticsResult.deletedCount} daily analytics deleted`);

    res.status(200).json({
      success: true,
      message: "All analytics data has been permanently deleted",
      deletedCounts: {
        dailyAnalytics: analyticsResult.deletedCount,
      },
    });
  } catch (error) {
    logger.error("Reset analytics error:", error);
    next(error);
  }
};

const startNewDay = async (req, res, next) => {
  try {
    const { pin } = req.body;

    const isPinCorrect = await req.user.comparePin(pin);
    if (!isPinCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid PIN",
      });
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("new-day-started", {
        message: "New business day started",
        date: new Date().toISOString(),
      });
    }

    logger.info(`New day started by ${req.user.username}`);

    res.status(200).json({
      success: true,
      message: "New day started successfully",
    });
  } catch (error) {
    logger.error("Start new day error:", error);
    next(error);
  }
};

module.exports = {
  getSettings,
  updateAppearance,
  updateOrderManagement,
  updateTakeawayPricing,
  clearKitchenDisplay,
  clearJuicebarDisplay,
  resetAnalytics,
  startNewDay,
};
