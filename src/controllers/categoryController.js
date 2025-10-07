const Category = require("../models/Category");
const MenuItem = require("../models/MenuItem");
const logger = require("../utils/logger");

/**
 * @desc    Get all categories
 * @route   GET /api/categories
 * @access  Private
 */
exports.getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ "name.en": 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    logger.error("Get categories error:", error);
    next(error);
  }
};

/**
 * @desc    Create category
 * @route   POST /api/categories
 * @access  Private (Owner)
 */
exports.createCategory = async (req, res, next) => {
  try {
    const { name, prepStation, requiresPreparation, autoDeductStock } =
      req.body;

    const category = await Category.create({
      name,
      prepStation: prepStation || "kitchen",
      requiresPreparation:
        requiresPreparation !== undefined ? requiresPreparation : true,
      autoDeductStock: autoDeductStock || false,
      createdBy: req.user._id,
    });

    // Emit Socket.IO event
    const io = req.app.get("io");
    io.emit("category-added", { category });

    logger.info(`Category ${name.en} created by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    logger.error("Create category error:", error);
    next(error);
  }
};

/**
 * @desc    Update category
 * @route   PATCH /api/categories/:id
 * @access  Private (Owner)
 */
exports.updateCategory = async (req, res, next) => {
  try {
    let category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const { name, prepStation, requiresPreparation, autoDeductStock } =
      req.body;

    if (name) category.name = name;
    if (prepStation) category.prepStation = prepStation;
    if (requiresPreparation !== undefined)
      category.requiresPreparation = requiresPreparation;
    if (autoDeductStock !== undefined)
      category.autoDeductStock = autoDeductStock;

    await category.save();

    // Emit Socket.IO event
    const io = req.app.get("io");
    io.emit("category-updated", { category });

    logger.info(`Category ${category.name.en} updated by ${req.user.username}`);

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    logger.error("Update category error:", error);
    next(error);
  }
};

/**
 * @desc    Delete category
 * @route   DELETE /api/categories/:id
 * @access  Private (Owner)
 */
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if any menu items use this category
    const itemCount = await MenuItem.countDocuments({
      categoryId: req.params.id,
    });

    if (itemCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. ${itemCount} menu items are using it.`,
      });
    }

    await category.deleteOne();

    // Emit Socket.IO event
    const io = req.app.get("io");
    io.emit("category-deleted", { categoryId: req.params.id });

    logger.info(`Category ${category.name.en} deleted by ${req.user.username}`);

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    logger.error("Delete category error:", error);
    next(error);
  }
};
