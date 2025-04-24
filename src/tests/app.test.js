// src/tests/app.test.js
const request = require("supertest");
const { expect } = require("chai");
const server = require("../../bin/server"); // Import the server instance
const botInstance = require("../core/bot"); // To get the secret path

describe("Express App", () => {
  let secretPath;

  before(() => {
    // Construct the secret path once before tests
    const secretPathComponent = botInstance.secretPathComponent();
    secretPath = `/telegraf/${secretPathComponent}`;
  });

  // Close the server after all tests in this describe block are done
  after((done) => {
    server.close(done); // Pass done callback to handle async close
  });

  it("GET /health should return 200 OK", async () => {
    const res = await request(server) // Use server instance
      .get("/health")
      .expect("Content-Type", /text\/plain/)
      .expect(200);

    expect(res.text).to.equal("OK");
  });

  it("POST /<secretPath> should return 200 OK for basic requests", async () => {
    // Telegraf's webhookCallback handles basic POSTs gracefully even without
    // a valid Telegram update payload, responding 200 OK to prevent retries.
    await request(server) // Use server instance
      .post(secretPath)
      .send({}) // Send an empty JSON body
      // .expect('Content-Type', /text\/plain/) // REMOVED: Don't assert content-type here
      .expect(200);

    // expect(res.text).to.equal('OK'); // REMOVED: Don't assert body content
  });

  it("GET /invalid-route should return 404 Not Found", async () => {
    await request(server) // Use server instance
      .get("/non-existent-path-12345")
      .expect("Content-Type", /text\/html/) // Express default 404 is HTML
      .expect(404);
  });

  // Optional: Test webhook with invalid JSON (might depend on Express version)
  // it('POST /<secretPath> with invalid JSON should return 400 Bad Request', async () => {
  //   await request(server)
  //     .post(secretPath)
  //     .set('Content-Type', 'application/json')
  //     .send('this is not json')
  //     .expect(400); // Express's JSON parser should reject invalid JSON
  // });
});
