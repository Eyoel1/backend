const express = require("express");
const router = express.Router();
const { login, verify, logout } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { validateRequest, schemas } = require("../middleware/validator");

// Public routes
router.post("/login", validateRequest(schemas.login), login);

// ⚠️ TEMPORARY - Create owner account (REMOVE AFTER USE)
router.post("/create-owner", async (req, res) => {
  try {
    const User = require("../models/User");

    console.log("=== CREATE OWNER REQUEST ===");

    // Check if owner already exists
    const existingOwner = await User.findOne({ role: "owner" });
    if (existingOwner) {
      console.log("Owner already exists:", existingOwner.username);
      return res.status(400).json({
        success: false,
        message: "Owner account already exists",
        owner: {
          username: existingOwner.username,
          fullName: existingOwner.fullName,
          createdAt: existingOwner.createdAt,
        },
      });
    }

    // Create owner account
    const owner = await User.create({
      username: "owner",
      pin: "1234",
      fullName: "Restaurant Owner",
      role: "owner",
      active: true,
    });

    console.log("✅ Owner created successfully:", owner.username);

    res.status(201).json({
      success: true,
      message: "Owner account created successfully! 🎉",
      credentials: {
        username: "owner",
        pin: "1234",
        warning: "⚠️ Please change PIN after first login!",
      },
      nextSteps: [
        "1. Login with username: owner, pin: 1234",
        "2. Go to Settings and change your PIN",
        "3. Create staff accounts (waitress, kitchen, juicebar)",
        "4. IMPORTANT: Remove this /create-owner endpoint from code",
      ],
    });
  } catch (error) {
    console.error("❌ Create owner error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: error.toString(),
    });
  }
});

// Protected routes
router.get("/verify", protect, verify);
router.post("/logout", protect, logout);

module.exports = router;
