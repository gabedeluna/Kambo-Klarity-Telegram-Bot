/**
 * @fileoverview Tests for the /start command handler
 */

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

const mockNotifier = {
  sendMessage: jest.fn(),
};

describe("Start Command Handler", () => {
  let initializeStartCommandHandler;
  let handleStartCommand;

  beforeEach(() => {
    jest.resetModules(); // Reset modules to ensure fresh state
    jest.clearAllMocks(); // Clear all mock function calls

    // Re-require the module under test after resetting modules
    const startCommandHandler = require("../../../src/commands/client/start");
    initializeStartCommandHandler =
      startCommandHandler.initializeStartCommandHandler;
    handleStartCommand = startCommandHandler.handleStartCommand;
  });

  describe("initializeStartCommandHandler", () => {
    it("should initialize successfully with valid dependencies", () => {
      expect(() => {
        initializeStartCommandHandler({
          logger: mockLogger,
          notifier: mockNotifier,
        });
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[startCommandHandler] Initialized successfully.",
      );
    });

    it("should log error when missing dependencies", () => {
      // Mock console.error since it will be used as fallback when logger is missing
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      expect(() => {
        initializeStartCommandHandler({});
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[startCommandHandler] Initialization failed: Missing notifier or logger dependency.",
      );

      consoleSpy.mockRestore();
    });

    it("should handle missing logger gracefully", () => {
      // Should not throw even without logger
      expect(() => {
        initializeStartCommandHandler({ notifier: mockNotifier });
      }).not.toThrow();
    });
  });

  describe("handleStartCommand", () => {
    beforeEach(() => {
      // Initialize handler before each test
      initializeStartCommandHandler({
        logger: mockLogger,
        notifier: mockNotifier,
      });
    });

    describe("basic /start command without parameters", () => {
      it("should respond to basic /start command", async () => {
        const mockCtx = {
          from: { id: 12345, first_name: "TestUser" },
          reply: jest.fn(),
          startPayload: undefined,
        };

        await handleStartCommand(mockCtx);

        expect(mockCtx.reply).toHaveBeenCalledWith(
          expect.stringContaining("Welcome"),
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          { userId: "12345" },
          "[/start] Basic start command received.",
        );
      });

      it("should handle missing user name gracefully", async () => {
        const mockCtx = {
          from: { id: 12345 },
          reply: jest.fn(),
          startPayload: undefined,
        };

        await handleStartCommand(mockCtx);

        expect(mockCtx.reply).toHaveBeenCalled();
      });
    });

    describe("/start with invite token", () => {
      it("should extract invite token from startPayload", async () => {
        const mockCtx = {
          from: { id: 12345, first_name: "TestUser" },
          reply: jest.fn(),
          startPayload: "invite_ABC123XYZ",
        };

        await handleStartCommand(mockCtx);

        expect(mockLogger.info).toHaveBeenCalledWith(
          { userId: "12345", inviteToken: "ABC123XYZ" },
          "[/start] Invite token detected, processing friend flow.",
        );
      });

      it("should handle malformed invite token gracefully", async () => {
        const mockCtx = {
          from: { id: 12345, first_name: "TestUser" },
          reply: jest.fn(),
          startPayload: "invite_",
        };

        await handleStartCommand(mockCtx);

        expect(mockCtx.reply).toHaveBeenCalledWith(
          "Sorry, this invite link appears to be invalid.",
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          { userId: "12345", startPayload: "invite_" },
          "[/start] Malformed invite token received.",
        );
      });

      it("should handle non-invite startPayload", async () => {
        const mockCtx = {
          from: { id: 12345, first_name: "TestUser" },
          reply: jest.fn(),
          startPayload: "something_else",
        };

        await handleStartCommand(mockCtx);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          { userId: "12345", startPayload: "something_else" },
          "[/start] Non-invite start payload received, treating as basic start.",
        );
      });
    });

    describe("/start with invite API integration", () => {
      let mockAxios;

      beforeEach(() => {
        // Mock axios at the module level
        jest.doMock("axios", () => ({
          get: jest.fn(),
        }));

        // Clear module cache and require fresh mocks
        jest.resetModules();
        mockAxios = require("axios");

        // Re-require the handler with mocked axios
        const startHandler = require("../../../src/commands/client/start");
        initializeStartCommandHandler =
          startHandler.initializeStartCommandHandler;
        handleStartCommand = startHandler.handleStartCommand;

        // Initialize handler for these tests
        initializeStartCommandHandler({
          logger: mockLogger,
          notifier: mockNotifier,
        });

        jest.clearAllMocks();
      });

      afterEach(() => {
        jest.unmock("axios");
      });

      it("should call BookingFlowManager API for valid invite token", async () => {
        const mockApiResponse = {
          success: true,
          sessionDetails: {
            sessionType: "Kambo Session",
            date: "2025-01-15",
            time: "14:00",
            primaryBookerName: "John Doe",
          },
          flowToken: "flow_token_123",
        };

        mockAxios.get.mockResolvedValueOnce({
          data: mockApiResponse,
        });

        const mockCtx = {
          from: { id: 12345, first_name: "TestUser" },
          reply: jest.fn(),
          startPayload: "invite_VALID123TOKEN",
        };

        await handleStartCommand(mockCtx);

        expect(mockAxios.get).toHaveBeenCalledWith(
          expect.stringContaining(
            "/api/booking-flow/start-invite/VALID123TOKEN?friend_tg_id=12345",
          ),
          expect.objectContaining({
            headers: expect.objectContaining({
              "Content-Type": "application/json",
            }),
          }),
        );

        expect(mockCtx.reply).toHaveBeenCalledWith(
          expect.stringContaining("Hi TestUser!"),
          expect.any(Object), // inline keyboard
        );
      });

      it("should handle expired invite token", async () => {
        const axiosError = new Error("Request failed");
        axiosError.response = {
          status: 404,
          data: { error: "Invite token expired or not found" },
        };
        mockAxios.get.mockRejectedValueOnce(axiosError);

        const mockCtx = {
          from: { id: 12345, first_name: "TestUser" },
          reply: jest.fn(),
          startPayload: "invite_EXPIRED123",
        };

        await handleStartCommand(mockCtx);

        expect(mockCtx.reply).toHaveBeenCalledWith(
          "Sorry, this invitation has expired or is no longer valid.",
        );
      });

      it("should handle self-invite prevention", async () => {
        const axiosError = new Error("Request failed");
        axiosError.response = {
          status: 400,
          data: { error: "Cannot invite yourself" },
        };
        mockAxios.get.mockRejectedValueOnce(axiosError);

        const mockCtx = {
          from: { id: 12345, first_name: "TestUser" },
          reply: jest.fn(),
          startPayload: "invite_SELF123",
        };

        await handleStartCommand(mockCtx);

        expect(mockCtx.reply).toHaveBeenCalledWith(
          "You cannot accept your own invitation. This invite is for friends to join your session.",
        );
      });

      it("should handle already accepted invite", async () => {
        const axiosError = new Error("Request failed");
        axiosError.response = {
          status: 409,
          data: { error: "Invite already accepted" },
        };
        mockAxios.get.mockRejectedValueOnce(axiosError);

        const mockCtx = {
          from: { id: 12345, first_name: "TestUser" },
          reply: jest.fn(),
          startPayload: "invite_ACCEPTED123",
        };

        await handleStartCommand(mockCtx);

        expect(mockCtx.reply).toHaveBeenCalledWith(
          "This invitation has already been accepted.",
        );
      });

      it("should handle API network errors gracefully", async () => {
        mockAxios.get.mockRejectedValueOnce(new Error("Network error"));

        const mockCtx = {
          from: { id: 12345, first_name: "TestUser" },
          reply: jest.fn(),
          startPayload: "invite_NETWORK123",
        };

        await handleStartCommand(mockCtx);

        expect(mockCtx.reply).toHaveBeenCalledWith(
          "Sorry, I'm having trouble processing your invitation right now. Please try again later.",
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          {
            err: expect.any(Error),
            userId: "12345",
            inviteToken: "NETWORK123",
          },
          "[/start] Error calling BookingFlowManager API for invite token.",
        );
      });

      it("should handle malformed API responses", async () => {
        mockAxios.get.mockResolvedValueOnce({
          data: {}, // Missing required fields
        });

        const mockCtx = {
          from: { id: 12345, first_name: "TestUser" },
          reply: jest.fn(),
          startPayload: "invite_MALFORMED123",
        };

        await handleStartCommand(mockCtx);

        expect(mockCtx.reply).toHaveBeenCalledWith(
          "Sorry, I received an unexpected response. Please try again or contact support.",
        );
      });
    });

    describe("error handling", () => {
      it("should handle missing notifier dependency", async () => {
        // Since we use jest.resetModules in beforeEach, the module starts fresh
        // Let's make sure this test runs in isolation by creating a new context

        jest.resetModules();
        const freshStartHandler = require("../../../src/commands/client/start");

        // Don't initialize - test uninitialized state
        const consoleSpy = jest
          .spyOn(console, "error")
          .mockImplementation(() => {});

        const mockCtx = {
          from: { id: 12345 },
          reply: jest.fn(),
          startPayload: undefined,
        };

        await freshStartHandler.handleStartCommand(mockCtx);

        expect(mockCtx.reply).toHaveBeenCalledWith(
          "Sorry, the service is currently unavailable. Please try again later.",
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          "[startCommandHandler] Command handler called but notifier instance is not available.",
        );

        consoleSpy.mockRestore();
      });

      it("should handle reply failures gracefully", async () => {
        const mockCtx = {
          from: { id: 12345 },
          reply: jest.fn().mockRejectedValue(new Error("Reply failed")),
          startPayload: undefined,
        };

        await handleStartCommand(mockCtx);

        expect(mockLogger.error).toHaveBeenCalledWith(
          { err: expect.any(Error), userId: "12345" },
          "[/start] Exception during reply.",
        );
      });

      it("should handle missing user ID", async () => {
        const mockCtx = {
          from: undefined,
          reply: jest.fn(),
          startPayload: undefined,
        };

        await handleStartCommand(mockCtx);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          "[/start] Command received without user information.",
        );
      });
    });

    describe("logging behavior", () => {
      it("should log invite token processing", async () => {
        const mockCtx = {
          from: { id: 12345 },
          reply: jest.fn(),
          startPayload: "invite_VALIDTOKEN123",
        };

        await handleStartCommand(mockCtx);

        expect(mockLogger.info).toHaveBeenCalledWith(
          { userId: "12345", inviteToken: "VALIDTOKEN123" },
          "[/start] Invite token detected, processing friend flow.",
        );
      });

      it("should use fallback logger when not initialized", async () => {
        // Test with uninitialized handler
        const consoleSpy = jest.spyOn(console, "info").mockImplementation();

        const mockCtx = {
          from: { id: 12345 },
          reply: jest.fn(),
          startPayload: undefined,
        };

        // Call without initialization
        const {
          handleStartCommand: uninitializedHandler,
        } = require("../../../src/commands/client/start");
        await uninitializedHandler(mockCtx);

        consoleSpy.mockRestore();
      });
    });
  });
});
