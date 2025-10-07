const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      en: {
        type: String,
        required: [true, "English name is required"],
        trim: true,
      },
      am: {
        type: String,
        required: [true, "Amharic name is required"],
        trim: true,
      },
    },
    prepStation: {
      type: String,
      enum: ["kitchen", "juicebar", "none"],
      default: "kitchen",
    },
    requiresPreparation: {
      type: Boolean,
      default: true,
    },
    autoDeductStock: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
categorySchema.index({ "name.en": 1 });
categorySchema.index({ prepStation: 1 });

module.exports = mongoose.model("Category", categorySchema);
