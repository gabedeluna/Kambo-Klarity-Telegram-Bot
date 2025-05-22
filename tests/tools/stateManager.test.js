// tests/tools/stateManager.test.js

const mockPrismaUserMethods = {
  findUnique: jest.fn(),
  update: jest.fn(),
  // Add other user model methods if stateManager.js uses them
};

// Mock the entire prisma module that stateManager.js imports
// It's important that this mock is defined before stateManager is first required.
jest.mock('../../src/core/prisma', () => ({
  users: mockPrismaUserMethods, // Corrected to 'users' based on stateManager.js usage
  // If stateManager.js uses other models from prisma, mock them here too
  // e.g., sessions: { findMany: jest.fn() }
}));

let stateManager; // To be required in beforeEach
let mockLogger; // For testing setLogger

describe('Tools State Manager (stateManager.js)', () => {
  const testUserId = 'user123'; // Assuming this is a DB ID, not telegramId for some mocks
  const testTelegramId = 123456789;
  const testBigIntTelegramId = BigInt(testTelegramId);

  beforeEach(() => {
    jest.resetModules(); // Clear module cache

    // Clear mock calls before each test
    mockPrismaUserMethods.findUnique.mockClear();
    mockPrismaUserMethods.update.mockClear();
    // Clear other mocked methods if added

    // Require the module under test *after* resetting modules and clearing mocks
    stateManager = require('../../src/tools/stateManager');

    // Setup a mock logger for setLogger tests
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };
  });

  it('should export an object with expected functions', () => {
    expect(stateManager).toBeDefined();
    expect(stateManager.resetUserState).toEqual(expect.any(Function));
    expect(stateManager.updateUserState).toEqual(expect.any(Function));
    expect(stateManager.storeBookingData).toEqual(expect.any(Function));
    expect(stateManager.setActiveSessionId).toEqual(expect.any(Function));
    expect(stateManager.clearActiveSessionId).toEqual(expect.any(Function));
    expect(stateManager.getUserProfileData).toEqual(expect.any(Function));
    expect(stateManager.setLogger).toEqual(expect.any(Function));
  });

  describe('getUserProfileData', () => {
    it('should call prisma.users.findUnique with telegramId to get user profile', async () => {
      const mockUserProfile = { first_name: 'Test', role: 'client', state: 'IDLE' };
      mockPrismaUserMethods.findUnique.mockResolvedValueOnce(mockUserProfile);

      const result = await stateManager.getUserProfileData({ telegramId: String(testTelegramId) });
      expect(mockPrismaUserMethods.findUnique).toHaveBeenCalledWith({
        where: { telegram_id: testBigIntTelegramId },
        select: {
          first_name: true,
          role: true,
          state: true,
          session_type: true,
          active_session_id: true,
          edit_msg_id: true,
          can_book_3x3: true,
        },
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUserProfile);
    });

    it('should return success true and data null if user is not found', async () => {
      mockPrismaUserMethods.findUnique.mockResolvedValueOnce(null);
      const result = await stateManager.getUserProfileData({ telegramId: String(testTelegramId) });
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.message).toBe('User profile not found.');
    });

    it('should return success false on database error', async () => {
      mockPrismaUserMethods.findUnique.mockRejectedValueOnce(new Error('DB Error'));
      const result = await stateManager.getUserProfileData({ telegramId: String(testTelegramId) });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error fetching user profile');
    });
     it('should return success false for invalid telegramId format', async () => {
      const result = await stateManager.getUserProfileData({ telegramId: null }); // Example of invalid ID
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid Telegram ID provided.');
    });
  });

  describe('updateUserState', () => {
    const dataToUpdate = { state: 'BOOKING', edit_msg_id: 123 };
    const updatedUserMock = { telegram_id: testBigIntTelegramId, ...dataToUpdate };

    it('should call prisma.users.update with telegramId and new state data', async () => {
      mockPrismaUserMethods.update.mockResolvedValueOnce(updatedUserMock);

      const result = await stateManager.updateUserState(String(testTelegramId), dataToUpdate);
      expect(mockPrismaUserMethods.update).toHaveBeenCalledWith({
        where: { telegram_id: testBigIntTelegramId },
        data: dataToUpdate,
      });
      expect(result.success).toBe(true);
      expect(result.user).toEqual(updatedUserMock);
    });

    it('should return success false if telegramId is invalid', async () => {
      const result = await stateManager.updateUserState(null, dataToUpdate);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid telegramId');
    });
    
    it('should return success false if dataToUpdate is invalid', async () => {
      const result = await stateManager.updateUserState(String(testTelegramId), null);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid dataToUpdate object');
    });

    it('should return success false and "User not found" if Prisma error P2025 occurs', async () => {
      const prismaError = new Error("User not found");
      prismaError.code = "P2025";
      mockPrismaUserMethods.update.mockRejectedValueOnce(prismaError);
      const result = await stateManager.updateUserState(String(testTelegramId), dataToUpdate);
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found for update.');
    });
    
    it('should return success false on generic database error', async () => {
      mockPrismaUserMethods.update.mockRejectedValueOnce(new Error('DB Error'));
      const result = await stateManager.updateUserState(String(testTelegramId), dataToUpdate);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error during state update.');
    });
  });

  describe('resetUserState', () => {
    it('should call prisma.users.update with default reset data', async () => {
      mockPrismaUserMethods.update.mockResolvedValueOnce({}); // Simulate successful update
      const result = await stateManager.resetUserState(String(testTelegramId));
      expect(mockPrismaUserMethods.update).toHaveBeenCalledWith({
        where: { telegram_id: testBigIntTelegramId },
        data: {
          state: "NONE",
          session_type: null,
          conversation_history: null,
          booking_slot: null,
          edit_msg_id: null,
        },
      });
      expect(result.success).toBe(true);
    });
     it('should return success false if telegramId is invalid', async () => {
      const result = await stateManager.resetUserState(null);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input: telegramId is required.');
    });
  });

  describe('storeBookingData', () => {
    const sessionType = '1hr-kambo';
    const bookingSlotISO = '2024-05-21T10:00:00.000Z';
    const bookingSlotDate = new Date(bookingSlotISO);

    it('should call prisma.users.update with sessionType and booking_slot', async () => {
      mockPrismaUserMethods.update.mockResolvedValueOnce({});
      const result = await stateManager.storeBookingData(String(testTelegramId), sessionType, bookingSlotISO);
      expect(mockPrismaUserMethods.update).toHaveBeenCalledWith({
        where: { telegram_id: testBigIntTelegramId },
        data: { session_type: sessionType, booking_slot: bookingSlotDate },
      });
      expect(result.success).toBe(true);
    });
    it('should return success false if telegramId is invalid', async () => {
      const result = await stateManager.storeBookingData(null, sessionType, bookingSlotISO);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input: telegramId is required.');
    });

    it('should return success false if sessionType is invalid', async () => {
      const result = await stateManager.storeBookingData(String(testTelegramId), ' ', bookingSlotISO); // Empty string after trim
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input: sessionType is required.');
    });

    it('should return success false if bookingSlot is invalid (null)', async () => {
      const result = await stateManager.storeBookingData(String(testTelegramId), sessionType, null);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input: bookingSlot is required.');
    });
    
    it('should return success false if bookingSlot is not a valid date string', async () => {
      const result = await stateManager.storeBookingData(String(testTelegramId), sessionType, 'not-a-date');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input: bookingSlot must be a valid date or ISO string.');
    });

    it('should return success false if telegramId cannot be converted to BigInt', async () => {
      const result = await stateManager.storeBookingData("invalidBigInt", sessionType, bookingSlotISO);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input: telegramId format is invalid.');
    });

    it('should return success false and "User not found" if Prisma error P2025 occurs', async () => {
      const prismaError = new Error("User not found");
      prismaError.code = "P2025";
      mockPrismaUserMethods.update.mockRejectedValueOnce(prismaError);
      const result = await stateManager.storeBookingData(String(testTelegramId), sessionType, bookingSlotISO);
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found for storing booking data.');
    });

    it('should return success false on generic database error', async () => {
      mockPrismaUserMethods.update.mockRejectedValueOnce(new Error('DB Error'));
      const result = await stateManager.storeBookingData(String(testTelegramId), sessionType, bookingSlotISO);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error during booking data storage.');
    });
  });

  describe('setActiveSessionId', () => {
    const sessionId = 'graph-session-xyz';
    it('should call prisma.users.update to set active_session_id', async () => {
      mockPrismaUserMethods.update.mockResolvedValueOnce({});
      const result = await stateManager.setActiveSessionId({ telegramId: String(testTelegramId), sessionId });
      expect(mockPrismaUserMethods.update).toHaveBeenCalledWith({
        where: { telegram_id: testBigIntTelegramId },
        data: { active_session_id: sessionId },
      });
      expect(result.success).toBe(true);
    });
    it('should return success false if telegramId or sessionId is invalid', async () => {
      let result = await stateManager.setActiveSessionId({ telegramId: null, sessionId });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input: telegramId and sessionId are required.');
      
      result = await stateManager.setActiveSessionId({ telegramId: String(testTelegramId), sessionId: null });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input: telegramId and sessionId are required.');
    });

    it('should return success false if telegramId cannot be converted to BigInt for setActiveSessionId', async () => {
      const result = await stateManager.setActiveSessionId({ telegramId: "invalidBigInt", sessionId });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input: telegramId format is invalid.');
    });

    it('should return success false and "User not found" if Prisma error P2025 occurs for setActiveSessionId', async () => {
      const prismaError = new Error("User not found");
      prismaError.code = "P2025";
      mockPrismaUserMethods.update.mockRejectedValueOnce(prismaError);
      const result = await stateManager.setActiveSessionId({ telegramId: String(testTelegramId), sessionId });
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found.');
    });

    it('should return success false on generic database error for setActiveSessionId', async () => {
      mockPrismaUserMethods.update.mockRejectedValueOnce(new Error('DB Error'));
      const result = await stateManager.setActiveSessionId({ telegramId: String(testTelegramId), sessionId });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error setting active session ID.');
    });
  });

  describe('clearActiveSessionId', () => {
    it('should call prisma.users.update to set active_session_id to null', async () => {
      mockPrismaUserMethods.update.mockResolvedValueOnce({});
      const result = await stateManager.clearActiveSessionId({ telegramId: String(testTelegramId) });
      expect(mockPrismaUserMethods.update).toHaveBeenCalledWith({
        where: { telegram_id: testBigIntTelegramId },
        data: { active_session_id: null },
      });
      expect(result.success).toBe(true);
    });
     it('should return success false if telegramId is invalid', async () => {
      const result = await stateManager.clearActiveSessionId({ telegramId: null });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input: telegramId is required.');
    });

    it('should return success false if telegramId cannot be converted to BigInt for clearActiveSessionId', async () => {
      const result = await stateManager.clearActiveSessionId({ telegramId: "invalidBigInt" });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input: telegramId format is invalid.');
    });

    it('should return success false and "User not found" if Prisma error P2025 occurs for clearActiveSessionId', async () => {
      const prismaError = new Error("User not found");
      prismaError.code = "P2025";
      mockPrismaUserMethods.update.mockRejectedValueOnce(prismaError);
      const result = await stateManager.clearActiveSessionId({ telegramId: String(testTelegramId) });
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found.');
    });

    it('should return success false on generic database error for clearActiveSessionId', async () => {
      mockPrismaUserMethods.update.mockRejectedValueOnce(new Error('DB Error'));
      const result = await stateManager.clearActiveSessionId({ telegramId: String(testTelegramId) });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error clearing active session ID.');
    });
  });

  describe('setLogger', () => {
    it('should allow logger to be replaced and used by other functions', async () => {
      stateManager.setLogger(mockLogger);
      
      // Call a function that uses the logger, e.g., resetUserState
      // Mock prisma update to prevent actual DB call and isolate logger usage
      mockPrismaUserMethods.update.mockResolvedValueOnce({});
      await stateManager.resetUserState(String(testTelegramId));

      // Check if the new mockLogger was used
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ telegramId: String(testBigIntTelegramId) }),
        "Attempting to reset user state"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ telegramId: String(testBigIntTelegramId) }),
        "Successfully reset user state."
      );

      // Also test an error path if possible, e.g., by passing invalid telegramId to a function
      await stateManager.resetUserState(null); // This should trigger an error log
      expect(mockLogger.error).toHaveBeenCalledWith("resetUserState called without a telegramId.");
    });
  });
});