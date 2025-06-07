/**
 * @fileoverview Tests for the inline query handler
 */

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

const mockPrisma = {
  sessionInvite: {
    findMany: jest.fn(),
  },
  session: {
    findMany: jest.fn(),
  },
};

describe("Inline Query Handler", () => {
  // let inlineQueryHandler;
  let initializeInlineQueryHandler;
  let handleInlineQuery;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Re-require the module under test after resetting modules
    const inlineQuery = require("../../src/handlers/inlineQueryHandler");
    initializeInlineQueryHandler = inlineQuery.initializeInlineQueryHandler;
    handleInlineQuery = inlineQuery.handleInlineQuery;
  });

  describe("initializeInlineQueryHandler", () => {
    it("should initialize successfully with valid dependencies", () => {
      expect(() => {
        initializeInlineQueryHandler({
          logger: mockLogger,
          prisma: mockPrisma,
        });
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith(
        "[inlineQueryHandler] Initialized successfully.",
      );
    });

    it("should log error when missing dependencies", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      expect(() => {
        initializeInlineQueryHandler({});
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[inlineQueryHandler] Initialization failed: Missing prisma or logger dependency.",
      );

      consoleSpy.mockRestore();
    });
  });

  describe("handleInlineQuery", () => {
    beforeEach(() => {
      // Initialize handler before each test
      initializeInlineQueryHandler({
        logger: mockLogger,
        prisma: mockPrisma,
      });
    });

    describe("no query text", () => {
      it("should return empty results for no query", async () => {
        const mockCtx = {
          from: { id: 12345 },
          inlineQuery: { query: "" },
          answerInlineQuery: jest.fn(),
        };

        await handleInlineQuery(mockCtx);

        expect(mockCtx.answerInlineQuery).toHaveBeenCalledWith([]);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          { userId: "12345" },
          "[inline] Empty query, returning no results.",
        );
      });

      it("should return empty results for whitespace query", async () => {
        const mockCtx = {
          from: { id: 12345 },
          inlineQuery: { query: "   " },
          answerInlineQuery: jest.fn(),
        };

        await handleInlineQuery(mockCtx);

        expect(mockCtx.answerInlineQuery).toHaveBeenCalledWith([]);
      });
    });

    describe("share invite query", () => {
      it('should return invite results for "share" query', async () => {
        const mockInvites = [
          {
            id: "invite-1",
            inviteToken: "TOKEN123",
            status: "pending",
            parentSession: {
              sessionType: { name: "Kambo Session" },
              appointmentDateTime: new Date("2025-01-15T14:00:00Z"),
              user: { firstName: "John" },
            },
          },
        ];

        mockPrisma.sessionInvite.findMany.mockResolvedValueOnce(mockInvites);

        const mockCtx = {
          from: { id: 12345 },
          inlineQuery: { query: "share" },
          answerInlineQuery: jest.fn(),
        };

        await handleInlineQuery(mockCtx);

        expect(mockPrisma.sessionInvite.findMany).toHaveBeenCalledWith({
          where: {
            parentSession: {
              userId: "12345",
            },
            status: "pending",
          },
          include: {
            parentSession: {
              include: {
                user: true,
                sessionType: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        });

        expect(mockCtx.answerInlineQuery).toHaveBeenCalledWith([
          {
            type: "article",
            id: "invite-1",
            title: "Share Kambo Session Invitation",
            description: "Jan 15, 2025 at 8:00 AM",
            input_message_content: {
              message_text:
                "🌿 You've been invited to join a Kambo healing session!\\n\\n📅 **Kambo Session**\\n🗓️ Jan 15, 2025 at 8:00 AM\\n👤 Hosted by John\\n\\nTap the link below to view details and respond:\\nhttps://t.me/YourBotUsername?start=invite_TOKEN123\\n\\n_This is a personalized invitation link just for you._",
              parse_mode: "Markdown",
            },
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔗 Open Invitation",
                    url: "https://t.me/YourBotUsername?start=invite_TOKEN123",
                  },
                ],
              ],
            },
          },
        ]);
      });

      it("should handle no pending invites found", async () => {
        mockPrisma.sessionInvite.findMany.mockResolvedValueOnce([]);

        const mockCtx = {
          from: { id: 12345 },
          inlineQuery: { query: "share" },
          answerInlineQuery: jest.fn(),
        };

        await handleInlineQuery(mockCtx);

        expect(mockCtx.answerInlineQuery).toHaveBeenCalledWith([
          expect.objectContaining({
            type: "article",
            id: "no-invites",
            title: "No Active Invitations",
            description: "You don't have any pending invitations to share.",
            input_message_content: {
              message_text: expect.stringContaining(
                "I don't have any active session invitations to share right now.",
              ),
            },
          }),
        ]);
      });

      it("should handle database errors gracefully", async () => {
        mockPrisma.sessionInvite.findMany.mockRejectedValueOnce(
          new Error("Database error"),
        );

        const mockCtx = {
          from: { id: 12345 },
          inlineQuery: { query: "share" },
          answerInlineQuery: jest.fn(),
        };

        await handleInlineQuery(mockCtx);

        expect(mockLogger.error).toHaveBeenCalledWith(
          { err: expect.any(Error), userId: "12345", query: "share" },
          "[inline] Error processing inline query.",
        );

        expect(mockCtx.answerInlineQuery).toHaveBeenCalledWith([
          expect.objectContaining({
            type: "article",
            id: "error",
            title: "Error",
            description: "Unable to load invitations at this time.",
            input_message_content: {
              message_text:
                "Sorry, I couldn't load your invitations right now. Please try again later.",
            },
          }),
        ]);
      });
    });

    describe("other queries", () => {
      it("should return help message for unknown queries", async () => {
        const mockCtx = {
          from: { id: 12345 },
          inlineQuery: { query: "unknown" },
          answerInlineQuery: jest.fn(),
        };

        await handleInlineQuery(mockCtx);

        expect(mockCtx.answerInlineQuery).toHaveBeenCalledWith([
          expect.objectContaining({
            type: "article",
            id: "help",
            title: "How to use inline mode",
            description: 'Type "share" to find your session invitations.',
            input_message_content: expect.objectContaining({
              message_text: expect.stringContaining(
                "I can help you share session invitations",
              ),
              parse_mode: "Markdown",
            }),
          }),
        ]);
      });
    });

    describe("error handling", () => {
      it("should handle missing user ID", async () => {
        const mockCtx = {
          from: undefined,
          inlineQuery: { query: "share" },
          answerInlineQuery: jest.fn(),
        };

        await handleInlineQuery(mockCtx);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          "[inline] Inline query received without user information.",
        );

        expect(mockCtx.answerInlineQuery).toHaveBeenCalledWith([]);
      });

      it("should handle missing dependencies", async () => {
        // Test with uninitialized handler by resetting modules
        jest.resetModules();
        const consoleSpy = jest.spyOn(console, "error").mockImplementation();

        const mockCtx = {
          from: { id: 12345 },
          inlineQuery: { query: "share" },
          answerInlineQuery: jest.fn(),
        };

        // Call without initialization (fresh module import)
        const {
          handleInlineQuery: uninitializedHandler,
        } = require("../../src/handlers/inlineQueryHandler");
        await uninitializedHandler(mockCtx);

        expect(consoleSpy).toHaveBeenCalledWith(
          "[inlineQueryHandler] Handler called but dependencies are not available.",
        );

        expect(mockCtx.answerInlineQuery).toHaveBeenCalledWith([]);

        consoleSpy.mockRestore();
      });

      it("should handle answerInlineQuery failures gracefully", async () => {
        const mockCtx = {
          from: { id: 12345 },
          inlineQuery: { query: "" },
          answerInlineQuery: jest
            .fn()
            .mockRejectedValue(new Error("Answer failed")),
        };

        await handleInlineQuery(mockCtx);

        expect(mockLogger.error).toHaveBeenCalledWith(
          { err: expect.any(Error), userId: "12345" },
          "[inline] Failed to answer inline query.",
        );
      });
    });
  });
});
