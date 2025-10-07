const express = require("express");
const router = express.Router();
const { login, verify, logout } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { validateRequest, schemas } = require("../middleware/validator");

// Public routes
router.post("/login", validateRequest(schemas.login), login);

// Protected routes
router.get("/verify", protect, verify);
router.post("/logout", protect, logout);

module.exports = router;
