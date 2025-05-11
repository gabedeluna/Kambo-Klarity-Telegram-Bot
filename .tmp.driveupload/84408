const request = require("supertest");
const sinon = require("sinon");
const { expect } = require("chai");
const { initializeApp } = require("../src/app"); // Import the function

// --- Mocks Setup (using let, declared outside) ---
let sandbox;
let app;
let mockLogger;
let mockPrisma;
let mockBotInstance;
let mockSessionTypes;
let mockCreateTelegramNotifier;
let mockTelegramNotifierInstance;
let mockCallbackHandler;
let mockRegistrationHandler;
let mockExpressRouter;
let mockErrorHandlerMiddleware;
let mockStateManager;
let mockGoogleCalendarTool;
let mockBookingAgent;
let mockGraphNodes;
let mockInitializeGraph;
let mockGraphEdges;
let mockCommandHandler;
let mockInitUserLookup;
let mockUserLookupMiddleware;
let mockUpdateRouter;
let mockApiRoutes;

describe("Health Check Endpoint", () => {
  before(async () => {
    sandbox = sinon.createSandbox();

    // --- Re-initialize mocks inside before hook ---
    mockLogger = {
      info: sandbox.stub(),
      error: sandbox.stub(),
      warn: sandbox.stub(),
      debug: sandbox.stub(),
    };
    mockPrisma = {
      $connect: sandbox.stub().resolves(),
      $disconnect: sandbox.stub().resolves(),
      sessionType: { findMany: sandbox.stub().resolves([]) },
      users: { findUnique: sandbox.stub() },
    };
    mockBotInstance = {
      telegram: {
        setMyCommands: sandbox.stub().resolves(true),
        setWebhook: sandbox.stub().resolves(true),
      },
      secretPathComponent: sandbox.stub().returns("test-secret-path"),
      use: sandbox.stub(),
      on: sandbox.stub(),
      catch: sandbox.stub(),
      launch: sandbox.stub().resolves(),
    };
    mockSessionTypes = { getAll: sandbox.stub().returns({}) };
    mockTelegramNotifierInstance = {
      /* basic notifier stubs */
    };
    mockCreateTelegramNotifier = sandbox
      .stub()
      .returns(mockTelegramNotifierInstance);
    mockCallbackHandler = {
      initialize: sandbox.stub(),
      handleCallbackQuery: sandbox.stub(),
    };
    mockRegistrationHandler = {
      initialize: sandbox.stub(),
      handleRegistration: sandbox.stub(),
    };
    mockExpressRouter = sandbox.stub().callsFake((req, res, next) => next());
    mockErrorHandlerMiddleware = sandbox
      .stub()
      .callsFake((err, req, res, _next) => {
        res.status(500).send("Error");
      });
    mockStateManager = {
      initialize:
        sandbox.stub() /* Add other methods if needed by health test context */,
    };
    mockGoogleCalendarTool = class MockGoogleCalendarTool {
      constructor() {}
    };
    mockGoogleCalendarTool.prototype.initialize = sandbox.stub();
    mockBookingAgent = { initializeAgent: sandbox.stub() };
    mockGraphNodes = { initializeNodes: sandbox.stub() };
    mockInitializeGraph = sandbox.stub().returns({
      compile: sandbox.stub().returns({
        /* compiled graph */
      }),
    });
    mockGraphEdges = {
      /* minimal mock, likely ok */
    };
    mockCommandHandler = { initialize: sandbox.stub() };
    mockInitUserLookup = sandbox.stub();
    mockUserLookupMiddleware = sandbox
      .stub()
      .callsFake((req, res, next) => next());
    mockUpdateRouter = {
      initialize: sandbox.stub(),
      middleware: sandbox.stub().callsFake((ctx, next) => next()),
    };
    mockApiRoutes = mockExpressRouter;

    // Assemble the COMPLETE dependencies object for initializeApp
    const mockDependencies = {
      logger: mockLogger,
      prisma: mockPrisma,
      bot: mockBotInstance,
      config: { nodeEnv: "test" },
      sessionTypes: mockSessionTypes,
      stateManager: mockStateManager,
      createTelegramNotifier: mockCreateTelegramNotifier,
      GoogleCalendarTool: mockGoogleCalendarTool,
      bookingAgent: mockBookingAgent,
      graphNodes: mockGraphNodes,
      initializeGraph: mockInitializeGraph,
      graphEdges: mockGraphEdges,
      commandHandler: mockCommandHandler,
      callbackHandler: mockCallbackHandler,
      initUserLookup: mockInitUserLookup,
      userLookupMiddleware: mockUserLookupMiddleware,
      updateRouter: mockUpdateRouter,
      errorHandlerMiddleware: mockErrorHandlerMiddleware,
      apiRoutes: mockApiRoutes,
      formsRouter: mockExpressRouter,
      registrationHandler: mockRegistrationHandler,
    };

    // Initialize the app
    try {
      const result = await initializeApp(mockDependencies);
      app = result.app;
    } catch (error) {
      console.error(
        "Error during initializeApp in health.test.js before hook:",
        error,
      );
      throw error;
    }
  });

  after((done) => {
    sandbox.restore();
    done();
  });

  it("GET /health should return 200 OK", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).to.equal(200);
    expect(res.text).to.equal("OK");
  });
});
