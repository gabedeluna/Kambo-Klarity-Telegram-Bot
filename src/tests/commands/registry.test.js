const { expect } = require("chai");
const registry = require("../../commands/registry");

describe("Command Registry (src/commands/registry.js)", () => {
  it("should export an object with client and admin keys", () => {
    expect(registry).to.be.an("object");
    expect(registry).to.have.property("client").that.is.an("object");
    expect(registry).to.have.property("admin").that.is.an("object");
  });

  describe("Client Commands", () => {
    const clientCommands = registry.client;

    it("client commands should have descr (string) and handler (function)", () => {
      expect(Object.keys(clientCommands)).to.have.length.greaterThan(
        0,
        "Expected at least one client command",
      );
      for (const commandKey in clientCommands) {
        const command = clientCommands[commandKey];
        expect(command, `Client command '${commandKey}'`).to.be.an("object");
        expect(command, `Client command '${commandKey}'`)
          .to.have.property("descr")
          .that.is.a("string").and.not.empty;
        expect(command, `Client command '${commandKey}'`)
          .to.have.property("handler")
          .that.is.a("function");
      }
    });

    // Add more specific tests for client commands if needed
    it("should include help, book, cancel commands", () => {
      expect(clientCommands).to.have.property("help");
      expect(clientCommands).to.have.property("book");
      expect(clientCommands).to.have.property("cancel");
    });
  });

  describe("Admin Commands", () => {
    const adminCommands = registry.admin;

    it("admin commands should have descr (string) and handler (function)", () => {
      expect(Object.keys(adminCommands)).to.have.length.greaterThan(
        0,
        "Expected at least one admin command",
      );
      for (const commandKey in adminCommands) {
        const command = adminCommands[commandKey];
        expect(command, `Admin command '${commandKey}'`).to.be.an("object");
        expect(command, `Admin command '${commandKey}'`)
          .to.have.property("descr")
          .that.is.a("string").and.not.empty;
        expect(command, `Admin command '${commandKey}'`)
          .to.have.property("handler")
          .that.is.a("function");
      }
    });

    // Add more specific tests for admin commands if needed
    it("should include sessions, clients, session_add, session_del commands", () => {
      expect(adminCommands).to.have.property("sessions");
      expect(adminCommands).to.have.property("clients");
      expect(adminCommands).to.have.property("session_add");
      expect(adminCommands).to.have.property("session_del");
    });
  });
});
