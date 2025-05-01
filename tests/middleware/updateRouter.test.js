const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();

// Import the module under test - not used directly but kept for reference
// eslint-disable-next-line no-unused-vars
const updateRouterModule = require("../../src/middleware/updateRouter");

describe("updateRouter Middleware", () => {
  // Create sandbox at the top level
  const sandbox = sinon.createSandbox();

  // Create mock dependencies
  const mockBookingAgent = {
    runBookingAgent: sandbox.stub().resolves(),
  };
  const mockCommandHandler = {
    handle: sandbox.stub().resolves(),
  };
  const mockCallbackHandler = {
    handle: sandbox.stub().resolves(),
  };
  const mockLogger = {
    info: sandbox.stub(),
    debug: sandbox.stub(),
    warn: sandbox.stub(),
    error: sandbox.stub(),
  };

  // Variables for test context
  let updateRouter;
  let mockCtx;
  let mockNext;

  beforeEach(() => {
    // Reset all stubs
    sandbox.resetHistory();

    // Reset the mocks
    mockBookingAgent.runBookingAgent.reset();

    // Re-initialize the module for each test to ensure clean state
    updateRouter = proxyquire("../../src/middleware/updateRouter", {
      "../core/logger": { logger: mockLogger },
    });

    // Don't initialize in beforeEach for the initialize tests
    // We'll do it explicitly in the tests that need it

    // Create mock Telegraf context
    mockCtx = {
      updateType: "message",
      message: {
        text: "Hello",
      },
      from: {
        id: 123456789,
      },
      state: {
        user: {
          id: 1,
          state: "IDLE",
        },
      },
      reply: sandbox.stub().resolves(),
    };

    // Mock next middleware function
    mockNext = sandbox.stub().resolves();
  });

  afterEach(() => {
    sandbox.verifyAndRestore();
  });

  describe("initialize", () => {
    it("should throw error if bookingAgent is missing", () => {
      expect(() =>
        updateRouter.initialize({
          commandHandler: mockCommandHandler,
          callbackHandler: mockCallbackHandler,
        }),
      ).to.throw(/bookingAgent is required/);
    });

    it("should throw error if commandHandler is missing", () => {
      expect(() =>
        updateRouter.initialize({
          bookingAgent: mockBookingAgent,
          callbackHandler: mockCallbackHandler,
        }),
      ).to.throw(/commandHandler is required/);
    });

    it("should throw error if callbackHandler is missing", () => {
      expect(() =>
        updateRouter.initialize({
          bookingAgent: mockBookingAgent,
          commandHandler: mockCommandHandler,
        }),
      ).to.throw(/callbackHandler is required/);
    });

    it("should initialize successfully with all dependencies", () => {
      // Reset the logger info stub to ensure it's clean for this test
      mockLogger.info.resetHistory();

      // Call initialize
      updateRouter.initialize({
        bookingAgent: mockBookingAgent,
        commandHandler: mockCommandHandler,
        callbackHandler: mockCallbackHandler,
      });

      // Verify logger was called
      expect(mockLogger.info.calledOnce).to.be.true;
    });
  });

  describe("updateRouterMiddleware", () => {
    it("should route text message to booking agent when user state is BOOKING", async () => {
      // Initialize middleware with mocks
      updateRouter.initialize({
        bookingAgent: mockBookingAgent,
        commandHandler: mockCommandHandler,
        callbackHandler: mockCallbackHandler,
      });

      // Set user state to BOOKING
      mockCtx.state.user.state = "BOOKING";

      await updateRouter.updateRouterMiddleware(mockCtx, mockNext);

      expect(mockBookingAgent.runBookingAgent.calledOnce).to.be.true;
      expect(mockBookingAgent.runBookingAgent.firstCall.args[0]).to.deep.equal({
        telegramId: "123456789",
        message: "Hello",
      });
      expect(mockCtx.reply.called).to.be.false;
    });

    it("should send generic reply for text message when user state is not BOOKING", async () => {
      // Initialize middleware with mocks
      updateRouter.initialize({
        bookingAgent: mockBookingAgent,
        commandHandler: mockCommandHandler,
        callbackHandler: mockCallbackHandler,
      });

      // User state is IDLE (set in beforeEach)
      await updateRouter.updateRouterMiddleware(mockCtx, mockNext);

      expect(mockBookingAgent.runBookingAgent.called).to.be.false;
      expect(mockCtx.reply.calledOnce).to.be.true;
      expect(mockCtx.reply.firstCall.args[0]).to.equal(
        "Got it. How can I help you today?",
      );
    });

    it("should handle commands", async () => {
      // Initialize middleware with mocks
      updateRouter.initialize({
        bookingAgent: mockBookingAgent,
        commandHandler: mockCommandHandler,
        callbackHandler: mockCallbackHandler,
      });

      mockCtx.message.text = "/start";

      await updateRouter.updateRouterMiddleware(mockCtx, mockNext);

      // In the current implementation, we're using a placeholder response
      // instead of calling commandHandler.handle
      expect(mockCtx.reply.calledOnce).to.be.true;
      expect(mockCtx.reply.firstCall.args[0]).to.equal(
        "Command received (handler placeholder).",
      );
      // When commandHandler is fully implemented, this would be the assertion:
      // expect(mockCommandHandler.handle).to.have.been.calledWith(mockCtx);
    });

    it("should handle non-text messages", async () => {
      // Initialize middleware with mocks
      updateRouter.initialize({
        bookingAgent: mockBookingAgent,
        commandHandler: mockCommandHandler,
        callbackHandler: mockCallbackHandler,
      });

      mockCtx.message = { photo: ["photo_data"] }; // No text field

      await updateRouter.updateRouterMiddleware(mockCtx, mockNext);

      expect(mockCtx.reply.calledOnce).to.be.true;
      expect(mockCtx.reply.firstCall.args[0]).to.equal(
        "I can only process text messages right now.",
      );
    });

    it("should handle callback queries", async () => {
      // Initialize middleware with mocks
      updateRouter.initialize({
        bookingAgent: mockBookingAgent,
        commandHandler: mockCommandHandler,
        callbackHandler: mockCallbackHandler,
      });

      mockCtx.updateType = "callback_query";
      mockCtx.callbackQuery = { data: "book_session:1" };
      mockCtx.answerCbQuery = sandbox.stub().resolves();

      await updateRouter.updateRouterMiddleware(mockCtx, mockNext);

      // In the current implementation, we're using a placeholder response
      // instead of calling callbackHandler.handle
      expect(mockCtx.answerCbQuery.calledOnce).to.be.true;
      expect(mockCtx.answerCbQuery.firstCall.args[0]).to.equal(
        "Callback received (handler placeholder).",
      );
      // When callbackHandler is fully implemented, this would be the assertion:
      // expect(mockCallbackHandler.handle).to.have.been.calledWith(mockCtx);
    });

    it("should handle errors gracefully", async () => {
      // Initialize middleware with mocks
      updateRouter.initialize({
        bookingAgent: mockBookingAgent,
        commandHandler: mockCommandHandler,
        callbackHandler: mockCallbackHandler,
      });

      // Make bookingAgent.runBookingAgent throw an error
      mockCtx.state.user.state = "BOOKING";
      mockBookingAgent.runBookingAgent.rejects(new Error("Test error"));

      await updateRouter.updateRouterMiddleware(mockCtx, mockNext);

      expect(mockCtx.reply.calledOnce).to.be.true;
      expect(mockCtx.reply.firstCall.args[0]).to.equal(
        "Sorry, something went wrong while processing your request.",
      );
    });

    it("should handle errors in error handling", async () => {
      // Reset logger error stub
      mockLogger.error.resetHistory();

      // Initialize middleware with mocks
      updateRouter.initialize({
        bookingAgent: mockBookingAgent,
        commandHandler: mockCommandHandler,
        callbackHandler: mockCallbackHandler,
      });

      // Make bookingAgent.runBookingAgent throw an error
      mockCtx.state.user.state = "BOOKING";
      mockBookingAgent.runBookingAgent.rejects(new Error("Test error"));

      // And make ctx.reply throw an error too
      mockCtx.reply.rejects(new Error("Reply error"));

      // This should not throw
      // The test should pass without throwing an error
      await updateRouter.updateRouterMiddleware(mockCtx, mockNext);

      // Verify the error was logged - should be called at least once
      // There might be multiple error logs due to the nested error handling
      expect(mockLogger.error.called).to.be.true;
    });
  });
});
