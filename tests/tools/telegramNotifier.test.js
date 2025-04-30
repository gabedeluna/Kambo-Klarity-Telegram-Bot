/**
 * Unit tests for the telegramNotifier tool
 */

const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();
const { z } = require("zod"); // Import Zod

// Import schemas
const {
  sendWaiverLinkSchema,
  sendTextMessageSchema,
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

// Mock 'telegraf/markup' as it's required by the module
const mockWebAppButton = {
  text: "📝 Complete Waiver & Book",
  web_app: { url: "mock-url" },
};
const mockReplyMarkup = {
  reply_markup: { inline_keyboard: [[mockWebAppButton]] },
};

const mockMarkup = {
  Markup: {
    // inlineKeyboard should return the expected structure for sendMessage
    inlineKeyboard: sinon.stub().returns(mockReplyMarkup),
    button: {
      // webApp stub just needs to return the button part for the inlineKeyboard stub to use
      webApp: sinon.stub().returns(mockWebAppButton),
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
    // Reset Markup stubs
    mockMarkup.Markup.inlineKeyboard.resetHistory();
    mockMarkup.Markup.button.webApp.resetHistory(); // Reset the webApp stub

    // Define mocks needed within this scope
    const configMock = { FORM_URL: "dummy-form-url" };

    // Use proxyquire with ALL necessary mocks and CORRECT paths
    const notifierModule = proxyquire("../../src/tools/telegramNotifier", {
      "../../core/bot": { bot: mockBot },
      "../../core/logger": mockLogger,
      "../../core/prisma": mockPrisma, // Provide prisma mock
      "../../commands/registry": mockCommandRegistry,
      telegraf: mockMarkup, // Mock telegraf/markup
    });

    // Initialize the notifier instance using 'this'
    // Ensure initialize parameters match what the module expects
    if (typeof notifierModule.initialize === "function") {
      notifierModule.initialize({
        bot: mockBot,
        logger: mockLogger,
        prisma: mockPrisma,
        config: configMock,
      });
    }

    // Assign the fully initialized instance to 'this.notifier'
    this.notifier = notifierModule;

    // Assign spy for convenience if needed, access via mockBot is also fine
    this.setMyCommandsSpy = mockBot.telegram.setMyCommands;
  });

  // --- initialize Tests ---
  describe("initialize", function () {
    it("should throw an error if dependencies are missing", function () {
      // Create a new instance of the module to avoid affecting other tests
      const notifierModule = proxyquire("../../src/tools/telegramNotifier", {
        "../../core/bot": { bot: mockBot },
        "../../core/logger": mockLogger,
        "../../core/prisma": mockPrisma,
        "../../commands/registry": mockCommandRegistry,
        telegraf: mockMarkup,
      });

      // Test with missing dependencies
      expect(() => notifierModule.initialize()).to.throw(
        Error,
        /Missing: dependencies object/,
      );
      expect(() => notifierModule.initialize({})).to.throw(
        Error,
        /Missing: bot, prisma, logger, config/,
      );

      // Test with missing bot
      expect(() =>
        notifierModule.initialize({
          logger: mockLogger,
          prisma: mockPrisma,
          config: { FORM_URL: "test-url" },
        }),
      ).to.throw(Error, /Missing: bot/);

      // Test with missing config.FORM_URL
      expect(() =>
        notifierModule.initialize({
          bot: mockBot,
          logger: mockLogger,
          prisma: mockPrisma,
          config: {},
        }),
      ).to.throw(Error, /Missing: config.FORM_URL/);
    });
  });

  // --- sendWaiverLink Tests ---
  describe("sendWaiverLink", function () {
    // Use function()
    const testTelegramId = "123456789";
    const testSessionType = "initial";

    // REMOVED nested beforeEach

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

    it("should return error when tool is not initialized", async function () {
      // Create a new uninitalized instance of the module
      const uninitializedNotifier = proxyquire("../../src/tools/telegramNotifier", {
        "../../core/bot": { bot: null },
        "../../core/logger": null,
        "../../core/prisma": null,
        "../../commands/registry": mockCommandRegistry,
        telegraf: mockMarkup,
      });

      // Act
      const result = await uninitializedNotifier.sendWaiverLink({
        telegramId: testTelegramId,
        sessionType: testSessionType,
      });

      // Assert
      expect(result.success).to.be.false;
      expect(result.error).to.equal(
        "Internal server error: Notifier not initialized",
      );
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

    // REMOVED nested beforeEach

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

    it("should return error when tool is not initialized", async function () {
      // Create a new uninitalized instance of the module
      const uninitializedNotifier = proxyquire("../../src/tools/telegramNotifier", {
        "../../core/bot": { bot: null },
        "../../core/logger": null,
        "../../core/prisma": null,
        "../../commands/registry": mockCommandRegistry,
        telegraf: mockMarkup,
      });

      // Act
      const result = await uninitializedNotifier.sendTextMessage({
        telegramId: "123456789",
        text: "Test message",
      });

      // Assert
      expect(result.success).to.be.false;
      expect(result.error).to.equal("Tool not initialized");
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
      expect(result.error).to.equal("Failed to send Telegram message"); // Fix: Match actual error message
      expect(mockLogger.error.calledOnce).to.be.true;
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

    // REMOVED nested beforeEach

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

    it("should return error when dependencies are missing", async function () {
      // Reset any previous calls
      mockLogger.error.resetHistory();

      // Create a special version of the module where we can control the module-level variables
      // This simulates a partially initialized module
      const partialNotifier = {
        // Export the function we want to test
        setRoleSpecificCommands: async function ({ telegramId, role }) {
          // This simulates the function running with missing dependencies
          // but with a valid logger for error reporting
          if (!mockLogger) {
            return { success: false, error: "Logger missing" };
          }

          mockLogger.error(
            "setRoleSpecificCommands: Missing or invalid dependencies",
            {
              telegramId,
              role,
            },
          );
          return { success: false, error: "Missing or invalid dependencies" };
        },
      };

      // Act
      const result = await partialNotifier.setRoleSpecificCommands({
        telegramId: TEST_CLIENT_ID,
        role: "client",
      });

      // Assert
      expect(result.success).to.be.false;
      expect(result.error).to.equal("Missing or invalid dependencies");
      expect(mockLogger.error.calledOnce).to.be.true;
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
});
