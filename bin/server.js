// Main server startup script

const app = require("../src/app");
const config = require("../src/core/env");

// Determine port from environment or default to 3000
const PORT = config.PORT || 3000;

// Start the server
const server = app.listen(PORT, () => {
  console.log(`✅ [server] Server started successfully.`);
  console.log(`👂 [server] Listening on port ${PORT}`);
  console.log(
    `➡️ [server] Health check available at http://localhost:${PORT}/health`,
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
      console.error(`❌ [server] Port ${PORT} requires elevated privileges.`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(`❌ [server] Port ${PORT} is already in use.`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Export the server instance for testing or programmatic control
module.exports = server;
