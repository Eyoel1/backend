const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
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
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "mobile-money", "split"],
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    amountReceived: {
      type: Number,
      required: true,
      min: 0,
    },
    changeDue: {
      type: Number,
      default: 0,
    },
    splitPayments: [
      {
        method: {
          type: String,
          enum: ["cash", "card", "mobile-money"],
        },
        amount: {
          type: Number,
          min: 0,
        },
      },
    ],
    waitressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for analytics queries
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ waitressId: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
