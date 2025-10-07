// ============================================
// src/routes/payments.js
// ============================================
const express = require("express");
const router = express.Router();
const {
  processPayment,
  getDailyPayments,
} = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roleCheck");

// All routes require authentication
router.use(protect);

// Waitress routes
router.post("/", authorize("waitress"), processPayment);

// Owner routes
router.get("/daily", authorize("owner"), getDailyPayments);

module.exports = router;
