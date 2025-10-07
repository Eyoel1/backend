// ============================================
// src/routes/orders.js
// ============================================
const express = require("express");
const router = express.Router();
const {
  createOrder,
  getMyActiveOrders,
  getOrderById,
  editOrder,
  updateOrderStatus,
  cancelOrder,
  getOrdersForStation,
  getAllOrders,
} = require("../controllers/orderController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roleCheck");
const { validateRequest, schemas } = require("../middleware/validator");

// All routes require authentication
router.use(protect);

// Waitress routes
router.post(
  "/",
  authorize("waitress"),
  validateRequest(schemas.createOrder),
  createOrder
);
router.get("/my-active", authorize("waitress"), getMyActiveOrders);
router.patch("/:id", authorize("waitress"), editOrder);
router.patch("/:id/cancel", authorize("waitress"), cancelOrder);

// Kitchen/Juice Bar routes
router.get(
  "/pending-for-station",
  authorize("kitchen", "juicebar"),
  getOrdersForStation
);
router.patch(
  "/:id/status",
  authorize("kitchen", "juicebar"),
  updateOrderStatus
);

// Owner routes
router.get("/all", authorize("owner"), getAllOrders);

// Shared routes (Waitress, Owner)
router.get("/:id", authorize("waitress", "owner"), getOrderById);

module.exports = router;
