const logger = require("../utils/logger");

/**
 * Initialize Socket.IO event handlers
 * @param {SocketIO} io - Socket.IO instance
 */
const initSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    logger.info(`🔌 Client connected: ${socket.id}`);

    /**
     * User joins role-based and user-specific rooms
     * Data: { role, userId, username }
     */
    socket.on("join-room", (data) => {
      const { role, userId, username } = data;

      // Join role-based room
      socket.join(role);
      logger.info(`User ${username} (${userId}) joined room: ${role}`);

      // Join user-specific room
      socket.join(`user-${userId}`);
      logger.info(`User ${username} joined personal room: user-${userId}`);

      // Send confirmation
      socket.emit("joined-room", {
        success: true,
        room: role,
        userId,
      });
    });

    /**
     * Leave a room
     * Data: { room }
     */
    socket.on("leave-room", (data) => {
      const { room } = data;
      socket.leave(room);
      logger.info(`Socket ${socket.id} left room: ${room}`);
    });

    /**
     * Manual sync request from offline client
     * Data: { userId }
     */
    socket.on("request-sync", async (data) => {
      const { userId } = data;
      logger.info(`Sync requested by user: ${userId}`);

      // In a real implementation, you would fetch latest data
      // and send it back to the client
      socket.emit("sync-data", {
        success: true,
        timestamp: new Date().toISOString(),
        message: "Sync completed",
      });
    });

    /**
     * Ping for connection health check
     */
    socket.on("ping", () => {
      socket.emit("pong", {
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * Kitchen/Juice Bar confirms order received
     * Data: { orderId, orderNumber }
     */
    socket.on("order-acknowledged", (data) => {
      const { orderId, orderNumber, station } = data;
      logger.info(`Order ${orderNumber} acknowledged by ${station}`);

      // Optionally emit back to waitress
      io.emit("order-acknowledgement", {
        orderId,
        orderNumber,
        station,
        acknowledgedAt: new Date().toISOString(),
      });
    });

    /**
     * Request current orders (for reconnection scenarios)
     * Data: { role }
     */
    socket.on("request-current-orders", async (data) => {
      const { role } = data;
      logger.info(`Current orders requested by ${role}`);

      // This would typically fetch from database
      // For now, just acknowledge
      socket.emit("current-orders-response", {
        success: true,
        message: "Use API endpoint to fetch current orders",
      });
    });

    /**
     * Broadcast message to all connected clients
     * Data: { message, from }
     */
    socket.on("broadcast-message", (data) => {
      const { message, from } = data;
      logger.info(`Broadcasting message from ${from}: ${message}`);

      io.emit("system-message", {
        message,
        from,
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * Handle disconnection
     */
    socket.on("disconnect", (reason) => {
      logger.info(`🔌 Client disconnected: ${socket.id} (${reason})`);
    });

    /**
     * Handle connection errors
     */
    socket.on("error", (error) => {
      logger.error(`Socket error on ${socket.id}:`, error);
    });
  });

  // Return io for use in other parts of the app
  return io;
};

/**
 * Helper function to emit order events
 * Can be called from controllers
 */
const emitOrderEvent = (io, event, data) => {
  io.emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
  logger.info(`Event emitted: ${event}`);
};

/**
 * Emit to specific room
 */
const emitToRoom = (io, room, event, data) => {
  io.to(room).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
  logger.info(`Event emitted to ${room}: ${event}`);
};

/**
 * Emit to specific user
 */
const emitToUser = (io, userId, event, data) => {
  io.to(`user-${userId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
  logger.info(`Event emitted to user ${userId}: ${event}`);
};

module.exports = {
  initSocketHandlers,
  emitOrderEvent,
  emitToRoom,
  emitToUser,
};
