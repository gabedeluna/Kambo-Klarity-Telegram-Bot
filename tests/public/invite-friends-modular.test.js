/**
 * @file tests/public/invite-friends-modular.test.js
 * @description Modular test suite orchestrator for invite-friends mini-app
 */

// Import all modular test suites
require("../modules/invite-friends/core.test.js");
require("../modules/invite-friends/utils.test.js");
require("../modules/invite-friends/ui.test.js");
require("../modules/invite-friends/events.test.js");
require("../modules/invite-friends/main.test.js");

// This file serves as the main test orchestrator
// Individual test modules are split for better organization
describe("Invite Friends Mini-App - Modular Test Suite", () => {
  test("should have all test modules loaded", () => {
    expect(true).toBe(true);
  });
});
