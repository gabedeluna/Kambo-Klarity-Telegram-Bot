const { expect } = require("chai");
const fs = require("fs");
const sinon = require("sinon");

// Mock the logger before requiring sessionTypes
const loggerMock = {
  info: sinon.stub(),
  error: sinon.stub(),
  warn: sinon.stub(),
  debug: sinon.stub(),
  fatal: sinon.stub(),
  trace: sinon.stub()
};

// Use this to avoid circular dependencies when testing
require.cache[require.resolve("../../core/logger")] = {
  exports: loggerMock
};

// Import specific functions including the loader
const {
  getAll,
  getById,
  _loadSessionTypes,
} = require("../../core/sessionTypes");

describe("Session Types Helper", () => {
  beforeEach(() => {
    // Restore any stubs/spies before each test
    sinon.restore();
  });

  afterEach(() => {
    // Clean up stubs/spies after each test
    sinon.restore();
  });

  // --- Test Public API under normal conditions ---
  describe("Public API (getAll, getById)", () => {
    // These tests rely on the actual sessions.json file being present and valid
    it("getAll() should return a non-empty array", () => {
      const types = getAll();
      expect(types).to.be.an("array").that.is.not.empty;
      // Call again to ensure cache is used (implicitly)
      const typesAgain = getAll();
      expect(typesAgain).to.equal(types); // Should be the same cached array
    });

    it("each session object in getAll() should conform to the expected schema", () => {
      const types = getAll();
      types.forEach((type) => {
        expect(type).to.have.property("id").that.is.a("string");
        expect(type).to.have.property("label").that.is.a("string");
        expect(type).to.have.property("duration").that.is.a("number");
        expect(type).to.have.property("description").that.is.a("string");
      });
    });

    it("getById() should return the correct session object for a valid ID", () => {
      const allTypes = getAll(); // Ensure cache is populated
      const validId = allTypes[0]?.id;
      if (!validId) {
        throw new Error(
          "Could not get a valid ID from sessions.json for testing",
        );
      }
      const type = getById(validId);
      expect(type).to.be.an("object");
      expect(type?.id).to.equal(validId);
    });

    it("getById() should return undefined for an invalid ID", () => {
      getAll(); // Ensure cache is populated
      const type = getById("invalid-id-does-not-exist");
      expect(type).to.be.undefined;
    });

    it("getById() should return undefined for a non-string ID", () => {
      getAll(); // Ensure cache is populated
      expect(getById(123)).to.be.undefined;
      expect(getById(null)).to.be.undefined;
      expect(getById({})).to.be.undefined;
      expect(getById(undefined)).to.be.undefined;
    });
  });

  // --- Test Internal Loader Function directly ---
  describe("_loadSessionTypes() Error Handling", () => {
    let existsSyncStub;
    let readFileSyncStub;

    beforeEach(() => {
      // Reset logger mock stubs
      Object.values(loggerMock).forEach(stub => stub.reset());
      
      // Stub fs functions used by _loadSessionTypes
      existsSyncStub = sinon.stub(fs, "existsSync");
      readFileSyncStub = sinon.stub(fs, "readFileSync");
    });

    it("should return empty array and log error if file does not exist", () => {
      existsSyncStub.returns(false);

      const types = _loadSessionTypes();

      expect(types).to.be.an("array").that.is.empty;
      expect(existsSyncStub.calledOnce).to.be.true;
      expect(readFileSyncStub.called).to.be.false; // Shouldn't try to read
      expect(loggerMock.error.calledOnce).to.be.true;
      expect(loggerMock.error.firstCall.args[0]).to.include("file not found");
    });

    it("should return empty array and log error if file content is not an array", () => {
      existsSyncStub.returns(true);
      readFileSyncStub.returns('{"not": "an array"}'); // Invalid JSON structure

      const types = _loadSessionTypes();

      expect(types).to.be.an("array").that.is.empty;
      expect(existsSyncStub.calledOnce).to.be.true;
      expect(readFileSyncStub.calledOnce).to.be.true;
      expect(loggerMock.error.calledOnce).to.be.true;
      expect(loggerMock.error.firstCall.args[0]).to.include("Expected an array");
    });

    it("should return empty array and log error if reading file fails", () => {
      const mockError = new Error("Disk read error");
      existsSyncStub.returns(true);
      readFileSyncStub.throws(mockError);

      const types = _loadSessionTypes();

      expect(types).to.be.an("array").that.is.empty;
      expect(existsSyncStub.calledOnce).to.be.true;
      expect(readFileSyncStub.calledOnce).to.be.true;
      expect(loggerMock.error.calledOnce).to.be.true;
      expect(loggerMock.error.firstCall.args[0]).to.equal(mockError);
      expect(loggerMock.error.firstCall.args[1]).to.include(
        "Error loading session types",
      );
    });

    it("should return empty array and log error if parsing file fails", () => {
      existsSyncStub.returns(true);
      readFileSyncStub.returns('{"invalidJson":'); // Malformed JSON

      const types = _loadSessionTypes();

      expect(types).to.be.an("array").that.is.empty;
      expect(existsSyncStub.calledOnce).to.be.true;
      expect(readFileSyncStub.calledOnce).to.be.true;
      expect(loggerMock.error.calledOnce).to.be.true;
      // Check that the caught error is likely a SyntaxError
      expect(loggerMock.error.firstCall.args[0]).to.be.instanceOf(Error);
      expect(loggerMock.error.firstCall.args[0].name).to.equal("SyntaxError");
      expect(loggerMock.error.firstCall.args[1]).to.include(
        "Error loading session types",
      );
    });
  });
});
