const mongoose = require("mongoose");

const addonSchema = new mongoose.Schema(
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
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    // Changed to array to allow multiple categories
    categories: {
      type: [String],
      enum: ["kitchen", "juicebar"],
      default: ["kitchen", "juicebar"], // Available for both by default
      required: true,
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "At least one category must be selected",
      },
    },
    // Stock tracking
    stockTracking: {
      enabled: {
        type: Boolean,
        default: false,
      },
      currentStock: {
        type: Number,
        default: 0,
        min: 0,
      },
      minStock: {
        type: Number,
        default: 0,
      },
      unit: {
        type: String,
        enum: ["pieces", "bottles", "cans", "liters", "ml", "grams", "kg"],
        default: "pieces",
      },
      deductOnUse: {
        type: Boolean,
        default: true,
      },
    },
    isOptional: {
      type: Boolean,
      default: true,
    },
    available: {
      type: Boolean,
      default: true,
    },
    imageUrl: {
      type: String,
      default: "",
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

// Index for performance
addonSchema.index({ "name.en": 1 });
addonSchema.index({ categories: 1 });
addonSchema.index({ available: 1 });

// Auto-mark unavailable when stock reaches zero
addonSchema.pre("save", function (next) {
  if (this.stockTracking.enabled && this.stockTracking.currentStock <= 0) {
    this.available = false;
  }
  next();
});

module.exports = mongoose.model("Addon", addonSchema);
