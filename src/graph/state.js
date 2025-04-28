// src/graph/state.js

/**
 * Represents the state object passed between nodes in the booking graph.
 * @typedef {object} BookingState
 * @property {string} [userInput] - The latest input message from the user for the current turn.
 * @property {string} telegramId - The Telegram ID of the user.
 * @property {string} sessionId - The active session ID for memory and context management.
 * @property {string} [sessionType] - The type of session the user intends to book (e.g., '1hr-kambo').
 * @property {Array<{start: string, end: string}> | null} [availableSlots] - List of slots returned by the findFreeSlots tool. Null if not yet fetched or none found.
 * @property {{start: string, end: string} | null} [confirmedSlot] - The specific slot chosen and confirmed by the user, ready for booking. Null otherwise.
 * @property {string | null} [googleEventId] - The ID of the Google Calendar event created transiently during booking confirmation (before waiver). Null otherwise.
 * @property {object | null} [agentOutcome] - The structured output or decision from the last agent execution (e.g., { tool_calls: [...], response: "..."}). Specific structure depends on the agent implementation. Null initially.
 * @property {string | null} [error] - Stores error messages encountered during graph execution. Null if no error.
 * @property {Array<object> | null} [chatHistory] - Placeholder for conversation history if needed explicitly in state (often handled by memory component directly). Let's keep it minimal for now.
 * @property {string | null} [lastToolResponse] - Placeholder for the response from the last executed tool.
 * @property {object | null} [userProfile] - Basic user profile data fetched at the start.
 * @property {Array<Date> | null} [pastSessionDates] - Dates of past completed sessions.
 */

// For LangGraph StateGraph, the state is often managed implicitly or via AgentState/TypedDict.
// We define the structure here primarily for documentation and clarity for node/edge implementation.
// No actual class instance is typically exported, just the type definition.
// However, exporting a simple factory function can be useful for tests.

/**
 * Creates a default initial state object.
 * @param {string} telegramId - The user's Telegram ID.
 * @param {string} sessionId - The active session ID.
 * @returns {BookingState} An initial state object.
 */
function createInitialBookingState(telegramId, sessionId) {
    if (!telegramId || !sessionId) {
        throw new Error("Telegram ID and Session ID are required for initial state.");
    }
    return {
        userInput: null,
        telegramId: telegramId,
        sessionId: sessionId,
        sessionType: null,
        availableSlots: null,
        confirmedSlot: null,
        googleEventId: null,
        agentOutcome: null,
        error: null,
        chatHistory: null, // Initialize explicitly if using
        lastToolResponse: null,
        userProfile: null,
        pastSessionDates: null,
    };
}

// We export the type definition via JSDoc and potentially the factory
module.exports = {
    // BookingState is defined via JSDoc @typedef
    createInitialBookingState
};
