/**
 * @module tools/stateManager
 * @description Provides functions to manage user state in the database.
 */

const prisma = require("../core/prisma");
let logger = require("../core/logger"); // Use let for potential dependency injection

/**
 * Resets specific fields of a user's record in the database to default/null values.
 * This is typically used after a user interaction flow (like booking) is completed or cancelled.
 *
 * @param {string|number} telegramId - The Telegram ID of the user whose state needs to be reset.
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
 *
 * @param {string|number} telegramId - The Telegram ID of the user to update.
 * @param {object} dataToUpdate - An object containing the fields and values to update. Must not be empty.
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
 * Stores confirmed booking data (session type and slot) for a user.
 *
 * @param {string|number} telegramId - The Telegram ID of the user.
 * @param {string} sessionType - The type of session booked (e.g., '1hr-kambo').
 * @param {string|Date} bookingSlot - The specific date/time slot booked (ISO string or Date object).
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
 * Sets the logger instance used by this module.
 * Useful for dependency injection in tests.
 *
 * @param {object} newLogger - The logger instance to use.
 */
function setLogger(newLogger) {
  logger = newLogger;
}

module.exports = {
  resetUserState,
  updateUserState,
  storeBookingData,
  setLogger,
};
