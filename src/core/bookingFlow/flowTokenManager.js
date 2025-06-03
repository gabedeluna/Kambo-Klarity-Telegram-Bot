/**
 * @module core/bookingFlow/flowTokenManager
 * @description JWT-based flow token management for booking flows
 */

const jwt = require("jsonwebtoken");
const logger = require("../logger");

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-for-development";
const JWT_EXPIRY = "2h"; // 2 hours

/**
 * Generates a JWT flow token containing flow state information
 * @param {object} flowData - The flow state data to encode
 * @returns {string} JWT token
 */
function generateFlowToken(flowData) {
  logger.debug({ flowData }, "[FlowTokenManager] Generating flow token");

  try {
    const token = jwt.sign(flowData, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    logger.info(
      { userId: flowData.userId, flowType: flowData.flowType },
      "[FlowTokenManager] Flow token generated",
    );
    return token;
  } catch (error) {
    logger.error(
      { error, flowData },
      "[FlowTokenManager] Error generating flow token",
    );
    throw new Error("Failed to generate flow token");
  }
}

/**
 * Parses and validates a JWT flow token
 * @param {string} token - The JWT token to parse
 * @returns {object} Decoded flow state
 * @throws {Error} If token is invalid or expired
 */
function parseFlowToken(token) {
  logger.debug("[FlowTokenManager] Parsing flow token");

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    logger.debug(
      { userId: decoded.userId, flowType: decoded.flowType },
      "[FlowTokenManager] Flow token parsed successfully",
    );
    return decoded;
  } catch (error) {
    logger.warn(
      { error: error.message },
      "[FlowTokenManager] Invalid or expired flow token",
    );
    throw new Error("Invalid or expired flow token");
  }
}

module.exports = {
  generateFlowToken,
  parseFlowToken,
};
