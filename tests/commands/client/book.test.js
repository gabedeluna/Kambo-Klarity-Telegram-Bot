// tests/commands/client/book.test.js

const mockNotifier = {
  sendSessionTypeSelector: jest.fn(),
};
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(), // Added warn for completeness, though not directly used in src
  debug: jest.fn(),
};

// Mock dependencies before requiring the module under test
jest.mock("../../../src/tools/telegramNotifier", () => mockNotifier);
jest.mock("../../../src/core/logger", () => mockLogger);

describe("Book Command Handler (src/commands/client/book.js)", () => {
  let initializeBookCommandHandler;
  let handleBookCommand;
  let mockCtx;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules(); // Reset modules to ensure fresh state and mocks
    jest.clearAllMocks(); // Clear all mock function calls

    // Re-require the module under test after resetting modules
    const bookCommandHandler = require("../../../src/commands/client/book");
    initializeBookCommandHandler =
      bookCommandHandler.initializeBookCommandHandler;
    handleBookCommand = bookCommandHandler.handleBookCommand;

    mockCtx = {
      from: { id: "user123" },
      reply: jest.fn().mockResolvedValue(true),
      // Add other ctx properties if needed by the handler
    };

    // Suppress console.error for specific tests if needed
    // consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
      consoleErrorSpy = null; // Reset for next test
    }
  });

  describe("initializeBookCommandHandler", () => {
    it("should initialize successfully with notifier and logger", () => {
      initializeBookCommandHandler({
        notifier: mockNotifier,
        logger: mockLogger,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[bookCommandHandler] Initialized successfully.",
      );
    });

    it("should log an error if notifier is missing", () => {
      consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      initializeBookCommandHandler({ logger: mockLogger }); // Missing notifier
      expect(mockLogger.error).toHaveBeenCalledWith(
        // Changed from consoleErrorSpy
        "[bookCommandHandler] Initialization failed: Missing notifier or logger dependency.",
      );
      // mockLogger.error is expected because logger is provided in deps
    });

    it("should log an error if logger is missing", () => {
      consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      initializeBookCommandHandler({ notifier: mockNotifier }); // Missing logger
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[bookCommandHandler] Initialization failed: Missing notifier or logger dependency.",
      );
    });

    it("should log an error if deps are missing", () => {
      consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      initializeBookCommandHandler(null);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[bookCommandHandler] Initialization failed: Missing notifier or logger dependency.",
      );
    });
  });

  describe("handleBookCommand", () => {
    it("should reply with service unavailable if notifier is not initialized", async () => {
      // Not calling initializeBookCommandHandler to simulate uninitialized state
      consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {}); // Suppress expected error
      await handleBookCommand(mockCtx);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        "Sorry, the booking service is currently unavailable. Please try again later.",
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        // or mockLogger.error if it was initialized
        "[/book] Command handler called but notifier instance is not available. Ensure initializeBookCommandHandler was called with dependencies.",
      );
    });

    describe("when initialized", () => {
      beforeEach(() => {
        // Ensure it's initialized for these tests
        initializeBookCommandHandler({
          notifier: mockNotifier,
          logger: mockLogger,
        });
        // Clear mocks that might have been called during initialization
        mockLogger.info.mockClear();
        mockLogger.error.mockClear();
      });

      it("should call notifier.sendSessionTypeSelector with telegramId", async () => {
        mockNotifier.sendSessionTypeSelector.mockResolvedValueOnce({
          success: true,
        });
        await handleBookCommand(mockCtx);
        expect(mockNotifier.sendSessionTypeSelector).toHaveBeenCalledWith({
          telegramId: "user123",
        });
        expect(mockLogger.info).toHaveBeenCalledWith(
          { userId: "user123" },
          "[/book] Client command received. Calling sendSessionTypeSelector.",
        );
        expect(mockCtx.reply).not.toHaveBeenCalled(); // Notifier handles replies on success
      });

      it("should log error if sendSessionTypeSelector returns success: false", async () => {
        const errorDetails = { message: "Specific notifier error" };
        mockNotifier.sendSessionTypeSelector.mockResolvedValueOnce({
          success: false,
          error: errorDetails,
          warning: "A warning",
        });
        await handleBookCommand(mockCtx);
        expect(mockNotifier.sendSessionTypeSelector).toHaveBeenCalledWith({
          telegramId: "user123",
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          { userId: "user123", error: errorDetails, warning: "A warning" },
          "[/book] sendSessionTypeSelector indicated an issue.",
        );
        // No ctx.reply here as the source code comments suggest notifier might handle it
        // or a specific unhandled error type might trigger a reply.
      });

      it("should reply with an error and log if sendSessionTypeSelector throws an exception", async () => {
        const exception = new Error("Network Error");
        mockNotifier.sendSessionTypeSelector.mockRejectedValueOnce(exception);
        await handleBookCommand(mockCtx);
        expect(mockNotifier.sendSessionTypeSelector).toHaveBeenCalledWith({
          telegramId: "user123",
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          { err: exception, userId: "user123" },
          "[/book] Exception during sendSessionTypeSelector call.",
        );
        expect(mockCtx.reply).toHaveBeenCalledWith(
          "Sorry, an unexpected error occurred while trying to start booking.",
        );
      });
    });
  });
});
