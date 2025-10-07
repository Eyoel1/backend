const jwt = require("jsonwebtoken");
const User = require("../models/User");
const logger = require("../utils/logger");

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

/**
 * @desc    Login user with username and PIN
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { username, pin } = req.body;

    // Validate input
    if (!username || !pin) {
      return res.status(400).json({
        success: false,
        message: "Please provide username and PIN",
      });
    }

    // Find user
    const user = await User.findOne({ username: username.toLowerCase() });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if account is active
    if (!user.active) {
      return res.status(401).json({
        success: false,
        message: "Account has been deactivated",
      });
    }

    // Check PIN
    const isPinCorrect = await user.comparePin(pin);

    if (!isPinCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    logger.info(`User ${user.username} (${user.role}) logged in`);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          username: user.username,
          role: user.role,
          lastLogin: user.lastLogin,
        },
      },
    });
  } catch (error) {
    logger.error("Login error:", error);
    next(error);
  }
};

/**
 * @desc    Verify JWT token
 * @route   GET /api/auth/verify
 * @access  Private
 */
exports.verify = async (req, res, next) => {
  try {
    // User is already attached by protect middleware
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          fullName: req.user.fullName,
          username: req.user.username,
          role: req.user.role,
          lastLogin: req.user.lastLogin,
        },
      },
    });
  } catch (error) {
    logger.error("Verify token error:", error);
    next(error);
  }
};

/**
 * @desc    Logout user (client-side token removal)
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res, next) => {
  try {
    logger.info(`User ${req.user.username} logged out`);

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    logger.error("Logout error:", error);
    next(error);
  }
};
