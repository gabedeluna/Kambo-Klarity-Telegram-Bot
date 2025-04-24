const { expect } = require("chai");
const { Telegraf } = require("telegraf");

// Require the module multiple times to test singleton pattern
const botInstance1 = require("../../core/bot");
const botInstance2 = require("../../core/bot");

describe("Core Bot Module", () => {
  it("should export the same bot instance (singleton)", () => {
    expect(botInstance1).to.equal(
      botInstance2,
      "Expected bot instances to be the same object",
    );
  });

  it("should be an instance of Telegraf", () => {
    expect(botInstance1).to.be.an.instanceOf(
      Telegraf,
      "Expected botInstance to be an instance of Telegraf",
    );
  });

  // Note: Skipping advanced test for mocking process.exit on missing token for now.
  // This could be added later if needed for more robust testing.
});
