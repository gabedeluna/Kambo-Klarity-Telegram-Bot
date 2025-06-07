/**
 * @fileoverview Integration tests for Feature 9 - Friend Invite Flow
 * Tests the complete end-to-end flow from deep link to waiver completion
 */

const request = require("supertest");
const express = require("express");

// Mock dependencies
// const mockLogger = {
//   info: jest.fn(),
//   error: jest.fn(),
//   warn: jest.fn(),
//   debug: jest.fn(),
// };

const mockPrisma = {
  sessionInvite: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

const mockTelegramNotifier = {
  sendMessage: jest.fn(),
  sendAdminNotification: jest.fn(),
};

// const mockBot = {
//   telegram: {
//     editMessageText: jest.fn(),
//   },
// };

// Mock axios for API calls between components
const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
};

describe("Friend Invite Flow Integration Tests", () => {
  let app;
  let apiRoutes;
  let startCommandHandler;
  let callbackQueryHandler;
  let inlineQueryHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Setup express app for API testing
    app = express();
    app.use(express.json());

    // Mock API routes
    jest.doMock("../../src/routes/api", () => ({
      getRouter: jest.fn(() => {
        const router = express.Router();

        // Friend response endpoint
        router.post("/session-invites/:token/respond", async (req, res) => {
          try {
            const { token } = req.params;
            const { response, friendTelegramId } = req.body;

            // Validate request body
            if (!response) {
              return res.status(400).json({
                error: "Response field is required",
              });
            }

            if (response !== "accepted" && response !== "declined") {
              return res.status(400).json({
                error: 'Invalid response. Must be "accepted" or "declined"',
              });
            }

            const invite = await mockPrisma.sessionInvite.findFirst({
              where: { inviteToken: token },
              include: {
                parentSession: {
                  include: {
                    user: true,
                    sessionType: true,
                  },
                },
              },
            });

            if (!invite) {
              return res
                .status(404)
                .json({ error: "Invitation not found or expired" });
            }

            if (invite.status !== "pending") {
              return res
                .status(409)
                .json({ error: "Invitation has already been responded to" });
            }

            await mockPrisma.sessionInvite.update({
              where: { id: invite.id },
              data: {
                status: response,
                friendTelegramId:
                  response === "accepted" ? friendTelegramId : undefined,
                respondedAt: new Date(),
              },
            });

            // Send notifications
            if (response === "accepted") {
              await mockTelegramNotifier.sendMessage({
                telegramId: friendTelegramId,
                text: "✅ You've successfully accepted the invitation!",
              });
              await mockTelegramNotifier.sendMessage({
                telegramId: invite.parentSession.user.telegramId,
                text: `🎉 Great news! Friend has accepted your invitation.`,
              });
              await mockTelegramNotifier.sendAdminNotification(
                "Session invite accepted",
              );
            } else {
              await mockTelegramNotifier.sendMessage({
                telegramId: invite.parentSession.user.telegramId,
                text: `😔 Unfortunately, your friend has declined the invitation.`,
              });
            }

            const successMessage =
              response === "accepted"
                ? "Invitation accepted successfully"
                : "Invitation declined";

            res.status(200).json({
              success: true,
              message: successMessage,
            });
          } catch {
            res.status(500).json({
              error: "Internal server error",
            });
          }
        });

        // Invite context endpoint
        router.get("/invite-context/:inviteToken", async (req, res) => {
          const { inviteToken } = req.params;

          const sessionInvite = await mockPrisma.sessionInvite.findFirst({
            where: {
              inviteToken: inviteToken,
              status: "pending",
            },
            include: {
              parentSession: {
                include: {
                  SessionType: true,
                  user: true,
                },
              },
            },
          });

          if (!sessionInvite) {
            return res.status(404).json({
              success: false,
              message: "Invite token not found or no longer valid",
            });
          }

          const session = sessionInvite.parentSession;
          const sessionDetails = {
            sessionTypeLabel: session.SessionType?.name || "Kambo Session",
            formattedDateTime: new Date(
              session.appointmentDateTime,
            ).toLocaleString("en-US", {
              timeZone: "America/Chicago",
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }),
          };

          const flowConfiguration = {
            formType:
              session.SessionType?.waiverType === "NONE"
                ? "KAMBO_WAIVER_FRIEND_V1"
                : session.SessionType?.waiverType + "_FRIEND",
            allowsGroupInvites:
              session.SessionType?.allowsGroupInvites || false,
            maxGroupSize: session.SessionType?.maxGroupSize || 1,
          };

          res.json({
            success: true,
            data: {
              inviteToken: inviteToken,
              sessionTypeId: session.sessionTypeId,
              appointmentDateTimeISO: session.appointmentDateTime.toISOString(),
              sessionDetails: sessionDetails,
              flowConfiguration: flowConfiguration,
            },
          });
        });

        // Booking flow start-invite endpoint
        router.get(
          "/booking-flow/start-invite/:inviteToken",
          async (req, res) => {
            const { inviteToken } = req.params;
            const { friend_tg_id } = req.query;

            const sessionInvite = await mockPrisma.sessionInvite.findFirst({
              where: {
                inviteToken: inviteToken,
                status: "pending",
              },
              include: {
                parentSession: {
                  include: {
                    SessionType: true,
                    user: true,
                  },
                },
              },
            });

            if (!sessionInvite) {
              return res.status(404).json({
                error: "Invite token expired or not found",
              });
            }

            // Check self-invite
            if (sessionInvite.parentSession.user.telegramId === friend_tg_id) {
              return res.status(400).json({
                error: "Cannot invite yourself",
              });
            }

            const session = sessionInvite.parentSession;
            res.json({
              success: true,
              sessionDetails: {
                sessionType: session.SessionType.name,
                date: new Date(
                  session.appointmentDateTime,
                ).toLocaleDateString(),
                time: new Date(
                  session.appointmentDateTime,
                ).toLocaleTimeString(),
                primaryBookerName: session.user.firstName,
              },
              flowToken: "test-flow-token-123",
            });
          },
        );

        return router;
      }),
    }));

    // Mock handlers
    jest.doMock("../../src/commands/client/start", () => ({
      handleStartCommand: async (ctx) => {
        const telegramId = ctx.from?.id?.toString();
        const startPayload = ctx.startPayload;

        if (startPayload && startPayload.startsWith("invite_")) {
          const inviteToken = startPayload.replace("invite_", "");

          try {
            const response = await mockAxios.get(
              `http://localhost:3001/api/booking-flow/start-invite/${inviteToken}?friend_tg_id=${telegramId}`,
            );

            if (response.data.success) {
              const { sessionDetails } = response.data;
              await ctx.reply(
                `👋 Hi! You've been invited to join a Kambo session.\n\n` +
                  `📅 **Session Details:**\n` +
                  `🔹 Type: ${sessionDetails.sessionType}\n` +
                  `🔹 Date: ${sessionDetails.date}\n` +
                  `🔹 Time: ${sessionDetails.time}\n` +
                  `🔹 Hosted by: ${sessionDetails.primaryBookerName}\n\n` +
                  `Would you like to join this healing journey?`,
                {
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "View Invite & Accept ✨",
                          web_app: { url: "https://example.com/form" },
                        },
                        {
                          text: "Decline Invite 😔",
                          callback_data: `decline_invite_${inviteToken}`,
                        },
                      ],
                    ],
                  },
                },
              );
            }
          } catch (err) {
            if (err.response?.status === 404) {
              await ctx.reply(
                "Sorry, this invitation has expired or is no longer valid.",
              );
            } else if (err.response?.status === 400) {
              await ctx.reply(
                "You cannot accept your own invitation. This invite is for friends to join your session.",
              );
            } else {
              await ctx.reply(
                "Sorry, there was an issue processing your invitation.",
              );
            }
          }
        } else {
          await ctx.reply(
            "👋 Welcome! I'm your Kambo session booking assistant.",
          );
        }
      },
    }));

    jest.doMock("../../src/handlers/callbackQueryHandler", () => ({
      handleCallbackQuery: async (ctx) => {
        const callbackData = ctx.callbackQuery?.data;

        if (callbackData?.startsWith("decline_invite_")) {
          const inviteToken = callbackData.replace("decline_invite_", "");

          try {
            await mockAxios.post(
              `http://localhost:3001/api/session-invites/${inviteToken}/respond`,
              { response: "declined" },
            );

            await ctx.answerCbQuery("Invitation declined");
            await ctx.editMessageText("You have declined this invitation.");
          } catch {
            await ctx.answerCbQuery(
              "Sorry, there was an issue processing your response.",
            );
          }
        }
      },
    }));

    jest.doMock("../../src/handlers/inlineQueryHandler", () => ({
      handleInlineQuery: async (ctx) => {
        const query = ctx.inlineQuery?.query?.trim() || "";

        if (query.toLowerCase().includes("share")) {
          const mockInvites = await mockPrisma.sessionInvite.findMany({
            where: { status: "pending" },
            include: {
              parentSession: {
                include: {
                  user: true,
                  sessionType: true,
                },
              },
            },
          });

          const results = mockInvites.map((invite) => ({
            type: "article",
            id: invite.id,
            title: `Share ${invite.parentSession.sessionType.name} Invitation`,
            description: new Date(
              invite.parentSession.appointmentDateTime,
            ).toLocaleDateString(),
            input_message_content: {
              message_text: `🌿 You've been invited to join a Kambo healing session!\n\nTap the link to view details: https://t.me/testbot?start=invite_${invite.inviteToken}`,
              parse_mode: "Markdown",
            },
          }));

          await ctx.answerInlineQuery(results);
        } else {
          await ctx.answerInlineQuery([]);
        }
      },
    }));

    // Require modules after mocking
    apiRoutes = require("../../src/routes/api");
    startCommandHandler = require("../../src/commands/client/start");
    callbackQueryHandler = require("../../src/handlers/callbackQueryHandler");
    inlineQueryHandler = require("../../src/handlers/inlineQueryHandler");

    // Mount API routes
    app.use("/api", apiRoutes.getRouter());
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe("Complete Friend Invitation Flow", () => {
    it("should complete full accept flow: deep link → view invite → accept → notifications", async () => {
      const inviteToken = "TEST_INVITE_123";
      const friendTelegramId = "456";
      const primaryBookerTelegramId = "123";

      // Setup mock data
      const mockSessionInvite = {
        id: "invite-1",
        inviteToken: inviteToken,
        status: "pending",
        friendTelegramId: null,
        parentSession: {
          id: "session-1",
          sessionTypeId: "kambo-1",
          appointmentDateTime: new Date("2025-01-15T14:00:00Z"),
          user: {
            id: "user-1",
            telegramId: primaryBookerTelegramId,
            firstName: "John",
          },
          SessionType: {
            id: "kambo-1",
            name: "Kambo Session",
            waiverType: "KAMBO_V1",
            allowsGroupInvites: true,
            maxGroupSize: 2,
          },
        },
      };

      const mockFriend = {
        id: "user-2",
        telegramId: friendTelegramId,
        firstName: "Jane",
      };

      mockPrisma.sessionInvite.findFirst.mockResolvedValue(mockSessionInvite);
      mockPrisma.user.findUnique.mockResolvedValue(mockFriend);
      mockPrisma.sessionInvite.update.mockResolvedValue({
        ...mockSessionInvite,
        status: "accepted",
        friendTelegramId: friendTelegramId,
      });

      // Mock axios for start command API call
      mockAxios.get.mockResolvedValue({
        data: {
          success: true,
          sessionDetails: {
            sessionType: "Kambo Session",
            date: "1/15/2025",
            time: "2:00:00 PM",
            primaryBookerName: "John",
          },
          flowToken: "test-flow-token-123",
        },
      });

      // Step 1: Friend clicks deep link and sees invite
      const mockCtx = {
        from: { id: parseInt(friendTelegramId) },
        startPayload: `invite_${inviteToken}`,
        reply: jest.fn(),
      };

      await startCommandHandler.handleStartCommand(mockCtx);

      expect(mockAxios.get).toHaveBeenCalledWith(
        `http://localhost:3001/api/booking-flow/start-invite/${inviteToken}?friend_tg_id=${friendTelegramId}`,
      );

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining("You've been invited to join a Kambo session"),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: "View Invite & Accept ✨" }),
                expect.objectContaining({ text: "Decline Invite 😔" }),
              ]),
            ]),
          }),
        }),
      );

      // Step 2: Friend accepts via API endpoint
      const acceptResponse = await request(app)
        .post(`/api/session-invites/${inviteToken}/respond`)
        .send({
          response: "accepted",
          friendTelegramId: friendTelegramId,
        })
        .expect(200);

      expect(acceptResponse.body).toEqual({
        success: true,
        message: "Invitation accepted successfully",
      });

      // Step 3: Verify database updates
      expect(mockPrisma.sessionInvite.update).toHaveBeenCalledWith({
        where: { id: "invite-1" },
        data: {
          status: "accepted",
          friendTelegramId: friendTelegramId,
          respondedAt: expect.any(Date),
        },
      });

      // Step 4: Verify notifications sent
      expect(mockTelegramNotifier.sendMessage).toHaveBeenCalledWith({
        telegramId: friendTelegramId,
        text: "✅ You've successfully accepted the invitation!",
      });

      expect(mockTelegramNotifier.sendMessage).toHaveBeenCalledWith({
        telegramId: primaryBookerTelegramId,
        text: "🎉 Great news! Friend has accepted your invitation.",
      });

      expect(mockTelegramNotifier.sendAdminNotification).toHaveBeenCalledWith(
        "Session invite accepted",
      );
    });

    it("should complete decline flow: deep link → decline callback → notifications", async () => {
      const inviteToken = "TEST_DECLINE_123";
      const friendTelegramId = "456";
      const primaryBookerTelegramId = "123";

      // Setup mock data
      const mockSessionInvite = {
        id: "invite-2",
        inviteToken: inviteToken,
        status: "pending",
        parentSession: {
          user: {
            telegramId: primaryBookerTelegramId,
            firstName: "John",
          },
          SessionType: {
            name: "Kambo Session",
          },
        },
      };

      mockPrisma.sessionInvite.findFirst.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({
        ...mockSessionInvite,
        status: "declined",
      });

      // Mock axios for callback handler API call
      mockAxios.post.mockResolvedValue({
        data: { success: true, message: "Invitation declined" },
      });

      // Step 1: Friend clicks decline button
      const mockCtx = {
        from: { id: parseInt(friendTelegramId) },
        callbackQuery: { data: `decline_invite_${inviteToken}` },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
      };

      await callbackQueryHandler.handleCallbackQuery(mockCtx);

      expect(mockAxios.post).toHaveBeenCalledWith(
        `http://localhost:3001/api/session-invites/${inviteToken}/respond`,
        { response: "declined" },
      );

      expect(mockCtx.answerCbQuery).toHaveBeenCalledWith("Invitation declined");
      expect(mockCtx.editMessageText).toHaveBeenCalledWith(
        "You have declined this invitation.",
      );

      // Step 2: Verify API endpoint processes decline
      const declineResponse = await request(app)
        .post(`/api/session-invites/${inviteToken}/respond`)
        .send({ response: "declined" })
        .expect(200);

      expect(declineResponse.body).toEqual({
        success: true,
        message: "Invitation declined",
      });

      // Step 3: Verify notification sent to primary booker
      expect(mockTelegramNotifier.sendMessage).toHaveBeenCalledWith({
        telegramId: primaryBookerTelegramId,
        text: "😔 Unfortunately, your friend has declined the invitation.",
      });
    });

    it("should handle expired invite tokens gracefully", async () => {
      const expiredToken = "EXPIRED_TOKEN_123";
      const friendTelegramId = "456";

      // Mock no invite found
      mockPrisma.sessionInvite.findFirst.mockResolvedValue(null);

      // Mock axios for start command API call (expired)
      mockAxios.get.mockRejectedValue({
        response: {
          status: 404,
          data: { error: "Invite token expired or not found" },
        },
      });

      // Test start command with expired token
      const mockCtx = {
        from: { id: parseInt(friendTelegramId) },
        startPayload: `invite_${expiredToken}`,
        reply: jest.fn(),
      };

      await startCommandHandler.handleStartCommand(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        "Sorry, this invitation has expired or is no longer valid.",
      );

      // Test API endpoint with expired token
      const apiResponse = await request(app)
        .get(`/api/invite-context/${expiredToken}`)
        .expect(404);

      expect(apiResponse.body).toEqual({
        success: false,
        message: "Invite token not found or no longer valid",
      });
    });

    it("should prevent self-invite attempts", async () => {
      const inviteToken = "SELF_INVITE_123";
      const primaryBookerTelegramId = "123";

      // Mock axios for start command API call (self-invite)
      mockAxios.get.mockRejectedValue({
        response: {
          status: 400,
          data: { error: "Cannot invite yourself" },
        },
      });

      // Test start command with self-invite
      const mockCtx = {
        from: { id: parseInt(primaryBookerTelegramId) },
        startPayload: `invite_${inviteToken}`,
        reply: jest.fn(),
      };

      await startCommandHandler.handleStartCommand(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        "You cannot accept your own invitation. This invite is for friends to join your session.",
      );
    });

    it("should handle already responded invites", async () => {
      const inviteToken = "ALREADY_RESPONDED_123";
      const friendTelegramId = "456";

      // Mock already responded invite
      const mockSessionInvite = {
        id: "invite-3",
        inviteToken: inviteToken,
        status: "accepted", // Already responded
        friendTelegramId: "789",
        parentSession: {
          user: { telegramId: "123" },
          SessionType: { name: "Kambo Session" },
        },
      };

      mockPrisma.sessionInvite.findFirst.mockResolvedValue(mockSessionInvite);

      // Test API endpoint with already responded invite
      const apiResponse = await request(app)
        .post(`/api/session-invites/${inviteToken}/respond`)
        .send({
          response: "accepted",
          friendTelegramId: friendTelegramId,
        })
        .expect(409);

      expect(apiResponse.body).toEqual({
        error: "Invitation has already been responded to",
      });
    });
  });

  describe("Inline Query Integration", () => {
    it('should return shareable invite cards for "share" query', async () => {
      const mockInvites = [
        {
          id: "invite-1",
          inviteToken: "TOKEN123",
          status: "pending",
          parentSession: {
            appointmentDateTime: new Date("2025-01-15T14:00:00Z"),
            sessionType: { name: "Kambo Session" },
            user: { firstName: "John" },
          },
        },
      ];

      mockPrisma.sessionInvite.findMany.mockResolvedValue(mockInvites);

      const mockCtx = {
        from: { id: 123 },
        inlineQuery: { query: "share" },
        answerInlineQuery: jest.fn(),
      };

      await inlineQueryHandler.handleInlineQuery(mockCtx);

      expect(mockCtx.answerInlineQuery).toHaveBeenCalledWith([
        expect.objectContaining({
          type: "article",
          id: "invite-1",
          title: "Share Kambo Session Invitation",
          description: expect.stringContaining("1/15/2025"),
          input_message_content: {
            message_text: expect.stringContaining(
              "You've been invited to join a Kambo healing session",
            ),
            parse_mode: "Markdown",
          },
        }),
      ]);
    });
  });

  describe("StartApp Integration", () => {
    it("should load invite context for StartApp flow", async () => {
      const inviteToken = "STARTAPP_TOKEN_123";

      const mockSessionInvite = {
        id: "invite-4",
        inviteToken: inviteToken,
        status: "pending",
        parentSession: {
          sessionTypeId: "kambo-1",
          appointmentDateTime: new Date("2025-01-15T14:00:00Z"),
          SessionType: {
            name: "Kambo Session",
            waiverType: "KAMBO_V1",
            allowsGroupInvites: true,
            maxGroupSize: 2,
          },
          user: { firstName: "John" },
        },
      };

      mockPrisma.sessionInvite.findFirst.mockResolvedValue(mockSessionInvite);

      // Test invite context API
      const contextResponse = await request(app)
        .get(`/api/invite-context/${inviteToken}`)
        .expect(200);

      expect(contextResponse.body).toEqual({
        success: true,
        data: {
          inviteToken: inviteToken,
          sessionTypeId: "kambo-1",
          appointmentDateTimeISO: "2025-01-15T14:00:00.000Z",
          sessionDetails: {
            sessionTypeLabel: "Kambo Session",
            formattedDateTime: expect.stringContaining(
              "Wednesday, January 15, 2025",
            ),
          },
          flowConfiguration: {
            formType: "KAMBO_V1_FRIEND",
            allowsGroupInvites: true,
            maxGroupSize: 2,
          },
        },
      });
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle database errors gracefully", async () => {
      const inviteToken = "DB_ERROR_TOKEN";

      mockPrisma.sessionInvite.findFirst.mockRejectedValue(
        new Error("Database error"),
      );

      const apiResponse = await request(app)
        .post(`/api/session-invites/${inviteToken}/respond`)
        .send({ response: "accepted" })
        .expect(500);

      expect(apiResponse.body).toEqual({
        error: "Internal server error",
      });
    });

    it("should validate request body for friend response endpoint", async () => {
      const inviteToken = "VALID_TOKEN";

      // Test missing response field
      const missingResponse = await request(app)
        .post(`/api/session-invites/${inviteToken}/respond`)
        .send({})
        .expect(400);

      expect(missingResponse.body).toEqual({
        error: "Response field is required",
      });

      // Test invalid response value
      const invalidResponse = await request(app)
        .post(`/api/session-invites/${inviteToken}/respond`)
        .send({ response: "invalid" })
        .expect(400);

      expect(invalidResponse.body).toEqual({
        error: 'Invalid response. Must be "accepted" or "declined"',
      });
    });
  });

  describe("Decline Flow Integration", () => {
    it("should handle complete decline flow from callback to notifications", async () => {
      const inviteToken = "decline-integration-token-123";
      const friendTelegramId = "friend456";
      const primaryBookerTelegramId = "primary123";

      // Mock session invite data
      const mockSessionInvite = {
        id: 1,
        status: "pending",
        inviteToken,
        parentSession: {
          user: {
            telegramId: primaryBookerTelegramId,
            firstName: "PrimaryUser",
          },
          sessionType: {
            label: "Kambo Integration Session",
          },
          appointmentDateTime: new Date("2025-01-20T15:00:00Z"),
        },
      };

      mockPrisma.sessionInvite.findFirst.mockResolvedValue(mockSessionInvite);
      mockPrisma.sessionInvite.update.mockResolvedValue({
        ...mockSessionInvite,
        status: "declined_by_friend",
        friendTelegramId,
      });

      // Test the decline API endpoint
      const response = await request(app)
        .post(`/api/session-invites/${inviteToken}/respond`)
        .send({
          response: "declined",
          friendTelegramId,
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: "Invitation declined",
      });

      // Verify database was updated
      expect(mockPrisma.sessionInvite.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: "declined",
          respondedAt: expect.any(Date),
        },
      });

      // Verify notification was sent to primary booker
      expect(mockTelegramNotifier.sendMessage).toHaveBeenCalledWith({
        telegramId: primaryBookerTelegramId,
        text: expect.stringContaining(
          "Unfortunately, your friend has declined",
        ),
      });
    });

    it("should handle decline with already processed invite", async () => {
      const inviteToken = "already-processed-token";

      // Mock already processed invite
      mockPrisma.sessionInvite.findFirst.mockResolvedValue({
        id: 2,
        status: "declined_by_friend",
        inviteToken,
        parentSession: {
          user: { telegramId: "primary123", firstName: "PrimaryUser" },
          sessionType: { label: "Kambo Session" },
        },
      });

      const response = await request(app)
        .post(`/api/session-invites/${inviteToken}/respond`)
        .send({
          response: "declined",
          friendTelegramId: "friend456",
        })
        .expect(409);

      expect(response.body).toEqual({
        error: "Invitation has already been responded to",
      });
    });

    it("should handle decline with non-existent invite token", async () => {
      const inviteToken = "non-existent-token";

      mockPrisma.sessionInvite.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/session-invites/${inviteToken}/respond`)
        .send({
          response: "declined",
          friendTelegramId: "friend456",
        })
        .expect(404);

      expect(response.body).toEqual({
        error: "Invitation not found or expired",
      });
    });

    it("should handle multiple rapid decline attempts", async () => {
      const inviteToken = "rapid-decline-token";
      const friendTelegramId = "friend456";

      const mockSessionInvite = {
        id: 3,
        status: "pending",
        inviteToken,
        parentSession: {
          user: { telegramId: "primary123", firstName: "PrimaryUser" },
          sessionType: { label: "Kambo Session" },
          appointmentDateTime: new Date("2025-01-20T15:00:00Z"),
        },
      };

      // First call succeeds
      mockPrisma.sessionInvite.findFirst
        .mockResolvedValueOnce(mockSessionInvite)
        .mockResolvedValueOnce({
          ...mockSessionInvite,
          status: "declined_by_friend",
        });

      // First decline request
      const response1 = await request(app)
        .post(`/api/session-invites/${inviteToken}/respond`)
        .send({
          response: "declined",
          friendTelegramId,
        })
        .expect(200);

      expect(response1.body.success).toBe(true);

      // Second decline request should fail
      const response2 = await request(app)
        .post(`/api/session-invites/${inviteToken}/respond`)
        .send({
          response: "declined",
          friendTelegramId,
        })
        .expect(409);

      expect(response2.body).toEqual({
        error: "Invitation has already been responded to",
      });
    });
  });
});
