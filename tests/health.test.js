const request = require("supertest");
const sinon = require("sinon");
const { initializeApp } = require("../src/app"); // Import the function

// --- Mocks Setup --- (Simplified version based on app.test.js)
let app;
let sandbox;
let mockLogger, mockConfig, mockErrorHandlerMiddleware;
// Add other mocks IF initializeApp strictly requires them even for /health
// For now, assume these are enough for the health check setup part.
let mockPrisma = {}; // Basic mock
let mockBot = {}; // Basic mock
let mockUpdateRouter = { routeUpdate: () => {} }; // Basic mock
let mockUserLookupMiddleware = () => {}; // Basic mock
let mockStateManager = {};
let mockCreateTelegramNotifier = () => ({});
let mockGoogleCalendarTool = () => ({});
let mockBookingAgent = {};
let mockCommandHandler = {};
let mockCallbackHandler = {};
let mockGraphNodes = {};
let mockInitializeGraph = () => ({});
let mockInitUserLookup = () => {};
let mockSessionTypes = {};
let mockGraphEdges = {};
// --- End Mocks ---

describe("Health Check Endpoint", () => {
  before((done) => {
    // Use 'before' to initialize app once for the suite
    sandbox = sinon.createSandbox();

    // Mock basic dependencies needed by initializeApp
    mockLogger = {
      info: sandbox.stub(),
      error: sandbox.stub(),
      warn: sandbox.stub(),
      debug: sandbox.stub(),
      child: sandbox.stub().returnsThis(),
    };
    mockConfig = {
      nodeEnv: "test",
      appUrl: "http://test.health.app", // Unique URL for test
      ngrokUrl: null,
      // Add other required config fields if needed by initializeApp
      telegramBotToken: "fake-token",
      webhookSecretPath: "test-secret-path",
    };
    mockErrorHandlerMiddleware = sandbox.stub();

    // Refine other mocks if necessary
    mockPrisma = {
      $connect: sandbox.stub(),
      $disconnect: sandbox.stub(),
      setLogger: sandbox.stub(),
    };
    mockBot = {
      telegram: { setWebhook: sandbox.stub().resolves(true) },
      options: {},
      catch: sandbox.stub(),
      use: sandbox.stub(),
      secretPathComponent: sandbox.stub().returns(mockConfig.webhookSecretPath), // Add missing stub
    };
    mockUpdateRouter = {
      initialize: sandbox.stub().returns(sinon.stub()),
      routeUpdate: sinon.stub(),
    }; // Mock initialize too
    mockUserLookupMiddleware = sandbox.stub();
    mockStateManager = { setLogger: sandbox.stub() };
    mockCreateTelegramNotifier = sandbox
      .stub()
      .returns({ initialize: sandbox.stub() });
    mockGoogleCalendarTool = sandbox.stub().returns({});
    mockBookingAgent = { initializeAgent: sandbox.stub() };
    mockCommandHandler = { initialize: sandbox.stub() };
    mockCallbackHandler = { initialize: sandbox.stub() };
    mockGraphNodes = { initializeNodes: sandbox.stub().returns({}) };
    mockInitializeGraph = sandbox
      .stub()
      .returns({ compile: sandbox.stub().returns({}) });
    mockInitUserLookup = sandbox.stub().returns(mockUserLookupMiddleware);
    mockSessionTypes = { getAll: sandbox.stub().returns([]) };

    // Define the dependencies object using mocks
    const mockDependencies = {
      logger: mockLogger,
      prisma: mockPrisma,
      bot: mockBot,
      config: mockConfig,
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
      userLookupMiddleware: mockUserLookupMiddleware, // Pass the middleware itself
      updateRouter: mockUpdateRouter,
      errorHandlerMiddleware: mockErrorHandlerMiddleware,
    };

    try {
      // Initialize the app
      app = initializeApp(mockDependencies);
      done(); // Signal completion
    } catch (err) {
      done(err); // Signal error
    }
  });

  after(() => {
    sandbox.restore(); // Clean up sandbox
  });

  it("GET /health should return 200 OK", (done) => {
    request(app).get("/health").expect(200, "OK", done);
  });
});
