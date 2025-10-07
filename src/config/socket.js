const { Server } = require("socket.io");
const logger = require("../utils/logger");

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
    },
  });

  // Connection handling
  io.on("connection", (socket) => {
    logger.info(`🔌 Client connected: ${socket.id}`);

    // Join room based on user role
    socket.on("join-room", (data) => {
      const { role, userId } = data;
      socket.join(role); // Join role-based room (kitchen, juicebar, waitress, owner)
      socket.join(`user-${userId}`); // Join user-specific room
      logger.info(`User ${userId} joined room: ${role}`);
    });

    // Disconnect handling
    socket.on("disconnect", () => {
      logger.info(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = initSocket;
