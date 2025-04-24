/**
 * Unit tests for the logger module
 */
const { expect } = require("chai");

describe("Logger Module", () => {
  let logger;

  beforeEach(() => {
    // Clear the require cache to ensure fresh logger instance
    delete require.cache[require.resolve("../../core/logger")];
  });

  it("should export a logger instance", () => {
    logger = require("../../core/logger");
    expect(logger).to.be.an("object");
  });

  it("exported logger should have standard methods", () => {
    logger = require("../../core/logger");
    expect(logger.info).to.be.a("function");
    expect(logger.error).to.be.a("function");
    expect(logger.warn).to.be.a("function");
    expect(logger.debug).to.be.a("function");
    expect(logger.trace).to.be.a("function");
    expect(logger.fatal).to.be.a("function");
  });
});
