/**
 * Mocha configuration file
 */
module.exports = {
  // Include the setup file before running tests
  require: ["./tests/setup.js"],
  // Other Mocha configuration options can be added here
  timeout: 5000,
  exit: true,
  allowUncaught: false,
};
