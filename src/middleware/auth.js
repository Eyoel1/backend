const jwt = require("jsonwebtoken");
const User = require("../models/User");
const logger = require("../utils/logger");

const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id).select("-pin");

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      if (!req.user.active) {
        return res.status(401).json({
          success: false,
          message: "Account has been deactivated",
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, token failed",
      });
    }
  } catch (error) {
    logger.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Server error in authentication",
    });
  }
};

/**
 * Authorize specific roles
 * Usage: authorize("owner"), authorize("owner", "kitchen")
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(
        `Unauthorized access attempt by ${req.user.username} (${req.user.role}) to ${req.method} ${req.originalUrl}`
      );
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }

    next();
  };
};

module.exports = { protect, authorize };
