const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
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
    description: {
      en: {
        type: String,
        required: [true, "English description is required"],
      },
      am: {
        type: String,
        required: [true, "Amharic description is required"],
      },
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    pricing: {
      dineIn: {
        type: Number,
        required: [true, "Dine-in price is required"],
        min: [0, "Price cannot be negative"],
      },
      takeaway: {
        type: Number,
        required: [true, "Takeaway price is required"],
        min: [0, "Price cannot be negative"],
      },
    },
    prepStation: {
      type: String,
      enum: ["kitchen", "juicebar"],
      required: [true, "Preparation station is required"],
    },
    prepTime: {
      type: Number,
      default: 15,
      min: [0, "Preparation time cannot be negative"],
    },
    // NEW: Stock tracking
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
        enum: ["pieces", "bottles", "cans", "liters", "servings", "plates"],
        default: "pieces",
      },
      deductOnOrder: {
        type: Boolean,
        default: true,
      },
    },
    addOns: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Addon",
      },
    ],
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

// Indexes
menuItemSchema.index({ categoryId: 1 });
menuItemSchema.index({ prepStation: 1 });
menuItemSchema.index({ available: 1 });
menuItemSchema.index({ "name.en": "text", "name.am": "text" });

// Auto-mark unavailable when stock reaches zero
menuItemSchema.pre("save", function (next) {
  if (this.stockTracking.enabled && this.stockTracking.currentStock <= 0) {
    this.available = false;
  }
  next();
});

module.exports = mongoose.model("MenuItem", menuItemSchema);
