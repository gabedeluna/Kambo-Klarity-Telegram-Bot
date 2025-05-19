/**
 * Test suite for stateManager.js module
 */

// Mock Prisma client
const mockPrismaClient = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

// Mock the actual module to use our mocks
jest.mock('../../src/core/prisma', () => mockPrismaClient);

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../src/core/logger', () => mockLogger);

// Import the module under test (after mocks are set up)
const {
  getUserProfileData,
  updateUserState,
  resetUserState,
  // Import other functions as needed
} = require('../../src/tools/stateManager');

describe('stateManager.js', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfileData', () => {
    test('should return user data when user exists', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        telegramId: '123456',
        name: 'Test User',
        state: 'IDLE',
      };
      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await getUserProfileData('123456');

      // Assert
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: '123456' },
      });
      expect(result).toEqual(mockUser);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    test('should throw error when user does not exist', async () => {
      // Arrange
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(getUserProfileData('nonexistent')).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('updateUserState', () => {
    test('should update user state successfully', async () => {
      // Arrange
      const telegramId = '123456';
      const newState = 'BOOKING';
      const mockUpdatedUser = {
        id: 1,
        telegramId,
        state: newState,
      };
      mockPrismaClient.user.update.mockResolvedValue(mockUpdatedUser);

      // Act
      const result = await updateUserState(telegramId, { state: newState });

      // Assert
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { telegramId },
        data: { state: newState },
      });
      expect(result).toEqual(mockUpdatedUser);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    test('should handle error during update', async () => {
      // Arrange
      const error = new Error('Database error');
      mockPrismaClient.user.update.mockRejectedValue(error);

      // Act & Assert
      await expect(
        updateUserState('123456', { state: 'BOOKING' })
      ).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('resetUserState', () => {
    test('should reset user state to default values', async () => {
      // Arrange
      const telegramId = '123456';
      const mockUpdatedUser = {
        id: 1,
        telegramId,
        state: 'IDLE',
        selected_session_type: null,
        active_session_id: null,
      };
      mockPrismaClient.user.update.mockResolvedValue(mockUpdatedUser);

      // Act
      const result = await resetUserState(telegramId);

      // Assert
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { telegramId },
        data: {
          state: 'IDLE',
          selected_session_type: null,
          active_session_id: null,
        },
      });
      expect(result).toEqual(mockUpdatedUser);
    });
  });
});