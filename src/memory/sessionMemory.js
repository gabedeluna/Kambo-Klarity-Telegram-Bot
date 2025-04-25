/**
 * Manages conversation memory instances for different chat sessions.
 * Uses LangChain's BufferMemory and stores instances in-memory.
 *
 * Note: This is a simple in-memory store suitable for development or single-instance deployments.
 * For production or scaled environments, consider a persistent store (e.g., Redis, database).
 * Memory instances are keyed by a unique sessionId (e.g., Telegram chat ID).
 */

const { BufferMemory } = require("langchain/memory");
// InputValues, OutputValues, StoredMessage are typically used when interacting
// directly with memory methods like saveContext, but BufferMemory handles this
// internally when used with chains/agents. They are not strictly needed here
// for basic get/clear operations, but good to be aware of.
// const { InputValues, OutputValues, StoredMessage } = require('@langchain/core/messages');
const logger = require("../core/logger");

/**
 * In-memory cache to store BufferMemory instances.
 * Keys are sessionIds, values are BufferMemory instances.
 * @type {Object.<string, BufferMemory>}
 */
const memoryCache = {};

/**
 * Retrieves or creates a BufferMemory instance for a given session ID.
 *
 * @param {string|number} sessionId - A unique identifier for the chat session (e.g., Telegram chat ID).
 * @returns {BufferMemory} The BufferMemory instance for the session.
 */
function getMemoryForSession(sessionId) {
  if (!sessionId) {
    logger.error("sessionId is required to get memory.");
    // Consider throwing an error or returning null depending on desired handling
    throw new Error("Session ID is required.");
  }

  const key = String(sessionId); // Ensure sessionId is a string key

  if (!memoryCache[key]) {
    logger.info({ sessionId: key }, "Creating new BufferMemory instance.");
    const newMemory = new BufferMemory({
      memoryKey: "chat_history", // Standard key used by LangChain components
      inputKey: "input", // Key for user input message in context
      outputKey: "output", // Key for AI output message in context
      returnMessages: true, // Return history as LangChain message objects
    });
    memoryCache[key] = newMemory;
  }

  return memoryCache[key];
}

/**
 * Clears the conversation memory for a specific session.
 *
 * @param {string|number} sessionId - The unique identifier for the session whose memory should be cleared.
 */
function clearMemoryForSession(sessionId) {
  const key = String(sessionId);
  if (memoryCache[key]) {
    delete memoryCache[key];
    logger.info({ sessionId: key }, "Cleared memory for session.");
  } else {
    logger.warn(
      { sessionId: key },
      "Attempted to clear memory for non-existent session.",
    );
  }
}

module.exports = {
  getMemoryForSession,
  clearMemoryForSession,
};
