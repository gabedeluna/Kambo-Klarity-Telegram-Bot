"use strict";

const { expect } = require("chai");
const sinon = require("sinon");
const dotenv = require("dotenv");

const REQUIRED_ENV_KEYS = [
  "TG_TOKEN",
  "DATABASE_URL",
  "FORM_URL",
  "LANGCHAIN_API_KEY",
];
const ALL_RELEVANT_KEYS = [
  ...REQUIRED_ENV_KEYS,
  "PORT",
  "AI_PROVIDER",
  "OPENAI_API_KEY",
  "GOOGLE_API_KEY",
];

describe("core/env Module", () => {
  let originalEnvValues = {};
  let sandbox;

  beforeEach(() => {
    // Backup original values of relevant env vars
    originalEnvValues = {};
    ALL_RELEVANT_KEYS.forEach((key) => {
      if (process.env[key] !== undefined) {
        originalEnvValues[key] = process.env[key];
      }
      // Ensure keys are initially deleted for the test setup
      delete process.env[key];
    });

    // Clear cache for env module before each test
    // Ensures that require('../../src/core/env') re-runs the initialization logic
    delete require.cache[require.resolve("../../src/core/env")];

    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    // Clear any env vars set during the test
    ALL_RELEVANT_KEYS.forEach((key) => delete process.env[key]);

    // Restore original values
    Object.keys(originalEnvValues).forEach((key) => {
      process.env[key] = originalEnvValues[key];
    });

    // Optional: Clear cache again just in case (might be redundant)
    delete require.cache[require.resolve("../../src/core/env")];
    sandbox.restore();
  });

  const setupEnv = (presentVars) => {
    const defaults = {
      TG_TOKEN: "mock_token",
      DATABASE_URL: "mock_db_url",
      FORM_URL: "mock_form_url",
      LANGCHAIN_API_KEY: "mock_langchain_key",
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "mock_openai_key",
      GOOGLE_API_KEY: "mock_google_key",
    };

    // Start with original system env, but clean the required ones
    const envToSet = {};
    ALL_RELEVANT_KEYS.forEach((key) => delete envToSet[key]);

    // Add back only the ones meant to be present for this test
    for (const key of presentVars) {
      if (defaults[key]) {
        envToSet[key] = defaults[key];
      }
    }
    Object.keys(envToSet).forEach((key) => {
      process.env[key] = envToSet[key];
    });
  };

  it("should load environment variables and export a frozen object when all required vars are present", () => {
    setupEnv(["TG_TOKEN", "DATABASE_URL", "FORM_URL"]);
    process.env.PORT = "5432";

    const config = require("../../src/core/env");

    expect(config).to.be.an("object");
    expect(config.tgToken).to.equal("mock_token");
    expect(config.databaseUrl).to.equal("mock_db_url");
    expect(config.formUrl).to.equal("mock_form_url");
    expect(config.port).to.equal(5432);

    expect(Object.isFrozen(config)).to.be.true;
    expect(() => {
      config.tgToken = "new_value";
    }).to.throw(TypeError, /Cannot assign to read only property/);
  });

  it("should throw error if TG_TOKEN is missing", () => {
    setupEnv(["DATABASE_URL", "FORM_URL"]);
    sandbox.stub(dotenv, "config").returns({});
    const path = require.resolve("../../src/core/env");
    expect(() => {
      delete require.cache[path];
      require(path);
    }).to.throw(
      Error,
      "Missing required env vars for provider 'openai': TG_TOKEN",
    );
  });

  it("should throw error if DATABASE_URL is missing", () => {
    setupEnv(["TG_TOKEN", "FORM_URL"]);
    sandbox.stub(dotenv, "config").returns({});
    const path = require.resolve("../../src/core/env");
    expect(() => {
      delete require.cache[path];
      require(path);
    }).to.throw(
      Error,
      "Missing required env vars for provider 'openai': DATABASE_URL",
    );
  });

  it("should throw error if FORM_URL is missing", () => {
    setupEnv(["TG_TOKEN", "DATABASE_URL"]);
    sandbox.stub(dotenv, "config").returns({});
    const path = require.resolve("../../src/core/env");
    expect(() => {
      delete require.cache[path];
      require(path);
    }).to.throw(
      Error,
      "Missing required env vars for provider 'openai': FORM_URL",
    );
  });

  it("should throw error if multiple required vars are missing", () => {
    setupEnv(["DATABASE_URL"]);
    sandbox.stub(dotenv, "config").returns({});
    const path = require.resolve("../../src/core/env");
    expect(() => {
      delete require.cache[path];
      require(path);
    }).to.throw(
      Error,
      "Missing required env vars for provider 'openai': TG_TOKEN, FORM_URL",
    );
  });

  it("should use default PORT 3000 if not set in environment", () => {
    setupEnv(["TG_TOKEN", "DATABASE_URL", "FORM_URL"]);
    delete process.env.PORT;

    const config = require("../../src/core/env");
    expect(config.port).to.equal(3000);
  });

  it("uses PORT from environment if set", () => {
    process.env.TG_TOKEN = "temp_test_token";
    process.env.DATABASE_URL = "temp_db_url";
    process.env.FORM_URL = "temp_form_url";
    process.env.PORT = "8080";

    const config = require("../../src/core/env");
    expect(config.port).to.equal(8080);
  });
});
