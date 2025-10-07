// ============================================
// src/routes/analytics.js
// ============================================
const express = require("express");
const router = express.Router();
const {
  getTodayAnalytics,
  getPeriodAnalytics,
  getWaitressPerformance,
  getCancellations,
  reviewCancellation,
} = require("../controllers/analyticsController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roleCheck");

// All routes require authentication and owner role
router.use(protect);
router.use(authorize("owner"));

// Routes
router.get("/today", getTodayAnalytics);
router.get("/period", getPeriodAnalytics);
router.get("/waitress/:id", getWaitressPerformance);
router.get("/cancellations", getCancellations);
router.patch("/cancellations/:id/review", reviewCancellation);

module.exports = router;
