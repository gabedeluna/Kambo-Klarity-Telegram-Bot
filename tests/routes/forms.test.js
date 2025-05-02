const request = require("supertest");
const express = require("express");
const { expect } = require("chai");
const sinon = require("sinon"); // Import sinon for mocking
const formRoutes = require("../../src/routes/forms");

// Create a minimal Express app instance for testing
const app = express();
app.use(express.json()); // Add json parser for potential POST bodies

// Mock dependencies required by the router's initialize function
const mockLogger = {
  info: sinon.spy(),
  error: sinon.spy(),
  warn: sinon.spy(),
  debug: sinon.spy(),
};

// --- ADDED: Mock for Registration Handler ---
const mockRegistrationHandler = {
  // Stub the method that the route will call
  handleRegistrationSubmit: sinon.stub().callsFake((req, res) => {
    // Simulate the 'Not Implemented' behavior for this test
    res.status(501).json({
      message: "POST /submit-registration Not Implemented Yet (Mocked)",
    });
  }),
  // Add other methods if needed by other tests in this file
};
// --- END ADDED ---

// Initialize the router with mock dependencies
formRoutes.initialize({
  logger: mockLogger,
  registrationHandler: mockRegistrationHandler, // Pass the mock handler
});

// Mount the actual router
app.use("/", formRoutes.router); // Use the .router property

describe("Form Submission Routes Integration Tests", () => {
  it("POST /submit-registration should return 501 Not Implemented", async () => {
    const res = await request(app).post("/submit-registration");
    expect(res.statusCode).to.equal(501);
    expect(res.body.message).to.match(
      /POST \/submit-registration Not Implemented Yet/i,
    );
  });

  // Note: GET routes for HTML files are handled by express.static and are not part of this router,
  // so they are not tested here.
});
