// ============================================
// src/controllers/orderController.js
// ============================================
const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const RestaurantSettings = require("../models/RestaurantSettings");
const CancellationLog = require("../models/CancellationLog");
const { generateOrderNumber } = require("../utils/orderNumberGenerator");
const {
  calculateOrderSubtotal,
  calculateGraceWindowEnd,
  isWithinGraceWindow,
} = require("../utils/helpers");
const logger = require("../utils/logger");

/**
 * @desc    Create new order
 * @route   POST /api/orders
 * @access  Private (Waitress)
 */
exports.createOrder = async (req, res, next) => {
  try {
    console.log("=== CREATE ORDER ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const { orderType, customerName, customerPhone, items } = req.body;

    // Validate items exist and are available
    const itemIds = items.map((item) => item.itemId);
    const menuItems = await MenuItem.find({ _id: { $in: itemIds } });

    console.log(
      `Found ${menuItems.length} menu items for ${itemIds.length} requested items`
    );

    if (menuItems.length !== itemIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more items not found",
      });
    }

    // Check availability
    const unavailableItems = menuItems.filter((item) => !item.available);
    if (unavailableItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some items are not available",
        unavailableItems: unavailableItems.map((i) => i.name.en),
      });
    }

    // Get settings for grace window
    const settings = await RestaurantSettings.getSettings();

    // Process each item and track stock deductions
    const stockDeductions = [];
    const lowStockAlerts = [];

    const processedItems = await Promise.all(
      items.map(async (item) => {
        const menuItem = menuItems.find(
          (m) => m._id.toString() === item.itemId
        );

        console.log(`Processing item: ${menuItem.name.en}`);

        // Calculate item subtotal
        const itemSubtotal = item.pricePerUnit * item.quantity;
        const addOnsTotal =
          (item.addOns?.reduce((sum, addon) => sum + addon.price, 0) || 0) *
          item.quantity;

        // Check if item requires preparation
        const autoComplete = !menuItem.requiresPreparation;
        const skipKitchen = autoComplete;

        // Deduct stock if enabled
        if (
          menuItem.stockTracking?.enabled &&
          menuItem.stockTracking?.deductOnOrder
        ) {
          const previousStock = menuItem.stockTracking.currentStock;
          menuItem.stockTracking.currentStock = Math.max(
            0,
            menuItem.stockTracking.currentStock - item.quantity
          );

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

          // Mark unavailable if out of stock
          if (menuItem.stockTracking.currentStock <= 0) {
            menuItem.available = false;
          }

          await menuItem.save();

          stockDeductions.push({
            itemId: menuItem._id,
            name: menuItem.name.en,
            previousStock,
            newStock: menuItem.stockTracking.currentStock,
            deducted: item.quantity,
          });

          console.log(
            `Stock deducted: ${menuItem.name.en} - ${item.quantity} units (${previousStock} -> ${menuItem.stockTracking.currentStock})`
          );
        }

        // ✅ Return processed item WITHOUT prepStation
        return {
          itemId: item.itemId,
          name: menuItem.name,
          variant: item.variant || "",
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          addOns: item.addOns || [],
          specialNotes: item.specialNotes || "",
          subtotal: itemSubtotal + addOnsTotal,
          autoComplete,
          skipKitchen,
          status: autoComplete ? "ready" : "pending",
        };
      })
    );

    // Generate order number
    const orderNumber = await generateOrderNumber();

    // Calculate totals
    const subtotal = processedItems.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );
    const grandTotal = subtotal;

    // Calculate grace window
    const graceWindowEndsAt = calculateGraceWindowEnd(
      settings.graceWindowMinutes
    );

    // Create order
    const order = await Order.create({
      orderNumber,
      orderType,
      customerName: customerName || "",
      customerPhone: customerPhone || "",
      waitressId: req.user._id,
      waitressName: req.user.fullName,
      items: processedItems,
      subtotal,
      grandTotal,
      status: "pending",
      graceWindowEndsAt,
    });

    console.log(`✅ Order created: ${orderNumber}`);
    if (stockDeductions.length > 0) {
      console.log("Stock deductions:", stockDeductions);
    }

    // Emit Socket.IO events
    const io = req.app.get("io");

    if (io) {
      // Determine which stations need this order
      const kitchenItems = processedItems.filter((item) => {
        const menuItem = menuItems.find(
          (m) => m._id.toString() === item.itemId
        );
        return menuItem.prepStation === "kitchen" && !item.skipKitchen;
      });

      const juiceBarItems = processedItems.filter((item) => {
        const menuItem = menuItems.find(
          (m) => m._id.toString() === item.itemId
        );
        return menuItem.prepStation === "juicebar" && !item.skipKitchen;
      });

      if (kitchenItems.length > 0) {
        io.to("kitchen").emit("new-order", {
          order: {
            ...order.toObject(),
            items: kitchenItems,
          },
        });
        console.log(`Sent ${kitchenItems.length} items to kitchen`);
      }

      if (juiceBarItems.length > 0) {
        io.to("juicebar").emit("new-order", {
          order: {
            ...order.toObject(),
            items: juiceBarItems,
          },
        });
        console.log(`Sent ${juiceBarItems.length} items to juice bar`);
      }

      // Emit to owner
      io.to("owner").emit("new-order-alert", {
        orderNumber: order.orderNumber,
        waitressName: order.waitressName,
        total: order.grandTotal,
        itemCount: order.items.length,
      });

      // Emit low stock alerts to owner
      if (lowStockAlerts.length > 0) {
        lowStockAlerts.forEach((alert) => {
          io.to("owner").emit("low-stock-alert", alert);
        });
      }

      // Emit success back to waitress
      io.to(`user-${req.user._id}`).emit("order-created-success", {
        orderId: order._id,
        orderNumber: order.orderNumber,
      });
    }

    logger.info(`Order ${orderNumber} created by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
      stockDeductions,
      lowStockAlerts,
    });
  } catch (error) {
    console.error("❌ Create order error:", error);
    logger.error("Create order error:", error);
    next(error);
  }
};

/**
 * @desc    Get waitress's active orders
 * @route   GET /api/orders/my-active
 * @access  Private (Waitress)
 */
exports.getMyActiveOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({
      waitressId: req.user._id,
      status: { $in: ["pending", "confirmed", "in-progress", "ready"] },
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    logger.error("Get active orders error:", error);
    next(error);
  }
};

/**
 * @desc    Get order by ID
 * @route   GET /api/orders/:id
 * @access  Private (Waitress, Owner)
 */
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Waitress can only see their own orders
    if (
      req.user.role === "waitress" &&
      order.waitressId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    logger.error("Get order error:", error);
    next(error);
  }
};

/**
 * @desc    Edit order (during grace window)
 * @route   PATCH /api/orders/:id
 * @access  Private (Waitress)
 */
exports.editOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check ownership
    if (order.waitressId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to edit this order",
      });
    }

    // Check if within grace window
    if (!isWithinGraceWindow(order)) {
      return res.status(400).json({
        success: false,
        message: "Grace window has expired. Cannot edit order.",
      });
    }

    const { items, customerName, customerPhone } = req.body;

    // If items are being updated, recalculate everything
    if (items) {
      // Similar processing as createOrder
      const itemIds = items.map((item) => item.itemId);
      const menuItems = await MenuItem.find({ _id: { $in: itemIds } });

      const processedItems = items.map((item) => {
        const menuItem = menuItems.find(
          (m) => m._id.toString() === item.itemId
        );
        const itemSubtotal = item.pricePerUnit * item.quantity;
        const addOnsTotal =
          (item.addOns?.reduce((sum, addon) => sum + addon.price, 0) || 0) *
          item.quantity;
        const autoComplete = !menuItem.requiresPreparation;

        return {
          itemId: item.itemId,
          name: menuItem.name,
          variant: item.variant || "",
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          addOns: item.addOns || [],
          specialNotes: item.specialNotes || "",
          subtotal: itemSubtotal + addOnsTotal,
          autoComplete,
          skipKitchen: autoComplete,
          status: autoComplete ? "ready" : "pending",
        };
      });

      const subtotal = processedItems.reduce(
        (sum, item) => sum + item.subtotal,
        0
      );

      order.items = processedItems;
      order.subtotal = subtotal;
      order.grandTotal = subtotal;
    }

    if (customerName !== undefined) order.customerName = customerName;
    if (customerPhone !== undefined) order.customerPhone = customerPhone;

    // Reset grace window
    const settings = await RestaurantSettings.getSettings();
    order.graceWindowEndsAt = calculateGraceWindowEnd(
      settings.graceWindowMinutes
    );

    await order.save();

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.to("kitchen").emit("order-updated", { order });
      io.to("juicebar").emit("order-updated", { order });
    }

    logger.info(`Order ${order.orderNumber} edited by ${req.user.username}`);

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: order,
    });
  } catch (error) {
    logger.error("Edit order error:", error);
    next(error);
  }
};

/**
 * @desc    Update order status (Kitchen/Juice Bar)
 * @route   PATCH /api/orders/:id/status
 * @access  Private (Kitchen, Juice Bar)
 */
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, itemId } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // If updating specific item status
    if (itemId) {
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: "Item not found in order",
        });
      }

      item.status = status;
      order.updateOverallStatus();
    } else {
      // Update all items
      order.items.forEach((item) => {
        if (!item.autoComplete) {
          item.status = status;
        }
      });
      order.status = status;
    }

    await order.save();

    // Emit Socket.IO event to waitress
    const io = req.app.get("io");
    if (io) {
      io.to(`user-${order.waitressId}`).emit("order-status-update", {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        items: order.items,
      });
    }

    logger.info(
      `Order ${order.orderNumber} status updated to ${status} by ${req.user.username}`
    );

    res.status(200).json({
      success: true,
      message: "Order status updated",
      data: order,
    });
  } catch (error) {
    logger.error("Update order status error:", error);
    next(error);
  }
};

/**
 * @desc    Cancel order
 * @route   PATCH /api/orders/:id/cancel
 * @access  Private (Waitress)
 */
exports.cancelOrder = async (req, res, next) => {
  try {
    const { reason, details } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check ownership
    if (order.waitressId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this order",
      });
    }

    // Determine cancellation phase
    let phase;
    let requiresReview = false;
    let wasteCost = 0;

    if (isWithinGraceWindow(order)) {
      phase = "grace_window";
      requiresReview = false;
    } else if (order.status === "confirmed") {
      phase = "confirmed";
      requiresReview = true;
      wasteCost = order.grandTotal * 0.5; // Estimate 50% waste
    } else if (order.status === "in-progress") {
      phase = "in_progress";
      requiresReview = true;
      wasteCost = order.grandTotal * 0.8; // Estimate 80% waste
    } else if (order.status === "ready") {
      phase = "ready";
      requiresReview = true;
      wasteCost = order.grandTotal; // Full waste
    }

    // Update order
    order.status = "cancelled";
    order.cancelledAt = new Date();
    order.cancelledBy = req.user._id;
    order.cancellationReason = reason;
    order.cancellationPhase = phase;
    order.cancellationDetails = details || "";
    order.wasteCost = wasteCost;
    order.wastedItems = order.items.map((item) => ({
      itemId: item.itemId,
      itemName: item.name.en,
      quantity: item.quantity,
      cost: item.subtotal,
    }));

    await order.save();

    // Create cancellation log
    await CancellationLog.create({
      orderId: order._id,
      orderNumber: order.orderNumber,
      cancelledBy: req.user._id,
      cancelledByName: req.user.fullName,
      phase,
      reason,
      details: details || "",
      itemsLost: order.wastedItems,
      wasteCost,
      requiresReview,
    });

    // Emit Socket.IO events
    const io = req.app.get("io");
    if (io) {
      io.to("kitchen").emit("order-cancelled", {
        orderNumber: order.orderNumber,
      });
      io.to("juicebar").emit("order-cancelled", {
        orderNumber: order.orderNumber,
      });

      if (requiresReview) {
        io.to("owner").emit("cancellation-requires-review", {
          orderNumber: order.orderNumber,
          waitressName: req.user.fullName,
          wasteCost,
          reason,
        });
      }
    }

    logger.info(
      `Order ${order.orderNumber} cancelled by ${req.user.username} (${phase})`
    );

    res.status(200).json({
      success: true,
      message: "Order cancelled",
      data: {
        order,
        requiresReview,
        wasteCost,
      },
    });
  } catch (error) {
    logger.error("Cancel order error:", error);
    next(error);
  }
};

/**
 * @desc    Get orders for kitchen/juice bar display
 * @route   GET /api/orders/pending-for-station
 * @access  Private (Kitchen, Juice Bar)
 */
exports.getOrdersForStation = async (req, res, next) => {
  try {
    const station = req.user.role === "kitchen" ? "kitchen" : "juicebar";

    // Get all active orders
    const orders = await Order.find({
      status: { $in: ["pending", "confirmed", "in-progress", "ready"] },
    }).sort({ createdAt: 1 });

    // Filter items by station
    const filteredOrders = orders.map((order) => {
      const menuItemIds = order.items.map((item) => item.itemId);

      return MenuItem.find({ _id: { $in: menuItemIds } }).then((menuItems) => {
        const stationItems = order.items.filter((item) => {
          const menuItem = menuItems.find(
            (m) => m._id.toString() === item.itemId.toString()
          );
          return (
            menuItem && menuItem.prepStation === station && !item.skipKitchen
          );
        });

        if (stationItems.length > 0) {
          return {
            ...order.toObject(),
            items: stationItems,
          };
        }
        return null;
      });
    });

    const resolvedOrders = await Promise.all(filteredOrders);
    const validOrders = resolvedOrders.filter((order) => order !== null);

    res.status(200).json({
      success: true,
      count: validOrders.length,
      data: validOrders,
    });
  } catch (error) {
    logger.error("Get station orders error:", error);
    next(error);
  }
};

/**
 * @desc    Get all orders (Owner)
 * @route   GET /api/orders/all
 * @access  Private (Owner)
 */
exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, startDate, endDate, waitressId } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (waitressId) {
      query.waitressId = waitressId;
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    logger.error("Get all orders error:", error);
    next(error);
  }
};
