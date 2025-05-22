// tests/core/env.test.js

// Mock logger before any imports that might use it
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};
jest.mock("../../src/core/logger", () => mockLogger);
// Mock dotenv to prevent it from actually loading .env files during tests
jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

describe("Core Environment Configuration (env.js)", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules(); // Crucial to re-evaluate env.js with new process.env
    process.env = { ...ORIGINAL_ENV }; // Reset to original, then modify as needed
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    mockLogger.warn.mockClear();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV; // Restore original environment
  });

  const setRequiredEnvVars = (provider = "openai") => {
    process.env.TG_TOKEN = "test_tg_token";
    process.env.DATABASE_URL = "test_db_url";
    process.env.FORM_URL = "test_form_url";
    process.env.NGROK_URL = "test_ngrok_url";
    process.env.AI_PROVIDER = provider;
    if (provider === "openai") {
      process.env.OPENAI_API_KEY = "test_openai_key";
    } else if (provider === "gemini") {
      process.env.GOOGLE_API_KEY = "test_google_key";
    }
  };

  it("should load config successfully when all required vars are present (default AI_PROVIDER=openai)", () => {
    setRequiredEnvVars("openai");
    const envConfig = require("../../src/core/env");
    expect(envConfig.tgToken).toBe("test_tg_token");
    expect(envConfig.openaiApiKey).toBe("test_openai_key");
    expect(envConfig.aiProvider).toBe("openai");
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("should load config successfully when AI_PROVIDER is gemini and GOOGLE_API_KEY is present", () => {
    setRequiredEnvVars("gemini");
    const envConfig = require("../../src/core/env");
    expect(envConfig.googleApiKey).toBe("test_google_key");
    expect(envConfig.aiProvider).toBe("gemini");
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("should use default AI_PROVIDER (openai) if not set and load OPENAI_API_KEY", () => {
    process.env.TG_TOKEN = "test_tg_token";
    process.env.DATABASE_URL = "test_db_url";
    process.env.FORM_URL = "test_form_url";
    process.env.NGROK_URL = "test_ngrok_url";
    process.env.OPENAI_API_KEY = "test_openai_key";
    delete process.env.AI_PROVIDER; // Ensure it's not set

    const envConfig = require("../../src/core/env");
    expect(envConfig.aiProvider).toBe("openai");
    expect(envConfig.openaiApiKey).toBe("test_openai_key");
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("should throw an error if TG_TOKEN is missing", () => {
    setRequiredEnvVars();
    delete process.env.TG_TOKEN;
    expect(() => {
      require("../../src/core/env");
    }).toThrow(/Missing required env vars.*TG_TOKEN/);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("TG_TOKEN"),
    );
  });

  it("should throw an error if DATABASE_URL is missing", () => {
    setRequiredEnvVars();
    delete process.env.DATABASE_URL;
    expect(() => {
      require("../../src/core/env");
    }).toThrow(/Missing required env vars.*DATABASE_URL/);
  });

  it("should throw an error if FORM_URL is missing", () => {
    setRequiredEnvVars();
    delete process.env.FORM_URL;
    expect(() => {
      require("../../src/core/env");
    }).toThrow(/Missing required env vars.*FORM_URL/);
  });

  it("should throw an error if NGROK_URL is missing", () => {
    setRequiredEnvVars();
    delete process.env.NGROK_URL;
    expect(() => {
      require("../../src/core/env");
    }).toThrow(/Missing required env vars.*NGROK_URL/);
  });

  it("should throw an error if AI_PROVIDER is openai and OPENAI_API_KEY is missing", () => {
    setRequiredEnvVars("openai");
    delete process.env.OPENAI_API_KEY;
    expect(() => {
      require("../../src/core/env");
    }).toThrow(
      /Missing required env vars for provider 'openai': OPENAI_API_KEY/,
    );
  });

  it("should throw an error if AI_PROVIDER is gemini and GOOGLE_API_KEY is missing", () => {
    setRequiredEnvVars("gemini");
    delete process.env.GOOGLE_API_KEY;
    expect(() => {
      require("../../src/core/env");
    }).toThrow(
      /Missing required env vars for provider 'gemini': GOOGLE_API_KEY/,
    );
  });

  it("should log an error for unsupported AI_PROVIDER but not throw during initial load", () => {
    setRequiredEnvVars("unsupported_provider");
    // Ensure other keys that might be checked for unsupported_provider are not there
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    const envConfig = require("../../src/core/env"); // Should not throw here based on current env.js logic
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Unsupported AI_PROVIDER: unsupported_provider. Must be 'openai' or 'gemini'.",
    );
    expect(envConfig.aiProvider).toBe("unsupported_provider");
  });

  it("should use default PORT 3000 if not set", () => {
    setRequiredEnvVars();
    delete process.env.PORT;
    const envConfig = require("../../src/core/env");
    expect(envConfig.port).toBe(3000);
  });

  it("should use provided PORT if set", () => {
    setRequiredEnvVars();
    process.env.PORT = "5000";
    const envConfig = require("../../src/core/env");
    expect(envConfig.port).toBe(5000);
  });

  it('should use default NODE_ENV "development" if not set', () => {
    setRequiredEnvVars();
    // NODE_ENV is often set by Jest/cross-env, so explicitly delete for this test
    delete process.env.NODE_ENV;
    const envConfig = require("../../src/core/env");
    expect(envConfig.nodeEnv).toBe("development");
  });

  it("should use provided NODE_ENV if set", () => {
    setRequiredEnvVars();
    process.env.NODE_ENV = "production";
    const envConfig = require("../../src/core/env");
    expect(envConfig.nodeEnv).toBe("production");
    // Restore for other tests that might rely on 'test'
    process.env.NODE_ENV = "test";
  });

  it("should log the AI provider being used", () => {
    setRequiredEnvVars("gemini");
    require("../../src/core/env");
    expect(mockLogger.info).toHaveBeenCalledWith("Using AI Provider: gemini");

    jest.resetModules();
    process.env = { ...ORIGINAL_ENV }; // Reset again for clean state
    mockLogger.info.mockClear(); // Clear log before next require
    setRequiredEnvVars("openai");
    require("../../src/core/env");
    expect(mockLogger.info).toHaveBeenCalledWith("Using AI Provider: openai");
  });

  it("should export a frozen config object", () => {
    setRequiredEnvVars();
    const envConfig = require("../../src/core/env");
    expect(Object.isFrozen(envConfig)).toBe(true);
    expect(() => {
      // @ts-ignore
      envConfig.tgToken = "new_value_should_fail";
    }).toThrow(TypeError);
  });

  it("should include all expected keys in the config object", () => {
    setRequiredEnvVars("openai");
    const envConfig = require("../../src/core/env");
    expect(envConfig).toHaveProperty("tgToken");
    expect(envConfig).toHaveProperty("databaseUrl");
    expect(envConfig).toHaveProperty("formUrl");
    expect(envConfig).toHaveProperty("port");
    expect(envConfig).toHaveProperty("openaiApiKey");
    expect(envConfig).toHaveProperty("googleApiKey");
    expect(envConfig).toHaveProperty("aiProvider");
    expect(envConfig).toHaveProperty("nodeEnv");
    expect(envConfig).toHaveProperty("ngrokUrl");
    expect(envConfig).toHaveProperty("appUrl");
  });

  // Original tests adapted for the new structure
  it('[Original Adapted] should have NODE_ENV set to "test" when run by test script', () => {
    process.env = { ...ORIGINAL_ENV };
    setRequiredEnvVars("gemini");
    process.env.GOOGLE_API_KEY = ORIGINAL_ENV.GOOGLE_API_KEY || "test-key";
    // Crucially, ensure NODE_ENV from ORIGINAL_ENV (which is 'test' from script) is used
    process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;

    const envConfig = require("../../src/core/env");
    expect(envConfig.nodeEnv).toBe("test");
  });

  it("[Original Adapted] should have GOOGLE_API_KEY set from the test script when AI_PROVIDER is gemini", () => {
    process.env = { ...ORIGINAL_ENV };
    setRequiredEnvVars("gemini");

    process.env.AI_PROVIDER = "gemini";
    process.env.GOOGLE_API_KEY = ORIGINAL_ENV.GOOGLE_API_KEY || "test-key";

    const envConfig = require("../../src/core/env");
    expect(envConfig.googleApiKey).toBe(
      ORIGINAL_ENV.GOOGLE_API_KEY || "test-key",
    );
    expect(envConfig.aiProvider).toBe("gemini");
  });
});
