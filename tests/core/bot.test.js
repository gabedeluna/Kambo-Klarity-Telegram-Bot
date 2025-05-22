// tests/core/bot.test.js

// Define a mock instance that the Telegraf constructor will return
const mockTelegrafInstance = {
  // Add any methods or properties that bot.js or other parts of your app might use
  // e.g., start: jest.fn(), use: jest.fn(), launch: jest.fn()
  // For this specific module (bot.js), it just instantiates, so an empty object might suffice
  // or one with a distinct property to ensure it's our mock.
  _isMockTelegrafInstance: true,
};

// This is the mock for the Telegraf class constructor
const MockTelegrafConstructor = jest.fn(() => mockTelegrafInstance);

// Mock dependencies
jest.mock("telegraf", () => ({
  Telegraf: MockTelegrafConstructor, // Ensure 'Telegraf' is capitalized as it's a class
}));

// This import is fine, 'Telegraf' here will be MockTelegrafConstructor due to jest.mock hoisting
const { Telegraf } = require("telegraf"); // Telegraf here is actually MockTelegrafConstructor

const mockEnvConfig = {
  tgToken: "test-bot-token-from-env",
};
jest.mock("../../src/core/env", () => mockEnvConfig);

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(), // In case any errors were logged, though not expected here
};
jest.mock("../../src/core/logger", () => mockLogger);

describe("Core Bot Initialization", () => {
  let botInstance;

  beforeEach(() => {
    // Reset modules to ensure mocks are fresh for each test
    jest.resetModules();
    // Clear mock calls
    jest.clearAllMocks(); // Clears all mocks, including Telegraf (MockTelegrafConstructor)
    // MockTelegrafConstructor.mockClear(); // Explicitly clear if needed, but clearAllMocks should cover it.

    // Dynamically require the module under test after mocks are set up
    // This ensures it uses the mocked dependencies
    botInstance = require("../../src/core/bot");
  });

  it("should create a Telegraf instance", () => {
    expect(Telegraf).toHaveBeenCalledTimes(1);
  });

  it("should initialize Telegraf with the token from env config", () => {
    expect(Telegraf).toHaveBeenCalledWith(mockEnvConfig.tgToken);
  });

  it("should log an info message upon initialization", () => {
    // The logger.info call happens at the module level when bot.js is imported.
    // So, by the time this test runs, it should have already been called.
    expect(mockLogger.info).toHaveBeenCalledWith(
      "[core/bot] Telegraf bot instance initialized.",
    );
  });

  it("should export the Telegraf instance", () => {
    // Telegraf.mock.instances will contain all instances created by the mocked constructor
    // expect(botInstance).toBeInstanceOf(Telegraf); // Telegraf is the mock constructor, not the class itself for instanceof
    expect(botInstance).toBe(mockTelegrafInstance); // Check if it's the instance our mock constructor returned
    // expect(MockTelegrafConstructor.mock.instances[0]).toBe(mockTelegrafInstance); // This checks the 'this' context, not the return value
  });

  it("should use the correct token if env config changes between tests (demonstrating resetModules)", () => {
    // This test demonstrates the effect of jest.resetModules()
    // Change the mocked token for a new require of bot.js
    const newToken = "new-test-token-for-this-test";
    mockEnvConfig.tgToken = newToken; // Modify the exported object from the mock

    // Re-require bot.js after resetting modules and changing mock config
    jest.resetModules();
    const newBotInstance = require("../../src/core/bot");

    expect(Telegraf).toHaveBeenCalledWith(newToken);
    // expect(newBotInstance).toBeInstanceOf(Telegraf);
    expect(newBotInstance).toBe(mockTelegrafInstance); // Should be a new instance, but our mock always returns the same one
                                                    // unless we make MockTelegrafConstructor return new {} each time.
                                                    // For this test, verifying it's *an* instance from our mock is key.
    // If MockTelegrafConstructor was cleared, this would be the first instance in the new list.
    // If not cleared, it would be the second. Since we do clearAllMocks, it's the first of this 'require' cycle.
    // expect(MockTelegrafConstructor.mock.instances[0]).toBe(mockTelegrafInstance);

    // Restore original token for other tests if necessary, though resetModules handles it
    mockEnvConfig.tgToken = "test-bot-token-from-env";
  });
});