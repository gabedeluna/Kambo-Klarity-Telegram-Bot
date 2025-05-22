/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  collectCoverage: true,
  coverageDirectory: "coverage",
  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: "v8", // or "babel"
  // A list of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/app.js", // Usually, the main app setup is tested via integration/e2e tests
    "!src/core/logger.js", // Logger might be hard to unit test effectively without complex mocking
    "!src/core/prisma.js", // Prisma client instance, usually mocked
    "!src/core/bot.js", // Telegraf instance, usually mocked
    "!src/core/env.js", // Env loading, usually tested by its effect
    "!src/errors/**/*.js", // Custom error classes might not need dedicated tests if simple
    "!src/config/**/*.js", // Static config files
    "!**/node_modules/**",
    "!**/vendor/**",
  ],
  // The glob patterns Jest uses to detect test files
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
  testPathIgnorePatterns: ["/node_modules/"],
  // This option allows the use of a custom results processor
  // testResultsProcessor: "jest-sonar-reporter", // Example for SonarQube

  // A path to a module which exports an async function that is triggered once before all test suites
  // globalSetup: undefined,

  // A path to a module which exports an async function that is triggered once after all test suites
  // globalTeardown: undefined,

  // A list of paths to modules that run some code to configure or set up the testing framework before each test suite
  setupFilesAfterEnv: ["<rootDir>/tests/setupTests.js"],

  // The root directory that Jest should scan for tests and modules within
  rootDir: ".",

  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  // collectCoverage: false, // Already set above

  // An array of glob patterns indicating a set of files for which coverage information should be collected
  // collectCoverageFrom: undefined, // Already set above

  // The directory where Jest should output its coverage files
  // coverageDirectory: undefined, // Already set above

  // An array of regexp pattern strings used to skip coverage collection
  coveragePathIgnorePatterns: ["/node_modules/"],

  // A list of reporter names that Jest uses when writing coverage reports
  coverageReporters: ["json", "text", "lcov", "clover"],

  // An object that configures minimum threshold enforcement for coverage results
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // A path to a custom dependency extractor
  // dependencyExtractor: undefined,

  // Make calling deprecated APIs throw helpful error messages
  errorOnDeprecated: true,

  // Preset that is used as a base for Jest's configuration
  // preset: undefined,

  // Transform files with babel-jest
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  // An array of regexp pattern strings that are matched against all source file paths, matched files will skip transformation
  transformIgnorePatterns: ["/node_modules/", "\\.pnp\\.[^\\/]+$"],
};

module.exports = config;
