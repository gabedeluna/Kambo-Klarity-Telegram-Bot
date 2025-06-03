/**
 * @fileoverview API handler for BookingFlowManager endpoints
 * Provides HTTP interface for booking flow operations
 */

const bookingFlowManager = require("../../core/bookingFlow/bookingFlowManager");

let logger;

/**
 * Initializes the booking flow API handler with required dependencies
 * @param {object} deps - Dependencies object
 * @param {object} deps.logger - Logger instance
 * @throws {Error} If required dependencies are missing
 */
function initialize(deps) {
  if (!deps.logger) {
    throw new Error(
      "Dependency Error: logger is required for bookingFlowApiHandler.",
    );
  }

  logger = deps.logger;
  logger.info("BookingFlow API Handler initialized successfully.");
}

/**
 * Validates if a string represents a valid number
 * @param {string} value - Value to validate
 * @returns {boolean} True if valid number
 */
function isValidNumber(value) {
  return value && !isNaN(value) && !isNaN(parseInt(value));
}

/**
 * Validates if a string is a valid ISO date
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid ISO date
 */
function isValidISODate(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return (
    date instanceof Date && !isNaN(date) && dateString === date.toISOString()
  );
}

/**
 * Maps error messages to appropriate HTTP status codes
 * @param {string} errorMessage - Error message from BookingFlowManager
 * @returns {number} HTTP status code
 */
function getErrorStatusCode(errorMessage) {
  const message = errorMessage.toLowerCase();

  if (message.includes("invalid") && message.includes("invite")) {
    return 404;
  }
  if (message.includes("expired") && message.includes("invite")) {
    return 404;
  }
  if (message.includes("slot") && message.includes("available")) {
    return 409;
  }
  if (message.includes("invalid flow token")) {
    return 400;
  }

  return 500;
}

/**
 * Handles POST /api/booking-flow/start-primary
 * Initiates a new booking flow for a primary user
 */
async function handleStartPrimaryFlow(req, res) {
  logger.info(
    { body: req.body },
    "[BookingFlowApiHandler] Processing start primary flow request",
  );

  try {
    const {
      telegramId,
      sessionTypeId,
      appointmentDateTimeISO,
      placeholderId,
      initialSessionTypeDetails,
    } = req.body;

    // Validate required fields
    if (!telegramId) {
      return res.status(400).json({
        success: false,
        message: "Invalid input: telegramId is required.",
      });
    }

    if (!isValidNumber(telegramId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid input: telegramId must be a valid number.",
      });
    }

    if (!sessionTypeId) {
      return res.status(400).json({
        success: false,
        message: "Invalid input: sessionTypeId is required.",
      });
    }

    if (!appointmentDateTimeISO) {
      return res.status(400).json({
        success: false,
        message: "Invalid input: appointmentDateTimeISO is required.",
      });
    }

    if (!isValidISODate(appointmentDateTimeISO)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid input: appointmentDateTimeISO must be a valid ISO date string.",
      });
    }

    // Call BookingFlowManager
    const flowData = {
      userId: parseInt(telegramId),
      sessionTypeId,
      appointmentDateTimeISO,
      placeholderId,
      initialSessionTypeDetails,
    };

    const result = await bookingFlowManager.startPrimaryBookingFlow(flowData);

    logger.info(
      { userId: parseInt(telegramId), flowToken: result.flowToken },
      "[BookingFlowApiHandler] Primary flow started successfully",
    );

    return res.status(200).json({
      success: true,
      flowToken: result.flowToken,
      nextStep: result.nextStep,
    });
  } catch (error) {
    logger.error(
      { error: error.message, body: req.body },
      "[BookingFlowApiHandler] Error in handleStartPrimaryFlow",
    );

    return res.status(500).json({
      success: false,
      message: "An internal error occurred while starting the booking flow.",
    });
  }
}

/**
 * Handles GET /api/booking-flow/start-invite/:inviteToken
 * Initiates a flow for an invited friend
 */
async function handleStartInviteFlow(req, res) {
  logger.info(
    { params: req.params, query: req.query },
    "[BookingFlowApiHandler] Processing start invite flow request",
  );

  try {
    const { inviteToken } = req.params;
    const { friend_tg_id } = req.query;

    // Validate required fields
    if (!inviteToken) {
      return res.status(400).json({
        success: false,
        message: "Invalid input: inviteToken is required.",
      });
    }

    if (!friend_tg_id) {
      return res.status(400).json({
        success: false,
        message: "Invalid input: friend_tg_id is required.",
      });
    }

    if (!isValidNumber(friend_tg_id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid input: friend_tg_id must be a valid number.",
      });
    }

    // Call BookingFlowManager
    const flowData = {
      inviteToken,
      userId: parseInt(friend_tg_id),
    };

    const result = await bookingFlowManager.startInviteAcceptanceFlow(flowData);

    logger.info(
      {
        userId: parseInt(friend_tg_id),
        inviteToken,
        flowToken: result.flowToken,
      },
      "[BookingFlowApiHandler] Invite flow started successfully",
    );

    return res.status(200).json({
      success: true,
      flowToken: result.flowToken,
      nextStep: result.nextStep,
      ...(result.inviteDetails && { inviteDetails: result.inviteDetails }),
    });
  } catch (error) {
    logger.error(
      { error: error.message, params: req.params, query: req.query },
      "[BookingFlowApiHandler] Error in handleStartInviteFlow",
    );

    const statusCode = getErrorStatusCode(error.message);

    if (statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: "Invite token is invalid or has expired.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "An internal error occurred while starting the invite flow.",
    });
  }
}

/**
 * Handles POST /api/booking-flow/continue
 * Continues a flow with step data submission
 */
async function handleContinueFlow(req, res) {
  logger.info(
    { body: req.body },
    "[BookingFlowApiHandler] Processing continue flow request",
  );

  try {
    const { flowToken, stepId, formData } = req.body;

    // Validate required fields
    if (!flowToken) {
      return res.status(400).json({
        success: false,
        message: "Invalid input: flowToken is required.",
      });
    }

    if (!stepId) {
      return res.status(400).json({
        success: false,
        message: "Invalid input: stepId is required.",
      });
    }

    // Call BookingFlowManager
    const continueData = {
      flowToken,
      stepId,
      data: formData || {},
    };

    const result = await bookingFlowManager.continueFlow(continueData);

    logger.info(
      { stepId, flowToken },
      "[BookingFlowApiHandler] Flow continued successfully",
    );

    return res.status(200).json({
      success: true,
      ...(result.flowToken && { flowToken: result.flowToken }),
      nextStep: result.nextStep,
    });
  } catch (error) {
    logger.error(
      { error: error.message, body: req.body },
      "[BookingFlowApiHandler] Error in handleContinueFlow",
    );

    const statusCode = getErrorStatusCode(error.message);

    if (statusCode === 400) {
      return res.status(400).json({
        success: false,
        message: "Invalid flow token or form data.",
      });
    }

    if (statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "An internal error occurred while continuing the flow.",
    });
  }
}

module.exports = {
  initialize,
  handleStartPrimaryFlow,
  handleStartInviteFlow,
  handleContinueFlow,
};
