// ============================================
// src/routes/menuRoutes.js
// ============================================
const express = require("express");
const router = express.Router();
const {
  getActiveMenuItems,
  getAllMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
  updateStock,
  deductStock,
} = require("../controllers/menuController");
const { protect, authorize } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

// Public to all authenticated users
router.get("/active", getActiveMenuItems);

// Owner only routes
router.get("/", authorize("owner"), getAllMenuItems);
router.post("/", authorize("owner"), createMenuItem);
router.get("/:id", authorize("owner"), getMenuItem);
router.patch("/:id", authorize("owner"), updateMenuItem);
router.delete("/:id", authorize("owner"), deleteMenuItem);

// Stock management routes
router.patch("/:id/stock", authorize("owner"), updateStock);
router.post("/stock/deduct", deductStock); // Called automatically during order creation

// Owner and Kitchen can toggle availability
router.patch(
  "/:id/availability",
  authorize("owner", "kitchen", "juicebar"),
  toggleAvailability
);

module.exports = router;
