const mongoose = require("mongoose");

const restaurantSettingsSchema = new mongoose.Schema(
  {
    language: {
      type: String,
      enum: ["en", "am"],
      default: "am", // Default to Amharic as per specification
    },
    theme: {
      type: String,
      enum: ["light", "dark", "auto"],
      default: "light",
    },
    graceWindowMinutes: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    takeawayPricing: {
      policy: {
        type: String,
        enum: ["same-as-dinein", "percentage-discount", "custom-per-item"],
        default: "same-as-dinein",
      },
      discountPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Singleton pattern - only one settings document
restaurantSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model("RestaurantSettings", restaurantSettingsSchema);
