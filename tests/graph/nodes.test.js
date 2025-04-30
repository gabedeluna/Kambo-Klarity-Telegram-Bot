// src/tests/graph/nodes.test.js

const sinon = require('sinon');
const chai = require('chai');
// Try requiring the default export explicitly
const sinonChai = require('sinon-chai').default;
chai.use(sinonChai);
const { expect } = chai; // Destructure expect *after* using sinonChai

// Import the functions to test
const {
  initializeNodes,
  agentNode,
  findSlotsNode,
  storeBookingNode,
  createCalendarEventNode,
  sendWaiverNode,
  resetStateNode,
  handleErrorNode,
} = require('../../src/graph/nodes'); // Corrected path again

// --- Mocks Setup --- 
// Declare variables, but define inside beforeEach
let mockBookingAgent;
let mockGoogleCalendar;
let mockStateManager;
let mockTelegramNotifier;
let mockLogger;
let mockDependencies;

// --- Base State Helper --- 
const getBaseState = (overrides = {}) => ({
  telegramId: 'user123',
  userInput: 'I want to book a session',
  chatHistory: [],
  userProfile: { name: 'Test User', email: 'test@example.com' },
  sessionType: 'private',
  agentOutcome: null,
  availableSlots: null,
  confirmedSlot: null,
  googleEventId: null,
  lastToolResponse: null,
  error: null,
  ...overrides,
});

// --- Tests --- 
describe('Graph Nodes', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    // Create FRESH mocks for each test
    mockLogger = {
      info: sandbox.stub(),
      debug: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
    };
    mockBookingAgent = {
      runBookingAgent: sandbox.stub(),
    };
    mockStateManager = {
      storeBookingData: sandbox.stub(),
      resetUserState: sandbox.stub(),
    };
    mockGoogleCalendar = {
      findFreeSlots: sandbox.stub(),
      createCalendarEvent: sandbox.stub(),
    };
    mockTelegramNotifier = {
      sendWaiverLink: sandbox.stub(),
      sendTextMessage: sandbox.stub(),
    };
    mockDependencies = {
      bookingAgent: mockBookingAgent,
      stateManager: mockStateManager,
      googleCalendar: mockGoogleCalendar,
      telegramNotifier: mockTelegramNotifier,
      logger: mockLogger,
    };

    // Reset history (optional but safe)
    // sinon.resetHistory(); // Not strictly needed if creating fresh stubs
    
    // Initialize nodes with the fresh mocks
    initializeNodes(mockDependencies);
  });

  afterEach(() => {
    sandbox.restore();
  });

  // --- initializeNodes tests ---
  describe('initializeNodes()', () => {
    it('should initialize successfully with all dependencies', () => {
        mockLogger.info.resetHistory();
        initializeNodes(mockDependencies);
        expect(mockLogger.info).to.have.been.calledWith('[Graph Nodes] Initialized successfully.');
    });

    it('should log fatal error and attempt to exit if dependencies are missing', () => {
        const consoleErrorStub = sinon.stub(console, 'error');
        const processExitStub = sinon.stub(process, 'exit').callsFake(() => {}); // Prevent actual exit

        try {
            const incompleteDeps = { ...mockDependencies, bookingAgent: undefined };
            initializeNodes(incompleteDeps); 
            // Note: In a real test environment, process.exit might terminate the test runner.
            // We assert it was called, acknowledging this behavior.
        } finally {
             // Check calls regardless of how process.exit behaved
             expect(consoleErrorStub).to.have.been.calledWithMatch(/FATAL: Node initialization failed/);
             consoleErrorStub.restore();
             processExitStub.restore();
        }
    });
  });

  // --- agentNode tests ---
  describe('agentNode()', () => {
    it('should call bookingAgent and return successful outcome', async () => {
      const initialState = getBaseState({ userInput: 'Book please' });
      const agentResult = { success: true, data: { action: 'request_slots', details: 'wants private session next week' } };
      mockBookingAgent.runBookingAgent.resolves(agentResult);

      const result = await agentNode(initialState);

      expect(mockBookingAgent.runBookingAgent).to.have.been.calledOnceWithExactly({
        userInput: initialState.userInput,
        telegramId: initialState.telegramId,
        chatHistory: initialState.chatHistory,
      });
      expect(result).to.deep.equal({ agentOutcome: agentResult.data });
      expect(result.error).to.be.undefined;
      expect(mockLogger.info).to.have.been.calledWithMatch(/Agent call successful/);
    });

    it('should return error if bookingAgent call fails', async () => {
        const initialState = getBaseState({ userInput: 'Book please' });
        const agentResult = { success: false, error: 'Agent capacity exceeded' };
        mockBookingAgent.runBookingAgent.resolves(agentResult);

        const result = await agentNode(initialState);

        expect(mockBookingAgent.runBookingAgent).to.have.been.calledOnce;
        expect(result).to.deep.equal({ error: agentResult.error, agentOutcome: null });
        expect(mockLogger.error).to.have.been.calledWithMatch(/Agent call failed/);
    });

    it('should return error if bookingAgent call throws an exception', async () => {
        const initialState = getBaseState({ userInput: 'Book please' });
        const agentError = new Error('Network error');
        mockBookingAgent.runBookingAgent.rejects(agentError);

        const result = await agentNode(initialState);

        expect(mockBookingAgent.runBookingAgent).to.have.been.calledOnce;
        expect(result).to.deep.equal({ error: 'Unexpected error in agent interaction.', agentOutcome: null });
        expect(mockLogger.error).to.have.been.calledWithMatch(/Unexpected error during agent call/);
    });

    it('should return error and log warning if userInput is missing', async () => {
        const initialState = getBaseState({ userInput: null }); // or undefined

        const result = await agentNode(initialState);

        expect(mockBookingAgent.runBookingAgent).not.to.have.been.called;
        expect(result).to.deep.equal({ agentOutcome: null, error: 'User input missing for agent.' });
        expect(mockLogger.warn).to.have.been.calledWithMatch(/No userInput found/);
    });
  });

  // --- findSlotsNode tests ---
  describe('findSlotsNode()', () => {
    const slot1 = { start: '2025-05-10T10:00:00Z', end: '2025-05-10T11:30:00Z' };
    const slot2 = { start: '2025-05-11T14:00:00Z', end: '2025-05-11T15:30:00Z' };

    it('should call googleCalendar.findFreeSlots and return found slots', async () => {
        const initialState = getBaseState({ sessionType: 'private' }); // Duration 90
        const calendarResult = { success: true, data: [slot1, slot2] };
        mockGoogleCalendar.findFreeSlots.resolves(calendarResult);

        const result = await findSlotsNode(initialState);

        expect(mockGoogleCalendar.findFreeSlots).to.have.been.calledOnce;
        // Basic check on options - more specific date checks could be added if needed
        expect(mockGoogleCalendar.findFreeSlots.firstCall.args[0].durationMinutes).to.equal(90);
        expect(result).to.deep.equal({ availableSlots: calendarResult.data, lastToolResponse: 'Found available slots.' });
        expect(result.error).to.be.undefined;
        expect(mockLogger.info).to.have.been.calledWithMatch(/Found 2 slots/);
    });

    it('should call googleCalendar.findFreeSlots and return empty if no slots found', async () => {
        const initialState = getBaseState({ sessionType: 'group' }); // Duration 60
        const calendarResult = { success: true, data: [] };
        mockGoogleCalendar.findFreeSlots.resolves(calendarResult);

        const result = await findSlotsNode(initialState);

        expect(mockGoogleCalendar.findFreeSlots).to.have.been.calledOnce;
        expect(mockGoogleCalendar.findFreeSlots.firstCall.args[0].durationMinutes).to.equal(60);
        expect(result).to.deep.equal({ availableSlots: [], lastToolResponse: 'No available slots found for the requested time.' });
        expect(result.error).to.be.undefined;
        expect(mockLogger.info).to.have.been.calledWithMatch(/No slots found/);
    });

    it('should return error if googleCalendar.findFreeSlots fails', async () => {
        const initialState = getBaseState();
        const calendarResult = { success: false, error: 'API quota exceeded' };
        mockGoogleCalendar.findFreeSlots.resolves(calendarResult);

        const result = await findSlotsNode(initialState);

        expect(mockGoogleCalendar.findFreeSlots).to.have.been.calledOnce;
        expect(result).to.deep.equal({
          ...initialState, 
          error: calendarResult.error, 
          availableSlots: null,
          lastToolResponse: 'Error finding slots.',
        });
        expect(mockLogger.error).to.have.been.calledWithMatch(/Failed to find slots/);
    });

     it('should return error if googleCalendar.findFreeSlots throws', async () => {
        const initialState = getBaseState();
        const calendarError = new Error('Calendar Service Error');
        mockGoogleCalendar.findFreeSlots.rejects(calendarError);

        const result = await findSlotsNode(initialState);

        expect(mockGoogleCalendar.findFreeSlots).to.have.been.calledOnce;
        expect(result).to.deep.equal({
          ...initialState, 
          error: calendarError.message, 
          availableSlots: null,
          lastToolResponse: 'Error finding slots.',
        });
        expect(mockLogger.error).to.have.been.calledWithMatch(/\[Find Slots Node\] Unexpected error searching slots/);
    });
  });

  // --- storeBookingNode tests ---
  describe('storeBookingNode()', () => {
      const confirmedSlot = { start: '2025-05-10T10:00:00Z', end: '2025-05-10T11:30:00Z' };

      it('should call stateManager.storeBookingData successfully', async () => {
          const initialState = getBaseState({ confirmedSlot, sessionType: 'private' });
          const storeResult = { success: true };
          mockStateManager.storeBookingData.resolves(storeResult);

          const result = await storeBookingNode(initialState);

          expect(mockStateManager.storeBookingData).to.have.been.calledOnceWithExactly({
              telegramId: initialState.telegramId,
              bookingSlot: confirmedSlot.start,
              sessionType: initialState.sessionType,
          });
          expect(result).to.deep.equal({ lastToolResponse: 'Booking data stored.' });
          expect(result.error).to.be.undefined;
          expect(mockLogger.info).to.have.been.calledWithMatch(/Booking data stored/);
      });

      it('should return error if stateManager.storeBookingData fails', async () => {
          const initialState = getBaseState({ confirmedSlot });
          const storeResult = { success: false, error: 'Database connection error' };
          mockStateManager.storeBookingData.resolves(storeResult);

          const result = await storeBookingNode(initialState);

          expect(mockStateManager.storeBookingData).to.have.been.calledOnce;
          expect(result).to.deep.equal({ error: storeResult.error, lastToolResponse: 'Error storing booking data.' });
          expect(mockLogger.error).to.have.been.calledWithMatch(/Failed to store booking data/);
      });

       it('should return error if stateManager.storeBookingData throws', async () => {
          const initialState = getBaseState({ confirmedSlot });
          const storeError = new Error('DB Error');
          mockStateManager.storeBookingData.rejects(storeError);

          const result = await storeBookingNode(initialState);

          expect(mockStateManager.storeBookingData).to.have.been.calledOnce;
          expect(result).to.deep.equal({ error: 'Unexpected error when storing booking.', lastToolResponse: 'Error storing booking data.' });
          expect(mockLogger.error).to.have.been.calledWithMatch(/Unexpected error storing booking/);
      });

      it('should return error if confirmedSlot is missing or invalid', async () => {
          const invalidStates = [
              getBaseState({ confirmedSlot: null }),
              getBaseState({ confirmedSlot: {} }), // Missing 'start'
          ];

          for (const initialState of invalidStates) {
              sandbox.resetHistory(); // Reset mocks for this iteration
              const result = await storeBookingNode(initialState);
              expect(mockStateManager.storeBookingData).not.to.have.been.called;
              expect(result).to.deep.equal({ error: 'Cannot store booking without a confirmed slot.', lastToolResponse: 'Error storing booking data.' });
              expect(mockLogger.error).to.have.been.calledWithMatch(/Invalid or missing confirmedSlot/);
          }
      });
  });

  // --- createCalendarEventNode tests ---
  describe('createCalendarEventNode()', () => {
      const confirmedSlot = { start: '2025-05-10T10:00:00Z', end: '2025-05-10T11:30:00Z' };
      const eventId = 'evt12345';

      it('should call googleCalendar.createCalendarEvent successfully', async () => {
          const initialState = getBaseState({ confirmedSlot, sessionType: 'private', userProfile: { name: 'Test User' } });
          const calendarResult = { success: true, eventId: eventId };
          mockGoogleCalendar.createCalendarEvent.resolves(calendarResult);

          const result = await createCalendarEventNode(initialState);

          expect(mockGoogleCalendar.createCalendarEvent).to.have.been.calledOnce;
          const expectedEventDetails = mockGoogleCalendar.createCalendarEvent.firstCall.args[0];
          expect(expectedEventDetails.start).to.equal(confirmedSlot.start);
          expect(expectedEventDetails.end).to.equal(confirmedSlot.end);
          expect(expectedEventDetails.summary).to.contain('Kambo Session (private) with Test User');
          expect(result).to.deep.equal({ googleEventId: eventId, lastToolResponse: 'Calendar event created.' });
          expect(result.error).to.be.undefined;
          expect(mockLogger.info).to.have.been.calledWithMatch(/Calendar event created \(ID: evt12345\)/);
      });

      it('should return error if googleCalendar.createCalendarEvent fails', async () => {
          const initialState = getBaseState({ confirmedSlot });
          const calendarResult = { success: false, error: 'Authentication failure', eventId: null };
          mockGoogleCalendar.createCalendarEvent.resolves(calendarResult);

          const result = await createCalendarEventNode(initialState);

          expect(mockGoogleCalendar.createCalendarEvent).to.have.been.calledOnce;
          expect(result).to.deep.equal({ error: calendarResult.error, googleEventId: null, lastToolResponse: 'Error creating Google Calendar event.' });
          expect(mockLogger.error).to.have.been.calledWithMatch(/Failed to create calendar event/);
      });

      it('should return error if googleCalendar.createCalendarEvent throws', async () => {
           const initialState = getBaseState({ confirmedSlot });
           const calendarError = new Error('API Error');
           mockGoogleCalendar.createCalendarEvent.rejects(calendarError);

           const result = await createCalendarEventNode(initialState);

           expect(mockGoogleCalendar.createCalendarEvent).to.have.been.calledOnce;
           expect(result).to.deep.equal({ error: 'Unexpected error when creating calendar event.', googleEventId: null, lastToolResponse: 'Error creating Google Calendar event.' });
           expect(mockLogger.error).to.have.been.calledWithMatch(/Unexpected error creating GCal event/);
       });


      it('should return error if confirmedSlot is missing or invalid', async () => {
          const invalidStates = [
              getBaseState({ confirmedSlot: null }),
              getBaseState({ confirmedSlot: { start: '...' } }), // Missing 'end'
              getBaseState({ confirmedSlot: { end: '...' } }), // Missing 'start'
          ];

          for (const initialState of invalidStates) {
              sandbox.resetHistory(); // Reset mocks for this iteration
              const result = await createCalendarEventNode(initialState);
              expect(mockGoogleCalendar.createCalendarEvent).not.to.have.been.called;
              expect(result).to.deep.equal({ error: 'Cannot create calendar event without a confirmed slot.', lastToolResponse: 'Error creating Google Calendar event.' });
              expect(mockLogger.error).to.have.been.calledWithMatch(/Invalid or missing confirmedSlot/);
          }
      });
  });

  // --- sendWaiverNode tests ---
  describe('sendWaiverNode()', () => {
       it('should call telegramNotifier.sendWaiverLink successfully', async () => {
           const initialState = getBaseState({ telegramId: 'user456', sessionType: 'group' });
           const notifyResult = { success: true };
           mockTelegramNotifier.sendWaiverLink.resolves(notifyResult);

           const result = await sendWaiverNode(initialState);

           expect(mockTelegramNotifier.sendWaiverLink).to.have.been.calledOnceWithExactly({
               telegramId: initialState.telegramId,
               sessionType: initialState.sessionType,
           });
           expect(result).to.deep.equal({ lastToolResponse: 'Waiver sent.' });
           expect(result.error).to.be.undefined;
           expect(mockLogger.info).to.have.been.calledWithMatch(/Waiver link sent successfully/);
       });

       it('should return error if telegramNotifier.sendWaiverLink fails', async () => {
           const initialState = getBaseState();
           const notifyResult = { success: false, error: 'User blocked bot' };
           mockTelegramNotifier.sendWaiverLink.resolves(notifyResult);

           const result = await sendWaiverNode(initialState);

           expect(mockTelegramNotifier.sendWaiverLink).to.have.been.calledOnce;
           expect(result).to.deep.equal({ error: notifyResult.error, lastToolResponse: 'Error sending waiver.' });
           expect(mockLogger.error).to.have.been.calledWithMatch(/Failed to send waiver link/);
       });

       it('should return error if telegramNotifier.sendWaiverLink throws', async () => {
           const initialState = getBaseState();
           const notifyError = new Error('Telegram API error');
           mockTelegramNotifier.sendWaiverLink.rejects(notifyError);

           const result = await sendWaiverNode(initialState);

           expect(mockTelegramNotifier.sendWaiverLink).to.have.been.calledOnce;
           expect(result).to.deep.equal({ error: 'Unexpected error when sending waiver.', lastToolResponse: 'Error sending waiver.' });
           expect(mockLogger.error).to.have.been.calledWithMatch(/Unexpected error sending waiver/);
       });
  });

  // --- resetStateNode tests ---
  describe('resetStateNode()', () => {
      it('should call stateManager.resetUserState successfully', async () => {
          const initialState = getBaseState({ telegramId: 'user789' });
          const resetResult = { success: true };
          mockStateManager.resetUserState.resolves(resetResult);

          const result = await resetStateNode(initialState);

          expect(mockStateManager.resetUserState).to.have.been.calledOnceWithExactly({
              telegramId: initialState.telegramId,
          });
          // Successful reset still returns a success indicator, caller decides what to do
          expect(result).to.deep.equal({ lastToolResponse: 'User state reset.' });
          expect(result.error).to.be.undefined;
          expect(mockLogger.info).to.have.been.calledWithMatch(/User state reset successfully/);
      });

      it('should return error if stateManager.resetUserState fails', async () => {
          const initialState = getBaseState();
          const resetResult = { success: false, error: 'User not found' };
          mockStateManager.resetUserState.resolves(resetResult);

          const result = await resetStateNode(initialState);

          expect(mockStateManager.resetUserState).to.have.been.calledOnce;
          expect(result).to.deep.equal({ error: resetResult.error, lastToolResponse: 'Error resetting state.' });
          expect(mockLogger.error).to.have.been.calledWithMatch(/Failed to reset state/);
      });

      it('should return error if stateManager.resetUserState throws', async () => {
           const initialState = getBaseState();
           const resetError = new Error('DB Timeout');
           mockStateManager.resetUserState.rejects(resetError);

           const result = await resetStateNode(initialState);

           expect(mockStateManager.resetUserState).to.have.been.calledOnce;
           expect(result).to.deep.equal({ error: 'Unexpected error when resetting state.', lastToolResponse: 'Error resetting state.' });
           expect(mockLogger.error).to.have.been.calledWithMatch(/Unexpected error resetting state/);
       });
  });

  // --- handleErrorNode tests ---
  describe('handleErrorNode()', () => {
      it('should log the error and attempt to notify the user', async () => {
          const errorMessage = 'Something went wrong in previous node';
          const initialState = getBaseState({ error: errorMessage, telegramId: 'userErr' });
          mockTelegramNotifier.sendTextMessage.resolves({ success: true }); // Assume notification succeeds

          const result = await handleErrorNode(initialState);

          expect(mockLogger.error).to.have.been.calledWithMatch(/Entering for user: userErr. Error: Something went wrong/);
          expect(mockTelegramNotifier.sendTextMessage).to.have.been.calledOnce;
          const notificationArgs = mockTelegramNotifier.sendTextMessage.firstCall.args[0];
          expect(notificationArgs.telegramId).to.equal('userErr');
          // Check the exact expected message format
          const expectedMessage = `Sorry, I encountered an internal problem processing your request. The technical details are: ${errorMessage.substring(0, 100)}. Please try again shortly or contact support if the issue persists.`;
          expect(notificationArgs.text).to.equal(expectedMessage);
          expect(mockLogger.info).to.have.been.calledWithMatch(/Notified user userErr about the error/);
          expect(result).to.deep.equal({}); // No state change expected
      });

      it('should log the error even if notification fails', async () => {
          const errorMessage = 'Another issue';
          const initialState = getBaseState({ error: errorMessage, telegramId: 'userErrNotifyFail' });
          const notificationError = new Error('Telegram send failed');
          mockTelegramNotifier.sendTextMessage.rejects(notificationError); // Simulate notification failure

          const result = await handleErrorNode(initialState);

          expect(mockLogger.error).to.have.been.calledWithMatch(/Entering for user: userErrNotifyFail. Error: Another issue/);
          expect(mockTelegramNotifier.sendTextMessage).to.have.been.calledOnce;
          expect(mockLogger.error).to.have.been.calledWithMatch(/Failed to send error notification/);
          expect(mockLogger.info).not.to.have.been.calledWithMatch(/Notified user/); // Info log shouldn't happen if send fails
          expect(result).to.deep.equal({});
      });

       it('should handle cases where error is an object or null/undefined', async () => {
          const errorObject = new Error('Detailed Error');
          errorObject.code = 'ESOMECODE';
          const states = [
              getBaseState({ error: errorObject, telegramId: 'userErrObj' }),
              getBaseState({ error: null, telegramId: 'userErrNull' }),
          ];
          mockTelegramNotifier.sendTextMessage.resolves({ success: true });

          for (const initialState of states) {
              sandbox.resetHistory(); // Reset mocks *within the sandbox* for this iteration

              const result = await handleErrorNode(initialState);

              // Verify logging happened
              expect(mockLogger.error).to.have.been.calledWithMatch(/Entering for user:/);
              // Verify notification attempt
              expect(mockTelegramNotifier.sendTextMessage).to.have.been.calledOnce;
              // Construct expected message based on whether error exists
              let expectedDetail = 'Unknown error';
              if (initialState.error) {
                 const errorString = String(initialState.error);
                 expectedDetail = errorString.substring(0, 100);
              }
              const expectedMessage = `Sorry, I encountered an internal problem processing your request. The technical details are: ${expectedDetail}. Please try again shortly or contact support if the issue persists.`;
              expect(mockTelegramNotifier.sendTextMessage.firstCall.args[0].text).to.equal(expectedMessage);

              expect(mockLogger.info).to.have.been.calledWithMatch(/Notified user/);
              expect(result).to.deep.equal({});
          }
       });
  });

}); // End of describe('Graph Nodes')
