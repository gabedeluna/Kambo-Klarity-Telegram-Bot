const request = require("supertest");
const express = require("express");
const { expect } = require("chai");
const apiRoutes = require("../../src/routes/api");

// Create a minimal Express app instance for testing
const app = express();
app.use("/api", apiRoutes);

describe("API Routes Integration Tests", () => {
  it("GET /api/user-data should return 501 Not Implemented", async () => {
    const res = await request(app).get("/api/user-data");
    expect(res.statusCode).toEqual(501);
    expect(res.body.message).toMatch(
      /GET \/api\/user-data Not Implemented Yet/i,
    );
  });

  it("POST /api/submit-waiver should return 501 Not Implemented", async () => {
    const res = await request(app).post("/api/submit-waiver");
    expect(res.statusCode).toEqual(501);
    expect(res.body.message).toMatch(
      /POST \/api\/submit-waiver Not Implemented Yet/i,
    );
  });

  it("POST /api/waiver-completed should return 501 Not Implemented", async () => {
    const res = await request(app).post("/api/waiver-completed");
    expect(res.statusCode).toEqual(501);
    expect(res.body.message).toMatch(
      /POST \/waiver-completed Not Implemented Yet/i,
    );
  });
});
