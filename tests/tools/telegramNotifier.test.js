// tests/tools/telegramNotifier.test.js

// Mock dependencies required by createTelegramNotifier
const mockBotTelegramMethods = {
  sendMessage: jest.fn(),
  editMessageText: jest.fn(),
  setMyCommands: jest.fn(),
  // Add other bot.telegram methods if used by other notifier functions
};
jest.mock('../../src/core/bot', () => ({
  telegram: mockBotTelegramMethods,
}));

const mockPrismaUserMethods = {
  update: jest.fn(),
  findMany: jest.fn(), // For sendAdminNotification
};
jest.mock('../../src/core/prisma', () => ({
  users: mockPrismaUserMethods,
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock('../../src/core/logger', () => mockLogger); // Direct mock as it's an object

const mockSessionTypes = {
  getAll: jest.fn(), // For sendSessionTypeSelector
};
jest.mock('../../src/core/sessionTypes', () => mockSessionTypes);

const mockStateManager = {
  getUserProfileData: jest.fn(), // For sendSessionTypeSelector
  updateUserState: jest.fn(),    // For sendSessionTypeSelector (storing edit_msg_id)
};
jest.mock('../../src/tools/stateManager', () => mockStateManager);


const { createTelegramNotifier } = require('../../src/tools/telegramNotifier');

describe('Tools Telegram Notifier (telegramNotifier.js)', () => {
  let notifier; // Will hold the instance returned by the factory
  let mockDependencies;

  const testTelegramId = '123456789';
  const testAdminTelegramId = '987654321';
  const mockConfig = { formUrl: 'http://test.com/form' };

  beforeEach(() => {
    jest.resetModules(); // Reset modules to ensure fresh mocks if notifier itself was cached

    // Re-require mocks if they were reset or to ensure they are clean for the factory
    const freshMockBot = require('../../src/core/bot');
    const freshMockPrisma = require('../../src/core/prisma');
    const freshMockLogger = require('../../src/core/logger');
    const freshMockSessionTypes = require('../../src/core/sessionTypes');
    const freshMockStateManager = require('../../src/tools/stateManager');


    // Clear all mock function calls
    Object.values(freshMockBot.telegram).forEach(fn => fn.mockClear());
    Object.values(freshMockPrisma.users).forEach(fn => fn.mockClear());
    Object.values(freshMockLogger).forEach(fn => fn.mockClear());
    Object.values(freshMockSessionTypes).forEach(fn => fn.mockClear());
    Object.values(freshMockStateManager).forEach(fn => fn.mockClear());


    mockDependencies = {
      bot: freshMockBot,
      prisma: freshMockPrisma,
      logger: freshMockLogger,
      config: mockConfig,
      sessionTypes: freshMockSessionTypes,
      stateManager: freshMockStateManager,
    };

    // Create a new notifier instance for each test
    notifier = createTelegramNotifier(mockDependencies);
  });

  describe('createTelegramNotifier Factory', () => {
    let consoleErrorSpy;

    beforeEach(() => {
      // Spy on console.error and provide a mock implementation to suppress output for these specific tests
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      // Restore console.error to its original implementation after these tests
      consoleErrorSpy.mockRestore();
    });

    it('should throw an error if dependencies are missing and log to console.error', () => {
      expect(() => createTelegramNotifier({})).toThrow(/Missing:/);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('FATAL: telegramNotifier initialization failed. Missing: bot, prisma, logger, config, sessionTypes, stateManager.'));
      
      consoleErrorSpy.mockClear(); // Clear for the next assertion in the same test

      expect(() => createTelegramNotifier({ bot: {}, prisma: {}, logger: {}, config: {} })).toThrow(/Missing: config.formUrl, sessionTypes, stateManager/);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('FATAL: telegramNotifier initialization failed. Missing: config.formUrl, sessionTypes, stateManager.'));
    });
  });


  it('should return an object with expected notifier functions when dependencies are provided', () => {
    // This test relies on the beforeEach correctly setting up 'notifier' with valid mocks
    expect(notifier.sendWaiverLink).toEqual(expect.any(Function));
    expect(notifier.sendTextMessage).toEqual(expect.any(Function));
    expect(notifier.sendSessionTypeSelector).toEqual(expect.any(Function));
    expect(notifier.sendAdminNotification).toEqual(expect.any(Function));
    expect(notifier.setRoleSpecificCommands).toEqual(expect.any(Function));
  });

  describe('sendTextMessage', () => {
    it('should call bot.telegram.sendMessage with correct parameters', async () => {
      const text = 'Hello, world!';
      // Use the mock from the outer scope, which is part of mockDependencies.bot.telegram
      mockDependencies.bot.telegram.sendMessage.mockResolvedValueOnce({ message_id: 123 });

      const result = await notifier.sendTextMessage({ telegramId: testTelegramId, text });

      expect(mockDependencies.bot.telegram.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockDependencies.bot.telegram.sendMessage).toHaveBeenCalledWith(testTelegramId, text);
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(123);
    });

    it('should return success false if telegramId is missing', async () => {
      const result = await notifier.sendTextMessage({ text: 'Hello' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing or invalid parameters');
      expect(mockDependencies.bot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should return success false if text is missing or empty', async () => {
      let result = await notifier.sendTextMessage({ telegramId: testTelegramId });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing or invalid parameters');

      result = await notifier.sendTextMessage({ telegramId: testTelegramId, text: '  ' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing or invalid parameters');
      expect(mockDependencies.bot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should return success false and error message on Telegram API failure', async () => {
      const apiError = new Error('Telegram API Error');
      apiError.response = { error_code: 400, description: 'Bad Request' };
      mockDependencies.bot.telegram.sendMessage.mockRejectedValueOnce(apiError);

      const result = await notifier.sendTextMessage({ telegramId: testTelegramId, text: 'Test' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid request (e.g., bad chat ID).'); // Specific error message
    });
  });

  // TODO: Add describe blocks and tests for:
  // - sendWaiverLink (Adding now)
  // - sendSessionTypeSelector
  // - sendAdminNotification
  // - setRoleSpecificCommands

  describe('sendWaiverLink', () => {
    const sessionType = '1hr-kambo';
    const messageText = 'Please sign the waiver.';

    it('should send waiver link and store edit_msg_id successfully', async () => {
      mockDependencies.bot.telegram.sendMessage.mockResolvedValueOnce({ message_id: 456 });
      mockDependencies.prisma.users.update.mockResolvedValueOnce({}); // DB update success

      const result = await notifier.sendWaiverLink({ telegramId: testTelegramId, sessionType, messageText });

      expect(mockDependencies.bot.telegram.sendMessage).toHaveBeenCalledWith(
        testTelegramId,
        messageText,
        expect.any(Object) // Markup object
      );
      const sendMessageCall = mockDependencies.bot.telegram.sendMessage.mock.calls[0];
      const inlineKeyboard = sendMessageCall[2].reply_markup.inline_keyboard;
      expect(inlineKeyboard[0][0].text).toBe(' Complete Waiver & Book');
      expect(inlineKeyboard[0][0].web_app.url).toBe(`${mockConfig.formUrl}?telegramId=${testTelegramId}&sessionType=${encodeURIComponent(sessionType)}`);
      
      expect(mockDependencies.prisma.users.update).toHaveBeenCalledWith({
        where: { telegram_id: BigInt(testTelegramId) },
        data: { edit_msg_id: 456 },
      });
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(456);
      expect(result.warning).toBeUndefined();
    });

    it('should return success false if telegramId is missing', async () => {
      const result = await notifier.sendWaiverLink({ sessionType });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing parameters');
      expect(mockDependencies.bot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should return success false if sessionType is missing', async () => {
      const result = await notifier.sendWaiverLink({ telegramId: testTelegramId });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing parameters');
      expect(mockDependencies.bot.telegram.sendMessage).not.toHaveBeenCalled();
    });
    
    it('should use default messageText if not provided', async () => {
        mockDependencies.bot.telegram.sendMessage.mockResolvedValueOnce({ message_id: 789 });
        mockDependencies.prisma.users.update.mockResolvedValueOnce({});

        await notifier.sendWaiverLink({ telegramId: testTelegramId, sessionType });
        
        expect(mockDependencies.bot.telegram.sendMessage).toHaveBeenCalledWith(
            testTelegramId,
            `Great! Let's get you scheduled for your ${sessionType} session `, // Default text
            expect.any(Object)
        );
    });

    it('should return success false on Telegram API error', async () => {
      mockDependencies.bot.telegram.sendMessage.mockRejectedValueOnce(new Error('TG API Fail'));
      const result = await notifier.sendWaiverLink({ telegramId: testTelegramId, sessionType });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Telegram API error');
    });

    it('should return success true with warning if DB update for edit_msg_id fails', async () => {
      mockDependencies.bot.telegram.sendMessage.mockResolvedValueOnce({ message_id: 101 });
      mockDependencies.prisma.users.update.mockRejectedValueOnce(new Error('DB Update Fail'));

      const result = await notifier.sendWaiverLink({ telegramId: testTelegramId, sessionType });
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(101);
      expect(result.warning).toBe('Message sent but failed to store message_id in DB');
    });
    
    it('should return success true with warning if message_id is missing from Telegram response', async () => {
      mockDependencies.bot.telegram.sendMessage.mockResolvedValueOnce({}); // No message_id

      const result = await notifier.sendWaiverLink({ telegramId: testTelegramId, sessionType });
      expect(result.success).toBe(true);
      expect(result.messageId).toBeNull();
      expect(result.warning).toBe('Message sent but message_id missing');
      expect(mockDependencies.prisma.users.update).not.toHaveBeenCalled(); // Should not attempt DB update
    });
  });

  describe('sendSessionTypeSelector', () => {
    const mockActiveSessionTypes = [
      { id: '1hr-kambo', label: '1 Hour Kambo', durationMinutes: 60, description: 'Standard session.' },
      { id: '3hr-kambo', label: '3 Hour Kambo (3x3)', durationMinutes: 180, description: 'Intensive session.' },
      { id: 'consult', label: 'Consultation', durationMinutes: 30, description: 'Initial consultation.' },
    ];

    beforeEach(() => {
      // Reset mocks specific to this describe block
      mockDependencies.stateManager.getUserProfileData.mockClear();
      mockDependencies.sessionTypes.getAll.mockClear();
      mockDependencies.bot.telegram.sendMessage.mockClear();
      mockDependencies.stateManager.updateUserState.mockClear();
    });

    it('should send selector with all types if user can book 3x3', async () => {
      mockDependencies.stateManager.getUserProfileData.mockResolvedValueOnce({ success: true, data: { can_book_3x3: true } });
      mockDependencies.sessionTypes.getAll.mockResolvedValueOnce(mockActiveSessionTypes);
      mockDependencies.bot.telegram.sendMessage.mockResolvedValueOnce({ message_id: 111 });
      mockDependencies.stateManager.updateUserState.mockResolvedValueOnce({ success: true });

      const result = await notifier.sendSessionTypeSelector({ telegramId: testTelegramId });

      expect(mockDependencies.stateManager.getUserProfileData).toHaveBeenCalledWith({ telegramId: testTelegramId });
      expect(mockDependencies.sessionTypes.getAll).toHaveBeenCalledWith({ active: true });
      expect(mockDependencies.bot.telegram.sendMessage).toHaveBeenCalledTimes(1);
      const sendMessageCall = mockDependencies.bot.telegram.sendMessage.mock.calls[0];
      expect(sendMessageCall[1]).toContain("1 Hour Kambo");
      expect(sendMessageCall[1]).toContain("3 Hour Kambo (3x3)");
      expect(sendMessageCall[1]).toContain("Consultation");
      const keyboard = sendMessageCall[2].reply_markup.inline_keyboard;
      expect(keyboard.length).toBe(3); // All 3 types
      expect(keyboard[1][0].text).toBe('3 Hour Kambo (3x3)');


      expect(mockDependencies.stateManager.updateUserState).toHaveBeenCalledWith(testTelegramId, { edit_msg_id: 111 });
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(111);
    });

    it('should send selector excluding 3x3 type if user cannot book 3x3', async () => {
      mockDependencies.stateManager.getUserProfileData.mockResolvedValueOnce({ success: true, data: { can_book_3x3: false } });
      mockDependencies.sessionTypes.getAll.mockResolvedValueOnce(mockActiveSessionTypes);
      mockDependencies.bot.telegram.sendMessage.mockResolvedValueOnce({ message_id: 222 });
      mockDependencies.stateManager.updateUserState.mockResolvedValueOnce({ success: true });

      await notifier.sendSessionTypeSelector({ telegramId: testTelegramId });

      const sendMessageCall = mockDependencies.bot.telegram.sendMessage.mock.calls[0];
      expect(sendMessageCall[1]).toContain("1 Hour Kambo");
      expect(sendMessageCall[1]).not.toContain("3 Hour Kambo (3x3)");
      expect(sendMessageCall[1]).toContain("Consultation");
      const keyboard = sendMessageCall[2].reply_markup.inline_keyboard;
      expect(keyboard.length).toBe(2); // 1hr and consult
      expect(keyboard.find(row => row[0].text === '3 Hour Kambo (3x3)')).toBeUndefined();
    });

    it('should handle missing telegramId', async () => {
      const result = await notifier.sendSessionTypeSelector({ telegramId: null });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing telegramId');
      expect(mockDependencies.bot.telegram.sendMessage).not.toHaveBeenCalled();
    });
    
    it('should handle failure to fetch user profile', async () => {
      mockDependencies.stateManager.getUserProfileData.mockResolvedValueOnce({ success: false, error: 'DB down' });
      mockDependencies.bot.telegram.sendMessage.mockResolvedValueOnce({}); // For the error message to user

      const result = await notifier.sendSessionTypeSelector({ telegramId: testTelegramId });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Could not retrieve user information.');
      expect(mockDependencies.bot.telegram.sendMessage).toHaveBeenCalledWith(testTelegramId, expect.stringContaining("Sorry, we encountered an issue retrieving your profile."));
    });

    it('should handle no active session types found', async () => {
      mockDependencies.stateManager.getUserProfileData.mockResolvedValueOnce({ success: true, data: { can_book_3x3: true } });
      mockDependencies.sessionTypes.getAll.mockResolvedValueOnce([]); // No active types
      mockDependencies.bot.telegram.sendMessage.mockResolvedValueOnce({}); // For the error message to user

      const result = await notifier.sendSessionTypeSelector({ telegramId: testTelegramId });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active session types available');
      expect(mockDependencies.bot.telegram.sendMessage).toHaveBeenCalledWith(testTelegramId, expect.stringContaining("Sorry, there are currently no session types available for booking."));
    });
    
    it('should handle no displayable session types after filtering', async () => {
      mockDependencies.stateManager.getUserProfileData.mockResolvedValueOnce({ success: true, data: { can_book_3x3: false } });
      // Only provide the 3x3 session type, which will be filtered out
      mockDependencies.sessionTypes.getAll.mockResolvedValueOnce([mockActiveSessionTypes[1]]);
      mockDependencies.bot.telegram.sendMessage.mockResolvedValueOnce({});

      const result = await notifier.sendSessionTypeSelector({ telegramId: testTelegramId });
      expect(result.success).toBe(true); // Function considers this a success, just no options to show
      expect(result.messageId).toBeNull();
      expect(mockDependencies.bot.telegram.sendMessage).toHaveBeenCalledWith(testTelegramId, "Sorry, there are currently no session types available for you to book.");
    });

    it('should handle Telegram API error when sending selector', async () => {
      mockDependencies.stateManager.getUserProfileData.mockResolvedValueOnce({ success: true, data: { can_book_3x3: true } });
      mockDependencies.sessionTypes.getAll.mockResolvedValueOnce(mockActiveSessionTypes);
      mockDependencies.bot.telegram.sendMessage.mockRejectedValueOnce(new Error('TG Send Error'));

      const result = await notifier.sendSessionTypeSelector({ telegramId: testTelegramId });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Telegram API error sending selector');
    });

    it('should return warning if stateManager fails to store edit_msg_id', async () => {
      mockDependencies.stateManager.getUserProfileData.mockResolvedValueOnce({ success: true, data: { can_book_3x3: true } });
      mockDependencies.sessionTypes.getAll.mockResolvedValueOnce(mockActiveSessionTypes);
      mockDependencies.bot.telegram.sendMessage.mockResolvedValueOnce({ message_id: 333 });
      mockDependencies.stateManager.updateUserState.mockResolvedValueOnce({ success: false, error: 'SM Update Fail' });

      const result = await notifier.sendSessionTypeSelector({ telegramId: testTelegramId });
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(333);
      expect(result.warning).toBe('Message sent, but failed to store edit_msg_id via stateManager.');
    });
  });

  describe('sendAdminNotification', () => {
    const notificationText = 'System alert: new booking received.';
    const mockAdmins = [
      { telegram_id: BigInt(testAdminTelegramId), first_name: 'Admin', last_name: 'One' },
      { telegram_id: BigInt('112233445'), first_name: 'Admin', last_name: 'Two' },
    ];

    beforeEach(() => {
      mockDependencies.prisma.users.findMany.mockClear();
      mockDependencies.bot.telegram.sendMessage.mockClear(); // Also clear this as it's used internally
    });

    it('should send notifications to all admins successfully', async () => {
      mockDependencies.prisma.users.findMany.mockResolvedValueOnce(mockAdmins);
      mockDependencies.bot.telegram.sendMessage.mockResolvedValue({ message_id: 1 }); // Simulate successful send for all

      const result = await notifier.sendAdminNotification({ text: notificationText });

      expect(mockDependencies.prisma.users.findMany).toHaveBeenCalledWith({
        where: { role: 'admin' },
        select: { telegram_id: true, first_name: true, last_name: true },
      });
      expect(mockDependencies.bot.telegram.sendMessage).toHaveBeenCalledTimes(mockAdmins.length);
      expect(mockDependencies.bot.telegram.sendMessage).toHaveBeenCalledWith(String(mockAdmins[0].telegram_id), notificationText);
      expect(mockDependencies.bot.telegram.sendMessage).toHaveBeenCalledWith(String(mockAdmins[1].telegram_id), notificationText);
      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should return success true with empty errors if no admins are found', async () => {
      mockDependencies.prisma.users.findMany.mockResolvedValueOnce([]); // No admins

      const result = await notifier.sendAdminNotification({ text: notificationText });
      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(mockDependencies.bot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should return success false if text parameter is missing', async () => {
      const result = await notifier.sendAdminNotification({});
      expect(result.success).toBe(false);
      expect(result.errors[0].error).toBe('Missing text parameter');
      expect(mockDependencies.prisma.users.findMany).not.toHaveBeenCalled();
    });
    
    it('should return success false if DB error occurs fetching admins', async () => {
      mockDependencies.prisma.users.findMany.mockRejectedValueOnce(new Error('DB Read Fail'));
      const result = await notifier.sendAdminNotification({ text: notificationText });
      expect(result.success).toBe(false);
      expect(result.errors[0].error).toBe('Database error fetching admins');
    });

    it('should return success true but list errors if some notifications fail to send', async () => {
      mockDependencies.prisma.users.findMany.mockResolvedValueOnce(mockAdmins);
      // First admin send succeeds, second fails
      mockDependencies.bot.telegram.sendMessage
        .mockResolvedValueOnce({ message_id: 1 }) // Success for admin 1
        .mockRejectedValueOnce(new Error('Blocked by user')); // Failure for admin 2

      const result = await notifier.sendAdminNotification({ text: notificationText });
      
      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].adminId).toBe(String(mockAdmins[1].telegram_id));
      expect(result.errors[0].error).toBe('Blocked by user');
      expect(mockDependencies.bot.telegram.sendMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('setRoleSpecificCommands', () => {
    // Mock commandRegistry directly for these tests
    const mockClientCommands = { client_command: { descr: 'Client only' } };
    const mockAdminCommands = { admin_command: { descr: 'Admin only' } };
    
    let originalCommandRegistry;

    beforeAll(() => {
      // Store original and replace
      originalCommandRegistry = require('../../src/commands/registry');
      jest.doMock('../../src/commands/registry', () => ({
        client: mockClientCommands,
        admin: mockAdminCommands,
      }));
    });

    afterAll(() => {
      // Restore original
      jest.dontMock('../../src/commands/registry');
      // It might be necessary to clear require cache if other tests use the real registry
      // For now, assuming this test file is self-contained for registry mocking.
    });
    
    beforeEach(() => {
        // We need to re-require telegramNotifier here because it requires commandRegistry at module level
        // and we've just mocked commandRegistry.
        // This ensures the notifier instance used in these tests gets the mocked registry.
        const { createTelegramNotifier: createNotifierWithMockedRegistry } = require('../../src/tools/telegramNotifier');
        notifier = createNotifierWithMockedRegistry(mockDependencies);
        mockDependencies.bot.telegram.setMyCommands.mockClear();
    });

    it('should set client commands for "client" role', async () => {
      mockDependencies.bot.telegram.setMyCommands.mockResolvedValueOnce(true);
      const result = await notifier.setRoleSpecificCommands({ telegramId: testTelegramId, role: 'client' });

      expect(mockDependencies.bot.telegram.setMyCommands).toHaveBeenCalledWith(
        [{ command: 'client_command', description: 'Client only' }],
        { scope: { type: 'chat', chat_id: Number(testTelegramId) } }
      );
      expect(result.success).toBe(true);
    });

    it('should set combined client and admin commands for "admin" role', async () => {
      mockDependencies.bot.telegram.setMyCommands.mockResolvedValueOnce(true);
      const result = await notifier.setRoleSpecificCommands({ telegramId: testAdminTelegramId, role: 'admin' });
      
      expect(mockDependencies.bot.telegram.setMyCommands).toHaveBeenCalledWith(
        expect.arrayContaining([
          { command: 'client_command', description: 'Client only' },
          { command: 'admin_command', description: 'Admin only' },
        ]),
        { scope: { type: 'chat', chat_id: Number(testAdminTelegramId) } }
      );
      // Check length to ensure no unexpected commands
      const calls = mockDependencies.bot.telegram.setMyCommands.mock.calls;
      expect(calls[0][0].length).toBe(2);
      expect(result.success).toBe(true);
    });

    it('should set an empty command list for an unknown role', async () => {
      mockDependencies.bot.telegram.setMyCommands.mockResolvedValueOnce(true);
      const result = await notifier.setRoleSpecificCommands({ telegramId: testTelegramId, role: 'unknown_role' });
      expect(mockDependencies.bot.telegram.setMyCommands).toHaveBeenCalledWith(
        [], // Empty array
        { scope: { type: 'chat', chat_id: Number(testTelegramId) } }
      );
      expect(result.success).toBe(true);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(expect.stringContaining("Unknown role 'unknown_role'"));
    });

    it('should return success false if telegramId or role is missing', async () => {
      let res = await notifier.setRoleSpecificCommands({ role: 'client' });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Missing or invalid parameters');

      res = await notifier.setRoleSpecificCommands({ telegramId: testTelegramId });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Missing or invalid parameters');
      expect(mockDependencies.bot.telegram.setMyCommands).not.toHaveBeenCalled();
    });

    it('should return success false on Telegram API error', async () => {
      mockDependencies.bot.telegram.setMyCommands.mockRejectedValueOnce(new Error('TG API SetCommands Fail'));
      const result = await notifier.setRoleSpecificCommands({ telegramId: testTelegramId, role: 'client' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Telegram API error setting commands');
    });
  });
});
// Removed extra closing });