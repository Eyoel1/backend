// ============================================
// src/routes/settings.js
// ============================================
const express = require("express");
const router = express.Router();
const {
  getSettings,
  updateAppearance,
  updateOrderManagement,
  updateTakeawayPricing,
  clearKitchenDisplay,
  clearJuicebarDisplay,
  resetAnalytics,
  startNewDay,
} = require("../controllers/settingsController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roleCheck");

// All routes require authentication
router.use(protect);

// All authenticated users can view settings
router.get("/", getSettings);

// Owner only routes
router.patch("/appearance", authorize("owner"), updateAppearance);
router.patch("/order-management", authorize("owner"), updateOrderManagement);
router.patch("/takeaway-pricing", authorize("owner"), updateTakeawayPricing);
router.post("/clear-kitchen-display", authorize("owner"), clearKitchenDisplay);
router.post(
  "/clear-juicebar-display",
  authorize("owner"),
  clearJuicebarDisplay
);
router.post("/reset-analytics", authorize("owner"), resetAnalytics);
router.post("/start-new-day", authorize("owner"), startNewDay);

module.exports = router;
