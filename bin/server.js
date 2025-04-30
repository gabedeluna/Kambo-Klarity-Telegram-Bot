// Main server startup script

const app = require("../src/app");
const config = require("../src/core/env");
const logger = require("../src/core/logger"); // Keep logger require for the startup block

// Determine port from environment or default to 3000
const PORT = config.PORT || 3000;

// Only start listening if the script is run directly
if (require.main === module) {
  const server = app.listen(PORT, () => {
    logger.info(`[server] Server started successfully.`);
    logger.info(`[server] Listening on port ${PORT}`);
    logger.info(
      `[server] Health check available at http://localhost:${PORT}/health`,
    );
    // Note: The actual webhook URL depends on NGROK_URL + secret path.
    // The secret path component is logged in app.js.
    // For local dev, combine NGROK_URL and that path.
  });

  // Handle potential errors during server startup
  server.on("error", (error) => {
    if (error.syscall !== "listen") {
      throw error;
    }

    // Handle specific listen errors with friendly messages
    switch (error.code) {
      case "EACCES":
        logger.error(`[server] Port ${PORT} requires elevated privileges.`);
        process.exit(1);
        break;
      case "EADDRINUSE":
        logger.error(`[server] Port ${PORT} is already in use.`);
        process.exit(1);
        break;
      default:
        throw error;
    }
  });
}

// Export the Express app instance for testing
module.exports = app;
