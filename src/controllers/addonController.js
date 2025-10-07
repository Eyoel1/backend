const Addon = require("../models/Addon");
const MenuItem = require("../models/MenuItem"); // Add this
const logger = require("../utils/logger"); // Add this

/**
 * @desc    Get all add-ons
 * @route   GET /api/addons
 * @access  Private
 */
exports.getAllAddons = async (req, res, next) => {
  try {
    const addons = await Addon.find().sort({ "name.en": 1 });

    res.status(200).json({
      success: true,
      count: addons.length,
      data: addons,
    });
  } catch (error) {
    logger.error("Get addons error:", error);
    next(error);
  }
};

/**
 * @desc    Create add-on
 * @route   POST /api/addons
 * @access  Private (Owner)
 */
exports.createAddon = async (req, res, next) => {
  try {
    console.log("=== CREATE ADDON ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const { name, price, isOptional } = req.body;

    const addon = await Addon.create({
      name,
      price,
      isOptional: isOptional !== undefined ? isOptional : true,
      createdBy: req.user._id,
    });

    console.log("Addon created:", JSON.stringify(addon, null, 2));

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("addon-added", { addon });
    }

    logger.info(`Add-on ${name.en} created by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: "Add-on created successfully",
      data: addon,
    });
  } catch (error) {
    console.error("Create addon error:", error);
    logger.error("Create addon error:", error);
    next(error);
  }
};

/**
 * @desc    Update add-on
 * @route   PATCH /api/addons/:id
 * @access  Private (Owner)
 */
exports.updateAddon = async (req, res, next) => {
  try {
    let addon = await Addon.findById(req.params.id);

    if (!addon) {
      return res.status(404).json({
        success: false,
        message: "Add-on not found",
      });
    }

    const { name, price, isOptional } = req.body;

    if (name) addon.name = name;
    if (price !== undefined) addon.price = price;
    if (isOptional !== undefined) addon.isOptional = isOptional;

    await addon.save();

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("addon-updated", { addon });
    }

    logger.info(`Add-on ${addon.name.en} updated by ${req.user.username}`);

    res.status(200).json({
      success: true,
      message: "Add-on updated successfully",
      data: addon,
    });
  } catch (error) {
    logger.error("Update addon error:", error);
    next(error);
  }
};

/**
 * @desc    Delete add-on
 * @route   DELETE /api/addons/:id
 * @access  Private (Owner)
 */
exports.deleteAddon = async (req, res, next) => {
  try {
    const addon = await Addon.findById(req.params.id);

    if (!addon) {
      return res.status(404).json({
        success: false,
        message: "Add-on not found",
      });
    }

    // Check if any menu items use this add-on
    const itemsUsingAddon = await MenuItem.countDocuments({
      addOns: req.params.id,
    });

    if (itemsUsingAddon > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete add-on. ${itemsUsingAddon} menu items are using it.`,
      });
    }

    await addon.deleteOne();

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("addon-deleted", { addonId: req.params.id });
    }

    logger.info(`Add-on ${addon.name.en} deleted by ${req.user.username}`);

    res.status(200).json({
      success: true,
      message: "Add-on deleted successfully",
    });
  } catch (error) {
    logger.error("Delete addon error:", error);
    next(error);
  }
};
