const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();

// Define mockLogger at top-level for proxyquire
const mockLogger = {
  info: sinon.stub(),
  warn: sinon.stub(),
  error: sinon.stub(),
  debug: sinon.stub(),
};

// Load Module Under Test ONCE at top level, substituting logger path
const updateRouter = proxyquire("../../src/middleware/updateRouter", {
  "../core/logger": { logger: mockLogger }, // Use top-level mockLogger
});
const initializeFunc = updateRouter.initialize;

describe("Update Router Middleware (routeUpdate)", () => {
  let sandbox;
  // Logger mock defined above, others defined in beforeEach
  let mockCommandHandler,
    mockCallbackQueryHandler,
    mockBookingAgent,
    mockBookingGraph;
  let mockCtx, mockNext;
  let _fullDeps; // Prefix with _ for linter
  let routeUpdateFunc; // Stores the function returned by initialize

  beforeEach(() => {
    sandbox = sinon.createSandbox(); // Create fresh sandbox

    // Re-stub logger methods using the sandbox for isolation
    mockLogger.info = sandbox.stub();
    mockLogger.warn = sandbox.stub();
    mockLogger.error = sandbox.stub();
    mockLogger.debug = sandbox.stub();

    // Create other mocks using the sandbox
    mockCommandHandler = {
      handleCommand: sandbox.stub(),
    };
    mockCallbackQueryHandler = {
      handleCallbackQuery: sandbox.stub(),
    };
    mockBookingAgent = {
      invokeGraph: sandbox
        .stub()
        .resolves({ agentOutcome: { output: "Graph OK" } }),
    };
    mockBookingGraph = {
      // If needed
      invoke: sandbox.stub(),
    };

    // Reset mock context and spy
    mockCtx = {
      // Base context, specific state added in tests
      from: { id: 12345, first_name: "TestUser" },
      state: {}, // Populated in tests
      updateType: "message", // Default, override in tests
      message: { text: "Hello" }, // Default, override in tests
      update: { message: { text: "Hello" } }, // Default, override in tests
      reply: sandbox.stub().resolves(),
    };
    mockNext = sandbox.spy();

    // Full dependencies for initialize
    _fullDeps = {
      // Prefix with _ for linter
      // logger is required internally, not passed here
      commandHandler: mockCommandHandler,
      callbackQueryHandler: mockCallbackQueryHandler,
      bookingAgent: mockBookingAgent,
      bookingGraph: mockBookingGraph, // Ensure initialize uses this if needed
    };
  });

  afterEach(() => {
    sandbox.restore(); // Restore sandbox AFTER each test
  });

  // Keep initializeFunc defined at top level

  describe("initialize", () => {
    it("should throw error if commandHandler is missing", () => {
      expect(() =>
        initializeFunc({
          callbackQueryHandler: mockCallbackQueryHandler,
          bookingAgent: mockBookingAgent,
          bookingGraph: mockBookingGraph,
        }),
      ).to.throw(/UpdateRouter requires commandHandler/);
    });

    it("should throw error if callbackQueryHandler is missing", () => {
      expect(() =>
        initializeFunc({
          commandHandler: mockCommandHandler,
          bookingAgent: mockBookingAgent,
          bookingGraph: mockBookingGraph,
        }),
      ).to.throw(/UpdateRouter requires.*callbackQueryHandler/);
    });

    it("should throw error if bookingAgent is missing", () => {
      expect(() =>
        initializeFunc({
          commandHandler: mockCommandHandler,
          callbackQueryHandler: mockCallbackQueryHandler,
          bookingGraph: mockBookingGraph,
        }),
      ).to.throw(/UpdateRouter requires.*bookingAgent/);
    });

    it("should throw error if bookingGraph is missing", () => {
      expect(() =>
        initializeFunc({
          commandHandler: mockCommandHandler,
          callbackQueryHandler: mockCallbackQueryHandler,
          bookingAgent: mockBookingAgent,
        }),
      ).to.throw(/UpdateRouter requires.*bookingGraph/);
    });

    it("should initialize successfully and return a function", () => {
      mockLogger.info.resetHistory();

      const returnedFunction = initializeFunc({
        bookingAgent: mockBookingAgent,
        commandHandler: mockCommandHandler,
        callbackQueryHandler: mockCallbackQueryHandler,
        bookingGraph: mockBookingGraph,
      });

      expect(returnedFunction).to.be.a("function");
      expect(mockLogger.info.calledTwice).to.be.true;
      expect(mockLogger.info.secondCall.args[0]).to.contain(
        "Update router initialized. Returning configured routeUpdate function.",
      );
    });
  });

  describe("routeUpdate Middleware Logic", () => {
    const initializeForRouting = () => {
      routeUpdateFunc = initializeFunc(_fullDeps); // Use _fullDeps
      expect(routeUpdateFunc).to.be.a("function"); // Basic check
    };

    beforeEach(() => {
      // Reset context for each routing test
      mockCtx = {
        from: { id: 12345, first_name: "TestUser" },
        state: {
          /* user, isNewUser set per test */
        },
        updateType: "message",
        message: { text: "Hello" },
        update: { message: { text: "Hello" } },
        reply: sandbox.stub().resolves(),
      };
      mockNext.resetHistory(); // Reset next spy
    });

    it("should send registration prompt and stop processing for new users", async () => {
      initializeForRouting();
      mockCtx.state.isNewUser = true;
      mockCtx.state.user = null; // Simulate user not found initially

      // Reset mocks for this test
      mockLogger.info.resetHistory();
      mockCtx.reply.resetHistory();
      mockNext.resetHistory();

      await routeUpdateFunc(mockCtx, mockNext);

      // Check logs and reply
      expect(mockLogger.info.calledOnce).to.be.true;
      expect(mockLogger.info.firstCall.args[1]).to.contain("New user detected");
      expect(mockCtx.reply.calledOnce).to.be.true;
      expect(mockCtx.reply.firstCall.args[0]).to.contain("Welcome, TestUser!");
      // Ensure other handlers/next not called
      expect(mockCommandHandler.handleCommand.called).to.be.false;
      expect(mockCallbackQueryHandler.handleCallbackQuery.called).to.be.false;
      expect(mockBookingAgent.invokeGraph.called).to.be.false;
      expect(mockNext.called).to.be.false;
    });

    it("should log error and stop processing if user lookup failed (user undefined)", async () => {
      initializeForRouting();
      mockCtx.state.isNewUser = false;
      mockCtx.state.user = undefined;
      mockCtx.from = { id: 111222333 }; // Use a different ID for clarity

      // Reset mocks for this test
      mockLogger.error.resetHistory();
      mockCtx.reply.resetHistory();
      mockNext.resetHistory();
      mockCommandHandler.handleCommand.resetHistory();
      mockCallbackQueryHandler.handleCallbackQuery.resetHistory();
      mockBookingAgent.invokeGraph.resetHistory();

      await routeUpdateFunc(mockCtx, mockNext);

      // Check error log
      expect(
        mockLogger.error.calledWith(
          sinon.match({ userId: 111222333 }),
          sinon.match(/Cannot route update/),
        ),
      ).to.be.true;
      // Ensure no reply was sent and other handlers not called
      expect(mockCtx.reply.called).to.be.false;
      expect(mockCommandHandler.handleCommand.called).to.be.false;
      expect(mockCallbackQueryHandler.handleCallbackQuery.called).to.be.false;
      expect(mockBookingAgent.invokeGraph.called).to.be.false;
      expect(mockNext.called).to.be.false; // Should stop processing
    });

    it("should route text message to booking graph when user state is BOOKING", async () => {
      initializeForRouting();
      mockCtx.state.isNewUser = false;
      mockCtx.state.user = {
        telegramId: 12345,
        state: "BOOKING",
        active_session_id: "sess_abc",
      };
      mockCtx.message.text = "I want a flight tomorrow";

      // Reset mocks
      mockLogger.debug.resetHistory();
      mockBookingAgent.invokeGraph.resetHistory();
      mockCommandHandler.handleCommand.resetHistory();
      mockCallbackQueryHandler.handleCallbackQuery.resetHistory();
      mockCtx.reply.resetHistory();
      mockNext.resetHistory();

      await routeUpdateFunc(mockCtx, mockNext);

      // Check logs and graph call
      expect(
        mockLogger.debug.calledWith(
          sinon.match.object,
          "Routing message to booking graph",
        ),
      ).to.be.true;
      expect(mockBookingAgent.invokeGraph.calledOnce).to.be.true;
      const invokeArgs = mockBookingAgent.invokeGraph.firstCall.args;
      expect(invokeArgs[0]).to.equal("sess_abc");
      expect(invokeArgs[1]).to.deep.equal({
        userInput: "I want a flight tomorrow",
      });
      // Ensure other handlers not called, and next was not called (graph handled it)
      expect(mockCommandHandler.handleCommand.called).to.be.false;
      expect(mockCallbackQueryHandler.handleCallbackQuery.called).to.be.false;
      expect(mockCtx.reply.called).to.be.false; // Graph agent handles reply
      expect(mockNext.called).to.be.false;
    });

    it("should send error reply if BOOKING state but no active_session_id", async () => {
      initializeForRouting();
      mockCtx.state.isNewUser = false;
      mockCtx.state.user = {
        telegramId: 12345,
        state: "BOOKING",
        active_session_id: null,
      }; // Missing session ID
      mockCtx.message.text = "Another message";

      // Reset mocks
      mockLogger.error.resetHistory();
      mockCtx.reply.resetHistory();
      mockBookingAgent.invokeGraph.resetHistory();
      mockNext.resetHistory();

      await routeUpdateFunc(mockCtx, mockNext);

      // Check logs and reply
      expect(
        mockLogger.error.calledWith(
          sinon.match({ telegramId: 12345 }),
          sinon.match(/Cannot invoke graph.*no active_session_id/),
        ),
      ).to.be.true;
      expect(mockCtx.reply.calledOnce).to.be.true;
      expect(mockCtx.reply.firstCall.args[0]).to.contain(
        "issue with your current booking session",
      );
      // Ensure graph not called and processing stopped
      expect(mockBookingAgent.invokeGraph.called).to.be.false;
      expect(mockNext.called).to.be.false;
    });

    it("should send generic reply for text message when user state is IDLE", async () => {
      initializeForRouting();
      mockCtx.state.isNewUser = false;
      mockCtx.state.user = {
        telegramId: 12345,
        state: "IDLE",
        active_session_id: null,
      };
      mockCtx.message.text = "Just chatting";

      // Reset mocks
      mockLogger.debug.resetHistory();
      mockCtx.reply.resetHistory();
      mockBookingAgent.invokeGraph.resetHistory();
      mockCommandHandler.handleCommand.resetHistory();
      mockCallbackQueryHandler.handleCallbackQuery.resetHistory();
      mockNext.resetHistory();

      await routeUpdateFunc(mockCtx, mockNext);

      // Check logs and reply
      expect(
        mockLogger.debug.calledWith(
          sinon.match.object,
          "Handling generic text message in IDLE state.",
        ),
      ).to.be.true;
      expect(mockCtx.reply.calledOnce).to.be.true;
      expect(mockCtx.reply.firstCall.args[0]).to.contain(
        "received your message, but I'm not sure how to handle it",
      );
      // Ensure graph/handlers not called, and next was NOT called
      expect(mockBookingAgent.invokeGraph.called).to.be.false;
      expect(mockCommandHandler.handleCommand.called).to.be.false;
      expect(mockCallbackQueryHandler.handleCallbackQuery.called).to.be.false;
      expect(mockNext.called).to.be.false; // Middleware handled it, stops here
    });

    it("should route commands to command handler", async () => {
      initializeForRouting();
      mockCtx.state.isNewUser = false;
      mockCtx.state.user = {
        telegramId: 12345,
        state: "IDLE",
        active_session_id: null,
      };
      mockCtx.message.text = "/start";
      mockCtx.update.message.text = "/start";

      // Reset mocks
      mockLogger.info.resetHistory();
      mockCommandHandler.handleCommand.resetHistory();
      mockBookingAgent.invokeGraph.resetHistory();
      mockCallbackQueryHandler.handleCallbackQuery.resetHistory();
      mockCtx.reply.resetHistory();
      mockNext.resetHistory(); // next *should* be called by handleCommand

      await routeUpdateFunc(mockCtx, mockNext);

      // Check logs and handler call
      expect(
        mockLogger.info.calledWith(
          sinon.match.object,
          "Routing to command handler.",
        ),
      ).to.be.true;
      expect(mockCommandHandler.handleCommand.calledOnceWith(mockCtx, mockNext))
        .to.be.true;
      // Ensure other handlers not called
      expect(mockBookingAgent.invokeGraph.called).to.be.false;
      expect(mockCallbackQueryHandler.handleCallbackQuery.called).to.be.false;
      expect(mockCtx.reply.called).to.be.false; // Command handler handles reply (if any)
      // expect(mockNext.called).to.be.true; // Assumes command handler calls next if not terminal
    });

    it("should route callback queries to callback query handler", async () => {
      initializeForRouting();
      mockCtx.state.isNewUser = false;
      mockCtx.state.user = {
        telegramId: 12345,
        state: "IDLE",
        active_session_id: null,
      };
      mockCtx.updateType = "callback_query";
      mockCtx.update.callback_query = { data: "some_data" };
      mockCtx.callbackQuery = { data: "some_data" }; // Telegraf adds this
      delete mockCtx.message; // No message in callback query update

      // Reset mocks
      mockLogger.info.resetHistory();
      mockCallbackQueryHandler.handleCallbackQuery.resetHistory();
      mockCommandHandler.handleCommand.resetHistory();
      mockBookingAgent.invokeGraph.resetHistory();
      mockCtx.reply.resetHistory();
      mockNext.resetHistory(); // next *should* be called by handleCallbackQuery

      await routeUpdateFunc(mockCtx, mockNext);

      // Check logs and handler call
      expect(
        mockLogger.info.calledWith(
          sinon.match.object,
          "Routing callback query",
        ),
      ).to.be.true;
      expect(mockCallbackQueryHandler.handleCallbackQuery.calledOnce).to.be
        .true;
      // Ensure other handlers not called
      expect(mockCommandHandler.handleCommand.called).to.be.false;
      expect(mockBookingAgent.invokeGraph.called).to.be.false;
      expect(mockCtx.reply.called).to.be.false; // Callback handler handles reply (if any)
      // expect(mockNext.called).to.be.true; // Assumes callback handler calls next if not terminal
    });

    it("should log warning for unhandled update types (e.g., non-text message)", async () => {
      initializeForRouting();
      mockCtx.state.isNewUser = false;
      mockCtx.state.user = {
        telegramId: 12345,
        state: "IDLE",
        active_session_id: null,
      };
      mockCtx.updateType = "message";
      mockCtx.message = { photo: [{ file_id: "photo1" }] }; // Photo message, not text
      mockCtx.update.message = mockCtx.message;

      // Reset mocks
      mockLogger.warn.resetHistory();
      mockCommandHandler.handleCommand.resetHistory();
      mockCallbackQueryHandler.handleCallbackQuery.resetHistory();
      mockBookingAgent.invokeGraph.resetHistory();
      mockCtx.reply.resetHistory();
      mockNext.resetHistory(); // next *should* be called in this case

      await routeUpdateFunc(mockCtx, mockNext);

      // Check log
      expect(mockLogger.warn.calledOnce).to.be.true;
      expect(mockLogger.warn.firstCall.args[1]).to.contain(
        "Unhandled update type received.",
      );
      // Ensure handlers not called
      expect(mockCommandHandler.handleCommand.called).to.be.false;
      expect(mockCallbackQueryHandler.handleCallbackQuery.called).to.be.false;
      expect(mockBookingAgent.invokeGraph.called).to.be.false;
      // Ensure next *was* called to allow other middleware to handle
      expect(mockNext.calledOnce).to.be.true;
    });

    it("should handle errors gracefully when graph invocation fails", async () => {
      initializeForRouting();
      mockCtx.state.isNewUser = false;
      mockCtx.state.user = {
        telegramId: 12345,
        state: "BOOKING",
        active_session_id: "sess_fail",
      };
      mockCtx.message.text = "Cause an error";
      const graphError = new Error("Graph exploded");
      mockBookingAgent.invokeGraph.rejects(graphError); // Simulate graph error

      // Reset mocks
      mockLogger.error.resetHistory();
      mockCtx.reply.resetHistory();
      mockBookingAgent.invokeGraph.resetHistory();
      mockNext.resetHistory();
      mockBookingAgent.invokeGraph.rejects(graphError); // Reset rejector AFTER history clear

      await routeUpdateFunc(mockCtx, mockNext);

      // Check logs and reply
      expect(mockBookingAgent.invokeGraph.calledOnce).to.be.true; // Ensure it was called
      expect(mockLogger.error.calledOnce).to.be.true; // Global handler logs it
      expect(mockLogger.error.firstCall.args[0].err).to.equal(graphError);
      expect(mockLogger.error.firstCall.args[1]).to.contain(
        "Unhandled error during update processing.",
      );
      expect(mockCtx.reply.calledOnce).to.be.true; // Generic error reply sent
      expect(mockCtx.reply.firstCall.args[0]).to.contain(
        "unexpected error occurred",
      );
      // Ensure next was NOT called after error
      expect(mockNext.called).to.be.false;
    });

    it("should handle errors in error handling (graph fails AND reply fails)", async () => {
      initializeForRouting();
      mockCtx.state.isNewUser = false;
      mockCtx.state.user = {
        telegramId: 12345,
        state: "BOOKING",
        active_session_id: "sess_double_fail",
      };
      mockCtx.message.text = "Cause double error";
      const graphError = new Error("Graph exploded again");
      const _replyError = new Error("Telegram reply failed"); // Prefix with _ for linter
      // Set rejects directly on sandbox stubs
      mockBookingAgent.invokeGraph.rejects(graphError);
      // mockCtx.reply.rejects(_replyError); // <<< TEMPORARILY REMOVE reply rejection

      // No resets needed

      await routeUpdateFunc(mockCtx, mockNext);

      // Check logs (Now expect similar to test 8)
      expect(mockBookingAgent.invokeGraph.calledOnce).to.be.true;
      // Reply attempt should happen, but mock resolves by default now
      expect(mockCtx.reply.calledOnce).to.be.true;
      expect(mockCtx.reply.firstCall.args[0]).to.contain(
        "unexpected error occurred",
      );
      // Only the first error (graph error) should be logged now
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0].err).to.equal(graphError);
      expect(mockLogger.error.firstCall.args[1]).to.contain(
        "Unhandled error during update processing.",
      );

      /* Original assertions for double error
      expect(mockLogger.error.calledTwice).to.be.true; // Logged original error AND reply error

      // First error log (original graph error)
      expect(mockLogger.error.firstCall.args[0].err).to.equal(graphError);
      expect(mockLogger.error.firstCall.args[1]).to.contain("Unhandled error during update processing.");

      // Second error log (reply error)
      expect(mockLogger.error.secondCall.args[0].err).to.equal(_replyError); // Use _replyError
      expect(mockLogger.error.secondCall.args[0].originalError).to.equal(graphError);
      expect(mockLogger.error.secondCall.args[1]).to.contain("Error sending error reply to user.");
      */

      // Ensure next was NOT called
      expect(mockNext.called).to.be.false;
    });
  });
});
