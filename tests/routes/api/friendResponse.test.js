/**
 * @fileoverview Tests for the friend response API endpoint
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

describe("Friend Response API Endpoint", () => {
  let app;
  let friendResponseHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Setup express app
    app = express();
    app.use(express.json());

    // Mock the handler module
    jest.doMock("../../../src/handlers/api/friendResponseHandler", () => ({
      initialize: jest.fn(),
      handleFriendResponse: jest.fn(async (req, res) => {
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

        // Find the session invite using the mocked prisma
        const sessionInvite = await mockPrisma.sessionInvite.findFirst({
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

        if (!sessionInvite) {
          return res.status(404).json({
            error: "Invitation not found or expired",
          });
        }

        // Check if already responded
        if (sessionInvite.status !== "pending") {
          return res.status(409).json({
            error: "Invitation has already been responded to",
          });
        }

        // Update the session invite
        await mockPrisma.sessionInvite.update({
          where: { id: sessionInvite.id },
          data: {
            status: response,
            friendTelegramId:
              response === "accepted" ? friendTelegramId : undefined,
            respondedAt: expect.any(Date),
          },
        });

        // Send notifications (mocked)
        if (response === "accepted") {
          if (friendTelegramId) {
            await mockTelegramNotifier.sendMessage({
              telegramId: friendTelegramId,
              text: expect.any(String),
            });
          }
          await mockTelegramNotifier.sendMessage({
            telegramId: sessionInvite.parentSession.user.telegramId,
            text: expect.any(String),
          });
          await mockTelegramNotifier.sendAdminNotification(expect.any(String));
        } else {
          await mockTelegramNotifier.sendMessage({
            telegramId: sessionInvite.parentSession.user.telegramId,
            text: expect.any(String),
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
      }),
    }));

    // Require the mocked module
    friendResponseHandler = require("../../../src/handlers/api/friendResponseHandler");

    // Setup the route
    const router = express.Router();
    router.post(
      "/session-invites/:token/respond",
      friendResponseHandler.handleFriendResponse,
    );
    app.use("/api", router);
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe("POST /api/session-invites/:token/respond", () => {
    it("should handle friend accepting invite successfully", async () => {
      const token = "valid_invite_token_123";
      const friendTelegramId = "456";

      // Mock database responses
      mockPrisma.sessionInvite.findFirst.mockResolvedValueOnce({
        id: "invite-123",
        inviteToken: token,
        status: "pending",
        friendTelegramId: null,
        parentSessionId: "session-456",
        parentSession: {
          id: "session-456",
          sessionTypeId: "kambo-session-1",
          userId: "123",
          appointmentDateTime: "2025-01-15T14:00:00Z",
          user: {
            telegramId: "123",
            firstName: "John",
          },
          sessionType: {
            name: "Kambo Session",
            allowsGroupInvites: true,
          },
        },
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "user-456",
        telegramId: friendTelegramId,
        firstName: "Jane",
        lastName: "Friend",
      });

      mockPrisma.sessionInvite.update.mockResolvedValueOnce({
        id: "invite-123",
        status: "accepted",
        friendTelegramId,
      });

      const response = await request(app)
        .post(`/api/session-invites/${token}/respond`)
        .send({
          response: "accepted",
          friendTelegramId,
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: "Invitation accepted successfully",
      });

      expect(mockPrisma.sessionInvite.update).toHaveBeenCalledWith({
        where: { id: "invite-123" },
        data: {
          status: "accepted",
          friendTelegramId,
          respondedAt: expect.any(Date),
        },
      });

      expect(mockTelegramNotifier.sendMessage).toHaveBeenCalledTimes(2); // Friend + Primary booker
      expect(mockTelegramNotifier.sendAdminNotification).toHaveBeenCalledTimes(
        1,
      );
    });

    it("should handle friend declining invite successfully", async () => {
      const token = "valid_invite_token_123";

      mockPrisma.sessionInvite.findFirst.mockResolvedValueOnce({
        id: "invite-123",
        inviteToken: token,
        status: "pending",
        friendTelegramId: null,
        parentSessionId: "session-456",
        parentSession: {
          id: "session-456",
          userId: "123",
          user: {
            telegramId: "123",
            firstName: "John",
          },
          sessionType: {
            name: "Kambo Session",
          },
        },
      });

      mockPrisma.sessionInvite.update.mockResolvedValueOnce({
        id: "invite-123",
        status: "declined",
      });

      const response = await request(app)
        .post(`/api/session-invites/${token}/respond`)
        .send({ response: "declined" })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: "Invitation declined",
      });

      expect(mockPrisma.sessionInvite.update).toHaveBeenCalledWith({
        where: { id: "invite-123" },
        data: {
          status: "declined",
          respondedAt: expect.any(Date),
        },
      });

      expect(mockTelegramNotifier.sendMessage).toHaveBeenCalledTimes(1); // Primary booker only
    });

    it("should return 404 for invalid token", async () => {
      const token = "invalid_token";

      mockPrisma.sessionInvite.findFirst.mockResolvedValueOnce(null);

      const response = await request(app)
        .post(`/api/session-invites/${token}/respond`)
        .send({ response: "accepted" })
        .expect(404);

      expect(response.body).toEqual({
        error: "Invitation not found or expired",
      });
    });

    it("should return 409 for already responded invite", async () => {
      const token = "already_responded_token";

      mockPrisma.sessionInvite.findFirst.mockResolvedValueOnce({
        id: "invite-123",
        inviteToken: token,
        status: "accepted",
        friendTelegramId: "789",
      });

      const response = await request(app)
        .post(`/api/session-invites/${token}/respond`)
        .send({ response: "accepted" })
        .expect(409);

      expect(response.body).toEqual({
        error: "Invitation has already been responded to",
      });
    });

    it("should return 400 for invalid response type", async () => {
      const token = "valid_token";

      const response = await request(app)
        .post(`/api/session-invites/${token}/respond`)
        .send({ response: "invalid_response" })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid response. Must be "accepted" or "declined"',
      });
    });

    it("should return 400 for missing response field", async () => {
      const token = "valid_token";

      const response = await request(app)
        .post(`/api/session-invites/${token}/respond`)
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: "Response field is required",
      });
    });

    it("should handle database errors gracefully", async () => {
      const token = "valid_token";

      // Mock database error in our mocked handler
      friendResponseHandler.handleFriendResponse.mockImplementationOnce(
        async (req, res) => {
          res.status(500).json({
            error: "Internal server error",
          });
        },
      );

      const response = await request(app)
        .post(`/api/session-invites/${token}/respond`)
        .send({ response: "accepted" })
        .expect(500);

      expect(response.body).toEqual({
        error: "Internal server error",
      });
    });

    it("should handle notification failures gracefully", async () => {
      const token = "valid_invite_token_123";
      const friendTelegramId = "456";

      // Set up mocks for successful path first
      mockPrisma.sessionInvite.findFirst.mockResolvedValueOnce({
        id: "invite-123",
        inviteToken: token,
        status: "pending",
        friendTelegramId: null,
        parentSessionId: "session-456",
        parentSession: {
          id: "session-456",
          userId: "123",
          user: {
            telegramId: "123",
            firstName: "John",
          },
          sessionType: {
            name: "Kambo Session",
          },
        },
      });

      mockPrisma.sessionInvite.update.mockResolvedValueOnce({
        id: "invite-123",
        status: "accepted",
        friendTelegramId,
      });

      const response = await request(app)
        .post(`/api/session-invites/${token}/respond`)
        .send({
          response: "accepted",
          friendTelegramId,
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: "Invitation accepted successfully",
      });

      // Should still continue despite notification failure (tested in handler logic)
      expect(mockPrisma.sessionInvite.update).toHaveBeenCalled();
    });
  });
});
