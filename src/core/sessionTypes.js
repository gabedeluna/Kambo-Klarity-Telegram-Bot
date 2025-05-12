/**
 * @module core/sessionTypes
 * @description Helper module to load and access session type configuration data.
 */

const prisma = require("./prisma");
const logger = require("./logger");

/**
 * Retrieves all active session types from the database.
 * @returns {Promise<Array<object>>} An array of active session type objects.
 */
async function getAll() {
  logger.debug(
    "[sessionTypes] Attempting to fetch all active session types from DB.",
  );
  try {
    const activeSessionTypes = await prisma.sessionType.findMany({
      where: { active: true },
      orderBy: { label: "asc" }, // Optional: order by label for consistency
    });
    logger.info(
      `[sessionTypes] Fetched ${activeSessionTypes.length} active session types from DB.`,
    );
    // console.log('[MANUAL TEST getAll] DB Result:', activeSessionTypes); // Temporary for manual testing
    return activeSessionTypes;
  } catch (error) {
    logger.error(
      { err: error },
      "[sessionTypes] Error fetching active session types from DB.",
    );
    return [];
  }
}

/**
 * Finds a session type by its unique ID from the database.
 * @param {string} id - The unique identifier for the session type.
 * @returns {Promise<object | null>} The session type object if found, otherwise null.
 */
async function getById(id) {
  if (!id || typeof id !== "string") {
    logger.warn(
      { idReceived: id },
      "[sessionTypes] getById called with invalid ID.",
    );
    return null;
  }
  logger.debug(
    { id },
    "[sessionTypes] Attempting to fetch session type by ID from DB.",
  );
  try {
    const sessionType = await prisma.sessionType.findUnique({
      where: { id: id },
    });
    if (sessionType) {
      logger.info(
        { id, data: sessionType },
        "[sessionTypes] Session type found by ID in DB.",
      );
    } else {
      logger.warn({ id }, "[sessionTypes] Session type not found by ID in DB.");
    }
    return sessionType;
  } catch (error) {
    logger.error(
      { err: error, id },
      "[sessionTypes] Error fetching session type by ID from DB.",
    );
    return null;
  }
}

// CRUD FUNCTIONS

/**
 * Creates a new session type in the database.
 * @param {object} data - The data for the new session type.
 * @param {string} data.id - Unique ID for the session type.
 * @param {string} data.label - Display label for the session type.
 * @param {number} data.durationMinutes - Duration of the session in minutes.
 * @param {string} [data.description] - Optional description.
 * @param {number|string} [data.price] - Optional price (can be number or string representation).
 * @param {boolean} [data.active=true] - Optional active status.
 * @returns {Promise<object | null>} The created session type object or null on error.
 */
async function createType(data) {
  logger.debug(
    { data },
    "[sessionTypes] Attempting to create new session type in DB.",
  );
  try {
    // Prisma expects Decimal to be a string or number, it will handle conversion
    const newSessionType = await prisma.sessionType.create({
      data: data,
    });
    logger.info(
      { data: newSessionType },
      "[sessionTypes] Successfully created new session type in DB.",
    );
    return newSessionType;
  } catch (error) {
    logger.error(
      { err: error, data },
      "[sessionTypes] Error creating new session type in DB.",
    );
    return null;
  }
}

/**
 * Updates an existing session type in the database.
 * @param {string} id - The ID of the session type to update.
 * @param {object} data - The data to update.
 * @param {string} [data.label] - New label.
 * @param {number} [data.durationMinutes] - New duration.
 * @param {string} [data.description] - New description.
 * @param {number|string} [data.price] - New price.
 * @param {boolean} [data.active] - New active status.
 * @returns {Promise<object | null>} The updated session type object or null on error.
 */
async function updateType(id, data) {
  if (!id || typeof id !== "string") {
    logger.warn(
      { idReceived: id, data },
      "[sessionTypes] updateType called with invalid ID.",
    );
    return null;
  }
  logger.debug(
    { id, data },
    "[sessionTypes] Attempting to update session type in DB.",
  );
  try {
    const updatedSessionType = await prisma.sessionType.update({
      where: { id: id },
      data: data,
    });
    logger.info(
      { data: updatedSessionType },
      "[sessionTypes] Successfully updated session type in DB.",
    );
    return updatedSessionType;
  } catch (error) {
    // Prisma throws P2025 if record to update not found
    if (error.code === "P2025") {
      logger.warn(
        { err: error, id, data },
        "[sessionTypes] Session type not found for update.",
      );
    } else {
      logger.error(
        { err: error, id, data },
        "[sessionTypes] Error updating session type in DB.",
      );
    }
    return null;
  }
}

/**
 * Deactivates a session type by its ID.
 * Sets the 'active' flag to false.
 * @param {string} id - The unique identifier for the session type to deactivate.
 * @returns {Promise<object | null>} The updated session type object with active=false, or null on error.
 */
async function deactivateType(id) {
  if (!id || typeof id !== "string") {
    logger.warn(
      { idReceived: id },
      "[sessionTypes] deactivateType called with invalid ID.",
    );
    return null;
  }
  logger.debug(
    { id },
    "[sessionTypes] Attempting to deactivate session type in DB.",
  );
  try {
    const deactivatedSessionType = await prisma.sessionType.update({
      where: { id: id },
      data: { active: false },
    });
    logger.info(
      { data: deactivatedSessionType },
      "[sessionTypes] Successfully deactivated session type in DB.",
    );
    return deactivatedSessionType;
  } catch (error) {
    if (error.code === "P2025") {
      logger.warn(
        { err: error, id },
        "[sessionTypes] Session type not found for deactivation.",
      );
    } else {
      logger.error(
        { err: error, id },
        "[sessionTypes] Error deactivating session type in DB.",
      );
    }
    return null;
  }
}

/**
 * Reactivates a session type by its ID.
 * Sets the 'active' flag to true.
 * @param {string} id - The unique identifier for the session type to reactivate.
 * @returns {Promise<object | null>} The updated session type object with active=true, or null on error.
 */
async function reactivateType(id) {
  if (!id || typeof id !== "string") {
    logger.warn(
      { idReceived: id },
      "[sessionTypes] reactivateType called with invalid ID.",
    );
    return null;
  }
  logger.debug(
    { id },
    "[sessionTypes] Attempting to reactivate session type in DB.",
  );
  try {
    const reactivatedSessionType = await prisma.sessionType.update({
      where: { id: id },
      data: { active: true },
    });
    logger.info(
      { data: reactivatedSessionType },
      "[sessionTypes] Successfully reactivated session type in DB.",
    );
    return reactivatedSessionType;
  } catch (error) {
    if (error.code === "P2025") {
      logger.warn(
        { err: error, id },
        "[sessionTypes] Session type not found for reactivation.",
      );
    } else {
      logger.error(
        { err: error, id },
        "[sessionTypes] Error reactivating session type in DB.",
      );
    }
    return null;
  }
}

/**
 * Permanently deletes a session type from the database.
 * @param {string} id - The unique identifier for the session type to delete.
 * @returns {Promise<object | null>} The deleted session type object or null if not found or on error.
 */
async function deleteType(id) {
  if (!id || typeof id !== "string") {
    logger.warn(
      { idReceived: id },
      "[sessionTypes] deleteType called with invalid ID.",
    );
    return null;
  }
  logger.debug(
    { id },
    "[sessionTypes] Attempting to permanently delete session type from DB.",
  );
  try {
    const deletedSessionType = await prisma.sessionType.delete({
      where: { id: id },
    });
    logger.info(
      { data: deletedSessionType },
      "[sessionTypes] Successfully deleted session type from DB.",
    );
    return deletedSessionType;
  } catch (error) {
    if (error.code === "P2025") {
      // P2025: Record to delete not found.
      logger.warn(
        { err: error, id },
        "[sessionTypes] Session type not found for deletion.",
      );
    } else {
      logger.error(
        { err: error, id },
        "[sessionTypes] Error deleting session type from DB.",
      );
    }
    return null;
  }
}

module.exports = {
  getAll,
  getById,
  createType,
  updateType,
  deactivateType,
  reactivateType,
  deleteType,
};
