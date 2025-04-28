// src/tests/graph/state.test.js

const { expect } = require('chai');
const { createInitialBookingState } = require('../../graph/state');

describe('Graph State', () => {
    describe('createInitialBookingState', () => {
        const telegramId = '12345';
        const sessionId = 'session-abc';

        it('should create an initial state object with required IDs and null defaults', () => {
            const initialState = createInitialBookingState(telegramId, sessionId);

            expect(initialState).to.deep.equal({
                userInput: null,
                telegramId: telegramId,
                sessionId: sessionId,
                sessionType: null,
                availableSlots: null,
                confirmedSlot: null,
                googleEventId: null,
                agentOutcome: null,
                error: null,
                chatHistory: null,
                lastToolResponse: null,
                userProfile: null,
                pastSessionDates: null,
            });
        });

        it('should throw an error if telegramId is missing', () => {
            expect(() => createInitialBookingState(null, sessionId)).to.throw(
                'Telegram ID and Session ID are required for initial state.'
            );
            expect(() => createInitialBookingState(undefined, sessionId)).to.throw(
                'Telegram ID and Session ID are required for initial state.'
            );
            expect(() => createInitialBookingState('', sessionId)).to.throw(
                'Telegram ID and Session ID are required for initial state.'
            );
        });

        it('should throw an error if sessionId is missing', () => {
            expect(() => createInitialBookingState(telegramId, null)).to.throw(
                'Telegram ID and Session ID are required for initial state.'
            );
            expect(() => createInitialBookingState(telegramId, undefined)).to.throw(
                'Telegram ID and Session ID are required for initial state.'
            );
            expect(() => createInitialBookingState(telegramId, '')).to.throw(
                'Telegram ID and Session ID are required for initial state.'
            );
        });
    });
});
