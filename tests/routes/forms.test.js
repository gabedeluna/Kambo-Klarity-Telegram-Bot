const request = require("supertest");
const express = require("express");
const { expect } = require("chai");
const formRoutes = require("../../src/routes/forms");

// Create a minimal Express app instance for testing
const app = express();
// Mount at root, similar to how it's done in app.js
app.use("/", formRoutes);

describe("Form Submission Routes Integration Tests", () => {
  it("POST /submit-registration should return 501 Not Implemented", async () => {
    const res = await request(app).post("/submit-registration");
    expect(res.statusCode).toEqual(501);
    expect(res.body.message).toMatch(
      /POST \/submit-registration Not Implemented Yet/i,
    );
  });

  // Note: GET routes for HTML files are handled by express.static and are not part of this router,
  // so they are not tested here.
});
