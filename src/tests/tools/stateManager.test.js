const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru(); // Prevent calling real dependencies
const { z } = require("zod"); // Add zod import
const {
  // Add schema imports
  resetUserStateSchema,
  updateUserStateSchema,
  storeBookingDataSchema,
  setActiveSessionIdSchema,
  clearActiveSessionIdSchema,
  getUserProfileDataSchema,
  getUserPastSessionsSchema,
} = require("../../tools/toolSchemas");

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
    findUnique: sinon.stub(),
  },
  sessions: {
    findMany: sinon.stub(),
  },
};

// Load the module under test using proxyquire to inject mocks
const stateManager = proxyquire("../../tools/stateManager", {
  "../core/prisma": mockPrisma,
  "../core/logger": mockLogger,
});

describe("Tool: stateManager", () => {
  let prismaUpdateStub;
  let prismaFindUniqueStub;
  let prismaFindManyStub;

  beforeEach(() => {
    // Explicitly reset history on each stub within the mock objects
    mockLogger.info.resetHistory();
    mockLogger.error.resetHistory();
    mockLogger.debug.resetHistory();
    mockLogger.warn.resetHistory();
    mockPrisma.users.update.resetHistory();
    mockPrisma.users.findUnique.resetHistory();
    mockPrisma.sessions.findMany.resetHistory();

    // Re-assign the stub variables
    prismaUpdateStub = mockPrisma.users.update;
    prismaFindUniqueStub = mockPrisma.users.findUnique;
    prismaFindManyStub = mockPrisma.sessions.findMany;
  });

  afterEach(() => {
    // Restore stubs is not strictly necessary with proxyquire's isolation,
    // but good practice if mixing stubbing methods.
    sinon.restore();
  });

  describe("resetUserState", () => {
    const testTelegramId = "123456789";
    const bigIntTestTelegramId = BigInt(testTelegramId);

    // --- Schema Validation Tests ---
    describe("Schema Validation", () => {
      it("should accept valid input according to schema", () => {
        const validInput = { telegramId: testTelegramId };
        expect(() => resetUserStateSchema.parse(validInput)).to.not.throw();
      });

      it("should reject invalid input (missing telegramId)", () => {
        const invalidInput = {};
        expect(() => resetUserStateSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (wrong type for telegramId)", () => {
        const invalidInput = { telegramId: 123 };
        expect(() => resetUserStateSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (empty string telegramId)", () => {
        const invalidInput = { telegramId: "" };
        expect(() => resetUserStateSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });
    });
    // --- End Schema Validation Tests ---

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
      edit_msg_id: 12345,
    };

    // --- Schema Validation Tests ---
    describe("Schema Validation", () => {
      it("should accept valid input according to schema", () => {
        const validInput = {
          telegramId: testTelegramId,
          updates: testUpdateData,
        };
        expect(() => updateUserStateSchema.parse(validInput)).to.not.throw();
      });

      it("should accept valid input with only some fields", () => {
        const validInput = {
          telegramId: testTelegramId,
          updates: { state: "CONFIRMING" },
        };
        expect(() => updateUserStateSchema.parse(validInput)).to.not.throw();
      });

      it("should reject invalid input (missing telegramId)", () => {
        const invalidInput = { updates: testUpdateData };
        expect(() => updateUserStateSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (missing updates)", () => {
        const invalidInput = { telegramId: testTelegramId };
        expect(() => updateUserStateSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (empty updates object)", () => {
        const invalidInput = { telegramId: testTelegramId, updates: {} };
        expect(() => updateUserStateSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (wrong type in updates - state)", () => {
        const invalidInput = {
          telegramId: testTelegramId,
          updates: { state: 123 },
        };
        expect(() => updateUserStateSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (wrong type in updates - edit_msg_id)", () => {
        const invalidInput = {
          telegramId: testTelegramId,
          updates: { edit_msg_id: "abc" },
        };
        expect(() => updateUserStateSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (invalid datetime string for booking_slot)", () => {
        const invalidInput = {
          telegramId: testTelegramId,
          updates: { booking_slot: "not-a-date" },
        };
        expect(() => updateUserStateSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should accept null for nullable fields", () => {
        const validInput = {
          telegramId: testTelegramId,
          updates: {
            session_type: null,
            conversation_history: null,
            booking_slot: null,
            edit_msg_id: null,
            state: "SOME_STATE", // Need at least one field
          },
        };
        expect(() => updateUserStateSchema.parse(validInput)).to.not.throw();
      });
    });
    // --- End Schema Validation Tests ---

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

    // --- Schema Validation Tests ---
    describe("Schema Validation", () => {
      it("should accept valid input according to schema", () => {
        const validInput = {
          telegramId: testTelegramId,
          sessionType: testSessionType,
          bookingSlot: testBookingSlotISO,
        };
        expect(() => storeBookingDataSchema.parse(validInput)).to.not.throw();
      });

      it("should reject invalid input (missing telegramId)", () => {
        const invalidInput = {
          sessionType: testSessionType,
          bookingSlot: testBookingSlotISO,
        };
        expect(() => storeBookingDataSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (missing sessionType)", () => {
        const invalidInput = {
          telegramId: testTelegramId,
          bookingSlot: testBookingSlotISO,
        };
        expect(() => storeBookingDataSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (empty sessionType)", () => {
        const invalidInput = {
          telegramId: testTelegramId,
          sessionType: "",
          bookingSlot: testBookingSlotISO,
        };
        expect(() => storeBookingDataSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (missing bookingSlot)", () => {
        const invalidInput = {
          telegramId: testTelegramId,
          sessionType: testSessionType,
        };
        expect(() => storeBookingDataSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (invalid date string for bookingSlot)", () => {
        const invalidInput = {
          telegramId: testTelegramId,
          sessionType: testSessionType,
          bookingSlot: "not-a-real-date",
        };
        expect(() => storeBookingDataSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (wrong type for telegramId)", () => {
        const invalidInput = {
          telegramId: 12345,
          sessionType: testSessionType,
          bookingSlot: testBookingSlotISO,
        };
        expect(() => storeBookingDataSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (wrong type for sessionType)", () => {
        const invalidInput = {
          telegramId: testTelegramId,
          sessionType: true,
          bookingSlot: testBookingSlotISO,
        };
        expect(() => storeBookingDataSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });
    });
    // --- End Schema Validation Tests ---

    it("should call prisma.users.update with correct ID and booking data, log success", async () => {
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

    it("should log error and return failure on generic prisma update error", async () => {
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

    it("should return specific error if user not found (P2025)", async () => {
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

  // Tests for setActiveSessionId
  describe("setActiveSessionId", () => {
    const testTelegramId = "123456789";
    const testSessionId = "session-123";
    const bigIntTestTelegramId = BigInt(testTelegramId);

    // --- Schema Validation Tests ---
    describe("Schema Validation", () => {
      it("should accept valid input according to schema", () => {
        const validInput = {
          telegramId: testTelegramId,
          sessionId: testSessionId,
        };
        expect(() => setActiveSessionIdSchema.parse(validInput)).to.not.throw();
      });

      it("should reject invalid input (missing telegramId)", () => {
        const invalidInput = { sessionId: testSessionId };
        expect(() => setActiveSessionIdSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (missing sessionId)", () => {
        const invalidInput = { telegramId: testTelegramId };
        expect(() => setActiveSessionIdSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (empty telegramId)", () => {
        const invalidInput = { telegramId: "", sessionId: testSessionId };
        expect(() => setActiveSessionIdSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (empty sessionId)", () => {
        const invalidInput = { telegramId: testTelegramId, sessionId: "" };
        expect(() => setActiveSessionIdSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });
    });
    // --- End Schema Validation Tests ---

    it("should call prisma.users.update with correct ID and sessionId, log success", async () => {
      prismaUpdateStub.resolves({
        id: "user-1",
        telegram_id: bigIntTestTelegramId,
        active_session_id: testSessionId,
      });

      const result = await stateManager.setActiveSessionId({
        telegramId: testTelegramId,
        sessionId: testSessionId,
      });

      expect(result).to.deep.equal({ success: true });
      expect(prismaUpdateStub.calledOnce).to.be.true;
      expect(prismaUpdateStub.firstCall.args[0].where.telegram_id).to.equal(
        bigIntTestTelegramId,
      );
      expect(prismaUpdateStub.firstCall.args[0].data).to.deep.equal({
        active_session_id: testSessionId,
      });
      expect(mockLogger.info.calledTwice).to.be.true;
      expect(mockLogger.info.secondCall.args[0]).to.deep.equal({
        telegramId: String(bigIntTestTelegramId),
      });
      expect(mockLogger.info.secondCall.args[1]).to.equal(
        "Successfully set active session ID.",
      );
      expect(mockLogger.error.notCalled).to.be.true;
    });

    it("should log error and return failure on prisma update error", async () => {
      const dbError = new Error("DB Error");
      prismaUpdateStub.rejects(dbError);

      const result = await stateManager.setActiveSessionId({
        telegramId: testTelegramId,
        sessionId: testSessionId,
      });

      expect(result).to.deep.equal({
        success: false,
        error: "Database error setting active session ID.",
      });
      expect(prismaUpdateStub.calledOnce).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.deep.include({
        telegramId: String(bigIntTestTelegramId),
        sessionId: testSessionId,
      });
      expect(mockLogger.error.firstCall.args[0]).to.have.property(
        "err",
        dbError,
      );
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "Error setting active session ID in database.",
      );
      expect(mockLogger.info.calledOnce).to.be.true; // Only 'Attempting' log
    });

    it("should handle user not found error (P2025)", async () => {
      const notFoundError = new Error("Record not found");
      notFoundError.code = "P2025";
      prismaUpdateStub.rejects(notFoundError);

      const result = await stateManager.setActiveSessionId({
        telegramId: testTelegramId,
        sessionId: testSessionId,
      });

      expect(result).to.deep.equal({
        success: false,
        error: "User not found.",
      });
      expect(prismaUpdateStub.calledOnce).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "Error setting active session ID in database.",
      );
      expect(mockLogger.info.calledOnce).to.be.true; // Only 'Attempting' log
    });

    it("should return failure if telegramId is missing", async () => {
      const result = await stateManager.setActiveSessionId({
        sessionId: testSessionId,
      });

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: telegramId and sessionId are required.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.info.notCalled).to.be.true;
    });

    it("should return failure if sessionId is missing", async () => {
      const result = await stateManager.setActiveSessionId({
        telegramId: testTelegramId,
      });

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: telegramId and sessionId are required.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.info.notCalled).to.be.true;
    });

    it("should return failure if sessionId is empty", async () => {
      const result = await stateManager.setActiveSessionId({
        telegramId: testTelegramId,
        sessionId: "  ",
      });

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: telegramId and sessionId are required.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.info.notCalled).to.be.true;
    });

    it("should return failure if telegramId is invalid format", async () => {
      const invalidId = "abc";
      const result = await stateManager.setActiveSessionId({
        telegramId: invalidId,
        sessionId: testSessionId,
      });

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: telegramId format is invalid.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0].telegramId).to.equal(invalidId);
      expect(mockLogger.error.firstCall.args[0].err).to.be.instanceOf(Error);
      expect(mockLogger.info.notCalled).to.be.true;
    });
  }); // End describe setActiveSessionId

  // Tests for clearActiveSessionId
  describe("clearActiveSessionId", () => {
    const testTelegramId = "123456789";
    const bigIntTestTelegramId = BigInt(testTelegramId);

    // --- Schema Validation Tests ---
    describe("Schema Validation", () => {
      it("should accept valid input according to schema", () => {
        const validInput = { telegramId: testTelegramId };
        expect(() =>
          clearActiveSessionIdSchema.parse(validInput),
        ).to.not.throw();
      });

      it("should reject invalid input (missing telegramId)", () => {
        const invalidInput = {};
        expect(() => clearActiveSessionIdSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (empty telegramId)", () => {
        const invalidInput = { telegramId: "" };
        expect(() => clearActiveSessionIdSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });
    });
    // --- End Schema Validation Tests ---

    it("should call prisma.users.update to set active_session_id to null, log success", async () => {
      prismaUpdateStub.resolves({
        id: "user-1",
        telegram_id: bigIntTestTelegramId,
        active_session_id: null,
      });

      const result = await stateManager.clearActiveSessionId({
        telegramId: testTelegramId,
      });

      expect(result).to.deep.equal({ success: true });
      expect(prismaUpdateStub.calledOnce).to.be.true;
      expect(prismaUpdateStub.firstCall.args[0].where.telegram_id).to.equal(
        bigIntTestTelegramId,
      );
      expect(prismaUpdateStub.firstCall.args[0].data).to.deep.equal({
        active_session_id: null,
      });
      expect(mockLogger.info.calledTwice).to.be.true;
      expect(mockLogger.info.secondCall.args[0]).to.deep.equal({
        telegramId: String(bigIntTestTelegramId),
      });
      expect(mockLogger.info.secondCall.args[1]).to.equal(
        "Successfully cleared active session ID.",
      );
      expect(mockLogger.error.notCalled).to.be.true;
    });

    it("should log error and return failure on prisma update error", async () => {
      const dbError = new Error("DB Error");
      prismaUpdateStub.rejects(dbError);

      const result = await stateManager.clearActiveSessionId({
        telegramId: testTelegramId,
      });

      expect(result).to.deep.equal({
        success: false,
        error: "Database error clearing active session ID.",
      });
      expect(prismaUpdateStub.calledOnce).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.deep.include({
        telegramId: String(bigIntTestTelegramId),
      });
      expect(mockLogger.error.firstCall.args[0]).to.have.property(
        "err",
        dbError,
      );
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "Error clearing active session ID in database.",
      );
      expect(mockLogger.info.calledOnce).to.be.true; // Only 'Attempting' log
    });

    it("should handle user not found error (P2025)", async () => {
      const notFoundError = new Error("Record not found");
      notFoundError.code = "P2025";
      prismaUpdateStub.rejects(notFoundError);

      const result = await stateManager.clearActiveSessionId({
        telegramId: testTelegramId,
      });

      expect(result).to.deep.equal({
        success: false,
        error: "User not found.",
      });
      expect(prismaUpdateStub.calledOnce).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "Error clearing active session ID in database.",
      );
      expect(mockLogger.info.calledOnce).to.be.true; // Only 'Attempting' log
    });

    it("should return failure if telegramId is missing", async () => {
      const result = await stateManager.clearActiveSessionId({});

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: telegramId is required.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.info.notCalled).to.be.true;
    });

    it("should return failure if telegramId is invalid format", async () => {
      const invalidId = "abc";
      const result = await stateManager.clearActiveSessionId({
        telegramId: invalidId,
      });

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid input: telegramId format is invalid.",
      });
      expect(prismaUpdateStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0].telegramId).to.equal(invalidId);
      expect(mockLogger.error.firstCall.args[0].err).to.be.instanceOf(Error);
      expect(mockLogger.info.notCalled).to.be.true;
    });
  }); // End describe clearActiveSessionId

  // New tests for getUserProfileData
  describe("getUserProfileData", () => {
    const testTelegramId = "123456789";
    const bigIntTestTelegramId = BigInt(testTelegramId);

    // --- Schema Validation Tests ---
    describe("Schema Validation", () => {
      it("should accept valid input according to schema", () => {
        const validInput = { telegramId: testTelegramId };
        expect(() => getUserProfileDataSchema.parse(validInput)).to.not.throw();
      });

      it("should reject invalid input (missing telegramId)", () => {
        const invalidInput = {};
        expect(() => getUserProfileDataSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (empty string telegramId)", () => {
        const invalidInput = { telegramId: "" };
        expect(() => getUserProfileDataSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });
    });
    // --- End Schema Validation Tests ---

    it("should call prisma.users.findUnique with correct ID and return profile data", async () => {
      const mockProfileData = {
        first_name: "John",
        role: "client",
        state: "IDLE",
        session_type: null,
        active_session_id: null,
      };

      prismaFindUniqueStub.resolves(mockProfileData);

      const result = await stateManager.getUserProfileData({
        telegramId: testTelegramId,
      });

      expect(result).to.deep.equal({
        success: true,
        data: mockProfileData,
      });

      expect(prismaFindUniqueStub.calledOnce).to.be.true;
      expect(prismaFindUniqueStub.firstCall.args[0].where.telegram_id).to.equal(
        bigIntTestTelegramId,
      );
      expect(prismaFindUniqueStub.firstCall.args[0].select).to.deep.equal({
        first_name: true,
        role: true,
        state: true,
        session_type: true,
        active_session_id: true,
      });

      expect(mockLogger.info.calledOnce).to.be.true;
      expect(mockLogger.info.firstCall.args[0]).to.deep.equal({
        telegramId: testTelegramId,
      });
      expect(mockLogger.info.firstCall.args[1]).to.equal(
        "User profile data fetched successfully.",
      );
      expect(mockLogger.error.notCalled).to.be.true;
    });

    it("should return null data when user is not found", async () => {
      prismaFindUniqueStub.resolves(null);

      const result = await stateManager.getUserProfileData({
        telegramId: testTelegramId,
      });

      expect(result).to.deep.equal({
        success: true,
        data: null,
        message: "User profile not found.",
      });

      expect(prismaFindUniqueStub.calledOnce).to.be.true;
      expect(mockLogger.warn.calledOnce).to.be.true;
      expect(mockLogger.warn.firstCall.args[0]).to.deep.equal({
        telegramId: testTelegramId,
      });
      expect(mockLogger.warn.firstCall.args[1]).to.equal(
        "User profile not found.",
      );
      expect(mockLogger.error.notCalled).to.be.true;
    });

    it("should log error and return failure on database error", async () => {
      const dbError = new Error("DB Error");
      prismaFindUniqueStub.rejects(dbError);

      const result = await stateManager.getUserProfileData({
        telegramId: testTelegramId,
      });

      expect(result).to.deep.equal({
        success: false,
        error: "Database error fetching user profile",
      });

      expect(prismaFindUniqueStub.calledOnce).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.deep.include({
        telegramId: testTelegramId,
      });
      expect(mockLogger.error.firstCall.args[0]).to.have.property(
        "err",
        dbError,
      );
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "Database error fetching user profile",
      );
    });

    it("should return error if telegramId is invalid", async () => {
      const result = await stateManager.getUserProfileData({ telegramId: "" });

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid Telegram ID provided.",
      });

      expect(prismaFindUniqueStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
    });
  });

  // Tests for getUserPastSessions
  describe("getUserPastSessions", () => {
    const testTelegramId = "123456789";
    const bigIntTestTelegramId = BigInt(testTelegramId);

    // --- Schema Validation Tests ---
    describe("Schema Validation", () => {
      it("should accept valid input according to schema", () => {
        const validInput = { telegramId: testTelegramId };
        expect(() =>
          getUserPastSessionsSchema.parse(validInput),
        ).to.not.throw();
      });

      it("should reject invalid input (missing telegramId)", () => {
        const invalidInput = {};
        expect(() => getUserPastSessionsSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (empty string telegramId)", () => {
        const invalidInput = { telegramId: "" };
        expect(() => getUserPastSessionsSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });
    });
    // --- End Schema Validation Tests ---

    it("should call prisma.sessions.findMany with correct parameters and return session dates", async () => {
      const date1 = new Date("2025-01-01T10:00:00Z");
      const date2 = new Date("2025-02-01T10:00:00Z");
      const mockSessions = [
        { appointment_datetime: date1 },
        { appointment_datetime: date2 },
      ];

      prismaFindManyStub.resolves(mockSessions);

      const result = await stateManager.getUserPastSessions({
        telegramId: testTelegramId,
      });

      expect(result).to.deep.equal({
        success: true,
        data: [date1, date2],
      });

      expect(prismaFindManyStub.calledOnce).to.be.true;
      expect(prismaFindManyStub.firstCall.args[0].where).to.deep.equal({
        telegram_id: bigIntTestTelegramId,
        session_status: "COMPLETED",
      });
      expect(prismaFindManyStub.firstCall.args[0].select).to.deep.equal({
        appointment_datetime: true,
      });
      expect(prismaFindManyStub.firstCall.args[0].orderBy).to.deep.equal({
        appointment_datetime: "desc",
      });
      expect(prismaFindManyStub.firstCall.args[0].take).to.equal(5);

      expect(mockLogger.info.calledOnce).to.be.true;
      expect(mockLogger.info.firstCall.args[0]).to.deep.equal({
        telegramId: testTelegramId,
        count: 2,
      });
      expect(mockLogger.info.firstCall.args[1]).to.equal(
        "Past session dates fetched successfully.",
      );
      expect(mockLogger.error.notCalled).to.be.true;
    });

    it("should return empty array when no past sessions exist", async () => {
      prismaFindManyStub.resolves([]);

      const result = await stateManager.getUserPastSessions({
        telegramId: testTelegramId,
      });

      expect(result).to.deep.equal({
        success: true,
        data: [],
      });

      expect(prismaFindManyStub.calledOnce).to.be.true;
      expect(mockLogger.info.calledOnce).to.be.true;
      expect(mockLogger.info.firstCall.args[0]).to.deep.equal({
        telegramId: testTelegramId,
        count: 0,
      });
      expect(mockLogger.error.notCalled).to.be.true;
    });

    it("should log error and return failure on database error", async () => {
      const dbError = new Error("DB Error");
      prismaFindManyStub.rejects(dbError);

      const result = await stateManager.getUserPastSessions({
        telegramId: testTelegramId,
      });

      expect(result).to.deep.equal({
        success: false,
        error: "Database error fetching past sessions",
      });

      expect(prismaFindManyStub.calledOnce).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.deep.include({
        telegramId: testTelegramId,
      });
      expect(mockLogger.error.firstCall.args[0]).to.have.property(
        "err",
        dbError,
      );
      expect(mockLogger.error.firstCall.args[1]).to.equal(
        "Database error fetching past sessions",
      );
    });

    it("should return error if telegramId is invalid", async () => {
      const result = await stateManager.getUserPastSessions({ telegramId: "" });

      expect(result).to.deep.equal({
        success: false,
        error: "Invalid Telegram ID provided.",
      });

      expect(prismaFindManyStub.notCalled).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
    });
  });
}); // End describe stateManager
