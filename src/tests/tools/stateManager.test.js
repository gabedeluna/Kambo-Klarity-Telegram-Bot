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
      expect(mockLogger.error.firstCall.args[0]).to.have.property(
        "err",
        dbError,
      );
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
      expect(mockLogger.error.firstCall.args[0])
        .to.have.property("err")
        .that.is.an.instanceOf(Error);
      expect(mockLogger.error.firstCall.args[1]).to.contain(
        "Invalid telegramId format",
      );
      expect(mockLogger.info.notCalled).to.be.true;
    });
  });

  describe("updateUserState", () => {
    const testTelegramId = "987654321";
    const bigIntTestTelegramId = BigInt(testTelegramId);
    const testUpdateData = {
      state: "BOOKING",
      session_type: "1hr-kambo",
      booking_slot: new Date().toISOString(), // Example update data
    };

    it("should call prisma.users.update with correct ID and data, log success", async () => {
      const mockUpdatedUser = {
        id: 1, // Example ID from DB
        telegram_id: bigIntTestTelegramId,
        ...testUpdateData,
      };
      prismaUpdateStub.resolves(mockUpdatedUser);

      const result = await stateManager.updateUserState(
        testTelegramId,
        testUpdateData,
      );

      expect(result).to.deep.equal({ success: true, user: mockUpdatedUser });
      expect(prismaUpdateStub.calledOnce).to.be.true;
      expect(prismaUpdateStub.firstCall.args[0].where.telegram_id).to.equal(
        bigIntTestTelegramId,
      );
      expect(prismaUpdateStub.firstCall.args[0].data).to.deep.equal(
        testUpdateData,
      );
      expect(mockLogger.info.calledTwice).to.be.true; // Attempt + Success
      expect(mockLogger.info.firstCall.args[0]).to.deep.equal({
        telegramId: String(bigIntTestTelegramId),
        updateData: testUpdateData,
      });
      expect(mockLogger.info.firstCall.args[1]).to.equal(
        "Attempting to update user state",
      );
      expect(mockLogger.info.secondCall.args[0]).to.deep.equal({
        telegramId: String(bigIntTestTelegramId),
      });
      expect(mockLogger.info.secondCall.args[1]).to.equal(
        "Successfully updated user state.",
      );
      expect(mockLogger.error.notCalled).to.be.true;
    });

    it("should log error and return failure on generic prisma update error", async () => {
      const dbError = new Error("Generic DB Error");
      prismaUpdateStub.rejects(dbError);

      const result = await stateManager.updateUserState(
        testTelegramId,
        testUpdateData,
      );

      expect(result).to.deep.equal({
        success: false,
        error: "Database error during state update.",
      });
      expect(prismaUpdateStub.calledOnce).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.deep.equal({
        telegramId: String(bigIntTestTelegramId),
        updateData: testUpdateData,
        err: dbError,
      });
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "Error updating user state in database.",
      );
      expect(mockLogger.info.calledOnce).to.be.true; // Only 'Attempting' log
    });

    it("should return specific error if user not found (P2025)", async () => {
      const notFoundError = new Error("User not found");
      notFoundError.code = "P2025"; // Prisma specific error code
      prismaUpdateStub.rejects(notFoundError);

      const result = await stateManager.updateUserState(
        testTelegramId,
        testUpdateData,
      );

      expect(result).to.deep.equal({
        success: false,
        error: "User not found for update.",
      });
      expect(prismaUpdateStub.calledOnce).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.deep.equal({
        telegramId: String(bigIntTestTelegramId),
        updateData: testUpdateData,
        err: notFoundError,
      });
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "Error updating user state in database.",
      );
      expect(mockLogger.info.calledOnce).to.be.true; // Only 'Attempting' log
    });

    it("should return failure if telegramId is invalid (null)", async () => {
      const result = await stateManager.updateUserState(null, testUpdateData);

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid telegramId",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.equal(
        "updateUserState called without a telegramId.",
      );
      expect(mockLogger.info.notCalled).to.be.true;
    });

    it("should return failure if telegramId format is invalid (cannot convert to BigInt)", async () => {
      const invalidId = "not-a-number";
      const result = await stateManager.updateUserState(
        invalidId,
        testUpdateData,
      );

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: telegramId format is invalid.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.have.property(
        "telegramId",
        invalidId,
      );
      expect(mockLogger.error.firstCall.args[0])
        .to.have.property("err")
        .that.is.an.instanceOf(Error);
      expect(mockLogger.error.firstCall.args[1]).to.contain(
        "Invalid telegramId format for updateUserState",
      );
      expect(mockLogger.info.notCalled).to.be.true;
    });

    it("should return failure if dataToUpdate is invalid (null)", async () => {
      const result = await stateManager.updateUserState(testTelegramId, null);

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid dataToUpdate object",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.deep.equal({
        telegramId: testTelegramId,
        data: null,
      });
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "updateUserState called with invalid dataToUpdate object.",
      );
      expect(mockLogger.info.notCalled).to.be.true; // No BigInt conversion attempt either
    });

    it("should return failure if dataToUpdate is invalid (empty object)", async () => {
      const result = await stateManager.updateUserState(testTelegramId, {});

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid dataToUpdate object",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.deep.equal({
        telegramId: testTelegramId,
        data: {},
      });
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "updateUserState called with invalid dataToUpdate object.",
      );
      expect(mockLogger.info.notCalled).to.be.true;
    });

    it("should return failure if dataToUpdate is invalid (undefined)", async () => {
      const result = await stateManager.updateUserState(
        testTelegramId,
        undefined,
      );

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid dataToUpdate object",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.deep.equal({
        telegramId: testTelegramId,
        data: undefined,
      });
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "updateUserState called with invalid dataToUpdate object.",
      );
      expect(mockLogger.info.notCalled).to.be.true;
    });
  }); // End describe updateUserState

  describe("storeBookingData", () => {
    const testTelegramId = "1122334455";
    const bigIntTestTelegramId = BigInt(testTelegramId);
    const testSessionType = "1hr-kambo";
    let testBookingSlotDate;
    let testBookingSlotISO;

    beforeEach(() => {
      // Create a fresh date for each test to avoid state leakage
      testBookingSlotDate = new Date();
      testBookingSlotISO = testBookingSlotDate.toISOString();
    });

    it("storeBookingData should call prisma.users.update with correct ID and booking data", async () => {
      const expectedBookingData = {
        session_type: testSessionType,
        booking_slot: testBookingSlotDate, // Function converts ISO string to Date
      };
      const mockUpdatedUser = {
        telegram_id: bigIntTestTelegramId,
        ...expectedBookingData,
      };
      prismaUpdateStub.resolves(mockUpdatedUser);

      const result = await stateManager.storeBookingData(
        testTelegramId,
        testSessionType,
        testBookingSlotISO,
      );

      expect(result).to.deep.equal({ success: true, user: mockUpdatedUser });
      expect(prismaUpdateStub.calledOnce).to.be.true;
      expect(prismaUpdateStub.firstCall.args[0].where.telegram_id).to.equal(
        bigIntTestTelegramId,
      );
      // Ensure date comparison works correctly
      expect(prismaUpdateStub.firstCall.args[0].data.session_type).to.equal(
        expectedBookingData.session_type,
      );
      expect(
        prismaUpdateStub.firstCall.args[0].data.booking_slot.toISOString(),
      ).to.equal(expectedBookingData.booking_slot.toISOString());
      expect(mockLogger.info.calledTwice).to.be.true; // Attempt + Success
      expect(mockLogger.info.firstCall.args[0]).to.deep.equal({
        telegramId: String(bigIntTestTelegramId),
        sessionType: testSessionType,
        bookingSlot: testBookingSlotISO,
      });
      expect(mockLogger.info.firstCall.args[1]).to.equal(
        "Attempting to store booking data",
      );
      expect(mockLogger.info.secondCall.args[0]).to.deep.equal({
        telegramId: String(bigIntTestTelegramId),
      });
      expect(mockLogger.info.secondCall.args[1]).to.equal(
        "Successfully stored booking data.",
      );
      expect(mockLogger.error.notCalled).to.be.true;
    });

    it("storeBookingData should log error and return failure on generic prisma update error", async () => {
      const dbError = new Error("DB Store Error");
      prismaUpdateStub.rejects(dbError);

      const result = await stateManager.storeBookingData(
        testTelegramId,
        testSessionType,
        testBookingSlotISO,
      );

      expect(result).to.deep.equal({
        success: false,
        error: "Database error during booking data storage.",
      });
      expect(prismaUpdateStub.calledOnce).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.deep.equal({
        telegramId: String(bigIntTestTelegramId),
        sessionType: testSessionType,
        bookingSlot: testBookingSlotISO,
        err: dbError,
      });
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "Error storing booking data in database.",
      );
      expect(mockLogger.info.calledOnce).to.be.true; // Only 'Attempting' log
    });

    it("storeBookingData should return specific error if user not found (P2025)", async () => {
      const notFoundError = new Error("User not found");
      notFoundError.code = "P2025";
      prismaUpdateStub.rejects(notFoundError);

      const result = await stateManager.storeBookingData(
        testTelegramId,
        testSessionType,
        testBookingSlotISO,
      );

      expect(result).to.deep.equal({
        success: false,
        error: "User not found for storing booking data.",
      });
      expect(prismaUpdateStub.calledOnce).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.deep.equal({
        telegramId: String(bigIntTestTelegramId),
        sessionType: testSessionType,
        bookingSlot: testBookingSlotISO,
        err: notFoundError,
      });
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "Error storing booking data in database.",
      );
      expect(mockLogger.info.calledOnce).to.be.true; // Only 'Attempting' log
    });

    // --- Input Validation Tests ---

    it("storeBookingData should return failure if telegramId is null", async () => {
      const result = await stateManager.storeBookingData(
        null,
        testSessionType,
        testBookingSlotISO,
      );
      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: telegramId is required.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.equal(
        "storeBookingData called without a telegramId.",
      );
      expect(mockLogger.info.notCalled).to.be.true;
    });

    it("storeBookingData should return failure if telegramId format is invalid", async () => {
      const invalidId = "not-bigint";
      const result = await stateManager.storeBookingData(
        invalidId,
        testSessionType,
        testBookingSlotISO,
      );
      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: telegramId format is invalid.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0].telegramId).to.equal(invalidId);
      expect(mockLogger.error.firstCall.args[0].err).to.be.instanceOf(Error);
      expect(mockLogger.error.firstCall.args[1]).to.contain(
        "Invalid telegramId format for storeBookingData",
      );
      expect(mockLogger.info.notCalled).to.be.true;
    });

    it("storeBookingData should return failure if sessionType is invalid (null)", async () => {
      const result = await stateManager.storeBookingData(
        testTelegramId,
        null,
        testBookingSlotISO,
      );
      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: sessionType is required.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.deep.equal({
        telegramId: testTelegramId,
        sessionType: null,
      });
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "storeBookingData called with invalid sessionType.",
      );
      expect(mockLogger.info.notCalled).to.be.true;
    });

    it("storeBookingData should return failure if sessionType is invalid (empty string)", async () => {
      const result = await stateManager.storeBookingData(
        testTelegramId,
        "  ", // Whitespace only
        testBookingSlotISO,
      );
      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: sessionType is required.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.deep.equal({
        telegramId: testTelegramId,
        sessionType: "  ",
      });
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "storeBookingData called with invalid sessionType.",
      );
      expect(mockLogger.info.notCalled).to.be.true;
    });

    it("storeBookingData should return failure if bookingSlot is invalid (null)", async () => {
      const result = await stateManager.storeBookingData(
        testTelegramId,
        testSessionType,
        null,
      );
      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: bookingSlot is required.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.deep.equal({
        telegramId: testTelegramId,
        bookingSlot: null,
      });
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "storeBookingData called with invalid bookingSlot.",
      );
      expect(mockLogger.info.notCalled).to.be.true;
    });

    it("storeBookingData should return failure if bookingSlot is invalid (bad date string)", async () => {
      const badBookingSlot = "not-a-date";
      const result = await stateManager.storeBookingData(
        testTelegramId,
        testSessionType,
        badBookingSlot,
      );
      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: bookingSlot must be a valid date or ISO string.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.deep.equal({
        telegramId: testTelegramId,
        bookingSlot: badBookingSlot,
      });
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "storeBookingData called with invalid date format for bookingSlot.",
      );
      // BigInt conversion happens before date validation, so no info log
      expect(mockLogger.info.notCalled).to.be.true;
    });
  }); // End describe storeBookingData
}); // End describe stateManager
