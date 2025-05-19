/**
 * Test suite for telegramNotifier.js module
 */

// Mock dependencies
const mockBot = {
  telegram: {
    sendMessage: jest.fn().mockResolvedValue({ message_id: 123 }),
    editMessageText: jest.fn().mockResolvedValue({}),
    answerCallbackQuery: jest.fn().mockResolvedValue({}),
    setMyCommands: jest.fn().mockResolvedValue(true),
  },
};

jest.mock('../../src/core/bot', () => mockBot);

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  child: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
  }),
};

jest.mock('../../src/core/logger', () => mockLogger);

const mockSessionTypes = [
  { id: 1, label: '1hr-kambo', durationMinutes: 60, description: 'Standard session', active: true },
  { id: 2, label: '2hr-kambo', durationMinutes: 120, description: 'Extended session', active: true },
  { id: 3, label: '3hr-kambo', durationMinutes: 180, description: 'Three points session', active: true },
];

jest.mock('../../src/core/sessionTypes', () => ({
  getAll: jest.fn().mockResolvedValue(mockSessionTypes),
}));

// Mock Prisma client
jest.mock('../../src/core/prisma', () => ({
  user: {
    update: jest.fn().mockResolvedValue({ id: 1, telegramId: '123456', edit_msg_id: 456 }),
  },
}));

// Import module under test (after mocks)
const telegramNotifier = require('../../src/tools/telegramNotifier');

describe('telegramNotifier.js', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Initialize telegramNotifier
    telegramNotifier.initialize(mockBot);
  });
  
  describe('sendTextMessage', () => {
    test('should send a text message to the specified user', async () => {
      // Arrange
      const telegramId = '123456';
      const text = 'Test message';
      
      // Act
      const result = await telegramNotifier.sendTextMessage(telegramId, text);
      
      // Assert
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        telegramId,
        text,
        expect.anything()
      );
      expect(result).toEqual({ message_id: 123 });
      expect(mockLogger.info).toHaveBeenCalled();
    });
    
    test('should handle error when sending message fails', async () => {
      // Arrange
      const telegramId = '123456';
      const text = 'Test message';
      const error = new Error('Failed to send message');
      mockBot.telegram.sendMessage.mockRejectedValueOnce(error);
      
      // Act & Assert
      await expect(telegramNotifier.sendTextMessage(telegramId, text))
        .rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
  
  describe('sendWaiverLink', () => {
    test('should send waiver link and update user record', async () => {
      // Arrange
      const telegramId = '123456';
      const sessionId = '789';
      const editMsgId = 456;
      
      // Act
      const result = await telegramNotifier.sendWaiverLink(telegramId, sessionId, editMsgId);
      
      // Assert
      expect(mockBot.telegram.editMessageText).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });
  
  describe('sendSessionTypeSelector', () => {
    test('should send session type selector with inline keyboard', async () => {
      // Arrange
      const telegramId = '123456';
      const canBook3x3 = true;
      
      // Act
      const result = await telegramNotifier.sendSessionTypeSelector(telegramId, canBook3x3);
      
      // Assert
      expect(mockBot.telegram.sendMessage).toHaveBeenCalled();
      expect(result).toEqual({ message_id: 123 });
      expect(mockLogger.info).toHaveBeenCalled();
    });
    
    test('should filter out 3x3 session for users without permission', async () => {
      // Arrange
      const telegramId = '123456';
      const canBook3x3 = false;
      
      // Act
      const result = await telegramNotifier.sendSessionTypeSelector(telegramId, canBook3x3);
      
      // Assert
      expect(mockBot.telegram.sendMessage).toHaveBeenCalled();
      
      // Get the inline keyboard argument and verify 3hr-kambo is filtered out
      const callArgs = mockBot.telegram.sendMessage.mock.calls[0];
      const options = callArgs[2];
      const keyboard = options.reply_markup.inline_keyboard;
      
      // Verify no button contains "3hr-kambo"
      const has3hrOption = keyboard.some(row => 
        row.some(button => button.text.includes('3hr-kambo'))
      );
      
      expect(has3hrOption).toBe(false);
    });
  });
  
  describe('setRoleSpecificCommands', () => {
    test('should set role-specific commands for a user', async () => {
      // Arrange
      const telegramId = '123456';
      const isAdmin = true;
      
      // Act
      const result = await telegramNotifier.setRoleSpecificCommands(telegramId, isAdmin);
      
      // Assert
      expect(mockBot.telegram.setMyCommands).toHaveBeenCalled();
      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalled();
    });
    
    test('should set different commands based on role', async () => {
      // Arrange
      const telegramId = '123456';
      
      // Act - Test admin commands
      await telegramNotifier.setRoleSpecificCommands(telegramId, true);
      const adminCall = mockBot.telegram.setMyCommands.mock.calls[0];
      
      // Reset mock
      jest.clearAllMocks();
      
      // Act - Test client commands
      await telegramNotifier.setRoleSpecificCommands(telegramId, false);
      const clientCall = mockBot.telegram.setMyCommands.mock.calls[0];
      
      // Assert - Commands should be different
      expect(adminCall[0]).not.toEqual(clientCall[0]);
    });
  });
});