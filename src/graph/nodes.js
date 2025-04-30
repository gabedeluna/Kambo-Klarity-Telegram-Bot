/**
 * @fileoverview Defines the nodes (processing steps) for the booking state graph.
 * Each node function takes the current graph state and returns a partial state update.
 */

const { BookingState } = require('./state'); // For JSDoc type hinting
// const { BookingState } // Assuming BookingState is defined/imported here; adjust if necessary.

// Module-level variables for injected dependencies
let bookingAgent, stateManager, googleCalendar, telegramNotifier, logger;

/**
 * Initializes the graph nodes with necessary dependencies.
 * This should be called once during application startup.
 *
 * @param {object} deps - An object containing dependencies.
 * @param {object} deps.bookingAgent - The initialized booking agent instance.
 * @param {object} deps.stateManager - The state manager instance.
 * @param {object} deps.googleCalendar - The Google Calendar tool instance.
 * @param {object} deps.telegramNotifier - The Telegram notifier instance.
 * @param {object} deps.logger - The application logger instance.
 */
function initializeNodes(deps) {
  if (!deps.bookingAgent || !deps.stateManager || !deps.googleCalendar || !deps.telegramNotifier || !deps.logger) {
    console.error("FATAL: Node initialization failed. Missing dependencies.", {
      bookingAgent: !!deps.bookingAgent,
      stateManager: !!deps.stateManager,
      googleCalendar: !!deps.googleCalendar,
      telegramNotifier: !!deps.telegramNotifier,
      logger: !!deps.logger,
    });
    process.exit(1);
  }
  bookingAgent = deps.bookingAgent;
  stateManager = deps.stateManager;
  googleCalendar = deps.googleCalendar;
  telegramNotifier = deps.telegramNotifier;
  logger = deps.logger;
  logger.info('[Graph Nodes] Initialized successfully.');
}

/**
 * Node to interact with the booking agent (LLM) to process user input.
 *
 * @param {BookingState} state - The current graph state.
 * @returns {Promise<Partial<BookingState>>} Update containing agent outcome or error.
 */
async function agentNode(state) {
  logger.debug(`[Agent Node] Entering for user: ${state.telegramId}`);
  const { userInput, telegramId, chatHistory } = state;

  if (!userInput) {
      logger.warn(`[Agent Node] No userInput found for user: ${telegramId}. Skipping agent call.`);
      return { agentOutcome: null, error: 'User input missing for agent.' };
  }

  try {
    // Assuming bookingAgent.runBookingAgent handles the chat history internally or takes it as an arg
    const result = await bookingAgent.runBookingAgent({ userInput, telegramId, chatHistory });

    if (result.success) {
      logger.info(`[Agent Node] Agent call successful for user: ${telegramId}. Outcome: ${JSON.stringify(result.data)}`);
      // Ensure agentOutcome includes the agent's response text and any structured data
      return { agentOutcome: result.data };
    } else {
      logger.error(`[Agent Node] Agent call failed for user: ${telegramId}. Error: ${result.error}`);
      return { error: result.error, agentOutcome: null };
    }
  } catch (err) {
    logger.error(`[Agent Node] Unexpected error during agent call for user: ${telegramId}.`, err);
    return { error: 'Unexpected error in agent interaction.', agentOutcome: null };
  }
}

/**
 * Node to find available time slots using the Google Calendar tool.
 *
 * @param {BookingState} state - The current graph state.
 * @returns {Promise<Partial<BookingState>>} Update containing available slots or error.
 */
async function findSlotsNode(state) {
  logger.debug(`[Find Slots Node] Entering for user: ${state.telegramId}`);
  // TODO: Extract actual date range and duration logic based on agentOutcome/sessionType
  const options = {
    // Placeholder: derive actual start/end dates and duration from state
    startDate: new Date(), // Example: Use agent output
    endDate: new Date(new Date().setDate(new Date().getDate() + 14)), // Example: Next 14 days
    durationMinutes: state.sessionType === 'private' ? 90 : 60, // Example: based on session type
  };

  try {
    const result = await googleCalendar.findFreeSlots(options);

    if (result.success) {
      if (result.data && result.data.length > 0) {
        logger.info(`[Find Slots Node] Found ${result.data.length} slots for user: ${state.telegramId}`);
        return { availableSlots: result.data, lastToolResponse: 'Found available slots.' };
      } else {
        logger.info(`[Find Slots Node] No slots found for user: ${state.telegramId}`);
        return { availableSlots: [], lastToolResponse: 'No available slots found for the requested time.' };
      }
    } else {
      logger.error(`[Find Slots Node] Failed to find slots for user: ${state.telegramId}. Error: ${result.error}`);
      state.error = result.error;
      state.availableSlots = null;
      state.lastToolResponse = 'Error finding slots.';
      return state;
    }
  } catch (err) {
    logger.error(`[Find Slots Node] Unexpected error searching slots for user: ${state.telegramId}.`, err);
    state.error = err.message || 'Unexpected error when searching for slots.';
    state.availableSlots = null;
    state.lastToolResponse = 'Error finding slots.';
    return state;
  }
}

/**
 * Node to store the confirmed booking details in the state/database.
 *
 * @param {BookingState} state - The current graph state.
 * @returns {Promise<Partial<BookingState>>} Update indicating success or error.
 */
async function storeBookingNode(state) {
  logger.debug(`[Store Booking Node] Entering for user: ${state.telegramId}`);
  const { telegramId, confirmedSlot, sessionType } = state;

  if (!confirmedSlot || !confirmedSlot.start) {
    logger.error(`[Store Booking Node] Invalid or missing confirmedSlot for user: ${telegramId}`);
    return { error: 'Cannot store booking without a confirmed slot.', lastToolResponse: 'Error storing booking data.' };
  }

  try {
    const result = await stateManager.storeBookingData({
      telegramId,
      bookingSlot: confirmedSlot.start, // Assuming confirmedSlot structure { start: 'datetime', end: 'datetime' }
      sessionType,
      // Add other relevant details like user name if available in state
    });

    if (result.success) {
      logger.info(`[Store Booking Node] Booking data stored for user: ${telegramId}`);
      return { lastToolResponse: 'Booking data stored.' };
    } else {
      logger.error(`[Store Booking Node] Failed to store booking data for user: ${telegramId}. Error: ${result.error}`);
      return { error: result.error, lastToolResponse: 'Error storing booking data.' };
    }
  } catch (err) {
    logger.error(`[Store Booking Node] Unexpected error storing booking for user: ${telegramId}.`, err);
    return { error: 'Unexpected error when storing booking.', lastToolResponse: 'Error storing booking data.' };
  }
}

/**
 * Node to create the corresponding event in Google Calendar.
 * NOTE: This is currently a stub.
 *
 * @param {BookingState} state - The current graph state.
 * @returns {Promise<Partial<BookingState>>} Update with event ID or error.
 */
async function createCalendarEventNode(state) {
  logger.debug(`[Create Calendar Event Node] Entering for user: ${state.telegramId}`);
  const { confirmedSlot, sessionType, userProfile, telegramId } = state;

  if (!confirmedSlot || !confirmedSlot.start || !confirmedSlot.end) {
    logger.error(`[Create Calendar Event Node] Invalid or missing confirmedSlot for user: ${telegramId}`);
    return { error: 'Cannot create calendar event without a confirmed slot.', lastToolResponse: 'Error creating Google Calendar event.' };
  }

  // TODO: Enhance event details (attendees, description)
  const eventDetails = {
    start: confirmedSlot.start,
    end: confirmedSlot.end,
    summary: `Kambo Session (${sessionType}) with ${userProfile?.name || 'User ' + telegramId}`,
    description: `Kambo Klarity Booking\nSession Type: ${sessionType}\nUser ID: ${telegramId}`,
    // attendees: [{ email: userProfile?.email }] // If email is available
  };

  try {
    // Assuming googleCalendar.createCalendarEvent is async and returns { success: bool, eventId: string|null, error: string|null }
    const result = await googleCalendar.createCalendarEvent(eventDetails);

    if (result.success) {
      logger.info(`[Create Calendar Event Node] Calendar event created (ID: ${result.eventId}) for user: ${telegramId}`);
      return { googleEventId: result.eventId, lastToolResponse: 'Calendar event created.' };
    } else {
      logger.error(`[Create Calendar Event Node] Failed to create calendar event for user: ${telegramId}. Error: ${result.error}`);
      return { error: result.error, googleEventId: null, lastToolResponse: 'Error creating Google Calendar event.' };
    }
  } catch (err) {
    logger.error(`[Create Calendar Event Node] Unexpected error creating GCal event for user: ${telegramId}.`, err);
    return { error: 'Unexpected error when creating calendar event.', googleEventId: null, lastToolResponse: 'Error creating Google Calendar event.' };
  }
}

/**
 * Node to send the appropriate waiver link to the user via Telegram.
 *
 * @param {BookingState} state - The current graph state.
 * @returns {Promise<Partial<BookingState>>} Update indicating success or error.
 */
async function sendWaiverNode(state) {
  logger.debug(`[Send Waiver Node] Entering for user: ${state.telegramId}`);
  const { telegramId, sessionType } = state;

  try {
    // Assuming telegramNotifier.sendWaiverLink is async and returns { success: bool, error: string|null }
    const result = await telegramNotifier.sendWaiverLink({ telegramId, sessionType });

    if (result.success) {
      logger.info(`[Send Waiver Node] Waiver link sent successfully to user: ${telegramId}`);
      return { lastToolResponse: 'Waiver sent.' };
    } else {
      logger.error(`[Send Waiver Node] Failed to send waiver link to user: ${telegramId}. Error: ${result.error}`);
      return { error: result.error, lastToolResponse: 'Error sending waiver.' };
    }
  } catch (err) {
    logger.error(`[Send Waiver Node] Unexpected error sending waiver to user: ${telegramId}.`, err);
    return { error: 'Unexpected error when sending waiver.', lastToolResponse: 'Error sending waiver.' };
  }
}

/**
 * Node to reset the user's state in the state manager.
 *
 * @param {BookingState} state - The current graph state.
 * @returns {Promise<Partial<BookingState>>} Update indicating success or error.
 */
async function resetStateNode(state) {
  logger.debug(`[Reset State Node] Entering for user: ${state.telegramId}`);
  const { telegramId } = state;

  try {
    // Assuming stateManager.resetUserState is async and returns { success: bool, error: string|null }
    const result = await stateManager.resetUserState({ telegramId });

    if (result.success) {
      logger.info(`[Reset State Node] User state reset successfully for user: ${telegramId}`);
      // Important: Resetting state likely means the *caller* should terminate or restart the graph,
      // but the node itself signals success.
      return { lastToolResponse: 'User state reset.' };
    } else {
      logger.error(`[Reset State Node] Failed to reset state for user: ${telegramId}. Error: ${result.error}`);
      // Even if reset fails, we might want to signal an error but not halt everything?
      // For now, return the error.
      return { error: result.error, lastToolResponse: 'Error resetting state.' };
    }
  } catch (err) {
    logger.error(`[Reset State Node] Unexpected error resetting state for user: ${telegramId}.`, err);
    return { error: 'Unexpected error when resetting state.', lastToolResponse: 'Error resetting state.' };
  }
}

/**
 * Node to handle errors that occurred in previous steps.
 * Logs the error and potentially notifies the user.
 *
 * @param {BookingState} state - The current graph state, expected to have an 'error' property.
 * @returns {Promise<Partial<BookingState>>} Returns an empty object; error handling is a side effect.
 */
async function handleErrorNode(state) {
  // Convert error to string for consistent logging
  const errorString = String(state.error || 'Unknown error');
  logger.error(`[Handle Error Node] Entering for user: ${state.telegramId}. Error: ${errorString}`);

  // Optionally, notify the user via Telegram
  if (telegramNotifier && state.telegramId) {
    try {
        // Use the stringified error for the user message, applying substring correctly
        const errorDetail = errorString.substring(0, 100);
        const userMessage = `Sorry, I encountered an internal problem processing your request. The technical details are: ${errorDetail}. Please try again shortly or contact support if the issue persists.`;
        await telegramNotifier.sendTextMessage({ telegramId: state.telegramId, text: userMessage });
        logger.info(`[Handle Error Node] Notified user ${state.telegramId} about the error.`);
    } catch (notificationError) {
        logger.error(`[Handle Error Node] Failed to send error notification to user ${state.telegramId}.`, notificationError);
    }
  }

  // This node primarily handles the error (logging, notification); it doesn't modify the state further.
  // The graph's routing logic should decide where to go after an error (e.g., end, retry, reset).
  return {};
}

module.exports = {
  initializeNodes,
  agentNode,
  findSlotsNode,
  storeBookingNode,
  createCalendarEventNode,
  sendWaiverNode,
  resetStateNode,
  handleErrorNode,
};
