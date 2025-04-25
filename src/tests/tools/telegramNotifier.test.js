/**
 * @fileoverview Unit tests for the Telegram Notifier tool
 */

// Ensure NODE_ENV is set to 'test' for conditional exports
process.env.NODE_ENV = 'test';

const { expect } = require('chai');
const sinon = require('sinon');

// Import the module directly
const telegramNotifier = require('../../tools/telegramNotifier');

describe('Tool: telegramNotifier', () => {
  // Test data
  const validTelegramId = '123456';
  const validText = 'Test message';
  const mockMessageId = 42;
  
  // Mocks
  let mockBot;
  let mockLogger;
  let consoleStub;
  
  beforeEach(() => {
    // Reset module state between tests
    if (telegramNotifier._getBot) {
      // Reset internal state if test exports are available
      telegramNotifier._resetForTest && telegramNotifier._resetForTest();
    }
    
    // Create fresh mocks for each test
    mockBot = {
      telegram: {
        sendMessage: sinon.stub().resolves({ message_id: mockMessageId })
      }
    };
    
    mockLogger = {
      info: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
      warn: sinon.stub()
    };
    
    // Stub console.error to avoid polluting test output
    consoleStub = sinon.stub(console, 'error');
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('Happy path', () => {
    it('should send a message successfully when properly initialized', async () => {
      // Initialize the module
      telegramNotifier.initialize({
        botInstance: mockBot,
        loggerInstance: mockLogger
      });
      
      // Act
      const result = await telegramNotifier.sendTextMessage({
        telegramId: validTelegramId,
        text: validText
      });
      
      // Assert
      expect(result).to.deep.equal({ success: true, messageId: mockMessageId });
      expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
      expect(mockBot.telegram.sendMessage.firstCall.args[0]).to.equal(validTelegramId);
      expect(mockBot.telegram.sendMessage.firstCall.args[1]).to.equal(validText);
    });
  });
  
  describe('Error cases', () => {
    beforeEach(() => {
      // Initialize for these tests
      telegramNotifier.initialize({
        botInstance: mockBot,
        loggerInstance: mockLogger
      });
    });
    
    it('should return error when telegramId is missing', async () => {
      const result = await telegramNotifier.sendTextMessage({ text: validText });
      
      expect(result).to.deep.equal({ success: false, error: 'Missing or invalid parameters' });
      expect(mockLogger.error.called).to.be.true;
      expect(mockBot.telegram.sendMessage.called).to.be.false;
    });
    
    it('should return error when text is missing', async () => {
      const result = await telegramNotifier.sendTextMessage({ telegramId: validTelegramId });
      
      expect(result).to.deep.equal({ success: false, error: 'Missing or invalid parameters' });
      expect(mockLogger.error.called).to.be.true;
      expect(mockBot.telegram.sendMessage.called).to.be.false;
    });
    
    it('should handle Telegram API errors gracefully', async () => {
      // Arrange - make the API call fail
      const apiError = new Error('API Error');
      mockBot.telegram.sendMessage.rejects(apiError);
      
      // Act
      const result = await telegramNotifier.sendTextMessage({
        telegramId: validTelegramId,
        text: validText
      });
      
      // Assert
      expect(result).to.deep.equal({ success: false, error: 'Failed to send Telegram message' });
      expect(mockLogger.error.called).to.be.true;
    });
  });
  
  describe('Uninitialized state', () => {
    it('should return error when not initialized', async () => {
      // Act - call without initialization
      const result = await telegramNotifier.sendTextMessage({
        telegramId: validTelegramId,
        text: validText
      });
      
      // Assert
      expect(result).to.deep.equal({ success: false, error: 'Tool not initialized' });
      expect(consoleStub.called).to.be.true;
    });
  });
});
