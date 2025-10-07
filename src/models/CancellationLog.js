const mongoose = require("mongoose");

const cancellationLogSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    orderNumber: {
      type: String,
      required: true,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cancelledByName: {
      type: String,
      required: true,
    },
    phase: {
      type: String,
      enum: ["grace_window", "confirmed", "in_progress", "ready"],
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    details: {
      type: String,
      default: "",
    },
    itemsLost: [
      {
        itemId: mongoose.Schema.Types.ObjectId,
        itemName: {
          en: String,
          am: String,
        },
        quantity: Number,
        pricePerUnit: Number,
      },
    ],
    wasteCost: {
      type: Number,
      default: 0,
    },
    requiresReview: {
      type: Boolean,
      default: false,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for owner review queries
cancellationLogSchema.index({ requiresReview: 1, createdAt: -1 });
cancellationLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("CancellationLog", cancellationLogSchema);
