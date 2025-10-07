// ============================================
// src/routes/staff.js
// ============================================
const express = require("express");
const router = express.Router();
const {
  getAllStaff,
  getStaffMember,
  createStaff,
  updateStaff,
  resetPin,
  deleteStaff,
} = require("../controllers/staffController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roleCheck");
const { validateRequest, schemas } = require("../middleware/validator");

// All routes require authentication and owner role
router.use(protect);
router.use(authorize("owner"));

// Routes
router.get("/", getAllStaff);
router.post("/", validateRequest(schemas.createStaff), createStaff);
router.get("/:id", getStaffMember);
router.patch("/:id", updateStaff);
router.patch("/:id/reset-pin", resetPin);
router.delete("/:id", deleteStaff);

module.exports = router;
