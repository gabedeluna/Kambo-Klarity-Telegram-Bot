/**
 * Unit tests for the sessionTypes helper module.
 */

const { expect } = require("chai");
const sessionTypes = require("../../core/sessionTypes");

// Optionally, uncomment if direct file access is needed for advanced tests
// const fs = require('fs');
// const path = require('path');
// const sessionTypesPath = path.join(__dirname, '../../config/sessionTypes.json');

describe("Session Types Helper", () => {
  describe("getAll()", () => {
    it("getAll() should return a non-empty array", () => {
      const result = sessionTypes.getAll();
      expect(result).to.be.an("array");
      // Assuming the JSON file is correctly populated as per spec
      expect(result).to.not.be.empty;
    });

    it("each session object in getAll() should conform to the expected schema (id, label, duration, description)", () => {
      const allSessions = sessionTypes.getAll();
      const ids = new Set();

      expect(allSessions.length).to.be.greaterThan(
        0,
        "Expected at least one session type",
      );

      allSessions.forEach((session) => {
        // Check for required keys
        expect(session).to.have.all.keys(
          "id",
          "label",
          "duration",
          "description",
        );

        // Check data types
        expect(session.id).to.be.a("string");
        expect(session.label).to.be.a("string");
        expect(session.duration).to.be.a("number");
        expect(session.description).to.be.a("string");

        // Check for non-empty strings and positive duration
        expect(session.id).to.not.be.empty;
        expect(session.label).to.not.be.empty;
        expect(session.duration).to.be.greaterThan(0);
        // Description can be empty, but should be a string

        // Check for ID uniqueness
        expect(ids.has(session.id), `Duplicate session ID found: ${session.id}`)
          .to.be.false;
        ids.add(session.id);
      });
    });
  });

  describe("getById()", () => {
    it("getById() should return the correct session object for a valid ID", () => {
      const knownId = "1hr-kambo"; // Use a known ID from the JSON
      const result = sessionTypes.getById(knownId);

      expect(result).to.be.an("object");
      expect(result.id).to.equal(knownId);
      // Optionally check other properties if needed
      expect(result.label).to.equal("1 hr Kambo");
    });

    it("getById() should return undefined for an invalid ID", () => {
      const invalidId = "non-existent-session-id";
      const result = sessionTypes.getById(invalidId);
      expect(result).to.be.undefined;
    });

    it("getById() should return undefined for a non-string ID", () => {
      expect(sessionTypes.getById(123)).to.be.undefined;
      expect(sessionTypes.getById(null)).to.be.undefined;
      expect(sessionTypes.getById({})).to.be.undefined;
      expect(sessionTypes.getById(undefined)).to.be.undefined;
    });
  });
});
