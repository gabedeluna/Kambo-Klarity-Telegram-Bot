// tests/middleware/updateRouter.test.js

const { Markup } = require("telegraf");
const { initialize } = require("../../src/middleware/updateRouter");

jest.mock("telegraf", () => ({
  Markup: {
    inlineKeyboard: jest.fn((buttons) => ({
      inline_keyboard: buttons, // Simulate Telegraf's structure
    })),
    button: {
      webApp: jest.fn((text, url) => ({ text, web_app: { url } })),
    },
  },
}));

describe("updateRouter Middleware", () => {
  let mockLogger;
  let mockCommandHandler;
  let mockCallbackQueryHandler;
  let mockConfig;
  let mockCtx;
  let mockNext;
  let consoleErrorSpy;
  let consoleLogSpy; // To suppress verbose logging from the module

  beforeEach(() => {
    jest.resetModules(); // Ensures `initialize` is fresh if module state matters
    // const { initialize } = require("../../src/middleware/updateRouter"); // Re-require if needed

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    mockCommandHandler = {
      handleCommand: jest.fn(),
    };
    mockCallbackQueryHandler = {
      handleCallbackQuery: jest.fn(),
    };
    mockConfig = {
      ngrokUrl: "https://fake.ngrok.io",
    };

    mockCtx = {
      from: { id: 123, first_name: "TestUser" },
      state: {}, // Will be populated per test
      reply: jest.fn().mockResolvedValue(true),
      // updateType, message, callbackQuery will be set per test
    };
    mockNext = jest.fn();

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {}); // Suppress console.log
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe("initialize", () => {
    it("should throw error if logger is missing", () => {
      expect(() =>
        initialize({ commandHandler: {}, callbackQueryHandler: {}, config: {} }),
      ).toThrow(
        "UpdateRouter requires logger, commandHandler, callbackQueryHandler, and config.",
      );
      // Logger might not be available to log the error message in this specific failure case
    });

    it("should throw error if commandHandler is missing", () => {
       // Provide a minimal logger for this test to catch the specific error log
      const tempLogger = { error: jest.fn(), info: jest.fn() };
      expect(() =>
        initialize({ logger: tempLogger, callbackQueryHandler: {}, config: {} }),
      ).toThrow(
        "UpdateRouter requires logger, commandHandler, callbackQueryHandler, and config.",
      );
      expect(tempLogger.error).toHaveBeenCalledWith(
        { missingDependencies: "commandHandler" },
        "UpdateRouter initialization failed. Missing: commandHandler",
      );
    });
    
    // Similar tests for callbackQueryHandler and config missing...

    it("should return a function and log success if all dependencies are provided", () => {
      const routeUpdateFn = initialize({
        logger: mockLogger,
        commandHandler: mockCommandHandler,
        callbackQueryHandler: mockCallbackQueryHandler,
        config: mockConfig,
      });
      expect(typeof routeUpdateFn).toBe("function");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Update router initialized. Returning configured routeUpdate function.",
      );
    });
  });

  describe("routeUpdate function (returned by initialize)", () => {
    let routeUpdate;

    beforeEach(() => {
      // Get a fresh routeUpdate function for each test in this suite
      routeUpdate = initialize({
        logger: mockLogger,
        commandHandler: mockCommandHandler,
        callbackQueryHandler: mockCallbackQueryHandler,
        config: mockConfig,
      });
      mockLogger.info.mockClear(); // Clear init log
    });

    describe("New User Handling (isNewUser === true)", () => {
      beforeEach(() => {
        mockCtx.state.isNewUser = true;
      });

      it("should reply with error if NGROK_URL is not configured", async () => {
        const configWithoutNgrok = { ...mockConfig, ngrokUrl: undefined };
        routeUpdate = initialize({
            logger: mockLogger, commandHandler: mockCommandHandler,
            callbackQueryHandler: mockCallbackQueryHandler, config: configWithoutNgrok
        });

        await routeUpdate(mockCtx, mockNext);

        expect(mockLogger.error).toHaveBeenCalledWith(
          { telegramId: 123 },
          "NGROK_URL is not configured. Cannot generate registration link.",
        );
        expect(mockCtx.reply).toHaveBeenCalledWith(
          "Welcome! There seems to be an issue setting up your registration link right now.",
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it("should send registration link if NGROK_URL is configured", async () => {
        await routeUpdate(mockCtx, mockNext);
        
        const expectedRegUrl = `${mockConfig.ngrokUrl}/registration-form.html?botServerUrl=${mockConfig.ngrokUrl}`;
        expect(mockLogger.info).toHaveBeenCalledWith(
          { telegramId: 123 },
          "New user detected: TestUser",
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          { telegramId: 123, registrationUrl: expectedRegUrl },
          "Generated registration URL for new user.",
        );
        expect(mockCtx.reply).toHaveBeenCalledWith(
          "👋 Welcome, TestUser! Please complete your registration to get started.",
          Markup.inlineKeyboard([
            Markup.button.webApp("Register Now", expectedRegUrl),
          ]),
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it("should log error if sending registration reply fails", async () => {
        mockCtx.reply.mockRejectedValueOnce(new Error("Telegram API error"));
        await routeUpdate(mockCtx, mockNext);

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ err: expect.any(Error), telegramId: 123 }),
            "Failed to send welcome/registration reply to new user."
        );
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe("Failed User Lookup (user === undefined)", () => {
      it("should log error and return", async () => {
        mockCtx.state.user = undefined; // Explicitly
        mockCtx.state.isNewUser = false; // Not a new user

        await routeUpdate(mockCtx, mockNext);

        expect(mockLogger.error).toHaveBeenCalledWith(
          { userId: 123 },
          "Cannot route update: User lookup failed previously.",
        );
        expect(mockNext).not.toHaveBeenCalled();
        expect(mockCtx.reply).not.toHaveBeenCalled();
      });
    });
    
    describe("Existing User Routing", () => {
        beforeEach(() => {
            mockCtx.state.user = { id: "dbUserId", state: "IDLE", active_session_id: null };
            mockCtx.state.isNewUser = false;
        });

        it("should route /commands to commandHandler", async () => {
            mockCtx.updateType = "message";
            mockCtx.message = { text: "/start" };
            
            await routeUpdate(mockCtx, mockNext);

            expect(mockLogger.info).toHaveBeenCalledWith(
                { telegramId: 123, command: "/start" },
                "Routing to command handler."
            );
            expect(mockCommandHandler.handleCommand).toHaveBeenCalledWith(mockCtx, mockNext);
        });

        it("should handle text message in BOOKING state", async () => {
            mockCtx.state.user.state = "BOOKING";
            mockCtx.updateType = "message";
            mockCtx.message = { text: "Hello there" };

            await routeUpdate(mockCtx, mockNext);
            expect(mockLogger.info).toHaveBeenCalledWith(
                { telegramId: 123, messageText: "Hello there", activeSessionId: null },
                ">>> routeUpdate BOOKING path (text message) - Agent logic removed."
            );
            expect(mockCtx.reply).toHaveBeenCalledWith(
                "I received your message, but the AI booking assistant is currently unavailable. Please use commands if you know them, or type /help."
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it("should handle text message in IDLE state", async () => {
            mockCtx.state.user.state = "IDLE";
            mockCtx.updateType = "message";
            mockCtx.message = { text: "Just a random text" };

            await routeUpdate(mockCtx, mockNext);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                 { telegramId: 123 },
                "Handling generic text message in IDLE state."
            );
            expect(mockCtx.reply).toHaveBeenCalledWith(
                "I received your message, but I'm not sure how to handle it in the current context. Try starting with a command like /start or /help."
            );
            expect(mockNext).not.toHaveBeenCalled();
        });
        
        it("should handle text message in an UNKNOWN state", async () => {
            mockCtx.state.user.state = "WEIRD_STATE";
            mockCtx.updateType = "message";
            mockCtx.message = { text: "What now?" };

            await routeUpdate(mockCtx, mockNext);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                 { telegramId: 123, userState: "WEIRD_STATE" },
                "User in unhandled state received text message."
            );
            expect(mockCtx.reply).toHaveBeenCalledWith(
                "I'm not sure how to handle that in my current state."
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it("should route callback_query to callbackQueryHandler", async () => {
            mockCtx.updateType = "callback_query";
            mockCtx.callbackQuery = { data: "action:yes" };

            await routeUpdate(mockCtx, mockNext);
            expect(mockLogger.info).toHaveBeenCalledWith(
                { telegramId: 123, data: "action:yes" },
                "Routing callback query"
            );
            expect(mockCallbackQueryHandler.handleCallbackQuery).toHaveBeenCalledWith(mockCtx, mockNext);
        });

        it("should call next for unhandled update types", async () => {
            mockCtx.updateType = "edited_message";
            mockCtx.message = { text: "edited" }; // Provide some message structure

            await routeUpdate(mockCtx, mockNext);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                { updateType: "edited_message", messageType: undefined }, // 'text' is excluded, find returns undefined
                "Unhandled update type received."
            );
            expect(mockNext).toHaveBeenCalledTimes(1);
        });
    });

    describe("General Error Handling in routeUpdate", () => {
        beforeEach(() => {
            // Ensure user is not new and exists for these tests
            mockCtx.state.isNewUser = false;
            mockCtx.state.user = { id: "dbUserId", state: "IDLE" };
        });

        it("should catch errors, log, and reply with apology", async () => {
            mockCtx.updateType = "message";
            mockCtx.message = { text: "/errorcommand" };
            const testError = new Error("Handler failed");
            mockCommandHandler.handleCommand.mockRejectedValueOnce(testError);

            await routeUpdate(mockCtx, mockNext);

            expect(mockLogger.error).toHaveBeenCalledWith(
                { err: testError, telegramId: 123 },
                "Unhandled error during update processing."
            );
            expect(mockCtx.reply).toHaveBeenCalledWith(
                "Apologies, an unexpected error occurred while processing your request."
            );
            expect(mockNext).not.toHaveBeenCalled(); // next() should not be called after error
        });

        it("should log an additional error if sending apology reply fails", async () => {
            mockCtx.updateType = "message";
            mockCtx.message = { text: "/doubleerror" };
            const initialError = new Error("Initial processing error");
            mockCommandHandler.handleCommand.mockRejectedValueOnce(initialError);
            
            const replyError = new Error("Failed to send apology");
            mockCtx.reply.mockRejectedValueOnce(replyError);

            await routeUpdate(mockCtx, mockNext);

            expect(mockLogger.error).toHaveBeenCalledWith(
                { err: initialError, telegramId: 123 },
                "Unhandled error during update processing."
            );
            expect(mockLogger.error).toHaveBeenCalledWith(
                { err: replyError, originalError: initialError, telegramId: 123 },
                "Error sending error reply to user."
            );
            expect(mockNext).not.toHaveBeenCalled();
        });
    });
  });
});