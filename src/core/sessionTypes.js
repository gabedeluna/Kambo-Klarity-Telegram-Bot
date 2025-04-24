/**
 * @module core/sessionTypes
 * @description Helper module to load and access session type configuration data.
 */

const fs = require("fs");
const path = require("path");

const SESSION_TYPES_PATH = path.join(__dirname, "../config/sessionTypes.json");

let sessionTypesCache = [];

/**
 * Loads session types from the JSON configuration file.
 * Includes basic error handling for file reading and parsing.
 * @private
 * @returns {Array<object>} An array of session type objects, or an empty array on error.
 */
function _loadSessionTypes() {
  try {
    const fileContent = fs.readFileSync(SESSION_TYPES_PATH, "utf-8");
    const data = JSON.parse(fileContent);
    // Basic validation to ensure it's an array
    if (!Array.isArray(data)) {
      console.error(
        `Error: Expected an array in ${SESSION_TYPES_PATH}, but got ${typeof data}`,
      );
      return [];
    }
    return data;
  } catch (error) {
    console.error(
      `Error loading session types from ${SESSION_TYPES_PATH}:`,
      error,
    );
    return [];
  }
}

// Load data on module initialization
sessionTypesCache = _loadSessionTypes();

/**
 * Retrieves all loaded session types.
 *
 * @returns {Array<object>} An array containing all session type objects.
 */
function getAll() {
  return sessionTypesCache;
}

/**
 * Finds a session type by its unique ID.
 *
 * @param {string} id - The unique identifier for the session type.
 * @returns {object | undefined} The session type object if found, otherwise undefined.
 */
function getById(id) {
  if (typeof id !== "string") {
    console.warn("getById called with non-string id:", id);
    return undefined;
  }
  return sessionTypesCache.find((session) => session.id === id);
}

module.exports = {
  getAll,
  getById,
};
