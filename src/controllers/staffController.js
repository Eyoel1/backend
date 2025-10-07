// ============================================
// src/controllers/staffController.js
// ============================================
const User = require("../models/User");
const Order = require("../models/Order");
const logger = require("../utils/logger");

/**
 * @desc    Get all staff members
 * @route   GET /api/staff
 * @access  Private (Owner)
 */
exports.getAllStaff = async (req, res, next) => {
  try {
    const { role, active } = req.query;
    const query = {};

    if (role) query.role = role;
    if (active !== undefined) query.active = active === "true";

    const staff = await User.find(query).select("-pin").sort({ createdAt: -1 });

    // Get today's performance for each staff member
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const staffWithPerformance = await Promise.all(
      staff.map(async (member) => {
        if (member.role === "waitress") {
          const todayOrders = await Order.countDocuments({
            waitressId: member._id,
            createdAt: { $gte: today },
            status: { $ne: "cancelled" },
          });

          const todayRevenue = await Order.aggregate([
            {
              $match: {
                waitressId: member._id,
                createdAt: { $gte: today },
                status: "completed",
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$grandTotal" },
              },
            },
          ]);

          return {
            ...member.toObject(),
            todayPerformance: {
              orders: todayOrders,
              revenue: todayRevenue[0]?.total || 0,
            },
          };
        }

        return member.toObject();
      })
    );

    res.status(200).json({
      success: true,
      count: staffWithPerformance.length,
      data: staffWithPerformance,
    });
  } catch (error) {
    logger.error("Get all staff error:", error);
    next(error);
  }
};

/**
 * @desc    Get single staff member
 * @route   GET /api/staff/:id
 * @access  Private (Owner)
 */
exports.getStaffMember = async (req, res, next) => {
  try {
    const staff = await User.findById(req.params.id).select("-pin");

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    // Get performance history for waitresses
    let performanceData = null;
    if (staff.role === "waitress") {
      const totalOrders = await Order.countDocuments({
        waitressId: staff._id,
        status: { $ne: "cancelled" },
      });

      const totalRevenue = await Order.aggregate([
        {
          $match: {
            waitressId: staff._id,
            status: "completed",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$grandTotal" },
          },
        },
      ]);

      const totalCancellations = await Order.countDocuments({
        waitressId: staff._id,
        status: "cancelled",
      });

      performanceData = {
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalCancellations,
        averageOrderValue:
          totalOrders > 0 ? (totalRevenue[0]?.total || 0) / totalOrders : 0,
      };
    }

    res.status(200).json({
      success: true,
      data: {
        ...staff.toObject(),
        performance: performanceData,
      },
    });
  } catch (error) {
    logger.error("Get staff member error:", error);
    next(error);
  }
};

/**
 * @desc    Create new staff member
 * @route   POST /api/staff
 * @access  Private (Owner)
 */
exports.createStaff = async (req, res, next) => {
  try {
    const { fullName, username, pin, role } = req.body;

    // Check if username already exists
    const existingUser = await User.findOne({
      username: username.toLowerCase(),
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
      });
    }

    // Validate PIN is 4 digits
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: "PIN must be exactly 4 digits",
      });
    }

    // Create staff member
    const staff = await User.create({
      fullName,
      username: username.toLowerCase(),
      pin,
      role,
      active: true,
      createdBy: req.user._id,
    });

    // Emit Socket.IO event
    const io = req.app.get("io");
    io.to("owner").emit("staff-created", {
      staffId: staff._id,
      fullName: staff.fullName,
      role: staff.role,
    });

    logger.info(
      `Staff member ${fullName} (${role}) created by ${req.user.username}`
    );

    res.status(201).json({
      success: true,
      message: "Staff member created successfully",
      data: staff,
    });
  } catch (error) {
    logger.error("Create staff error:", error);
    next(error);
  }
};

/**
 * @desc    Update staff member
 * @route   PATCH /api/staff/:id
 * @access  Private (Owner)
 */
exports.updateStaff = async (req, res, next) => {
  try {
    let staff = await User.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    const { fullName, username, role, active } = req.body;

    // If updating username, check uniqueness
    if (username && username.toLowerCase() !== staff.username) {
      const existingUser = await User.findOne({
        username: username.toLowerCase(),
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Username already exists",
        });
      }
      staff.username = username.toLowerCase();
    }

    if (fullName) staff.fullName = fullName;
    if (role) staff.role = role;
    if (active !== undefined) staff.active = active;

    staff.updatedBy = req.user._id;
    await staff.save();

    // Emit Socket.IO event
    const io = req.app.get("io");
    io.to(`user-${staff._id}`).emit("account-updated", {
      message: "Your account has been updated",
      active: staff.active,
    });

    logger.info(
      `Staff member ${staff.fullName} updated by ${req.user.username}`
    );

    res.status(200).json({
      success: true,
      message: "Staff member updated successfully",
      data: staff,
    });
  } catch (error) {
    logger.error("Update staff error:", error);
    next(error);
  }
};

/**
 * @desc    Reset staff PIN
 * @route   PATCH /api/staff/:id/reset-pin
 * @access  Private (Owner)
 */
exports.resetPin = async (req, res, next) => {
  try {
    const { newPin } = req.body;

    // Validate PIN is 4 digits
    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({
        success: false,
        message: "PIN must be exactly 4 digits",
      });
    }

    const staff = await User.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    staff.pin = newPin;
    staff.updatedBy = req.user._id;
    await staff.save();

    logger.info(`PIN reset for ${staff.fullName} by ${req.user.username}`);

    res.status(200).json({
      success: true,
      message: "PIN reset successfully",
    });
  } catch (error) {
    logger.error("Reset PIN error:", error);
    next(error);
  }
};

/**
 * @desc    Deactivate/Delete staff member
 * @route   DELETE /api/staff/:id
 * @access  Private (Owner)
 */
exports.deleteStaff = async (req, res, next) => {
  try {
    const staff = await User.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    // Don't allow deleting yourself
    if (staff._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    // Soft delete by deactivating
    staff.active = false;
    staff.updatedBy = req.user._id;
    await staff.save();

    // Emit Socket.IO event to force logout
    const io = req.app.get("io");
    io.to(`user-${staff._id}`).emit("account-deactivated", {
      message: "Your account has been deactivated. Please contact the owner.",
    });

    logger.info(
      `Staff member ${staff.fullName} deactivated by ${req.user.username}`
    );

    res.status(200).json({
      success: true,
      message: "Staff member deactivated successfully",
    });
  } catch (error) {
    logger.error("Delete staff error:", error);
    next(error);
  }
};
