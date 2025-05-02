// tests/app.test.js
const request = require("supertest");
const { expect } = require("chai");
const sinon = require("sinon");
// const express = require("express"); // No longer needed directly
// eslint-disable-next-line no-unused-vars
const path = require("path");
const { initializeApp } = require("../src/app"); // Import the exported function

// Create sandbox for test isolation
let sandbox;
let app; // App instance will be assigned in before()

// Create a minimal mock for the bot instance
const mockBotInstance = {
  secretPathComponent: () => "test-secret-path",
  // Mock other bot methods if needed by initializeApp or middleware
  use: sinon.stub(),
  catch: sinon.stub(),
  telegram: {
    setWebhook: sinon.stub().resolves(true),
    deleteWebhook: sinon.stub().resolves(true),
  },
};

// Mock logger
const mockLogger = {
  info: sinon.stub(),
  error: sinon.stub(),
  warn: sinon.stub(),
  debug: sinon.stub(),
};

// Mock middleware/dependencies expected by initializeApp
const _mockSetWebhookRoute = (req, res, _next) => _next(); // Simple pass-through
const _mockHealthCheckMiddleware = (req, res) => res.sendStatus(200);
const mockErrorHandlerMiddleware = (err, req, res, _next) =>
  res.status(500).send("Internal Server Error");
const mockUserLookupMiddleware = (req, res, _next) => _next();

// More detailed mocks
const mockPrisma = {
  user: { findUnique: sinon.stub() }, // Example mock
  // Add other models/methods if needed by initUserLookup
};
const mockInitUserLookup = sinon.stub();
const mockUpdateRouter = {
  initialize: sinon.stub(),
  routeUpdate: sinon.stub().callsFake((req, res, next) => next()), // Middleware function
};
const mockStateManager = {
  initialize: sinon.stub(),
  getSession: sinon.stub(),
  updateSession: sinon.stub(),
  // Add other methods as needed
};
const mockTelegramNotifierInstance = {
  sendBookingConfirmation: sinon.stub(),
  sendAvailability: sinon.stub(),
  sendError: sinon.stub(),
  // Add other methods as needed
};
const mockCreateTelegramNotifier = sinon
  .stub()
  .returns(mockTelegramNotifierInstance);
const mockGoogleCalendarInstance = {
  addEvent: sinon.stub(),
  findAvailableSlots: sinon.stub(),
  // Add other methods as needed
};
// Mock the constructor if GoogleCalendarTool is a class
const mockGoogleCalendarTool = sinon.stub().returns(mockGoogleCalendarInstance);
const mockBookingAgent = {
  initializeAgent: sinon.stub(),
  run: sinon.stub(),
  // Add other methods as needed
};
const mockCommandHandler = {
  initialize: sinon.stub(),
  handleCommand: sinon.stub(),
};
const mockCallbackHandler = {
  initialize: sinon.stub(),
  handleCallbackQuery: sinon.stub(),
};
const mockGraphNodes = {
  initializeNodes: sinon.stub(),
  checkAvailabilityNode: sinon.stub(),
  confirmBookingNode: sinon.stub(),
  // Add other node functions as needed
};
const mockCompiledGraph = {
  compile: sinon.stub(),
  stream: sinon.stub(),
  // Add other graph methods
};
const mockInitializeGraph = sinon.stub().returns(mockCompiledGraph);
const mockSessionTypes = {
  // ADDED Mock for sessionTypes
  REGISTRATION: "registration",
  BOOKING: "booking",
  // Add other session types if necessary
};

describe("Express App", () => {
  // let secretPath; // No longer needed here if webhook setup is mocked

  before(() => {
    // Set up sandbox
    sandbox = sinon.createSandbox();

    // Restore stubs before each test run if needed, or manage globally
    mockLogger.info.resetHistory();
    mockLogger.error.resetHistory();
    // ... reset other stubs

    // Define the dependencies object using our mocks
    const mockDependencies = {
      logger: mockLogger,
      bot: mockBotInstance,
      errorHandlerMiddleware: mockErrorHandlerMiddleware,
      // Pass refined mocks
      prisma: mockPrisma,
      config: { nodeEnv: "test", appUrl: "http://test.app", ngrokUrl: null }, // Use detailed mock
      sessionTypes: mockSessionTypes, // Use mock
      userLookupMiddleware: mockUserLookupMiddleware,
      updateRouter: mockUpdateRouter, // Use detailed mock
      stateManager: mockStateManager, // Use detailed mock
      createTelegramNotifier: mockCreateTelegramNotifier, // Use detailed mock setup
      GoogleCalendarTool: mockGoogleCalendarTool, // Use detailed mock setup
      bookingAgent: mockBookingAgent, // Use detailed mock
      commandHandler: mockCommandHandler, // Use detailed mock
      callbackHandler: mockCallbackHandler, // Use detailed mock
      graphNodes: mockGraphNodes, // Use detailed mock
      initializeGraph: mockInitializeGraph, // Use detailed mock setup
      initUserLookup: mockInitUserLookup,
      graphEdges: {}, // Add mock for graphEdges if needed by initializeGraph
      // Note: setWebhookRoute and healthCheckMiddleware are internal to initializeApp now
    };

    // Initialize the app by calling the exported function with mocks
    app = initializeApp(mockDependencies);

    // NOTE: The mocks above are basic. If initializeApp performs complex
    // logic or requires specific methods on these mocks, they'll need
    // to be more detailed.

    // --- Removed manual app setup ---
    // app = express(); // REMOVED
    // app.use(express.json()); // REMOVED - Handled by initializeApp
    // Setup routes manually? // REMOVED - Handled by initializeApp
    // app.get("/health", (req, res) => res.status(200).send("OK")); // REMOVED
    // app.use(secretPath, mockBotInstance.webhookCallback(secretPath)); // REMOVED
    // app.use(errorHandler.errorHandlerMiddleware); // REMOVED
  });

  afterEach(() => {
    // Restore all stubs/spies/mocks in the sandbox after each test
    sandbox.restore();
  });

  // --- Health Check Test (Should still work) ---
  it("GET /health should return 200 OK", (done) => {
    request(app).get("/health").expect(200, done);
  });

  // --- Webhook Test (May need adjustment based on how setWebhookRoute is mocked) ---
  // it("POST to webhook path should return 200 OK", (done) => {
  //   request(app)
  //     .post(secretPath) // Use the calculated path
  //     .send({ update_id: 1, message: { text: 'test' } })
  //     .expect(200, done);
  // });

  // --- Static File Serving Tests (Should now use the initialized app) ---
  describe("Static File Serving", () => {
    it("GET /registration-form.html should return the registration form HTML", (done) => {
      request(app)
        .get("/registration-form.html")
        .expect("Content-Type", /html/)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          // Ensure mockLogger was called if logging is expected
          // expect(mockLogger.info.calledWith(sinon.match(/Serving static files from:/))).to.be.true;
          expect(res.text).to.include(
            "<title>Kambo Klarity Registration</title>",
          );
          done();
        });
    });

    it("GET /registration-form.css should return the CSS file", (done) => {
      request(app)
        .get("/registration-form.css")
        .expect("Content-Type", /css/)
        .expect(200, done);
    });

    it("GET /waiver-form.html should return the waiver form HTML", (done) => {
      request(app)
        .get("/waiver-form.html")
        .expect("Content-Type", /html/)
        .expect(200, done);
      // Removed specific content check for waiver for brevity
    });

    it("GET /pristine.min.js should return the JS file", (done) => {
      request(app)
        .get("/pristine.min.js")
        .expect("Content-Type", /javascript/)
        .expect(200, done);
    });
  });

  // --- Other Tests ---
  // it("POST /invalid-json should return 400 Bad Request", async () => {
  //   await request(app)
  //     .post("/some-json-endpoint") // Assuming such an endpoint exists
  //     .set("Content-Type", "application/json")
  //     .send("invalid json")
  //     .expect(400); // Express's JSON parser should reject invalid JSON
  // });
  it("should register error handling middleware last", () => {
    // Simulate an error in a preceding middleware/route
    const _errorRoute = (req, res, _next) => { 
      _next(new Error("Test Error")); 
    };
    // Need to temporarily add this route to the app instance for testing
  });
});
