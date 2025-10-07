const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MenuItem",
    required: true,
  },
  name: {
    en: { type: String, required: true },
    am: { type: String, required: true },
  },
  variant: {
    type: String,
    default: "",
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  pricePerUnit: {
    type: Number,
    required: true,
    min: 0,
  },
  addOns: [
    {
      addonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Addon",
      },
      name: {
        en: String,
        am: String,
      },
      price: {
        type: Number,
        min: 0,
      },
    },
  ],
  specialNotes: {
    type: String,
    default: "",
  },
  subtotal: {
    type: Number,
    required: true,
  },
  autoComplete: {
    type: Boolean,
    default: false,
  },
  skipKitchen: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ["pending", "in-progress", "ready"],
    default: "pending",
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderType: {
      type: String,
      enum: ["dine-in", "takeaway"],
      required: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: "",
    },
    customerPhone: {
      type: String,
      trim: true,
      default: "",
    },
    waitressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    waitressName: {
      type: String,
      required: true,
    },
    items: [orderItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "in-progress",
        "ready",
        "completed",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },
    graceWindowEndsAt: {
      type: Date,
      required: true,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancellationReason: {
      type: String,
    },
    cancellationPhase: {
      type: String,
      enum: ["grace_window", "confirmed", "in_progress", "ready"],
    },
    cancellationDetails: {
      type: String,
    },
    wasteCost: {
      type: Number,
      default: 0,
    },
    wastedItems: [
      {
        itemId: mongoose.Schema.Types.ObjectId,
        itemName: String,
        quantity: Number,
        cost: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
orderSchema.index({ createdAt: -1, status: 1 });
orderSchema.index({ waitressId: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });

// Calculate item-level status for mixed orders
orderSchema.methods.updateOverallStatus = function () {
  const statuses = this.items.map((item) => item.status);

  if (statuses.every((s) => s === "ready")) {
    this.status = "ready";
  } else if (statuses.some((s) => s === "in-progress")) {
    this.status = "in-progress";
  } else if (statuses.every((s) => s === "pending")) {
    this.status = this.graceWindowEndsAt > new Date() ? "pending" : "confirmed";
  }
};

module.exports = mongoose.model("Order", orderSchema);
