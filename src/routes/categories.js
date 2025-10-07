// ============================================
// src/routes/categories.js
// ============================================
const express = require("express");
const router = express.Router();
const {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roleCheck");

// All routes require authentication
router.use(protect);

// All authenticated users can view categories
router.get("/", getAllCategories);

// Owner only routes
router.post("/", authorize("owner"), createCategory);
router.patch("/:id", authorize("owner"), updateCategory);
router.delete("/:id", authorize("owner"), deleteCategory);

module.exports = router;
