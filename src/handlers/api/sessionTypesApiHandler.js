/**
 * @fileoverview Handles API requests related to session types.
 */

const coreSessionTypes = require("../../core/sessionTypes");

let logger;

/**
 * Initializes the Session Types API handler module with required dependencies.
 *
 * @param {object} deps - The dependencies object.
 * @param {object} deps.logger - The logger instance.
 * @throws {Error} If required dependencies are missing.
 */
function initialize(deps) {
  if (!deps.logger) {
    throw new Error(
      "Dependency Error: logger is required for SessionTypesApiHandler.",
    );
  }
  logger = deps.logger;
  logger.info("SessionTypesApiHandler initialized successfully with logger.");
}

/**
 * Handles GET /api/session-types/:id requests.
 * Fetches a session type by its ID.
 *
 * @param {object} req - The Express request object.
 * @param {object} req.params - The route parameters.
 * @param {string} req.params.id - The ID of the session type to fetch.
 * @param {object} res - The Express response object.
 * @param {Function} _next - The Express next middleware function (unused).
 * @returns {Promise<void>} Sends a JSON response with the session type or an error.
 * @response {200} {object} Successfully fetched session type. { success: true, data: SessionType }
 * @response {400} {object} Session Type ID is required. { success: false, message: string }
 * @response {404} {object} Session type not found. { success: false, message: string }
 * @response {500} {object} Internal server error. { success: false, message: string }
 */
async function getSessionTypeById(req, res, _next) {
  const { id } = req.params;
  logger.info(
    { sessionTypeId: id },
    "GET /api/session-types/:id called (handler: sessionTypesApiHandler)",
  );

  if (!id) {
    logger.warn("Session Type ID is required but was not provided in params.");
    return res.status(400).json({
      success: false,
      message: "Session Type ID is required.",
    });
  }

  try {
    const sessionType = await coreSessionTypes.getById(id);

    if (sessionType) {
      logger.info(
        { sessionTypeId: id, data: sessionType },
        "Session type found by sessionTypesApiHandler.",
      );
      return res.status(200).json({
        success: true,
        data: sessionType,
      });
    } else {
      logger.warn(
        { sessionTypeId: id },
        "Session type not found by sessionTypesApiHandler.",
      );
      return res.status(404).json({
        success: false,
        message: `Session type with ID '${id}' not found.`,
      });
    }
  } catch (error) {
    logger.error(
      { err: error, sessionTypeId: id },
      "Error in sessionTypesApiHandler fetching session type by ID.",
    );
    return res.status(500).json({
      success: false,
      message:
        "An internal error occurred while fetching session type details.",
    });
  }
}

module.exports = {
  initialize,
  getSessionTypeById,
};
