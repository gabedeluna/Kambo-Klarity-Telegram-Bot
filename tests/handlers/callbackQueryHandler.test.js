// tests/handlers/callbackQueryHandler.test.js

const { v4: _uuidv4 } = require("uuid"); // Renamed as it's mocked below

// Mock dependencies
jest.mock("uuid", () => {
  const originalUuid = jest.requireActual("uuid");
  return {
    ...originalUuid, // Spread original module to keep other exports if any
    v4: jest.fn(() => "test-uuid-123"), // Default mock implementation
  };
});

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
const mockStateManager = {
  getUserProfileData: jest.fn(),
  setActiveSessionId: jest.fn(),
  updateUserState: jest.fn(),
  clearActiveSessionId: jest.fn(),
};
const mockTelegramNotifier = {
  sendTextMessage: jest.fn(),
};

// Mock Telegraf context
const mockCtx = (callbackQueryDataString, fromId = 123, chatId = 123) => ({
  from: { id: fromId },
  chat: { id: chatId },
  callbackQuery: callbackQueryDataString
    ? { data: callbackQueryDataString }
    : undefined,
  answerCbQuery: jest.fn().mockResolvedValue(true),
  // telegram: { // Not directly used by the handler after agent removal, but good to have if needed
  //   editMessageText: jest.fn().mockResolvedValue(true),
  // },
});

describe("Callback Query Handler", () => {
  let callbackQueryHandler;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    callbackQueryHandler = require("../../src/handlers/callbackQueryHandler");
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  describe("initialize", () => {
    it("should initialize successfully with all dependencies", () => {
      expect(() =>
        callbackQueryHandler.initialize({
          logger: mockLogger,
          stateManager: mockStateManager,
          telegramNotifier: mockTelegramNotifier,
        }),
      ).not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "callbackQueryHandler initialized successfully.",
      );
    });

    it("should throw an error if logger is missing", () => {
      expect(() =>
        callbackQueryHandler.initialize({
          stateManager: mockStateManager,
          telegramNotifier: mockTelegramNotifier,
        }),
      ).toThrow("Missing required dependencies for callbackQueryHandler");
    });

    it("should throw an error if stateManager is missing", () => {
      expect(() =>
        callbackQueryHandler.initialize({
          logger: mockLogger,
          telegramNotifier: mockTelegramNotifier,
        }),
      ).toThrow("Missing required dependencies for callbackQueryHandler");
    });

    it("should throw an error if telegramNotifier is missing", () => {
      expect(() =>
        callbackQueryHandler.initialize({
          logger: mockLogger,
          stateManager: mockStateManager,
        }),
      ).toThrow("Missing required dependencies for callbackQueryHandler");
    });
  });

  describe("handleCallbackQuery", () => {
    beforeEach(() => {
      // Initialize with mocks before each test in this describe block
      callbackQueryHandler.initialize({
        logger: mockLogger,
        stateManager: mockStateManager,
        telegramNotifier: mockTelegramNotifier,
      });
      // uuidv4 is now mocked at the top level to return "test-uuid-123" by default
      // So, no need to set mockReturnValue here unless a different value is needed for a specific test.
      // If we still need to access the mock function instance to check calls, ensure 'uuidv4' variable is correctly scoped.
      // The 'uuidv4' imported at the top of the file is the mock.
    });

    it("should return early if ctx.callbackQuery or ctx.callbackQuery.data is undefined", async () => {
      const ctxNoCb = mockCtx(undefined);
      mockLogger.info.mockClear(); // Clear initialize log before this specific test's action
      await callbackQueryHandler.handleCallbackQuery(ctxNoCb);
      expect(mockLogger.info).not.toHaveBeenCalled(); // No processing should occur

      const _ctxNoData = mockCtx(undefined); // Simulate no callbackQuery object at all for one path
      // To test ctx.callbackQuery.data undefined when ctx.callbackQuery IS defined:
      const ctxCbNoDataField = {
        from: { id: 123 },
        chat: { id: 123 },
        callbackQuery: {
          /* no data field */
        },
        answerCbQuery: jest.fn(),
      };
      mockLogger.info.mockClear();
      await callbackQueryHandler.handleCallbackQuery(ctxCbNoDataField);
      expect(mockLogger.info).not.toHaveBeenCalled();

      // Test original case for ctx.callbackQuery.data being explicitly undefined
      const ctxWithUndefinedData = {
        from: { id: 123 },
        chat: { id: 123 },
        callbackQuery: { data: undefined },
        answerCbQuery: jest.fn(),
      };
      mockLogger.info.mockClear();
      await callbackQueryHandler.handleCallbackQuery(ctxWithUndefinedData);
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it("should ignore and answer callbacks not starting with 'book_session:'", async () => {
      const ctx = mockCtx("other_action:123");
      await callbackQueryHandler.handleCallbackQuery(ctx);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { callbackData: "other_action:123", userId: "123" },
        "Callback data does not match book_session prefix, ignoring.",
      );
      expect(ctx.answerCbQuery).toHaveBeenCalled();
      expect(mockStateManager.getUserProfileData).not.toHaveBeenCalled();
    });

    it("should log a warning if answering a non-matching callback fails", async () => {
      const ctx = mockCtx("other_action:123");
      ctx.answerCbQuery.mockRejectedValueOnce(new Error("Ack failed"));
      await callbackQueryHandler.handleCallbackQuery(ctx);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { err: new Error("Ack failed"), userId: "123" },
        "Failed to answer non-matching callback query.",
      );
    });

    it("should acknowledge 'book_session' callback query", async () => {
      const ctx = mockCtx("book_session:sessionType1");
      mockStateManager.getUserProfileData.mockResolvedValue({
        success: true,
        data: { edit_msg_id: 987 },
      }); // Mock to proceed further
      await callbackQueryHandler.handleCallbackQuery(ctx);
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1); // Only once for the actual processing
    });

    it("should log warning and continue if 'book_session' ack fails", async () => {
      const ctx = mockCtx("book_session:sessionType1");
      ctx.answerCbQuery.mockRejectedValueOnce(new Error("Ack failed"));
      mockStateManager.getUserProfileData.mockResolvedValue({
        success: true,
        data: { edit_msg_id: 987 },
      });
      await callbackQueryHandler.handleCallbackQuery(ctx);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { err: new Error("Ack failed"), userId: "123" },
        "Failed to answer 'book_session' callback query (possibly already answered or expired).",
      );
      expect(mockStateManager.getUserProfileData).toHaveBeenCalled(); // Should still proceed
    });

    it("should notify user and return if edit_msg_id is not found in profile", async () => {
      const ctx = mockCtx("book_session:sessionType1");
      mockStateManager.getUserProfileData.mockResolvedValue({
        success: true,
        data: { edit_msg_id: null }, // No edit_msg_id
      });
      await callbackQueryHandler.handleCallbackQuery(ctx);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { userId: "123" },
        "Original message ID (edit_msg_id) not found for user. Cannot edit message. User might be clicking an old button.",
      );
      expect(mockTelegramNotifier.sendTextMessage).toHaveBeenCalledWith({
        telegramId: "123",
        text: "It seems you clicked an outdated button. Please try starting the booking process again with /book if you wish to proceed.",
      });
      expect(mockStateManager.setActiveSessionId).not.toHaveBeenCalled();
    });

    it("should notify user and return if getUserProfileData fails or returns no data", async () => {
      const ctx = mockCtx("book_session:sessionType1");
      mockStateManager.getUserProfileData.mockResolvedValue({
        success: false,
        data: null,
      }); // Simulate failure
      await callbackQueryHandler.handleCallbackQuery(ctx);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: new Error(
            "User profile fetch failed or profile not found for 123.",
          ),
        }),
        "Error fetching profile or edit_msg_id for callback.",
      );
      expect(mockTelegramNotifier.sendTextMessage).toHaveBeenCalledWith({
        telegramId: "123",
        text: "Sorry, I couldn't retrieve necessary information to proceed. Please try /book again.",
      });
      expect(mockStateManager.setActiveSessionId).not.toHaveBeenCalled();
    });

    it("should notify user and return if stateManager.getUserProfileData throws an error", async () => {
      const ctx = mockCtx("book_session:sessionType1");
      mockStateManager.getUserProfileData.mockRejectedValue(
        new Error("DB Error"),
      );
      await callbackQueryHandler.handleCallbackQuery(ctx);
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: new Error("DB Error"), userId: "123" },
        "Error fetching profile or edit_msg_id for callback.",
      );
      expect(mockTelegramNotifier.sendTextMessage).toHaveBeenCalled();
    });

    it("should update user state and log info if state update fails", async () => {
      const ctx = mockCtx("book_session:sessionType1");
      mockStateManager.getUserProfileData.mockResolvedValue({
        success: true,
        data: { edit_msg_id: 987 },
      });
      mockStateManager.setActiveSessionId.mockResolvedValue({ success: true });
      mockStateManager.updateUserState.mockRejectedValue(
        new Error("State Update Error"),
      );

      await callbackQueryHandler.handleCallbackQuery(ctx);

      expect(mockStateManager.setActiveSessionId).toHaveBeenCalledWith({
        telegramId: "123",
        sessionId: "test-uuid-123",
      });
      expect(mockStateManager.updateUserState).toHaveBeenCalledWith("123", {
        state: "BOOKING",
        session_type: "sessionType1",
        edit_msg_id: null,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          err: new Error("State Update Error"),
          userId: "123",
          sessionId: "test-uuid-123",
        },
        "Error updating user state for booking.",
      );
      expect(mockStateManager.clearActiveSessionId).toHaveBeenCalledWith({
        telegramId: "123",
      });
      expect(mockTelegramNotifier.sendTextMessage).toHaveBeenCalledWith({
        telegramId: "123",
        text: "Sorry, there was an error setting up your booking session. Please try /book again.",
      });
    });

    it("should successfully process callback, update state, and log agent removal", async () => {
      const selectedSessionTypeId = "kambo_intro";
      const ctx = mockCtx(`book_session:${selectedSessionTypeId}`);
      const mockUserProfile = { edit_msg_id: 9876 };

      mockStateManager.getUserProfileData.mockResolvedValue({
        success: true,
        data: mockUserProfile,
      });
      mockStateManager.setActiveSessionId.mockResolvedValue({ success: true });
      mockStateManager.updateUserState.mockResolvedValue({ success: true });

      await callbackQueryHandler.handleCallbackQuery(ctx);

      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
      expect(mockStateManager.getUserProfileData).toHaveBeenCalledWith({
        telegramId: "123",
      });
      expect(require("uuid").v4).toHaveBeenCalled(); // Ensure we're asserting on the SUT's instance of the mock
      expect(mockStateManager.setActiveSessionId).toHaveBeenCalledWith({
        telegramId: "123",
        sessionId: "test-uuid-123",
      });
      expect(mockStateManager.updateUserState).toHaveBeenCalledWith("123", {
        state: "BOOKING",
        session_type: selectedSessionTypeId,
        edit_msg_id: null,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          userId: "123",
          sessionId: "test-uuid-123",
          sessionType: selectedSessionTypeId,
        },
        "User state updated to BOOKING, session ID assigned, edit_msg_id cleared.",
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: "123", sessionId: "test-uuid-123" },
        "User selected session type. Agent interaction has been removed from this handler.",
      );
      // Verify no message editing or agent invocation happens
      // expect(ctx.telegram.editMessageText).not.toHaveBeenCalled(); // Assuming no edit for now
      expect(mockTelegramNotifier.sendTextMessage).not.toHaveBeenCalled(); // No error messages
    });
  });
});
