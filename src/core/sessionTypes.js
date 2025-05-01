/**
 * @module core/sessionTypes
 * @description Helper module to load and access session type configuration data.
 */

const fs = require("fs");
const path = require("path");
const logger = require("./logger");

// Define the path to the session types configuration file
const SESSION_TYPES_PATH = path.join(__dirname, "../config/sessionTypes.json"); // Corrected path

// Internal cache for session types - Initialize to null for lazy loading
let sessionTypesCache = null;

/**
 * Loads session types from the JSON configuration file.
 * Includes basic error handling for file reading and parsing.
 * @private
 * @returns {Array<object>} An array of session type objects, or an empty array on error.
 */
function _loadSessionTypes() {
  try {
    if (!fs.existsSync(SESSION_TYPES_PATH)) {
      logger.error(
        `Error: Session types file not found at ${SESSION_TYPES_PATH}`,
      );
      return [];
    }

    const fileContent = fs.readFileSync(SESSION_TYPES_PATH, "utf-8");
    const data = JSON.parse(fileContent);
    // Basic validation to ensure it's an array
    if (!Array.isArray(data)) {
      logger.error(
        `Error: Expected an array in ${SESSION_TYPES_PATH}, but got ${typeof data}`,
      );
      return [];
    }
    return data;
  } catch (error) {
    logger.error(
      error,
      `Error loading session types from ${SESSION_TYPES_PATH}`,
    );
    return [];
  }
}

/**
 * Retrieves all loaded session types.
 *
 * @returns {Array<object>} An array containing all session type objects.
 */
function getAll() {
  if (sessionTypesCache === null) {
    sessionTypesCache = _loadSessionTypes();
  }
  return sessionTypesCache;
}

/**
 * Finds a session type by its unique ID.
 *
 * @param {string} id - The unique identifier for the session type.
 * @returns {object | undefined} The session type object if found, otherwise undefined.
 */
function getById(id) {
  if (sessionTypesCache === null) {
    sessionTypesCache = _loadSessionTypes();
  }

  if (typeof id !== "string") {
    logger.warn({ id }, "getById called with non-string id");
    return undefined;
  }
  return sessionTypesCache.find((session) => session.id === id);
}

module.exports = {
  getAll,
  getById,
  _loadSessionTypes,
};
