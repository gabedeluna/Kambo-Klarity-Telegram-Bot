const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru(); // Prevent calling real dependencies

// Mock dependencies
const mockLogger = {
  info: sinon.stub(),
  error: sinon.stub(),
  debug: sinon.stub(),
  warn: sinon.stub(),
};

const mockPrisma = {
  users: {
    update: sinon.stub(),
  },
};

// Load the module under test using proxyquire to inject mocks
const stateManager = proxyquire("../../tools/stateManager", {
  "../core/prisma": mockPrisma,
  "../core/logger": mockLogger,
});

describe("Tool: stateManager", () => {
  let prismaUpdateStub;

  beforeEach(() => {
    // Explicitly reset history on each stub within the mock objects
    mockLogger.info.resetHistory();
    mockLogger.error.resetHistory();
    mockLogger.debug.resetHistory();
    mockLogger.warn.resetHistory();
    mockPrisma.users.update.resetHistory();

    // Re-assign the stub variable (optional but can be clearer)
    prismaUpdateStub = mockPrisma.users.update;
  });

  afterEach(() => {
    // Restore stubs is not strictly necessary with proxyquire's isolation,
    // but good practice if mixing stubbing methods.
    sinon.restore();
  });

  describe("resetUserState", () => {
    const testTelegramId = "123456789";
    const bigIntTestTelegramId = BigInt(testTelegramId);

    it("should call prisma.users.update with correct ID and reset data on successful reset", async () => {
      const expectedResetData = {
        state: "NONE",
        session_type: null,
        conversation_history: null,
        booking_slot: null,
        edit_msg_id: null,
      };
      prismaUpdateStub.resolves({
        id: bigIntTestTelegramId,
        telegram_id: bigIntTestTelegramId,
      }); // Mock successful Prisma response

      const result = await stateManager.resetUserState(testTelegramId);

      expect(result).to.deep.equal({ success: true });
      expect(prismaUpdateStub.calledOnce).to.be.true;
      expect(prismaUpdateStub.firstCall.args[0].where.telegram_id).to.equal(
        bigIntTestTelegramId,
      );
      expect(prismaUpdateStub.firstCall.args[0].data).to.deep.equal(
        expectedResetData,
      );
      expect(mockLogger.info.calledTwice).to.be.true; // Called for 'Attempting' and 'Successfully'
      expect(mockLogger.info.secondCall.args[0]).to.deep.equal({
        telegramId: String(bigIntTestTelegramId),
      });
      expect(mockLogger.info.secondCall.args[1]).to.equal(
        "Successfully reset user state.",
      );
      expect(mockLogger.error.notCalled).to.be.true;
    });

    it("should log an error and return failure on prisma update error", async () => {
      const dbError = new Error("DB Error");
      prismaUpdateStub.rejects(dbError);

      const result = await stateManager.resetUserState(testTelegramId);

      expect(result).to.deep.equal({
        success: false,
        error: "Database error during state reset.",
      });
      expect(prismaUpdateStub.calledOnce).to.be.true;
      expect(prismaUpdateStub.firstCall.args[0].where.telegram_id).to.equal(
        bigIntTestTelegramId,
      );
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.have.property("err", dbError);
      expect(mockLogger.error.firstCall.args[0]).to.have.property(
        "telegramId",
        String(bigIntTestTelegramId),
      );
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "Error resetting user state in database.",
      );
      expect(mockLogger.info.calledOnce).to.be.true; // Only the 'Attempting' log
    });

    it("should log an error and not call prisma if telegramId is null", async () => {
      const result = await stateManager.resetUserState(null);

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: telegramId is required.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.equal(
        "resetUserState called without a telegramId.",
      );
      expect(mockLogger.info.notCalled).to.be.true;
    });

    it("should log an error and not call prisma if telegramId is undefined", async () => {
      const result = await stateManager.resetUserState(undefined);

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: telegramId is required.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.equal(
        "resetUserState called without a telegramId.",
      );
      expect(mockLogger.info.notCalled).to.be.true;
    });

    it("should log an error and not call prisma if telegramId format is invalid", async () => {
      const invalidTelegramId = "abc";
      const result = await stateManager.resetUserState(invalidTelegramId);

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: telegramId format is invalid.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.have.property(
        "telegramId",
        invalidTelegramId,
      );
      expect(mockLogger.error.firstCall.args[0]).to.have.property("err").that.is
        .an.instanceOf(Error);
      expect(mockLogger.error.firstCall.args[1]).to.contain(
        "Invalid telegramId format",
      );
      expect(mockLogger.info.notCalled).to.be.true;
    });
  });
});
