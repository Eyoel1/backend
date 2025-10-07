const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const addonController = require("../controllers/addonController");

// All routes require authentication
router.use(protect);

// Get all addons - accessible to all authenticated users (waitress, kitchen, owner)
router.get("/", addonController.getAllAddons);

// Owner-only routes
router.post("/", authorize("owner"), addonController.createAddon);
router.patch("/:id", authorize("owner"), addonController.updateAddon);
router.delete("/:id", authorize("owner"), addonController.deleteAddon);

module.exports = router;
