/**
 * @file public/invite-friends/core.js
 * @description Core functionality and state management for invite-friends mini-app
 */

// Global variables
let urlParams = {};
let maxInvitesAllowed = 0;
let botUsername = null;
let webAppName = null;
let currentSessionId = null;
let currentTelegramId = null;
let autoRefreshInterval = null;

// Initialize Telegram WebApp
if (typeof Telegram !== "undefined" && Telegram.WebApp) {
  Telegram.WebApp.ready();
}

/**
 * Parse URL parameters from the current page
 * @returns {object} Parsed parameters
 */
function parseUrlParameters() {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const params = {};

    // Required parameters
    params.sessionId = searchParams.get("sessionId") || null;
    params.telegramId = searchParams.get("telegramId") || null;

    // Optional parameters
    params.flowToken = searchParams.get("flowToken") || null;
    params.maxGroupSize = searchParams.get("maxGroupSize") || null;

    return params;
  } catch (error) {
    console.error("Error parsing URL parameters:", error);
    return {};
  }
}

/**
 * Validate required URL parameters
 * @param {object} params - Parsed URL parameters
 * @returns {boolean} True if valid, false otherwise
 */
function validateRequiredParameters(params) {
  if (!params.sessionId || !params.telegramId) {
    displayPageError("Invalid link. Missing required parameters.");
    return false;
  }
  return true;
}

/**
 * Fetch configuration from the backend
 * @returns {Promise<object>} Configuration data
 */
async function fetchConfiguration() {
  try {
    const response = await fetch("/api/config");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch configuration");
    }

    return data.data;
  } catch (error) {
    console.error("Error fetching configuration:", error);
    // Fallback configuration
    return {
      botUsername: null,
      webAppName: "kambo",
    };
  }
}

/**
 * Fetch invite context data from the API
 * @param {string} sessionId - Session ID
 * @param {string} telegramId - User's Telegram ID
 * @returns {Promise<object>} API response data
 */
async function fetchInviteContext(sessionId, telegramId) {
  const response = await fetch(
    `/api/sessions/${sessionId}/invite-context?telegramId=${telegramId}`,
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch invite context");
  }

  return await response.json();
}

/**
 * Generate a new invite token
 * @param {string} sessionId - Session ID
 * @param {string} telegramId - User's Telegram ID
 * @returns {Promise<object>} API response data
 */
async function generateNewInviteToken(sessionId, telegramId) {
  const response = await fetch(
    `/api/sessions/${sessionId}/generate-invite-token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ telegramId }),
    },
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to generate invite token");
  }

  return await response.json();
}

/**
 * Show loading state
 */
function showLoadingState() {
  const loadingIndicator = document.getElementById("loadingIndicator");
  const mainContent = document.getElementById("mainContent");
  const errorContainer = document.getElementById("errorContainer");

  if (loadingIndicator) loadingIndicator.style.display = "block";
  if (mainContent) mainContent.style.display = "none";
  if (errorContainer) errorContainer.style.display = "none";
}

/**
 * Hide loading state
 */
function hideLoadingState() {
  const loadingIndicator = document.getElementById("loadingIndicator");
  if (loadingIndicator) loadingIndicator.style.display = "none";
}

/**
 * Display a page-level error
 * @param {string} message - Error message to display
 */
function displayPageError(message) {
  const errorContainer = document.getElementById("errorContainer");
  const errorMessage = document.getElementById("errorMessage");
  const mainContent = document.getElementById("mainContent");
  const loadingIndicator = document.getElementById("loadingIndicator");

  if (errorContainer) errorContainer.style.display = "block";
  if (errorMessage) errorMessage.textContent = message;
  if (mainContent) mainContent.style.display = "none";
  if (loadingIndicator) loadingIndicator.style.display = "none";
}

/**
 * Display an inline error near a specific element
 * @param {string} message - Error message
 * @param {HTMLElement} targetElement - Element to show error near
 */
function displayInlineError(message, targetElement) {
  if (!targetElement) return;

  // Remove any existing inline errors
  const existingError = targetElement.querySelector(".inline-error");
  if (existingError) {
    existingError.remove();
  }

  // Create new error element
  const errorElement = document.createElement("div");
  errorElement.className = "alert alert-error inline-error mt-2";
  errorElement.textContent = message;

  targetElement.appendChild(errorElement);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (errorElement.parentElement) {
      errorElement.remove();
    }
  }, 5000);
}

// Export functions for testing and other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    // State variables
    getUrlParams: () => urlParams,
    setUrlParams: (params) => {
      urlParams = params;
    },
    getMaxInvitesAllowed: () => maxInvitesAllowed,
    setMaxInvitesAllowed: (max) => {
      maxInvitesAllowed = max;
    },
    getBotUsername: () => botUsername,
    setBotUsername: (username) => {
      botUsername = username;
    },
    getWebAppName: () => webAppName,
    setWebAppName: (name) => {
      webAppName = name;
    },
    getCurrentSessionId: () => currentSessionId,
    setCurrentSessionId: (id) => {
      currentSessionId = id;
    },
    getCurrentTelegramId: () => currentTelegramId,
    setCurrentTelegramId: (id) => {
      currentTelegramId = id;
    },
    getAutoRefreshInterval: () => autoRefreshInterval,
    setAutoRefreshInterval: (interval) => {
      autoRefreshInterval = interval;
    },

    // Functions
    parseUrlParameters,
    validateRequiredParameters,
    fetchConfiguration,
    fetchInviteContext,
    generateNewInviteToken,
    showLoadingState,
    hideLoadingState,
    displayPageError,
    displayInlineError,
  };
}
