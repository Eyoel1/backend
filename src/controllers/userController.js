// backend/src/controllers/userController.js
const User = require("../models/User");
const logger = require("../utils/logger");

/**
 * @desc    Get all users
 * @route   GET /api/users
 * @access  Private (Owner)
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-pin").sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    logger.error("Get all users error:", error);
    next(error);
  }
};

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @access  Private (Owner)
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-pin");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error("Get user error:", error);
    next(error);
  }
};

/**
 * @desc    Create user
 * @route   POST /api/users
 * @access  Private (Owner)
 */
exports.createUser = async (req, res, next) => {
  try {
    const { username, pin, fullName, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      username: username.toLowerCase(),
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
      });
    }

    // Validate role
    const validRoles = ["waitress", "kitchen", "juicebar"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be waitress, kitchen, or juicebar",
      });
    }

    // Create user
    const user = await User.create({
      username: username.toLowerCase(),
      pin,
      fullName,
      role,
      active: true,
    });

    // Remove pin from response
    const userResponse = user.toObject();
    delete userResponse.pin;

    logger.info(`User ${username} created by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: userResponse,
    });
  } catch (error) {
    logger.error("Create user error:", error);
    next(error);
  }
};

/**
 * @desc    Update user
 * @route   PATCH /api/users/:id
 * @access  Private (Owner)
 */
exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent updating owner account
    if (user.role === "owner") {
      return res.status(403).json({
        success: false,
        message: "Cannot modify owner account",
      });
    }

    const { fullName, role, active, pin } = req.body;

    // Update allowed fields
    if (fullName !== undefined) user.fullName = fullName;
    if (role !== undefined) {
      const validRoles = ["waitress", "kitchen", "juicebar"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role",
        });
      }
      user.role = role;
    }
    if (active !== undefined) user.active = active;
    if (pin) user.pin = pin; // PIN will be hashed by pre-save hook

    await user.save();

    // Remove pin from response
    const userResponse = user.toObject();
    delete userResponse.pin;

    logger.info(`User ${user.username} updated by ${req.user.username}`);

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: userResponse,
    });
  } catch (error) {
    logger.error("Update user error:", error);
    next(error);
  }
};

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:id
 * @access  Private (Owner)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent deleting owner account
    if (user.role === "owner") {
      return res.status(403).json({
        success: false,
        message: "Cannot delete owner account",
      });
    }

    await user.deleteOne();

    logger.info(`User ${user.username} deleted by ${req.user.username}`);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    logger.error("Delete user error:", error);
    next(error);
  }
};
