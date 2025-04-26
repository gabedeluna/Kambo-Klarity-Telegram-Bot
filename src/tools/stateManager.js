/**
 * @module tools/stateManager
 * @description Provides functions to manage user state in the database.
 */

const prisma = require("../core/prisma");
let logger = require("../core/logger"); // Use let for potential dependency injection

/**
 * Resets the user's booking-related state fields in the database (e.g., state, session_type, booking_slot, edit_msg_id).
 * Call this when a booking flow is explicitly cancelled, successfully completed (after booking data is stored), or definitively concluded without a booking.
 *
 * @param {string|number} telegramId - The Telegram ID of the user whose state should be reset.
 * @returns {Promise<{success: boolean, error?: string}>} - An object indicating success or failure.
 */
async function resetUserState(telegramId) {
  let bigIntTelegramId;

  if (!telegramId) {
    logger.error("resetUserState called without a telegramId.");
    return { success: false, error: "Invalid input: telegramId is required." };
  }

  try {
    bigIntTelegramId = BigInt(telegramId);
  } catch (error) {
    logger.error(
      { telegramId: String(telegramId), err: error },
      "Invalid telegramId format. Cannot convert to BigInt.",
    );
    return {
      success: false,
      error: "Invalid input: telegramId format is invalid.",
    };
  }

  logger.info(
    { telegramId: String(bigIntTelegramId) },
    "Attempting to reset user state",
  );

  const resetData = {
    state: "NONE", // Default idle state
    session_type: null,
    conversation_history: null,
    booking_slot: null,
    edit_msg_id: null,
    // Add any other fields that should be cleared after a flow
  };

  try {
    await prisma.users.update({
      where: { telegram_id: bigIntTelegramId },
      data: resetData,
    });
    logger.info(
      { telegramId: String(bigIntTelegramId) },
      "Successfully reset user state.",
    );
    return { success: true };
  } catch (error) {
    logger.error(
      { telegramId: String(bigIntTelegramId), err: error },
      "Error resetting user state in database.",
    );
    // Consider if the error should be re-thrown or handled differently depending on the caller's needs.
    return { success: false, error: "Database error during state reset." };
  }
}

/**
 * Updates specific fields of a user's record in the database.
 * Use this to change the user's current state (e.g., 'AWAITING_SLOT_CONFIRMATION'), store temporary data like a message ID to be edited, or update conversation history.
 *
 * @param {string|number} telegramId - The Telegram ID of the user to update.
 * @param {object} dataToUpdate - An object containing the fields and values to update (e.g., { state: 'NEW_STATE', edit_msg_id: 123 }). Must not be empty. Refer to toolSchemas.js updateUserStateSchema for allowed fields.
 * @returns {Promise<{success: boolean, error?: string, user?: object}>} - An object indicating success/failure and potentially the updated user data.
 */
async function updateUserState(telegramId, dataToUpdate) {
  // Input Validation: telegramId
  if (!telegramId) {
    logger.error("updateUserState called without a telegramId.");
    return { success: false, error: "Invalid telegramId" };
  }

  // Input Validation: dataToUpdate
  if (
    typeof dataToUpdate !== "object" ||
    dataToUpdate === null ||
    Object.keys(dataToUpdate).length === 0
  ) {
    logger.error(
      { telegramId: String(telegramId), data: dataToUpdate },
      "updateUserState called with invalid dataToUpdate object.",
    );
    return { success: false, error: "Invalid dataToUpdate object" };
  }

  let bigIntTelegramId;
  try {
    bigIntTelegramId = BigInt(telegramId);
  } catch (error) {
    logger.error(
      { telegramId: String(telegramId), err: error },
      "Invalid telegramId format for updateUserState. Cannot convert to BigInt.",
    );
    return {
      success: false,
      error: "Invalid input: telegramId format is invalid.",
    };
  }

  logger.info(
    { telegramId: String(bigIntTelegramId), updateData: dataToUpdate },
    "Attempting to update user state",
  );

  try {
    const updatedUser = await prisma.users.update({
      where: { telegram_id: bigIntTelegramId },
      data: dataToUpdate,
    });
    logger.info(
      { telegramId: String(bigIntTelegramId) },
      "Successfully updated user state.",
    );
    return { success: true, user: updatedUser };
  } catch (error) {
    logger.error(
      {
        telegramId: String(bigIntTelegramId),
        updateData: dataToUpdate,
        err: error,
      },
      "Error updating user state in database.",
    );

    // Check for Prisma's specific 'RecordNotFound' error code (P2025)
    if (error.code === "P2025") {
      return { success: false, error: "User not found for update." };
    }

    // Generic database error
    return { success: false, error: "Database error during state update." };
  }
}

/**
 * Stores the confirmed booking session type and start time for a user after they have confirmed their choice.
 * Call this ONLY when a booking slot has been definitively chosen and confirmed by the user.
 *
 * @param {string|number} telegramId - The Telegram ID of the user.
 * @param {string} sessionType - The type of session booked (e.g., '1hr-kambo', must match configured session types).
 * @param {string} bookingSlot - The confirmed start time of the booking in ISO 8601 format (e.g., '2024-05-21T10:00:00Z').
 * @returns {Promise<{success: boolean, error?: string, user?: object}>} - An object indicating success/failure and potentially the updated user data.
 */
async function storeBookingData(telegramId, sessionType, bookingSlot) {
  // Input Validation: telegramId
  if (!telegramId) {
    logger.error("storeBookingData called without a telegramId.");
    return { success: false, error: "Invalid input: telegramId is required." };
  }

  // Input Validation: sessionType
  if (typeof sessionType !== "string" || !sessionType.trim()) {
    logger.error(
      { telegramId: String(telegramId), sessionType },
      "storeBookingData called with invalid sessionType.",
    );
    return { success: false, error: "Invalid input: sessionType is required." };
  }

  // Input Validation: bookingSlot
  if (!bookingSlot) {
    // Basic check, could be more specific (e.g., check if valid Date or ISO string)
    logger.error(
      { telegramId: String(telegramId), bookingSlot },
      "storeBookingData called with invalid bookingSlot.",
    );
    return { success: false, error: "Invalid input: bookingSlot is required." };
  }

  let bigIntTelegramId;
  try {
    bigIntTelegramId = BigInt(telegramId);
  } catch (error) {
    logger.error(
      { telegramId: String(telegramId), err: error },
      "Invalid telegramId format for storeBookingData. Cannot convert to BigInt.",
    );
    return {
      success: false,
      error: "Invalid input: telegramId format is invalid.",
    };
  }

  // Ensure bookingSlot is a Date object if it's a string
  const finalBookingSlot =
    typeof bookingSlot === "string" ? new Date(bookingSlot) : bookingSlot;
  if (
    !(finalBookingSlot instanceof Date) ||
    isNaN(finalBookingSlot.getTime())
  ) {
    logger.error(
      { telegramId: String(telegramId), bookingSlot: String(bookingSlot) },
      "storeBookingData called with invalid date format for bookingSlot.",
    );
    return {
      success: false,
      error: "Invalid input: bookingSlot must be a valid date or ISO string.",
    };
  }

  const bookingData = {
    session_type: sessionType.trim(),
    booking_slot: finalBookingSlot,
  };

  logger.info(
    {
      telegramId: String(bigIntTelegramId),
      sessionType,
      bookingSlot: finalBookingSlot.toISOString(),
    },
    "Attempting to store booking data",
  );

  try {
    const updatedUser = await prisma.users.update({
      where: { telegram_id: bigIntTelegramId },
      data: bookingData,
    });
    logger.info(
      { telegramId: String(bigIntTelegramId) },
      "Successfully stored booking data.",
    );
    return { success: true, user: updatedUser };
  } catch (error) {
    logger.error(
      {
        telegramId: String(bigIntTelegramId),
        sessionType,
        bookingSlot: finalBookingSlot.toISOString(),
        err: error,
      },
      "Error storing booking data in database.",
    );

    // Check for Prisma's specific 'RecordNotFound' error code (P2025)
    if (error.code === "P2025") {
      return {
        success: false,
        error: "User not found for storing booking data.",
      };
    }

    // Generic database error
    return {
      success: false,
      error: "Database error during booking data storage.",
    };
  }
}

/**
 * Sets the active LangGraph session ID for a user in the database.
 * This links the user's current interaction thread to a specific state machine instance.
 * Call this when initiating a new stateful interaction (like a booking graph).
 *
 * @param {object} params - The parameters object.
 * @param {string|number} params.telegramId - The Telegram ID of the user.
 * @param {string} params.sessionId - The LangGraph session ID (thread_id) to associate with the user.
 * @returns {Promise<{success: boolean, error?: string}>} - An object indicating success or failure.
 */
async function setActiveSessionId({ telegramId, sessionId }) {
  if (!telegramId || typeof sessionId !== "string" || !sessionId.trim()) {
    logger.error(
      { telegramId: String(telegramId), sessionId },
      "setActiveSessionId called with invalid input.",
    );
    return {
      success: false,
      error: "Invalid input: telegramId and sessionId are required.",
    };
  }

  let bigIntTelegramId;
  try {
    bigIntTelegramId = BigInt(telegramId);
  } catch (error) {
    logger.error(
      { telegramId: String(telegramId), err: error },
      "Invalid telegramId format for setActiveSessionId. Cannot convert to BigInt.",
    );
    return {
      success: false,
      error: "Invalid input: telegramId format is invalid.",
    };
  }

  logger.info(
    { telegramId: String(bigIntTelegramId), sessionId },
    "Attempting to set active session ID",
  );

  try {
    await prisma.users.update({
      where: { telegram_id: bigIntTelegramId },
      data: { active_session_id: sessionId },
    });
    logger.info(
      { telegramId: String(bigIntTelegramId) },
      "Successfully set active session ID.",
    );
    return { success: true };
  } catch (error) {
    logger.error(
      { telegramId: String(bigIntTelegramId), sessionId, err: error },
      "Error setting active session ID in database.",
    );
    if (error.code === "P2025") {
      return { success: false, error: "User not found." };
    }
    return {
      success: false,
      error: "Database error setting active session ID.",
    };
  }
}

/**
 * Clears the active LangGraph session ID for a user (sets it to null) in the database.
 * Call this when a stateful interaction (like a booking graph) concludes or is explicitly reset, detaching the user from that specific graph instance.
 *
 * @param {object} params - The parameters object.
 * @param {string|number} params.telegramId - The Telegram ID of the user.
 * @returns {Promise<{success: boolean, error?: string}>} - An object indicating success or failure.
 */
async function clearActiveSessionId({ telegramId }) {
  if (!telegramId) {
    logger.error("clearActiveSessionId called without a telegramId.");
    return {
      success: false,
      error: "Invalid input: telegramId is required.",
    };
  }

  let bigIntTelegramId;
  try {
    bigIntTelegramId = BigInt(telegramId);
  } catch (error) {
    logger.error(
      { telegramId: String(telegramId), err: error },
      "Invalid telegramId format for clearActiveSessionId. Cannot convert to BigInt.",
    );
    return {
      success: false,
      error: "Invalid input: telegramId format is invalid.",
    };
  }

  logger.info(
    { telegramId: String(bigIntTelegramId) },
    "Attempting to clear active session ID",
  );

  try {
    await prisma.users.update({
      where: { telegram_id: bigIntTelegramId },
      data: { active_session_id: null },
    });
    logger.info(
      { telegramId: String(bigIntTelegramId) },
      "Successfully cleared active session ID.",
    );
    return { success: true };
  } catch (error) {
    logger.error(
      { telegramId: String(bigIntTelegramId), err: error },
      "Error clearing active session ID in database.",
    );
    if (error.code === "P2025") {
      return { success: false, error: "User not found." };
    }
    return {
      success: false,
      error: "Database error clearing active session ID.",
    };
  }
}

/**
 * Sets the logger instance used by this module.
 * Useful for dependency injection in tests.
 *
 * @param {object} newLogger - The logger instance to use.
 */
function setLogger(newLogger) {
  logger = newLogger;
}

/**
 * Retrieves basic profile data for a given user.
 * Fetches fields relevant for initial agent interaction or context.
 *
 * @param {object} params - The parameters for fetching user profile data.
 * @param {string} params.telegramId - The Telegram ID of the user.
 * @returns {Promise<{success: boolean, data?: {first_name: string, role: string, state: string, session_type: string|null, active_session_id: string|null}|null, message?: string, error?: string}>} - Result object. `data` is null if user not found.
 * @throws {Error} If dependencies are not initialized.
 * @throws {z.ZodError} If input validation fails.
 */
async function getUserProfileData({ telegramId }) {
  if (!prisma || !logger) {
    throw new Error("StateManager not initialized. Call initialize first.");
  }
  // Input validation happens via Zod schema in the agent/tool definition
  // but good practice to have a basic check here too
  if (
    !telegramId ||
    typeof telegramId !== "string" ||
    telegramId.trim() === ""
  ) {
    logger.error(
      { telegramId },
      "Invalid telegramId provided to getUserProfileData.",
    );
    return { success: false, error: "Invalid Telegram ID provided." };
  }

  logger.debug({ telegramId }, "Attempting to fetch user profile data");
  try {
    const userProfile = await prisma.users.findUnique({
      where: { telegram_id: BigInt(telegramId) },
      select: {
        first_name: true,
        role: true,
        state: true,
        session_type: true,
        active_session_id: true,
      },
    });

    if (!userProfile) {
      logger.warn({ telegramId }, "User profile not found.");
      return { success: true, data: null, message: "User profile not found." };
    }

    logger.info({ telegramId }, "User profile data fetched successfully.");
    return { success: true, data: userProfile };
  } catch (error) {
    logger.error(
      { telegramId, err: error },
      "Database error fetching user profile",
    );
    return { success: false, error: "Database error fetching user profile" };
  }
}

/**
 * Retrieves the appointment dates of the last 5 completed sessions for a user.
 *
 * @param {object} params - The parameters for fetching past sessions.
 * @param {string} params.telegramId - The Telegram ID of the user.
 * @returns {Promise<{success: boolean, data?: Date[], error?: string}>} - Result object. `data` contains an array of Date objects.
 * @throws {Error} If dependencies are not initialized.
 * @throws {z.ZodError} If input validation fails.
 */
async function getUserPastSessions({ telegramId }) {
  if (!prisma || !logger) {
    throw new Error("StateManager not initialized. Call initialize first.");
  }
  // Basic validation
  if (
    !telegramId ||
    typeof telegramId !== "string" ||
    telegramId.trim() === ""
  ) {
    logger.error(
      { telegramId },
      "Invalid telegramId provided to getUserPastSessions.",
    );
    return { success: false, error: "Invalid Telegram ID provided." };
  }

  logger.debug({ telegramId }, "Attempting to fetch past completed sessions");
  try {
    const pastSessions = await prisma.sessions.findMany({
      where: {
        telegram_id: BigInt(telegramId),
        session_status: "COMPLETED",
      },
      select: { appointment_datetime: true },
      orderBy: { appointment_datetime: "desc" },
      take: 5, // Limit results
    });

    const sessionDates = pastSessions.map((s) => s.appointment_datetime);

    logger.info(
      { telegramId, count: sessionDates.length },
      "Past session dates fetched successfully.",
    );
    return { success: true, data: sessionDates };
  } catch (error) {
    logger.error(
      { telegramId, err: error },
      "Database error fetching past sessions",
    );
    return { success: false, error: "Database error fetching past sessions" };
  }
}

module.exports = {
  resetUserState,
  updateUserState,
  storeBookingData,
  setActiveSessionId,
  clearActiveSessionId,
  setLogger, // Keep exported for tests
  getUserProfileData, // Added export
  getUserPastSessions, // Added export
};
