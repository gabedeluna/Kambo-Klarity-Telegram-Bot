const request = require("supertest");
const app = require("../app"); // Adjust path as necessary

describe("Health Check Endpoint", () => {
  it("GET /health should return 200 OK", (done) => {
    request(app).get("/health").expect(200, "OK", done);
  });
});
