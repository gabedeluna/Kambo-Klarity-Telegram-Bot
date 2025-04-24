"use strict";

const { expect } = require("chai");
const sinon = require("sinon");
const dotenv = require("dotenv");

let originalEnv = {};

before(() => {
  originalEnv = { ...process.env };
});

afterEach(() => {
  process.env = { ...originalEnv };
  delete require.cache[require.resolve("../../core/env")];
  sinon.restore();
});

describe("core/env singleton", () => {
  it("exports a frozen object with expected properties when all required vars are present", () => {
    process.env.TG_TOKEN = process.env.TG_TOKEN || "temp_test_token";
    process.env.DATABASE_URL = process.env.DATABASE_URL || "temp_db_url";
    process.env.FORM_URL = process.env.FORM_URL || "temp_form_url";

    const config = require("../../core/env");

    expect(config).to.be.an("object");
    expect(config.tgToken).to.be.a("string").and.not.empty;
    expect(config.databaseUrl).to.be.a("string").and.not.empty;
    expect(config.formUrl).to.be.a("string").and.not.empty;

    expect(Object.isFrozen(config)).to.be.true;
    expect(() => {
      config.tgToken = "new_value";
    }).to.throw(TypeError);
  });

  it("throws when a required variable (TG_TOKEN) is missing", () => {
    const dotenvStub = sinon.stub(dotenv, "config").returns({});

    process.env.DATABASE_URL = "mock_db_url_for_test";
    process.env.FORM_URL = "mock_form_url_for_test";
    delete process.env.TG_TOKEN;

    let error = null;
    try {
      require("../../core/env");
    } catch (e) {
      error = e;
    }

    // Assertions about the error
    expect(error).to.be.instanceOf(Error);
    expect(error.message).to.equal("Missing required env vars: TG_TOKEN");
    expect(dotenvStub.calledOnce).to.be.true; // Verify dotenv.config was called (but stubbed)
  });

  it("uses default PORT 3000 if not set in environment", () => {
    process.env.TG_TOKEN = "temp_test_token";
    process.env.DATABASE_URL = "temp_db_url";
    process.env.FORM_URL = "temp_form_url";
    delete process.env.PORT;

    const config = require("../../core/env");
    expect(config.port).to.equal(3000);
  });

  it("uses PORT from environment if set", () => {
    process.env.TG_TOKEN = "temp_test_token";
    process.env.DATABASE_URL = "temp_db_url";
    process.env.FORM_URL = "temp_form_url";
    process.env.PORT = "8080";

    const config = require("../../core/env");
    expect(config.port).to.equal("8080");
  });
});
