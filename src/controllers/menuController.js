// ============================================
// src/controllers/menuController.js
// ============================================
const MenuItem = require("../models/MenuItem");
const Category = require("../models/Category");
const cloudinary = require("../config/cloudinary");
const logger = require("../utils/logger");

/**
 * @desc    Get all active menu items
 * @route   GET /api/menu-items/active
 * @access  Private (All authenticated users)
 */
exports.getActiveMenuItems = async (req, res, next) => {
  try {
    const menuItems = await MenuItem.find({ available: true })
      .populate("categoryId", "name prepStation")
      .populate("addOns", "name price")
      .sort({ "name.en": 1 });

    res.status(200).json({
      success: true,
      count: menuItems.length,
      data: menuItems,
    });
  } catch (error) {
    logger.error("Get active menu items error:", error);
    next(error);
  }
};

/**
 * @desc    Get all menu items (including inactive)
 * @route   GET /api/menu-items
 * @access  Private (Owner)
 */
exports.getAllMenuItems = async (req, res, next) => {
  try {
    const { category, prepStation, available } = req.query;
    const query = {};

    if (category) query.categoryId = category;
    if (prepStation) query.prepStation = prepStation;
    if (available !== undefined) query.available = available === "true";

    const menuItems = await MenuItem.find(query)
      .populate("categoryId", "name prepStation")
      .populate("addOns", "name price")
      .sort({ "name.en": 1 });

    res.status(200).json({
      success: true,
      count: menuItems.length,
      data: menuItems,
    });
  } catch (error) {
    logger.error("Get all menu items error:", error);
    next(error);
  }
};

/**
 * @desc    Get single menu item
 * @route   GET /api/menu-items/:id
 * @access  Private (Owner)
 */
exports.getMenuItem = async (req, res, next) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id)
      .populate("categoryId")
      .populate("addOns");

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    res.status(200).json({
      success: true,
      data: menuItem,
    });
  } catch (error) {
    logger.error("Get menu item error:", error);
    next(error);
  }
};

/**
 * @desc    Create menu item
 * @route   POST /api/menu-items
 * @access  Private (Owner)
 */
exports.createMenuItem = async (req, res, next) => {
  try {
    console.log("=== CREATE MENU ITEM ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("ImageUrl in request:", req.body.imageUrl);

    const {
      name,
      description,
      pricing,
      categoryId,
      prepStation,
      imageUrl,
      imagePublicId,
      requiresPreparation,
      stockTracking,
      addOns,
    } = req.body;

    // Verify category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Create menu item with stock tracking
    const menuItem = await MenuItem.create({
      name,
      description: description || { en: "", am: "" },
      pricing,
      categoryId,
      prepStation,
      imageUrl: imageUrl || "",
      imagePublicId: imagePublicId || "",
      requiresPreparation:
        requiresPreparation !== undefined ? requiresPreparation : true,
      stockTracking: stockTracking || {
        enabled: false,
        currentStock: 0,
        minStock: 10,
        unit: "pieces",
        deductOnOrder: true,
      },
      addOns: addOns || [],
      available: true,
      createdBy: req.user._id,
    });

    console.log("Created item:", JSON.stringify(menuItem.toObject(), null, 2));
    console.log("Created item imageUrl:", menuItem.imageUrl);

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("menu-updated", {
        action: "created",
        menuItem,
      });
    }

    logger.info(`Menu item ${name.en} created by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: "Menu item created successfully",
      data: menuItem,
    });
  } catch (error) {
    console.error("Create menu item error:", error);
    logger.error("Create menu item error:", error);
    next(error);
  }
};

/**
 * @desc    Update menu item
 * @route   PATCH /api/menu-items/:id
 * @access  Private (Owner)
 */
exports.updateMenuItem = async (req, res, next) => {
  try {
    console.log("=== UPDATE MENU ITEM ===");
    console.log("Item ID:", req.params.id);
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("ImageUrl in request:", req.body.imageUrl);

    let menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    // Update fields
    const allowedUpdates = [
      "name",
      "description",
      "pricing",
      "categoryId",
      "prepStation",
      "imageUrl",
      "imagePublicId",
      "requiresPreparation",
      "stockTracking",
      "addOns",
      "available",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        menuItem[field] = req.body[field];
      }
    });

    menuItem.updatedBy = req.user._id;

    console.log(
      "Menu item before save:",
      JSON.stringify(menuItem.toObject(), null, 2)
    );

    await menuItem.save();

    console.log(
      "Menu item after save:",
      JSON.stringify(menuItem.toObject(), null, 2)
    );
    console.log("Saved item imageUrl:", menuItem.imageUrl);

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("menu-updated", {
        action: "updated",
        menuItem,
      });
    }

    logger.info(
      `Menu item ${menuItem.name.en} updated by ${req.user.username}`
    );

    res.status(200).json({
      success: true,
      message: "Menu item updated successfully",
      data: menuItem,
    });
  } catch (error) {
    console.error("Update menu item error:", error);
    logger.error("Update menu item error:", error);
    next(error);
  }
};

/**
 * @desc    Delete menu item
 * @route   DELETE /api/menu-items/:id
 * @access  Private (Owner)
 */
exports.deleteMenuItem = async (req, res, next) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    // Delete image from Cloudinary if exists
    if (menuItem.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(menuItem.imagePublicId);
        logger.info(`Deleted image from Cloudinary: ${menuItem.imagePublicId}`);
      } catch (error) {
        logger.error("Cloudinary delete error:", error);
        // Continue with deletion even if image delete fails
      }
    }

    await menuItem.deleteOne();

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("menu-updated", {
        action: "deleted",
        menuItemId: req.params.id,
      });
    }

    logger.info(
      `Menu item ${menuItem.name.en} deleted by ${req.user.username}`
    );

    res.status(200).json({
      success: true,
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    logger.error("Delete menu item error:", error);
    next(error);
  }
};

/**
 * @desc    Toggle menu item availability
 * @route   PATCH /api/menu-items/:id/availability
 * @access  Private (Owner, Kitchen)
 */
exports.toggleAvailability = async (req, res, next) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    const { available } = req.body;
    menuItem.available = available;
    menuItem.updatedBy = req.user._id;
    await menuItem.save();

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("menu-updated", {
        action: "availability-changed",
        menuItem,
      });
    }

    logger.info(
      `Menu item ${menuItem.name.en} availability set to ${available} by ${req.user.username}`
    );

    res.status(200).json({
      success: true,
      message: `Menu item ${available ? "enabled" : "disabled"}`,
      data: menuItem,
    });
  } catch (error) {
    logger.error("Toggle availability error:", error);
    next(error);
  }
};

/**
 * @desc    Update menu item stock
 * @route   PATCH /api/menu-items/:id/stock
 * @access  Private (Owner)
 */
exports.updateStock = async (req, res, next) => {
  try {
    console.log("=== UPDATE STOCK ===");
    console.log("Item ID:", req.params.id);
    console.log("Request body:", req.body);

    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    if (!menuItem.stockTracking.enabled) {
      return res.status(400).json({
        success: false,
        message: "Stock tracking not enabled for this item",
      });
    }

    const { action, quantity } = req.body;
    const previousStock = menuItem.stockTracking.currentStock;

    if (action === "add") {
      menuItem.stockTracking.currentStock += quantity;
    } else if (action === "remove") {
      menuItem.stockTracking.currentStock = Math.max(
        0,
        menuItem.stockTracking.currentStock - quantity
      );
    } else if (action === "set") {
      menuItem.stockTracking.currentStock = quantity;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "add", "remove", or "set"',
      });
    }

    // Auto-enable if stock added
    if (menuItem.stockTracking.currentStock > 0) {
      menuItem.available = true;
    } else {
      menuItem.available = false;
    }

    menuItem.updatedBy = req.user._id;
    await menuItem.save();

    console.log(
      `Stock updated: ${previousStock} -> ${menuItem.stockTracking.currentStock}`
    );

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("menu-updated", {
        action: "stock-updated",
        menuItem,
      });
    }

    logger.info(
      `Stock updated for ${menuItem.name.en} by ${req.user.username}: ${action} ${quantity} (${previousStock} -> ${menuItem.stockTracking.currentStock})`
    );

    res.status(200).json({
      success: true,
      message: "Stock updated successfully",
      data: {
        itemId: menuItem._id,
        name: menuItem.name,
        previousStock,
        newStock: menuItem.stockTracking.currentStock,
        available: menuItem.available,
      },
    });
  } catch (error) {
    console.error("Update stock error:", error);
    logger.error("Update stock error:", error);
    next(error);
  }
};

/**
 * @desc    Deduct stock for multiple items (called during order creation)
 * @route   POST /api/menu-items/stock/deduct
 * @access  Private
 */
exports.deductStock = async (req, res, next) => {
  try {
    const { items } = req.body; // Array of {itemId, quantity}

    console.log("=== DEDUCT STOCK ===");
    console.log("Items to deduct:", items);

    const updatedItems = [];
    const lowStockAlerts = [];

    for (const item of items) {
      const menuItem = await MenuItem.findById(item.itemId);

      if (!menuItem) {
        console.log(`Menu item not found: ${item.itemId}`);
        continue;
      }

      // Only deduct if stock tracking is enabled
      if (
        menuItem.stockTracking.enabled &&
        menuItem.stockTracking.deductOnOrder
      ) {
        const previousStock = menuItem.stockTracking.currentStock;
        menuItem.stockTracking.currentStock = Math.max(
          0,
          menuItem.stockTracking.currentStock - item.quantity
        );

        // Auto-mark unavailable if out of stock
        if (menuItem.stockTracking.currentStock <= 0) {
          menuItem.available = false;
        }

        // Check for low stock
        if (
          menuItem.stockTracking.currentStock <=
            menuItem.stockTracking.minStock &&
          menuItem.stockTracking.currentStock > 0
        ) {
          lowStockAlerts.push({
            itemId: menuItem._id,
            itemName: menuItem.name,
            currentStock: menuItem.stockTracking.currentStock,
            minStock: menuItem.stockTracking.minStock,
            unit: menuItem.stockTracking.unit,
          });
        }

        await menuItem.save();

        updatedItems.push({
          itemId: menuItem._id,
          name: menuItem.name,
          previousStock,
          newStock: menuItem.stockTracking.currentStock,
          deducted: item.quantity,
          available: menuItem.available,
        });

        console.log(
          `Stock deducted for ${menuItem.name.en}: ${item.quantity} units (${previousStock} -> ${menuItem.stockTracking.currentStock})`
        );
      }
    }

    // Emit low stock alerts to owner
    if (lowStockAlerts.length > 0) {
      const io = req.app.get("io");
      if (io) {
        lowStockAlerts.forEach((alert) => {
          io.to("owner").emit("low-stock-alert", alert);
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Stock deducted successfully",
      data: {
        updatedItems,
        lowStockAlerts,
      },
    });
  } catch (error) {
    console.error("Deduct stock error:", error);
    logger.error("Deduct stock error:", error);
    next(error);
  }
};
