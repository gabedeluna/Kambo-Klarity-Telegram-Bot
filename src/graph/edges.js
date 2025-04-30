/**
 * Defines conditional edge functions for the LangGraph booking state machine.
 */

const { END } = require('@langchain/langgraph');
const logger = require('../core/logger');

// JSDoc type import
/** @typedef {import('./state').BookingState} BookingState */

/**
 * Routes based on the agent's decision (tool call or direct response).
 * Determines the next node based on whether the agent decided to call a tool,
 * respond directly to the user, or if an error occurred.
 *
 * @param {BookingState} state The current state of the graph.
 * @returns {string} The name of the next node to execute, or END.
 */
function routeAgentDecision(state) {
  logger.debug({ agentOutcome: state.agentOutcome }, 'Routing agent decision...');
  if (state.error) {
    logger.warn('Error detected in state before agent decision routing.');
    return 'handleErrorNode';
  }

  // Assuming agentOutcome structure like { tool_calls: [{ name: '...', args: {...} }], output: '...' }
  // Adjust based on actual agent output (e.g., from RunnableWithMessageHistory)
  const toolCalls = state.agentOutcome?.tool_calls;
  const agentResponse = state.agentOutcome?.output;

  if (toolCalls && toolCalls.length > 0) {
    // Agent wants to call a tool. Assuming one tool call per turn for simplicity.
    // If multiple tool calls are possible, logic might need adjustment.
    const toolName = toolCalls[0]?.name; // Get the name of the first tool call

    if (!toolName) {
        logger.error({ toolCalls }, 'Agent tool_calls array is present but contains no valid tool name.');
        state.error = 'Agent requested a tool but the tool name is missing.';
        return 'handleErrorNode';
    }

    logger.info(`Agent requests tool: ${toolName}`);
    const toolNodeMapping = {
      findFreeSlots: 'findSlotsNode',
      storeBookingData: 'storeBookingNode',
      createCalendarEvent: 'createCalendarEventNode',
      sendWaiverLink: 'sendWaiverNode',
      resetUserState: 'resetStateNode',
      deleteCalendarEvent: 'deleteCalendarEventNode', // Node needed for cancellation
      getUserProfileData: 'agentNode', // Data fetching usually feeds back to agent
      getUserPastSessions: 'agentNode', // Data fetching usually feeds back to agent
      sendTextMessage: 'sendTextMessageNode', // Node needed for direct messages
      // Add mappings for ALL tools the agent might call
    };

    if (toolNodeMapping[toolName]) {
      return toolNodeMapping[toolName];
    } else {
      logger.error(`Agent requested unknown or unmapped tool: ${toolName}`);
      state.error = `Agent requested an unknown tool: ${toolName}`;
      return 'handleErrorNode'; // Or a specific node to handle this
    }
  } else if (agentResponse) {
    // Agent provided a direct response to the user
    logger.info('Agent provided direct response, ending turn.');
    // The graph runner typically sends the final 'output' automatically when END is reached.
    // If not, a 'sendResponseNode' might be needed before END.
    return END;
  } else {
    logger.error({ outcome: state.agentOutcome }, 'Agent outcome unclear (no tool call or output). Routing to error.');
    state.error = 'Agent did not produce a tool call or a direct response.';
    return 'handleErrorNode';
  }
}

/**
 * Routes after the findSlotsNode has executed.
 * Always routes back to the agent to present the findings (slots found or not).
 *
 * @param {BookingState} state The current state of the graph.
 * @returns {string} Next node name ('agentNode' or 'handleErrorNode').
 */
function routeAfterSlotFinding(state) {
  logger.debug({ error: state.error, availableSlots: state.availableSlots }, 'Routing after slot finding...');
  if (state.error) {
      logger.warn('Error detected after slot finding.');
      return 'handleErrorNode';
  }
  // Always return to agent to present results (found or not)
  return 'agentNode';
}

/**
 * Routes after the storeBookingNode has executed.
 * If successful, proceeds to create the calendar event.
 *
 * @param {BookingState} state The current state of the graph.
 * @returns {string} Next node name ('createCalendarEventNode' or 'handleErrorNode').
 */
function routeAfterBookingStorage(state) {
  logger.debug({ error: state.error, bookingId: state.bookingId }, 'Routing after booking storage...');
  if (state.error) {
    logger.warn('Error detected after booking storage.');
    return 'handleErrorNode';
  }
  // Check if bookingId was actually set
  if (!state.bookingId) {
      logger.error("Booking storage node finished, but no bookingId found in state.");
      state.error = "Internal error: Booking ID missing after storage step.";
      return 'handleErrorNode';
  }
  // Next step is creating the calendar event
  return 'createCalendarEventNode';
}

/**
 * Routes after the createCalendarEventNode has executed.
 * If successful, proceeds to send the waiver link.
 *
 * @param {BookingState} state The current state of the graph.
 * @returns {string} Next node name ('sendWaiverNode' or 'handleErrorNode').
 */
function routeAfterGCalCreation(state) {
  logger.debug({ error: state.error, calendarEventId: state.calendarEventId }, 'Routing after GCal creation...');
  if (state.error) {
    logger.warn('Error detected after Google Calendar event creation.');
    return 'handleErrorNode';
  }
  if (!state.calendarEventId) {
      logger.error("Calendar event creation node finished, but no calendarEventId found in state.");
      state.error = "Internal error: Calendar Event ID missing after creation step.";
      return 'handleErrorNode';
  }
  // Next step is sending the waiver link
  return 'sendWaiverNode';
}

/**
 * Routes after the sendWaiverNode has executed.
 * If successful, the main booking flow for this turn is complete.
 *
 * @param {BookingState} state The current state of the graph.
 * @returns {string} Next node name (END or 'handleErrorNode').
 */
function routeAfterWaiverSent(state) {
  logger.debug({ error: state.error }, 'Routing after waiver sent...');
  if (state.error) {
    logger.warn('Error detected after sending waiver.');
    return 'handleErrorNode';
  }
  // Booking flow successfully initiated for this interaction, end the graph turn
  logger.info('Waiver sent successfully, ending graph turn.');
  return END;
}

/**
 * Routes after the resetStateNode has executed (typically for cancellations).
 * If successful, the cancellation or reset process is complete.
 *
 * @param {BookingState} state The current state of the graph.
 * @returns {string} Next node name (END or 'handleErrorNode').
 */
function routeAfterReset(state) {
    logger.debug({ error: state.error }, 'Routing after state reset...');
    if (state.error) {
        logger.warn('Error detected after state reset.');
        return 'handleErrorNode';
    }
    // Cancellation or reset process complete, end the graph turn
    logger.info('State reset successfully, ending graph turn.');
    return END;
}

// Potential future edge: routeAfterCalendarDeletion (if needed after deleteCalendarEventNode)
// function routeAfterCalendarDeletion(state) {
//   logger.debug({ state }, 'Routing after calendar deletion...');
//   if (state.error) { return 'handleErrorNode'; }
//   // Typically after deletion, we might want to inform the user
//   return 'sendTextMessageNode'; // or directly END if agent handles confirmation
// }


module.exports = {
  routeAgentDecision,
  routeAfterSlotFinding,
  routeAfterBookingStorage,
  routeAfterGCalCreation,
  routeAfterWaiverSent,
  routeAfterReset,
  // routeAfterCalendarDeletion, // Add when deleteCalendarEventNode is implemented
};
