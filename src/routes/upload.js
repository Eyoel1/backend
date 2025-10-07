// ============================================
// src/routes/upload.js
// ============================================
const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/roleCheck");
const logger = require("../utils/logger");

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
});

/**
 * @desc    Upload menu item image to Cloudinary
 * @route   POST /api/upload/menu-image
 * @access  Private (Owner)
 */
router.post(
  "/menu-image",
  protect,
  authorize("owner"),
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file provided",
        });
      }

      // Upload to Cloudinary
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "inat-food-pos/menu-items",
          transformation: [
            { width: 800, height: 800, crop: "limit" },
            { quality: "auto" },
            { fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) {
            logger.error("Cloudinary upload error:", error);
            return res.status(500).json({
              success: false,
              message: "Failed to upload image",
            });
          }

          logger.info(`Image uploaded to Cloudinary: ${result.public_id}`);

          res.status(200).json({
            success: true,
            message: "Image uploaded successfully",
            data: {
              imageUrl: result.secure_url,
              imagePublicId: result.public_id,
              width: result.width,
              height: result.height,
              format: result.format,
            },
          });
        }
      );

      // Pipe the buffer to Cloudinary
      const bufferStream = require("stream").Readable.from(req.file.buffer);
      bufferStream.pipe(uploadStream);
    } catch (error) {
      logger.error("Upload route error:", error);
      next(error);
    }
  }
);

/**
 * @desc    Delete image from Cloudinary
 * @route   DELETE /api/upload/menu-image/:publicId
 * @access  Private (Owner)
 */
router.delete(
  "/menu-image/:publicId",
  protect,
  authorize("owner"),
  async (req, res, next) => {
    try {
      const publicId = req.params.publicId.replace(/--/g, "/"); // Convert back to path

      const result = await cloudinary.uploader.destroy(publicId);

      if (result.result === "ok") {
        logger.info(`Image deleted from Cloudinary: ${publicId}`);

        res.status(200).json({
          success: true,
          message: "Image deleted successfully",
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Image not found",
        });
      }
    } catch (error) {
      logger.error("Delete image error:", error);
      next(error);
    }
  }
);

// Error handling for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB.",
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next(error);
});

module.exports = router;
