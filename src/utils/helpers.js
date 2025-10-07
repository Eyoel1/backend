/**
 * Calculate order subtotal from items
 */
const calculateOrderSubtotal = (items) => {
  return items.reduce((total, item) => {
    const itemSubtotal = item.pricePerUnit * item.quantity;
    const addOnsTotal =
      item.addOns.reduce((sum, addon) => sum + addon.price, 0) * item.quantity;
    return total + itemSubtotal + addOnsTotal;
  }, 0);
};

/**
 * Calculate grace window end time
 */
const calculateGraceWindowEnd = (graceWindowMinutes = 3) => {
  const now = new Date();
  return new Date(now.getTime() + graceWindowMinutes * 60000);
};

/**
 * Check if order is within grace window
 */
const isWithinGraceWindow = (order) => {
  if (!order.graceWindowEndsAt) return false;
  return new Date() < new Date(order.graceWindowEndsAt);
};

/**
 * Format currency for display
 */
const formatCurrency = (amount, language = "en") => {
  const formatted = amount.toFixed(2);
  return language === "am" ? `${formatted} ብር` : `$${formatted}`;
};

/**
 * Sanitize user input
 */
const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;
  return input.trim().replace(/[<>]/g, "");
};

/**
 * Generate error response
 */
const errorResponse = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Success response helper
 */
const successResponse = (res, data, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

module.exports = {
  calculateOrderSubtotal,
  calculateGraceWindowEnd,
  isWithinGraceWindow,
  formatCurrency,
  sanitizeInput,
  errorResponse,
  successResponse,
};
