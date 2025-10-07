// server.js - Main entry point for INAT FOOD POS Backend
require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const connectDB = require("./src/config/database");
const initSocket = require("./src/config/socket");
const logger = require("./src/utils/logger");

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server);

// Make io accessible to routes
app.set("io", io);

// Connect to database
connectDB();

// Start server
server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📱 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🔌 Socket.IO initialized`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection:", err);
  server.close(() => process.exit(1));
});
