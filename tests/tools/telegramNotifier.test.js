/**
 * Unit tests for the telegramNotifier tool
 */

const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();
const { z } = require("zod"); // Import Zod

// Import real schemas for validation tests
const {
  sendWaiverLinkSchema,
  sendTextMessageSchema,
  sendSessionTypeSelectorSchema,
  sendAdminNotificationSchema, // <-- Import the new schema
} = require("../../src/tools/toolSchemas");

// Mock dependencies - TOP LEVEL
const mockLogger = {
  info: sinon.stub(),
  error: sinon.stub(),
  warn: sinon.stub(),
  debug: sinon.stub(), // Keep if used
};

const mockBot = {
  telegram: {
    sendMessage: sinon.stub(),
    setMyCommands: sinon.stub(),
  },
};

const mockPrisma = {
  users: {
    update: sinon.stub(),
    findMany: sinon.stub(), // <-- Add findMany stub for admin lookup
  },
};

const mockCommandRegistry = {
  client: {
    help: { descr: "Client help" },
    book: { descr: "Client book" },
  },
  admin: {
    sessions: { descr: "Admin sessions" },
  },
};

// Mock sessionTypes helper
const mockSessionTypes = {
  getAll: sinon.stub().returns([
    { id: "type1", label: "Type 1" },
    { id: "type2", label: "Type 2" },
  ]),
};

// Create mock for toolSchemas
const mockToolSchemas = {
  toolSchemas: {
    sendWaiverLinkSchema,
    sendTextMessageSchema,
    sendSessionTypeSelectorSchema,
    sendAdminNotificationSchema, // <-- Add schema to mock
  },
};

// Mock 'telegraf/markup' as it's required by the module
const mockWebAppButton = {
  text: "📝 Complete Waiver & Book",
  web_app: { url: "mock-url" },
};
const mockReplyMarkup = {
  reply_markup: { inline_keyboard: [[]] }, // Adjust later if needed per test
};
// Define a mock callback button structure
const mockCallbackButton = {
  text: "Mock Callback Btn",
  callback_data: "mock:cb",
};

const mockMarkup = {
  Markup: {
    // inlineKeyboard should return the expected structure for sendMessage
    inlineKeyboard: sinon.stub().returns(mockReplyMarkup),
    button: {
      // webApp stub just needs to return the button part for the inlineKeyboard stub to use
      webApp: sinon.stub().returns(mockWebAppButton),
      // Add the missing callback stub
      callback: sinon.stub().returns(mockCallbackButton),
    },
  },
};

// --- Main Test Suite ---
describe("Telegram Notifier Tool", () => {
  // No variable declarations here, use 'this'

  // --- SINGLE TOP-LEVEL beforeEach ---
  beforeEach(function () {
    // Use function() to allow 'this'
    // Reset all stubs
    mockLogger.info.resetHistory();
    mockLogger.error.resetHistory();
    mockLogger.warn.resetHistory();
    mockLogger.debug.resetHistory();
    mockBot.telegram.sendMessage.resetHistory();
    mockBot.telegram.setMyCommands.resetHistory();
    mockPrisma.users.update.resetHistory();
    mockPrisma.users.findMany.resetHistory(); // <-- Reset findMany stub
    // Reset Markup stubs
    mockMarkup.Markup.inlineKeyboard.resetHistory();
    mockMarkup.Markup.button.webApp.resetHistory(); // Reset the webApp stub
    mockMarkup.Markup.button.callback.resetHistory(); // Reset the callback stub

    const configMock = { formUrl: "dummy-form-url" }; // Use correct key 'formUrl'

    // Use proxyquire HERE within beforeEach to get the factory
    // This ensures mocks are correctly applied for each test
    const { createTelegramNotifier } = proxyquire(
      "../../src/tools/telegramNotifier",
      {
        "../../core/bot": { bot: mockBot },
        "../../core/logger": mockLogger,
        "../../core/prisma": mockPrisma,
        "../../commands/registry": mockCommandRegistry,
        "../../core/sessionTypes": mockSessionTypes,
        "./toolSchemas": mockToolSchemas,
        // Correctly mock 'telegraf' module exporting the 'Markup' object
        telegraf: { Markup: mockMarkup.Markup },
      },
    );

    // Create the notifier instance using the factory and mocks
    // Assign the fully initialized instance to 'this.notifier'
    this.notifier = createTelegramNotifier({
      bot: mockBot,
      logger: mockLogger,
      prisma: mockPrisma,
      config: configMock,
      sessionTypes: mockSessionTypes,
    });

    // Assign spy for convenience if needed, access via mockBot is also fine
    this.setMyCommandsSpy = mockBot.telegram.setMyCommands;
  });

  // --- sendWaiverLink Tests ---
  describe("sendWaiverLink", function () {
    // Use function()
    const testTelegramId = "123456789";
    const testSessionType = "initial";

    it("should validate input using sendWaiverLinkSchema", function () {
      const validData = {
        telegramId: testTelegramId,
        sessionType: testSessionType,
      };
      const invalidData = { telegramId: testTelegramId }; // Missing sessionType
      expect(() => sendWaiverLinkSchema.parse(validData)).not.to.throw();
      expect(() => sendWaiverLinkSchema.parse(invalidData)).to.throw(
        z.ZodError,
      );
    });

    it("should send a waiver link message and store the message ID", async function () {
      // Arrange Mocks
      const testMessageId = 987;
      mockBot.telegram.sendMessage.resolves({ message_id: testMessageId });
      mockPrisma.users.update.resolves({}); // Mock successful DB update

      // Act - Use this.notifier
      const result = await this.notifier.sendWaiverLink({
        telegramId: testTelegramId,
        sessionType: testSessionType,
      });

      // Assert
      expect(result.success).to.be.true;
      expect(result.messageId).to.equal(testMessageId);
      expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
      expect(mockPrisma.users.update.calledOnce).to.be.true;
      expect(mockPrisma.users.update.firstCall.args[0]).to.deep.equal({
        where: { telegram_id: BigInt(testTelegramId) },
        data: { edit_msg_id: testMessageId },
      });
    });

    it("should return an error if telegramId is missing", async function () {
      // Act
      const result = await this.notifier.sendWaiverLink({
        // telegramId is missing
        sessionType: testSessionType,
      });
      // Assert
      expect(result.success).to.be.false;
      expect(result.error).to.equal("Missing parameters");
      expect(mockBot.telegram.sendMessage.called).to.be.false;
      expect(mockPrisma.users.update.called).to.be.false;
    });

    it("should return an error if sessionType is missing", async function () {
      // Act
      const result = await this.notifier.sendWaiverLink({
        telegramId: testTelegramId,
        // sessionType is missing
      });
      // Assert
      expect(result.success).to.be.false;
      expect(result.error).to.equal("Missing parameters");
      expect(mockBot.telegram.sendMessage.called).to.be.false;
      expect(mockPrisma.users.update.called).to.be.false;
    });

    it("should handle Telegram API errors gracefully", async function () {
      // Arrange
      const apiError = new Error("Telegram Send Error");
      mockBot.telegram.sendMessage.rejects(apiError);

      // Act
      const result = await this.notifier.sendWaiverLink({
        telegramId: testTelegramId,
        sessionType: testSessionType,
      });

      // Assert
      expect(result.success).to.be.false;
      expect(result.error).to.equal("Telegram API error");
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockPrisma.users.update.called).to.be.false;
    });

    it("should handle database update errors gracefully", async function () {
      // Arrange
      const dbError = new Error("DB Update Failed");
      const sentMsg = { message_id: 987 }; // Need the message_id for the warning path
      mockBot.telegram.sendMessage.resolves(sentMsg);
      mockPrisma.users.update.rejects(dbError);

      // Act
      const result = await this.notifier.sendWaiverLink({
        telegramId: testTelegramId,
        sessionType: testSessionType,
      });

      // Assert
      expect(result.success).to.be.true;
      expect(result.messageId).to.equal(sentMsg.message_id);
      expect(result.warning).to.equal(
        "Message sent but failed to store message_id in DB",
      );
      expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true; // Logger error for DB failure
    });

    it("should handle missing message_id from Telegram response", async function () {
      // Arrange
      mockBot.telegram.sendMessage.resolves({ chat: { id: 123 } }); // Simulate missing message_id but valid response

      // Act
      const result = await this.notifier.sendWaiverLink({
        telegramId: testTelegramId,
        sessionType: testSessionType,
      });

      // Assert
      expect(result.success).to.be.true;
      expect(result.messageId).to.be.null;
      expect(result.warning).to.equal("Message sent but message_id missing");
      expect(mockLogger.warn.calledOnce).to.be.true; // Code logs a warning
      expect(mockPrisma.users.update.called).to.be.false; // Don't update DB if no message ID
    });

    it("should use custom message text if provided", async function () {
      // Arrange
      const customMessage = "This is a custom waiver prompt.";
      const testMessageId = 987; // Define message ID for the test
      mockBot.telegram.sendMessage.resolves({ message_id: testMessageId });
      mockPrisma.users.update.resolves({});

      // Act
      const result = await this.notifier.sendWaiverLink({
        telegramId: testTelegramId,
        sessionType: testSessionType,
        messageText: customMessage, // Use messageText which is the correct parameter name
      });

      // Assert
      expect(result.success).to.be.true;
      expect(result.messageId).to.equal(testMessageId);
      expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
      const messageArg = mockBot.telegram.sendMessage.firstCall.args[1];
      expect(messageArg).to.contain(customMessage);
      // Check Prisma update call as well for this successful path
      expect(mockPrisma.users.update.calledOnce).to.be.true;
      expect(mockPrisma.users.update.firstCall.args[0]).to.deep.equal({
        where: { telegram_id: BigInt(testTelegramId) }, // Use telegram_id (BigInt)
        data: { edit_msg_id: testMessageId }, // Use edit_msg_id
      });
    });
  });

  // --- sendTextMessage Tests ---
  describe("sendTextMessage", function () {
    const testTelegramId = "987654321";
    const testText = "This is a test message.";

    it("should validate input using sendTextMessageSchema", function () {
      const validData = { telegramId: testTelegramId, text: testText };
      const invalidData = { telegramId: testTelegramId }; // Missing text
      expect(() => sendTextMessageSchema.parse(validData)).not.to.throw();
      expect(() => sendTextMessageSchema.parse(invalidData)).to.throw(
        z.ZodError,
      );
    });

    it("should send a text message and return success with message ID", async function () {
      // Arrange
      const mockMessageId = 12345;
      mockBot.telegram.sendMessage.resolves({ message_id: mockMessageId });

      // Act
      const result = await this.notifier.sendTextMessage({
        telegramId: testTelegramId,
        text: testText,
      });

      // Assert
      expect(result.success).to.be.true;
      expect(result.messageId).to.equal(mockMessageId);
      expect(
        mockBot.telegram.sendMessage.calledOnceWith(testTelegramId, testText),
      ).to.be.true;
      expect(mockLogger.error.called).to.be.false;
    });

    it("should return failure if telegramId is missing", async function () {
      const result = await this.notifier.sendTextMessage({ text: testText });
      expect(result.success).to.be.false;
      expect(result.error).to.equal("Missing or invalid parameters");
      expect(mockBot.telegram.sendMessage.called).to.be.false;
    });

    it("should return failure if text is missing", async function () {
      const result = await this.notifier.sendTextMessage({
        telegramId: testTelegramId,
      });
      expect(result.success).to.be.false;
      expect(result.error).to.equal("Missing or invalid parameters");
      expect(mockBot.telegram.sendMessage.called).to.be.false;
    });

    it("should handle Telegram API errors gracefully", async function () {
      // Arrange
      const apiError = new Error("Telegram API Error");
      mockBot.telegram.sendMessage.rejects(apiError);

      // Act
      const result = await this.notifier.sendTextMessage({
        telegramId: testTelegramId,
        text: testText,
      });

      // Assert
      expect(result.success).to.be.false;
      expect(result.error).to.equal("Telegram API Error"); // Expect the specific error message simulated in this test
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
    });

    it("should return success with warning if message_id is missing from response", async function () {
      // Arrange
      mockBot.telegram.sendMessage.resolves({ chat: { id: 123 } }); // Simulate missing message_id, use non-empty object

      // Act
      const result = await this.notifier.sendTextMessage({
        telegramId: testTelegramId,
        text: testText,
      });

      // Assert
      expect(result.success).to.be.true;
      expect(result.messageId).to.be.undefined;
      expect(mockLogger.warn.called).to.be.false;
    });
  });

  // --- setRoleSpecificCommands Tests ---
  describe("setRoleSpecificCommands", function () {
    const TEST_CLIENT_ID = "111";
    const TEST_ADMIN_ID = "222";
    const TEST_UNKNOWN_ID = "333";

    it("should call setMyCommands with correct scope and client command count for role 'client'", async function () {
      // Use spy from 'this'
      this.setMyCommandsSpy.resolves(true);

      const result = await this.notifier.setRoleSpecificCommands({
        telegramId: TEST_CLIENT_ID,
        role: "client",
      });

      expect(result).to.deep.equal({ success: true });
      expect(this.setMyCommandsSpy.calledOnce).to.be.true;
      expect(this.setMyCommandsSpy.firstCall.args[0])
        .to.be.an("array")
        .with.lengthOf(3);
      expect(this.setMyCommandsSpy.firstCall.args[1]).to.deep.equal({
        scope: { type: "chat", chat_id: Number(TEST_CLIENT_ID) },
      });
      expect(mockLogger.error.called).to.be.false;
    });

    it("should call setMyCommands with correct scope and combined command count for role 'admin'", async function () {
      this.setMyCommandsSpy.resolves(true);

      const result = await this.notifier.setRoleSpecificCommands({
        telegramId: TEST_ADMIN_ID,
        role: "admin",
      });

      expect(result).to.deep.equal({ success: true });
      expect(this.setMyCommandsSpy.calledOnce).to.be.true;
      expect(this.setMyCommandsSpy.firstCall.args[0])
        .to.be.an("array")
        .with.lengthOf(7);
      expect(this.setMyCommandsSpy.firstCall.args[1]).to.deep.equal({
        scope: { type: "chat", chat_id: Number(TEST_ADMIN_ID) },
      });
      expect(mockLogger.error.called).to.be.false;
    });

    it("should call setMyCommands with empty list for unknown roles and log a warning", async function () {
      this.setMyCommandsSpy.resolves(true);

      const result = await this.notifier.setRoleSpecificCommands({
        telegramId: TEST_UNKNOWN_ID,
        role: "unknown_role",
      });

      expect(result).to.deep.equal({ success: true });
      expect(this.setMyCommandsSpy.calledOnce).to.be.true;
      expect(this.setMyCommandsSpy.firstCall.args[0])
        .to.be.an("array")
        .with.lengthOf(0);
      expect(this.setMyCommandsSpy.firstCall.args[1]).to.deep.equal({
        scope: { type: "chat", chat_id: Number(TEST_UNKNOWN_ID) },
      });
      expect(mockLogger.warn.calledOnce).to.be.true;
      expect(mockLogger.error.called).to.be.false;
    });

    it("should return error and not call API if parameters are missing", async function () {
      let result = await this.notifier.setRoleSpecificCommands({
        telegramId: TEST_CLIENT_ID,
      });
      expect(result).to.deep.equal({
        success: false,
        error: "Missing or invalid parameters",
      });
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(this.setMyCommandsSpy.called).to.be.false;
      mockLogger.error.resetHistory();

      result = await this.notifier.setRoleSpecificCommands({ role: "client" });
      expect(result).to.deep.equal({
        success: false,
        error: "Missing or invalid parameters",
      });
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(this.setMyCommandsSpy.called).to.be.false;
    });

    it("should handle falsy result from Telegram API", async function () {
      // Reset any previous calls
      mockLogger.error.resetHistory();

      // Arrange - simulate API returning false
      this.setMyCommandsSpy.resolves(false);

      // Act
      const result = await this.notifier.setRoleSpecificCommands({
        telegramId: TEST_CLIENT_ID,
        role: "client",
      });

      // Assert
      expect(result.success).to.be.false;
      expect(result.error).to.equal("Telegram API returned non-true result");
      expect(mockLogger.error.called).to.be.true;
    });

    it("should return error if setMyCommands API call fails", async function () {
      const apiError = new Error("Telegram API failed");
      this.setMyCommandsSpy.rejects(apiError);

      const result = await this.notifier.setRoleSpecificCommands({
        telegramId: TEST_CLIENT_ID,
        role: "client",
      });

      expect(result).to.deep.equal({
        success: false,
        error: "Telegram API error setting commands",
      });
      expect(this.setMyCommandsSpy.calledOnce).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
      expect(mockLogger.error.firstCall.args[0]).to.contain(
        "Error setting Telegram commands",
      );
      expect(mockLogger.error.firstCall.args[1]).to.deep.equal({
        error: apiError,
      });
    });
  });

  // --- sendSessionTypeSelector Tests ---
  describe("sendSessionTypeSelector", function () {
    const testTelegramId = "123456789";
    const testMessageId = 54321;

    beforeEach(function () {
      // Reset stubs for this test suite
      mockBot.telegram.sendMessage.resetHistory();
      mockPrisma.users.update.resetHistory();
      mockSessionTypes.getAll.resetHistory();
      mockLogger.info.resetHistory();
      mockLogger.error.resetHistory();
      mockLogger.warn.resetHistory();
      mockLogger.debug.resetHistory();
      mockMarkup.Markup.inlineKeyboard.resetHistory();

      // Set up default successful responses
      mockBot.telegram.sendMessage.resolves({ message_id: testMessageId });
      mockPrisma.users.update.resolves({
        id: 1,
        telegram_id: BigInt(testTelegramId),
      });
      mockSessionTypes.getAll.returns([
        { id: "type1", label: "Type 1" },
        { id: "type2", label: "Type 2" },
      ]);
    });

    it("should validate input using sendSessionTypeSelectorSchema", function () {
      const validData = { telegramId: testTelegramId };
      const invalidData = { telegramId: "" }; // Empty telegramId

      expect(() =>
        sendSessionTypeSelectorSchema.parse(validData),
      ).not.to.throw();
      expect(() => sendSessionTypeSelectorSchema.parse(invalidData)).to.throw(
        z.ZodError,
      );
    });

    it("should send session type selector and store message ID successfully", async function () {
      // Act
      const result = await this.notifier.sendSessionTypeSelector({
        telegramId: testTelegramId,
      });

      // Assert
      expect(result).to.deep.equal({ success: true, messageId: testMessageId });

      // Verify sessionTypes.getAll was called
      expect(mockSessionTypes.getAll.calledOnce).to.be.true;

      // Verify sendMessage was called with correct parameters
      expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
      const sendMessageArgs = mockBot.telegram.sendMessage.firstCall.args;
      expect(sendMessageArgs[0]).to.equal(testTelegramId);
      expect(sendMessageArgs[1]).to.equal(
        "Please choose your desired session type:",
      );

      // Verify keyboard structure was used
      expect(mockMarkup.Markup.inlineKeyboard.calledOnce).to.be.true;

      // Verify message_id was stored in database
      expect(mockPrisma.users.update.calledOnce).to.be.true;
      expect(mockPrisma.users.update.firstCall.args[0]).to.deep.equal({
        where: { telegram_id: BigInt(testTelegramId) },
        data: { edit_msg_id: testMessageId },
      });

      // Verify logger was used
      expect(mockLogger.info.called).to.be.true;
      expect(mockLogger.error.called).to.be.false;
    });

    it("should return error if no session types are available", async function () {
      // Arrange - make getAll return empty array
      mockSessionTypes.getAll.returns([]);

      // Act
      const result = await this.notifier.sendSessionTypeSelector({
        telegramId: testTelegramId,
      });

      // Assert
      expect(result.success).to.be.false;
      expect(result.error).to.include("No session types available");
      expect(mockBot.telegram.sendMessage.called).to.be.false;
      expect(mockLogger.error.called).to.be.true;
    });

    it("should return error if getAll throws an error", async function () {
      // Arrange - make getAll throw error
      const sessionTypeError = new Error("Failed to get session types");
      mockSessionTypes.getAll.throws(sessionTypeError);

      // Act
      const result = await this.notifier.sendSessionTypeSelector({
        telegramId: testTelegramId,
      });

      // Assert
      expect(result.success).to.be.false;
      expect(result.error).to.include(
        "Internal error retrieving session types",
      );
      expect(mockBot.telegram.sendMessage.called).to.be.false;
      expect(mockLogger.error.called).to.be.true;
    });

    it("should return success with warning if message_id storage fails", async function () {
      // Arrange - database update fails
      const dbError = new Error("Database error");
      mockPrisma.users.update.rejects(dbError);

      // Act
      const result = await this.notifier.sendSessionTypeSelector({
        telegramId: testTelegramId,
      });

      // Assert - should still be successful because the message was sent
      expect(result.success).to.be.true;
      expect(result.messageId).to.equal(testMessageId);
      expect(result.warning).to.include("Database error");
      expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
      expect(mockPrisma.users.update.calledOnce).to.be.true;
      expect(mockLogger.error.calledOnce).to.be.true;
    });

    it("should return success with warning if message_id is missing", async function () {
      // Arrange - sendMessage succeeds but doesn't return message_id
      mockBot.telegram.sendMessage.resolves({});

      // Act
      const result = await this.notifier.sendSessionTypeSelector({
        telegramId: testTelegramId,
      });

      // Assert
      expect(result.success).to.be.true;
      expect(result.messageId).to.be.null;
      expect(result.warning).to.include("no message_id received");
      expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
      expect(mockPrisma.users.update.called).to.be.false;
      expect(mockLogger.warn.called).to.be.true;
    });

    it("should return error if sendMessage fails", async function () {
      // Arrange - sendMessage fails
      const telegramError = new Error("Telegram API error");
      mockBot.telegram.sendMessage.rejects(telegramError);

      // Act
      const result = await this.notifier.sendSessionTypeSelector({
        telegramId: testTelegramId,
      });

      // Assert
      expect(result.success).to.be.false;
      expect(result.error).to.include("Telegram API error");
      expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
      expect(mockPrisma.users.update.called).to.be.false;
      expect(mockLogger.error.called).to.be.true;
    });

    it("should handle specific Telegram API error codes", async function () {
      // Test 400 error
      mockBot.telegram.sendMessage.rejects({ response: { error_code: 400 } });

      let result = await this.notifier.sendSessionTypeSelector({
        telegramId: testTelegramId,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include("Invalid request");

      // Reset for next test
      mockBot.telegram.sendMessage.resetHistory();

      // Test 403 error
      mockBot.telegram.sendMessage.rejects({ response: { error_code: 403 } });

      result = await this.notifier.sendSessionTypeSelector({
        telegramId: testTelegramId,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include("Bot was blocked");
    });
  });

  // --- sendAdminNotification Tests --- //
  describe("sendAdminNotification", function () {
    const testNotificationText = "🚨 System Alert: Maintenance soon!";
    const adminUsersMock = [
      { telegram_id: BigInt("111111") },
      { telegram_id: BigInt("222222") },
    ];

    it("should validate input using sendAdminNotificationSchema", function () {
      const validData = { text: testNotificationText };
      const invalidData = { text: "" }; // Empty text
      const missingData = {}; // Missing text

      expect(() => sendAdminNotificationSchema.parse(validData)).not.to.throw();
      expect(() => sendAdminNotificationSchema.parse(invalidData)).to.throw(
        z.ZodError,
      );
      expect(() => sendAdminNotificationSchema.parse(missingData)).to.throw(
        z.ZodError,
      );
    });

    it("should fetch admin users and send a message to each", async function () {
      // Arrange
      mockPrisma.users.findMany.resolves(adminUsersMock);
      // Mock sendTextMessage to succeed for simplicity in this test
      mockBot.telegram.sendMessage.resolves({ message_id: 123 });

      // Act
      const result = await this.notifier.sendAdminNotification({
        text: testNotificationText,
      });

      // Assert
      expect(result.success).to.be.true;
      expect(result.errors).to.be.an("array").that.is.empty;
      expect(
        mockPrisma.users.findMany.calledOnceWith({
          where: { role: "admin" },
          select: { telegram_id: true },
        }),
      ).to.be.true;
      // Check sendTextMessage was called for each admin
      expect(mockBot.telegram.sendMessage.callCount).to.equal(
        adminUsersMock.length,
      );
      expect(mockBot.telegram.sendMessage.firstCall.args[0]).to.equal(
        String(adminUsersMock[0].telegram_id),
      );
      expect(mockBot.telegram.sendMessage.firstCall.args[1]).to.equal(
        testNotificationText,
      );
      expect(mockBot.telegram.sendMessage.secondCall.args[0]).to.equal(
        String(adminUsersMock[1].telegram_id),
      );
      expect(mockBot.telegram.sendMessage.secondCall.args[1]).to.equal(
        testNotificationText,
      );
      expect(
        mockLogger.info.calledWith(
          `Found ${adminUsersMock.length} admin users to notify.`,
        ),
      ).to.be.true;
      expect(
        mockLogger.info.calledWith(
          `sendAdminNotification completed successfully for all ${adminUsersMock.length} admins.`,
        ),
      ).to.be.true;
    });

    it("should return success true with an empty errors array if no admin users are found", async function () {
      // Arrange
      mockPrisma.users.findMany.resolves([]); // No admins found

      // Act
      const result = await this.notifier.sendAdminNotification({
        text: testNotificationText,
      });

      // Assert
      expect(result.success).to.be.true;
      expect(result.errors).to.be.an("array").that.is.empty;
      expect(mockPrisma.users.findMany.calledOnce).to.be.true;
      expect(mockBot.telegram.sendMessage.called).to.be.false; // No messages sent
      expect(
        mockLogger.warn.calledWith(
          "sendAdminNotification: No admin users found in the database.",
        ),
      ).to.be.true;
    });

    it("should return success false if fetching admin users fails", async function () {
      // Arrange
      const dbError = new Error("Database connection error");
      mockPrisma.users.findMany.rejects(dbError);

      // Act
      const result = await this.notifier.sendAdminNotification({
        text: testNotificationText,
      });

      // Assert
      expect(result.success).to.be.false;
      expect(result.errors).to.be.an("array").with.lengthOf(1);
      expect(result.errors[0].error).to.include(
        "Database error fetching admins",
      );
      expect(
        mockLogger.error.calledWith(
          { err: dbError },
          "Error fetching admin users from database.",
        ),
      ).to.be.true;
      expect(mockBot.telegram.sendMessage.called).to.be.false;
    });

    it("should return success true but populate errors array if some messages fail to send", async function () {
      // Arrange
      mockPrisma.users.findMany.resolves(adminUsersMock);
      // Simulate a realistic Telegram 403 error object
      const sendError = {
        response: {
          error_code: 403,
          description: "Forbidden: bot was blocked by the user",
        },
        message: "Forbidden: bot was blocked by the user", // Often included too
      };
      // Make the first send succeed, the second fail with the simulated 403 error
      mockBot.telegram.sendMessage.onFirstCall().resolves({ message_id: 123 });
      mockBot.telegram.sendMessage.onSecondCall().rejects(sendError);

      // Act
      const result = await this.notifier.sendAdminNotification({
        text: testNotificationText,
      });

      // Assert
      expect(result.success).to.be.true; // Overall operation attempted = success
      expect(result.errors).to.be.an("array").with.lengthOf(1);
      expect(result.errors[0].adminId).to.equal(
        String(adminUsersMock[1].telegram_id),
      );
      // Assert against the specific message returned by sendTextMessage for 403
      expect(result.errors[0].error).to.equal("Bot was blocked by the user.");
      expect(mockBot.telegram.sendMessage.callCount).to.equal(
        adminUsersMock.length,
      );
      expect(
        mockLogger.warn.calledWith(
          `sendAdminNotification completed with 1 failures.`,
        ),
      ).to.be.true;
    });

    it("should return success false with error if text parameter is missing", async function () {
      // Act
      const result = await this.notifier.sendAdminNotification({}); // Missing text

      // Assert
      expect(result.success).to.be.false;
      expect(result.errors).to.be.an("array").with.lengthOf(1);
      expect(result.errors[0].error).to.equal("Missing text parameter");
      expect(
        mockLogger.error.calledWith(
          "sendAdminNotification: Missing required 'text' parameter.",
        ),
      ).to.be.true;
      expect(mockPrisma.users.findMany.called).to.be.false;
      expect(mockBot.telegram.sendMessage.called).to.be.false;
    });
  });
});
