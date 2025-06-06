/**
 * @file tests/core/sessionInvite.uniqueConstraint.test.js
 * @description Tests for SessionInvite unique constraint on [parentSessionId, friendTelegramId]
 * Validates Feature 7 requirement that a friend can only accept one invite per session
 */

const { PrismaClient } = require("@prisma/client");

// Use a test database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

describe("SessionInvite Unique Constraint Tests - Feature 7", () => {
  let testSessionId;
  let testSessionTypeId;

  beforeAll(async () => {
    // Create a test session type
    const sessionType = await prisma.sessionType.create({
      data: {
        id: "test_constraint_session_type",
        label: "Test Constraint Session Type",
        durationMinutes: 120,
        price: 150.0,
        active: true,
        waiverType: "KAMBO_V1",
        allowsGroupInvites: true,
        maxGroupSize: 4,
        updatedAt: new Date(),
      },
    });
    testSessionTypeId = sessionType.id;

    // Create a test session
    const session = await prisma.sessions.create({
      data: {
        first_name: "Test",
        last_name: "User",
        telegram_id: BigInt("123456789"),
        appointment_datetime: new Date("2025-12-01T10:00:00Z"),
        session_status: "confirmed",
        session_type_id_fk: testSessionTypeId,
        updated_at: new Date(),
      },
    });
    testSessionId = session.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.sessionInvite.deleteMany({
      where: {
        OR: [
          { inviteToken: { startsWith: "test_constraint_" } },
          { parentSessionId: testSessionId },
        ],
      },
    });
    await prisma.sessions.deleteMany({
      where: { id: testSessionId },
    });
    await prisma.sessionType.deleteMany({
      where: { id: testSessionTypeId },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up any test invites before each test
    await prisma.sessionInvite.deleteMany({
      where: {
        inviteToken: { startsWith: "test_constraint_" },
      },
    });
  });

  describe("Unique Constraint Behavior", () => {
    test("should allow creating SessionInvite with null friendTelegramId", async () => {
      const inviteData = {
        id: "test_constraint_invite_1",
        parentSessionId: testSessionId,
        inviteToken: "test_constraint_token_1",
        status: "pending",
        friendTelegramId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const invite = await prisma.sessionInvite.create({
        data: inviteData,
      });

      expect(invite).toBeTruthy();
      expect(invite.id).toBe(inviteData.id);
      expect(invite.friendTelegramId).toBeNull();
    });

    test("should allow multiple SessionInvites with null friendTelegramId for same session", async () => {
      const invite1Data = {
        id: "test_constraint_invite_2",
        parentSessionId: testSessionId,
        inviteToken: "test_constraint_token_2",
        status: "pending",
        friendTelegramId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const invite2Data = {
        id: "test_constraint_invite_3",
        parentSessionId: testSessionId,
        inviteToken: "test_constraint_token_3",
        status: "pending",
        friendTelegramId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const invite1 = await prisma.sessionInvite.create({
        data: invite1Data,
      });
      const invite2 = await prisma.sessionInvite.create({
        data: invite2Data,
      });

      expect(invite1).toBeTruthy();
      expect(invite2).toBeTruthy();
      expect(invite1.friendTelegramId).toBeNull();
      expect(invite2.friendTelegramId).toBeNull();
    });

    test("should allow first SessionInvite with specific friendTelegramId", async () => {
      const friendTelegramId = BigInt("987654321");
      const inviteData = {
        id: "test_constraint_invite_4",
        parentSessionId: testSessionId,
        inviteToken: "test_constraint_token_4",
        status: "accepted_by_friend",
        friendTelegramId: friendTelegramId,
        friendNameOnWaiver: "Friend One",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const invite = await prisma.sessionInvite.create({
        data: inviteData,
      });

      expect(invite).toBeTruthy();
      expect(invite.friendTelegramId).toBe(friendTelegramId);
      expect(invite.friendNameOnWaiver).toBe("Friend One");
    });

    test("should prevent duplicate SessionInvite with same friendTelegramId and parentSessionId", async () => {
      const friendTelegramId = BigInt("555666777");

      // Create first invite
      const invite1Data = {
        id: "test_constraint_invite_5",
        parentSessionId: testSessionId,
        inviteToken: "test_constraint_token_5",
        status: "accepted_by_friend",
        friendTelegramId: friendTelegramId,
        friendNameOnWaiver: "Friend Two",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const invite1 = await prisma.sessionInvite.create({
        data: invite1Data,
      });
      expect(invite1).toBeTruthy();

      // Try to create second invite with same friendTelegramId and parentSessionId
      const invite2Data = {
        id: "test_constraint_invite_6",
        parentSessionId: testSessionId, // Same session
        inviteToken: "test_constraint_token_6",
        status: "pending",
        friendTelegramId: friendTelegramId, // Same friend
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(
        prisma.sessionInvite.create({
          data: invite2Data,
        }),
      ).rejects.toThrow();
    });

    test("should allow same friendTelegramId for different sessions", async () => {
      // Create a second test session
      const session2 = await prisma.sessions.create({
        data: {
          first_name: "Test",
          last_name: "User2",
          telegram_id: BigInt("123456790"),
          appointment_datetime: new Date("2025-12-02T10:00:00Z"),
          session_status: "confirmed",
          session_type_id_fk: testSessionTypeId,
          updated_at: new Date(),
        },
      });

      const friendTelegramId = BigInt("111222333");

      // Create invite for first session
      const invite1Data = {
        id: "test_constraint_invite_7",
        parentSessionId: testSessionId,
        inviteToken: "test_constraint_token_7",
        status: "accepted_by_friend",
        friendTelegramId: friendTelegramId,
        friendNameOnWaiver: "Friend Three",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create invite for second session with same friend
      const invite2Data = {
        id: "test_constraint_invite_8",
        parentSessionId: session2.id, // Different session
        inviteToken: "test_constraint_token_8",
        status: "accepted_by_friend",
        friendTelegramId: friendTelegramId, // Same friend
        friendNameOnWaiver: "Friend Three",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const invite1 = await prisma.sessionInvite.create({
        data: invite1Data,
      });
      const invite2 = await prisma.sessionInvite.create({
        data: invite2Data,
      });

      expect(invite1).toBeTruthy();
      expect(invite2).toBeTruthy();
      expect(invite1.friendTelegramId).toBe(friendTelegramId);
      expect(invite2.friendTelegramId).toBe(friendTelegramId);
      expect(invite1.parentSessionId).toBe(testSessionId);
      expect(invite2.parentSessionId).toBe(session2.id);

      // Clean up the second session
      await prisma.sessions.delete({
        where: { id: session2.id },
      });
    });

    test("should allow updating friendTelegramId from null to specific value", async () => {
      // Create invite with null friendTelegramId
      const inviteData = {
        id: "test_constraint_invite_9",
        parentSessionId: testSessionId,
        inviteToken: "test_constraint_token_9",
        status: "pending",
        friendTelegramId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const invite = await prisma.sessionInvite.create({
        data: inviteData,
      });
      expect(invite.friendTelegramId).toBeNull();

      // Update to specific friendTelegramId
      const friendTelegramId = BigInt("444555666");
      const updatedInvite = await prisma.sessionInvite.update({
        where: { id: invite.id },
        data: {
          friendTelegramId: friendTelegramId,
          status: "accepted_by_friend",
          friendNameOnWaiver: "Friend Four",
          updatedAt: new Date(),
        },
      });

      expect(updatedInvite.friendTelegramId).toBe(friendTelegramId);
      expect(updatedInvite.status).toBe("accepted_by_friend");
      expect(updatedInvite.friendNameOnWaiver).toBe("Friend Four");
    });

    test("should prevent updating to duplicate friendTelegramId for same session", async () => {
      const friendTelegramId = BigInt("777888999");

      // Create first invite with specific friendTelegramId
      const invite1Data = {
        id: "test_constraint_invite_10",
        parentSessionId: testSessionId,
        inviteToken: "test_constraint_token_10",
        status: "accepted_by_friend",
        friendTelegramId: friendTelegramId,
        friendNameOnWaiver: "Friend Five",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await prisma.sessionInvite.create({
        data: invite1Data,
      });

      // Create second invite with null friendTelegramId
      const invite2Data = {
        id: "test_constraint_invite_11",
        parentSessionId: testSessionId,
        inviteToken: "test_constraint_token_11",
        status: "pending",
        friendTelegramId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const invite2 = await prisma.sessionInvite.create({
        data: invite2Data,
      });

      // Try to update second invite to same friendTelegramId
      await expect(
        prisma.sessionInvite.update({
          where: { id: invite2.id },
          data: {
            friendTelegramId: friendTelegramId, // Same as first invite
            status: "accepted_by_friend",
            updatedAt: new Date(),
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe("Database Integrity", () => {
    test("should maintain constraint with cascade delete", async () => {
      // Create a session that we'll delete
      const tempSession = await prisma.sessions.create({
        data: {
          first_name: "Temp",
          last_name: "Session",
          telegram_id: BigInt("999888777"),
          appointment_datetime: new Date("2025-12-03T10:00:00Z"),
          session_status: "confirmed",
          session_type_id_fk: testSessionTypeId,
          updated_at: new Date(),
        },
      });

      // Create invites for this session
      const inviteData = {
        id: "test_constraint_invite_12",
        parentSessionId: tempSession.id,
        inviteToken: "test_constraint_token_12",
        status: "accepted_by_friend",
        friendTelegramId: BigInt("333444555"),
        friendNameOnWaiver: "Friend Six",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const invite = await prisma.sessionInvite.create({
        data: inviteData,
      });
      expect(invite).toBeTruthy();

      // Delete the session (should cascade delete the invite)
      await prisma.sessions.delete({
        where: { id: tempSession.id },
      });

      // Verify invite was deleted
      const deletedInvite = await prisma.sessionInvite.findUnique({
        where: { id: invite.id },
      });
      expect(deletedInvite).toBeNull();
    });
  });
});
