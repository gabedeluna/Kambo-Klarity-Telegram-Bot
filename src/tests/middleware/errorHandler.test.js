/**
 * Tests for the global error handling middleware.
 * Verifies that the error handler correctly catches, logs, and responds to different types of errors.
 */
const request = require("supertest");
const { expect } = require("chai");
const sinon = require("sinon");
const express = require("express");
const AppError = require("../../errors/AppError");
const NotFoundError = require("../../errors/NotFoundError");

// Import the actual error handler but with a mocked logger
const proxyquire = require("proxyquire").noCallThru();

describe("Error Handler Middleware", () => {
  let app;
  let mockLogger;
  let errorHandler;
  let loggerSpy;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();

    // Create a mock logger
    mockLogger = {
      error: sinon.spy(),
    };

    // Use proxyquire to inject our mock logger
    errorHandler = proxyquire("../../middleware/errorHandler", {
      "../core/logger": mockLogger,
    });

    // Set up a reference to the spy for easier assertions
    loggerSpy = mockLogger.error;
  });

  it("should handle synchronous errors with 500 status code and generic message", async () => {
    // Add a test route that throws a synchronous error
    app.get("/test-error-sync", () => {
      throw new Error("Sync Test Error");
    });

    // Register error handler
    app.use(errorHandler);

    // Test the route
    const response = await request(app)
      .get("/test-error-sync")
      .expect("Content-Type", /json/)
      .expect(500);

    // Verify response
    expect(response.body).to.deep.include({
      status: "error",
      message: "Internal Server Error",
    });

    // Verify logger was called
    expect(loggerSpy.calledOnce).to.be.true;
    expect(loggerSpy.firstCall.args[1]).to.include("Sync Test Error");
  });

  it("should handle errors passed to next() with 500 status code", async () => {
    // Add a test route that passes an error to next()
    app.get("/test-error-async", (req, res, next) => {
      next(new Error("Async Test Error"));
    });

    // Register error handler
    app.use(errorHandler);

    // Test the route
    const response = await request(app)
      .get("/test-error-async")
      .expect("Content-Type", /json/)
      .expect(500);

    // Verify response
    expect(response.body).to.deep.include({
      status: "error",
      message: "Internal Server Error",
    });

    // Verify logger was called
    expect(loggerSpy.calledOnce).to.be.true;
    expect(loggerSpy.firstCall.args[1]).to.include("Async Test Error");
  });

  it("should handle AppError with correct status code and specific message", async () => {
    // Add a test route that throws an AppError
    app.get("/test-app-error", (req, res, next) => {
      next(new AppError("Specific operational error", 400));
    });

    // Register error handler
    app.use(errorHandler);

    // Test the route
    const response = await request(app)
      .get("/test-app-error")
      .expect("Content-Type", /json/)
      .expect(400);

    // Verify response
    expect(response.body).to.deep.include({
      status: "error",
      message: "Specific operational error",
    });

    // Verify logger was called
    expect(loggerSpy.calledOnce).to.be.true;
    expect(loggerSpy.firstCall.args[1]).to.include(
      "Specific operational error",
    );
  });

  it("should handle NotFoundError with 404 status code", async () => {
    // Add a test route that throws a NotFoundError
    app.get("/test-not-found", (req, res, next) => {
      next(new NotFoundError());
    });

    // Register error handler
    app.use(errorHandler);

    // Test the route
    const response = await request(app)
      .get("/test-not-found")
      .expect("Content-Type", /json/)
      .expect(404);

    // Verify response
    expect(response.body).to.deep.include({
      status: "error",
      message: "Resource not found",
    });

    // Verify logger was called
    expect(loggerSpy.calledOnce).to.be.true;
    expect(loggerSpy.firstCall.args[1]).to.include("Resource not found");
  });

  it("should handle custom NotFoundError message", async () => {
    // Add a test route that throws a NotFoundError with custom message
    app.get("/test-custom-not-found", (req, res, next) => {
      next(new NotFoundError("Custom not found message"));
    });

    // Register error handler
    app.use(errorHandler);

    // Test the route
    const response = await request(app)
      .get("/test-custom-not-found")
      .expect("Content-Type", /json/)
      .expect(404);

    // Verify response
    expect(response.body).to.deep.include({
      status: "error",
      message: "Custom not found message",
    });

    // Verify logger was called
    expect(loggerSpy.calledOnce).to.be.true;
    expect(loggerSpy.firstCall.args[1]).to.include("Custom not found message");
  });
});
