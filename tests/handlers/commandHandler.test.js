// tests/handlers/commandHandler.test.js

// Mock the command registry
const mockCommandRegistry = {
  client: {},
  admin: {},
};
jest.mock("../../src/commands/registry", () => mockCommandRegistry);

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock Telegraf context
const mockCtx = (messageText, userState = {}) => ({
  message: { text: messageText },
  state: { user: userState }, // To simulate attachUser middleware
  from: { id: userState.id || 12345 }, // Fallback if user.id not in state
  reply: jest.fn().mockResolvedValue(true),
});

describe("Command Handler", () => {
  let commandHandler;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules(); // Resets the module cache, re-runs module-level mocks
    jest.clearAllMocks(); // Clears all mock function calls

    // Reset the registry for each test
    mockCommandRegistry.client = {};
    mockCommandRegistry.admin = {};

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    commandHandler = require("../../src/handlers/commandHandler");
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  describe("initialize", () => {
    it("should initialize successfully with a logger", () => {
      expect(() =>
        commandHandler.initialize({ logger: mockLogger }),
      ).not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[commandHandler] Initialized.",
      );
    });

    it("should throw an error if logger is missing", () => {
      expect(() => commandHandler.initialize({})).toThrow(
        "CommandHandler requires logger dependency.",
      );
      expect(() => commandHandler.initialize()).toThrow(
        "CommandHandler requires logger dependency.",
      );
    });
  });

  describe("handleCommand", () => {
    beforeEach(() => {
      // Initialize with logger before each command test
      commandHandler.initialize({ logger: mockLogger });

      // Setup some mock commands
      mockCommandRegistry.client.help = {
        handler: jest.fn().mockResolvedValue(true),
        description: "Shows help",
      };
      mockCommandRegistry.client.book = {
        handler: jest.fn().mockResolvedValue(true),
        description: "Books a session",
      };
      mockCommandRegistry.admin.ban = {
        handler: jest.fn().mockResolvedValue(true),
        description: "Bans a user",
      };
      mockCommandRegistry.admin.stats = {
        handler: jest.fn().mockResolvedValue(true),
        description: "Shows stats",
      };
    });

    it("should execute a client command for a CLIENT user", async () => {
      const ctx = mockCtx("/help", { id: "client123", role: "CLIENT" });
      await commandHandler.handleCommand(ctx);
      expect(mockCommandRegistry.client.help.handler).toHaveBeenCalledWith(ctx);
      expect(ctx.reply).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ commandName: "help", userId: "client123" }),
        "Executing client command.",
      );
    });

    it("should execute an admin command for an ADMIN user", async () => {
      const ctx = mockCtx("/ban user123", { id: "admin456", role: "ADMIN" });
      await commandHandler.handleCommand(ctx);
      expect(mockCommandRegistry.admin.ban.handler).toHaveBeenCalledWith(ctx);
      expect(ctx.reply).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ commandName: "ban", userId: "admin456" }),
        "Executing admin command.",
      );
    });

    it("should deny an admin command for a CLIENT user", async () => {
      const ctx = mockCtx("/ban user123", { id: "client123", role: "CLIENT" });
      await commandHandler.handleCommand(ctx);
      expect(mockCommandRegistry.admin.ban.handler).not.toHaveBeenCalled();
      // Current logic: if a command is not in client registry, it's unknown for a client.
      // It doesn't check admin registry to then deny.
      expect(ctx.reply).toHaveBeenCalledWith(
        'Sorry, I don\'t recognize the command "/ban". Please use /help to see available commands.',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ commandName: "ban", userRole: "CLIENT" }),
        "Unknown command or no handler defined.", // This is what gets logged
      );
    });

    it("should deny a client-only command for an ADMIN user", async () => {
      const ctx = mockCtx("/book", { id: "admin456", role: "ADMIN" });
      await commandHandler.handleCommand(ctx);
      expect(mockCommandRegistry.client.book.handler).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        "This command is for general client use. Please use specific admin commands or the dashboard.",
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ commandName: "book", userId: "admin456" }),
        "ADMIN user attempted client-only command.",
      );
    });

    it("should handle unknown commands for a CLIENT user", async () => {
      const ctx = mockCtx("/unknowncmd", { id: "client123", role: "CLIENT" });
      await commandHandler.handleCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(
        'Sorry, I don\'t recognize the command "/unknowncmd". Please use /help to see available commands.',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          commandName: "unknowncmd",
          userRole: "CLIENT",
        }),
        "Unknown command or no handler defined.",
      );
    });

    it("should handle unknown commands for an ADMIN user", async () => {
      const ctx = mockCtx("/unknowncmd", { id: "admin456", role: "ADMIN" });
      await commandHandler.handleCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(
        'Sorry, I don\'t recognize the command "/unknowncmd". Please use /help to see available commands.',
      );
    });

    it("should default to CLIENT role if user role is not found in ctx.state.user", async () => {
      const ctx = mockCtx("/help", {}); // No role in ctx.state.user
      await commandHandler.handleCommand(ctx);
      expect(mockCommandRegistry.client.help.handler).toHaveBeenCalledWith(ctx);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ commandName: "help" }),
        "User role not found in ctx.state.user. Defaulting to 'CLIENT'. Ensure attachUser middleware runs correctly.",
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ commandName: "help", userId: 12345 }), // Role defaults to CLIENT
        "Executing client command.",
      );
    });

    it("should handle case-insensitivity for command names (by parsing to lowercase)", async () => {
      const ctx = mockCtx("/HELP", { id: "client123", role: "CLIENT" });
      await commandHandler.handleCommand(ctx);
      expect(mockCommandRegistry.client.help.handler).toHaveBeenCalledWith(ctx);
    });

    it("should handle case-insensitivity for user roles (by normalizing to uppercase)", async () => {
      const ctxAdminLower = mockCtx("/ban user789", {
        id: "admin789",
        role: "admin",
      }); // lowercase admin
      await commandHandler.handleCommand(ctxAdminLower);
      expect(mockCommandRegistry.admin.ban.handler).toHaveBeenCalledWith(
        ctxAdminLower,
      );

      const ctxClientUpper = mockCtx("/help", {
        id: "client789",
        role: "client",
      }); // lowercase client
      await commandHandler.handleCommand(ctxClientUpper);
      expect(mockCommandRegistry.client.help.handler).toHaveBeenCalledWith(
        ctxClientUpper,
      );
    });

    it("should reply with unrecognized role message if role is neither ADMIN nor CLIENT after normalization (edge case)", async () => {
      // This tests the scenario where role normalization might fail or an unexpected role slips through
      // The current code defaults to CLIENT if role is missing, but this tests if it was something else entirely.
      const ctx = mockCtx("/help", { id: "unknownRoleUser", role: "VIEWER" });
      await commandHandler.handleCommand(ctx);
      // For role "VIEWER", handlerInfo will be null as it's not in client or admin lookup.
      // This leads to the "Unknown command" path.
      expect(mockCommandRegistry.client.help.handler).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        'Sorry, I don\'t recognize the command "/help". Please use /help to see available commands.',
      );
      // This specific error log for "unrecognized role attempted client command" is not hit.
      // Instead, the "User with unrecognized role type during command lookup" is logged.
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          commandName: "help",
          userRole: "VIEWER",
          userId: "unknownRoleUser",
        }),
        "User with unrecognized role type during command lookup.",
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ commandName: "help", userRole: "VIEWER" }),
        "Unknown command or no handler defined.",
      );
    });

    it("should correctly parse command with arguments but only use the command part", async () => {
      const ctx = mockCtx("/book argument1 argument2", {
        id: "client123",
        role: "CLIENT",
      });
      await commandHandler.handleCommand(ctx);
      expect(mockCommandRegistry.client.book.handler).toHaveBeenCalledWith(ctx);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ commandName: "book", userId: "client123" }),
        "Executing client command.",
      );
    });

    it("should handle commands not found in any registry section for ADMIN", async () => {
      const ctx = mockCtx("/completely_unknown", {
        id: "admin456",
        role: "ADMIN",
      });
      await commandHandler.handleCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(
        'Sorry, I don\'t recognize the command "/completely_unknown". Please use /help to see available commands.',
      );
    });
  });
});
