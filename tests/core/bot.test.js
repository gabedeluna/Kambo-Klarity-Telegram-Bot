const { expect } = require("chai");
const { Telegraf } = require("telegraf");

describe("Core Bot Module", () => {
  // Require the module multiple times to test singleton pattern
  const botInstance1 = require("../../src/core/bot");
  const botInstance2 = require("../../src/core/bot");

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
});
