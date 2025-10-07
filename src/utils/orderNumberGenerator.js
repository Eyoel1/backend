const Order = require("../models/Order");

/**
 * Generate unique order number in format: ORD-YYYYMMDD-XXXX
 * Example: ORD-20250105-0001
 */
const generateOrderNumber = async () => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

  // Find the last order of today
  const lastOrder = await Order.findOne({
    orderNumber: new RegExp(`^ORD-${dateStr}-`),
  }).sort({ orderNumber: -1 });

  let sequence = 1;
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.orderNumber.split("-")[2]);
    sequence = lastSequence + 1;
  }

  const orderNumber = `ORD-${dateStr}-${sequence.toString().padStart(4, "0")}`;
  return orderNumber;
};

module.exports = { generateOrderNumber };
