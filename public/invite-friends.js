/**
 * @file public/invite-friends.js
 * @description Core functionality for the invite-friends mini-app
 * Handles friend invitation management for group Kambo sessions
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
 * Construct a startapp link for an invite token
 * @param {string} token - Invite token
 * @returns {string|null} Startapp link or null if config missing
 */
function constructStartAppLink(token) {
  if (!botUsername || !webAppName) {
    console.error("Bot configuration missing for startapp links");
    return null;
  }

  return `https://t.me/${botUsername}/${webAppName}?startapp=invite_${token}`;
}

/**
 * Construct a legacy link for an invite token
 * @param {string} token - Invite token
 * @returns {string|null} Legacy link or null if config missing
 */
function constructLegacyLink(token) {
  if (!botUsername) {
    console.error("Bot username missing for legacy links");
    return null;
  }

  return `https://t.me/${botUsername}?start=invite_${token}`;
}

/**
 * Format invite status for display
 * @param {string} status - Raw status from API
 * @param {string|null} friendName - Friend's name if available
 * @returns {string} Formatted status text
 */
function formatInviteStatus(status, friendName = null) {
  switch (status) {
    case "pending":
      return "Pending";
    case "waiver_completed_by_friend":
      return friendName
        ? `Waiver Completed by ${friendName}`
        : "Waiver Completed";
    case "declined":
      return "Declined";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

/**
 * Create a DOM element for an invite list item
 * @param {object} invite - Invite data object
 * @returns {HTMLElement} List item element
 */
function createInviteListItemDOM(invite) {
  const template = document.getElementById("inviteItemTemplate");
  if (!template) {
    console.error("Invite item template not found");
    return document.createElement("li");
  }

  const listItem = template.content.cloneNode(true).querySelector("li");

  // Set data attributes
  listItem.dataset.token = invite.token || "";
  listItem.dataset.status = invite.status || "pending";

  // Set status display
  const statusElement = listItem.querySelector("[data-status-display]");
  if (statusElement) {
    const statusText = formatInviteStatus(invite.status, invite.friendName);
    statusElement.textContent = statusText;
    statusElement.className = `invite-status ${invite.status || "pending"}`;
  }

  // Set invite link
  const linkElement = listItem.querySelector("[data-invite-link]");
  if (linkElement) {
    const inviteLink = constructStartAppLink(invite.token);
    linkElement.textContent = inviteLink || "Link unavailable";
  }

  // Set friend name if available
  const friendNameElement = listItem.querySelector("[data-friend-name]");
  const friendInfoElement = listItem.querySelector(".friend-info");
  if (invite.friendName && friendNameElement && friendInfoElement) {
    friendNameElement.textContent = invite.friendName;
    friendInfoElement.style.display = "block";
  }

  // Set timestamps
  const createdAtElement = listItem.querySelector("[data-created-at]");
  if (createdAtElement && invite.createdAt) {
    const date = new Date(invite.createdAt);
    createdAtElement.textContent = date.toLocaleDateString();
  }

  // Show/hide native share button based on availability
  const nativeShareButton = listItem.querySelector(".share-native-button");
  if (nativeShareButton && navigator.share) {
    nativeShareButton.style.display = "inline-block";
  }

  // Disable actions for non-pending invites
  if (invite.status !== "pending") {
    const actionButtons = listItem.querySelectorAll(".invite-actions button");
    actionButtons.forEach((button) => {
      if (!button.classList.contains("share-native-button")) {
        button.disabled = true;
        button.classList.add("opacity-50");
      }
    });
  }

  return listItem;
}

/**
 * Update the generate invite button state
 * @param {number} remainingInvites - Number of remaining invites allowed
 */
function updateGenerateInviteButtonState(remainingInvites = null) {
  const generateButton = document.getElementById("generateInviteButton");
  if (!generateButton) return;

  if (remainingInvites === null) {
    // Calculate from current state
    const existingInvites = document.querySelectorAll(".invite-item").length;
    remainingInvites = maxInvitesAllowed - existingInvites;
  }

  const buttonText = generateButton.querySelector("#generateButtonText");

  if (remainingInvites <= 0) {
    generateButton.disabled = true;
    if (buttonText) buttonText.textContent = "Invite Limit Reached";
  } else {
    generateButton.disabled = false;
    if (buttonText) buttonText.textContent = "Generate New Invite Link";
  }
}

/**
 * Render the main invite page content
 * @param {object} apiData - Data from the invite context API
 */
function renderInvitePage(apiData) {
  if (!apiData.success || !apiData.data) {
    displayPageError("Invalid response from server");
    return;
  }

  const data = apiData.data;
  maxInvitesAllowed = data.maxInvites || 0;

  // Update session info display
  const sessionTypeLabel = document.getElementById("sessionTypeLabel");
  const sessionDateTime = document.getElementById("sessionDateTime");

  if (sessionTypeLabel && data.sessionDetails) {
    sessionTypeLabel.textContent =
      data.sessionDetails.sessionTypeLabel || "Kambo Session";
  }

  if (sessionDateTime && data.sessionDetails) {
    sessionDateTime.textContent = data.sessionDetails.formattedDateTime || "";
  }

  // Calculate remaining invites
  const existingInvites = data.existingInvites || [];
  const remainingInvites = maxInvitesAllowed - existingInvites.length;

  // Update invite summary
  const remainingCountElement = document.getElementById(
    "remainingInvitesCount",
  );
  if (remainingCountElement) {
    remainingCountElement.textContent = remainingInvites.toString();
  }

  // Clear and populate invites list
  const invitesContainer = document.getElementById(
    "existingInvitesListContainer",
  );
  const emptyState = document.getElementById("emptyInvitesState");

  if (invitesContainer) {
    invitesContainer.innerHTML = "";

    if (existingInvites.length === 0) {
      if (emptyState) emptyState.style.display = "block";
    } else {
      if (emptyState) emptyState.style.display = "none";

      existingInvites.forEach((invite) => {
        const listItem = createInviteListItemDOM(invite);
        invitesContainer.appendChild(listItem);
      });
    }
  }

  // Update button states
  updateGenerateInviteButtonState(remainingInvites);

  // Show main content
  const mainContent = document.getElementById("mainContent");
  if (mainContent) {
    mainContent.style.display = "block";
  }
}

/**
 * Handle generate invite button click
 */
async function handleGenerateInviteClick() {
  const generateButton = document.getElementById("generateInviteButton");
  const buttonText = document.getElementById("generateButtonText");

  if (!generateButton || generateButton.disabled) return;

  // Disable button and show loading state
  generateButton.disabled = true;
  const originalText = buttonText.textContent;
  buttonText.innerHTML = '<div class="loading-spinner"></div>Generating...';

  try {
    const response = await generateNewInviteToken(
      currentSessionId,
      currentTelegramId,
    );

    if (response.success && response.data) {
      // Add new invite to the DOM
      const invitesContainer = document.getElementById(
        "existingInvitesListContainer",
      );
      const emptyState = document.getElementById("emptyInvitesState");

      if (invitesContainer) {
        const newListItem = createInviteListItemDOM(response.data);
        invitesContainer.appendChild(newListItem);

        // Hide empty state
        if (emptyState) emptyState.style.display = "none";

        // Update remaining count
        const remainingCountElement = document.getElementById(
          "remainingInvitesCount",
        );
        if (remainingCountElement) {
          const current = parseInt(remainingCountElement.textContent) || 0;
          remainingCountElement.textContent = Math.max(
            0,
            current - 1,
          ).toString();
        }

        // Update button state
        updateGenerateInviteButtonState();
      }
    }
  } catch (error) {
    console.error("Error generating invite:", error);
    displayInlineError(error.message, generateButton.parentElement);
  } finally {
    // Re-enable button if not at limit
    buttonText.textContent = originalText;
    const remainingCount =
      parseInt(document.getElementById("remainingInvitesCount")?.textContent) ||
      0;
    if (remainingCount > 0) {
      generateButton.disabled = false;
    }
  }
}

/**
 * Handle copy link button click
 * @param {Event} event - Click event
 */
async function handleCopyLinkClick(event) {
  const inviteItem = event.target.closest(".invite-item");
  if (!inviteItem) return;

  const token = inviteItem.dataset.token;
  const button = event.target.closest(".copy-link-button");
  const buttonText = button.querySelector(".button-text");

  if (!token || !button || !buttonText) return;

  try {
    const inviteLink = constructStartAppLink(token);
    if (!inviteLink) {
      throw new Error("Could not generate invite link");
    }

    await navigator.clipboard.writeText(inviteLink);

    // Show success feedback
    const originalText = buttonText.textContent;
    buttonText.textContent = "Link Copied ✔️";
    button.classList.add("success");

    setTimeout(() => {
      buttonText.textContent = originalText;
      button.classList.remove("success");
    }, 2000);
  } catch (error) {
    console.error("Error copying link:", error);
    // Fallback: try to select text for manual copy
    try {
      const linkElement = inviteItem.querySelector("[data-invite-link]");
      if (linkElement) {
        const range = document.createRange();
        range.selectNode(linkElement);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      }
    } catch (fallbackError) {
      console.error("Fallback copy also failed:", fallbackError);
    }
  }
}

/**
 * Handle share on Telegram button click
 * @param {Event} event - Click event
 */
function handleShareTelegramClick(event) {
  const inviteItem = event.target.closest(".invite-item");
  if (!inviteItem) return;

  const token = inviteItem.dataset.token;
  if (!token) return;

  const inviteLink = constructStartAppLink(token);
  if (!inviteLink) {
    console.error("Could not generate invite link for sharing");
    return;
  }

  const message = encodeURIComponent("Join me for a Kambo session!");
  const encodedLink = encodeURIComponent(inviteLink);
  const shareUrl = `https://t.me/share/url?url=${encodedLink}&text=${message}`;

  window.open(shareUrl, "_blank");

  // Update UI to show shared state
  updateSharedInviteUI(inviteItem);
}

/**
 * Handle native share API button click
 * @param {Event} event - Click event
 */
async function handleShareNativeClick(event) {
  const inviteItem = event.target.closest(".invite-item");
  if (!inviteItem) return;

  const token = inviteItem.dataset.token;
  const button = event.target.closest(".share-native-button");
  const buttonText = button.querySelector(".button-text");

  if (!token || !button || !buttonText) return;

  const inviteLink = constructStartAppLink(token);
  if (!inviteLink) {
    console.error("Could not generate invite link for sharing");
    return;
  }

  const shareData = {
    title: "Kambo Session Invite",
    text: "Join my Kambo session!",
    url: inviteLink,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);

      // Show success feedback
      const originalText = buttonText.textContent;
      buttonText.textContent = "Shared ✔️";
      button.classList.add("success");

      // Update UI to show shared state
      updateSharedInviteUI(inviteItem);

      setTimeout(() => {
        buttonText.textContent = originalText;
        button.classList.remove("success");
      }, 2000);
    } else {
      // Fallback to copy
      await handleCopyLinkClick(event);
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Error sharing:", error);
      // Fallback to copy
      await handleCopyLinkClick(event);
    }
  }
}

/**
 * Handle inline query share (Telegram rich sharing)
 * @param {string} token - Invite token
 */
function handleInlineQueryShare(token) {
  if (!botUsername) {
    console.error("Bot username not available for inline query");
    return;
  }

  const queryText = `kbinvite_${token}`;

  if (
    window.Telegram &&
    window.Telegram.WebApp &&
    window.Telegram.WebApp.switchInlineQuery
  ) {
    window.Telegram.WebApp.switchInlineQuery(`@${botUsername}`, queryText);
  } else {
    console.error("Telegram inline query not available");
  }
}

/**
 * Update UI to show shared state for an invite
 * @param {HTMLElement} inviteElement - Invite list item element
 */
function updateSharedInviteUI(inviteElement) {
  if (!inviteElement) return;

  inviteElement.classList.add("shared");

  // Disable share buttons
  const shareButtons = inviteElement.querySelectorAll(".invite-actions button");
  shareButtons.forEach((button) => {
    if (!button.classList.contains("copy-link-button")) {
      button.disabled = true;
      button.classList.add("opacity-50");
    }
  });

  // Move to top of list (optional enhancement)
  const container = inviteElement.parentElement;
  if (container && container.firstChild !== inviteElement) {
    container.insertBefore(inviteElement, container.firstChild);
  }
}

/**
 * Update invite status in DOM
 * @param {string} token - Invite token
 * @param {string} newStatus - New status
 * @param {string|null} friendName - Friend name if available
 */
function updateInviteStatusInDOM(token, newStatus, friendName = null) {
  const inviteItem = document.querySelector(`[data-token="${token}"]`);
  if (!inviteItem) return;

  // Update status display
  const statusElement = inviteItem.querySelector("[data-status-display]");
  if (statusElement) {
    statusElement.textContent = formatInviteStatus(newStatus, friendName);
    statusElement.className = `invite-status ${newStatus}`;
  }

  // Update friend info if provided
  if (friendName) {
    const friendNameElement = inviteItem.querySelector("[data-friend-name]");
    const friendInfoElement = inviteItem.querySelector(".friend-info");
    if (friendNameElement && friendInfoElement) {
      friendNameElement.textContent = friendName;
      friendInfoElement.style.display = "block";
    }
  }

  // Update data attribute
  inviteItem.dataset.status = newStatus;
}

/**
 * Refresh invite statuses from the server
 */
async function refreshInviteStatuses() {
  try {
    await loadInviteDataAndRenderPage();
  } catch (error) {
    console.error("Error refreshing invite statuses:", error);
  }
}

/**
 * Handle page focus event for auto-refresh
 */
async function handlePageFocus() {
  if (document.visibilityState === "visible") {
    await refreshInviteStatuses();
  }
}

/**
 * Setup auto-refresh functionality
 */
function setupAutoRefresh() {
  // Listen for page visibility changes
  document.addEventListener("visibilitychange", handlePageFocus);

  // Setup periodic refresh (optional)
  setupAutoRefreshTimer();
}

/**
 * Setup auto-refresh timer (every 30 seconds)
 */
function setupAutoRefreshTimer() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }

  autoRefreshInterval = setInterval(() => {
    refreshInviteStatuses();
  }, 30000); // 30 seconds
}

/**
 * Load invite data and render the page
 */
async function loadInviteDataAndRenderPage() {
  showLoadingState();

  try {
    const data = await fetchInviteContext(currentSessionId, currentTelegramId);
    renderInvitePage(data);
  } catch (error) {
    console.error("Error loading invite data:", error);
    displayPageError("Could not load invite details. Please try again.");
  } finally {
    hideLoadingState();
  }
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

/**
 * Initialize the invite friends page
 */
async function initializePage() {
  // Parse URL parameters
  urlParams = parseUrlParameters();

  if (!validateRequiredParameters(urlParams)) {
    return;
  }

  // Store current values
  currentSessionId = urlParams.sessionId;
  currentTelegramId = urlParams.telegramId;

  // Fetch configuration
  const config = await fetchConfiguration();
  botUsername = config.botUsername;
  webAppName = config.webAppName;

  // Setup event listeners
  setupEventListeners();

  // Setup auto-refresh
  setupAutoRefresh();

  // Load initial data
  await loadInviteDataAndRenderPage();
}

/**
 * Setup event listeners for the page
 */
function setupEventListeners() {
  // Generate invite button
  const generateButton = document.getElementById("generateInviteButton");
  if (generateButton) {
    generateButton.addEventListener("click", handleGenerateInviteClick);
  }

  // Refresh button
  const refreshButton = document.getElementById("refreshStatusesButton");
  if (refreshButton) {
    refreshButton.addEventListener("click", refreshInviteStatuses);
  }

  // Done button
  const doneButton = document.getElementById("doneButton");
  if (doneButton) {
    doneButton.addEventListener("click", () => {
      if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.close();
      }
    });
  }

  // Close button
  const closeButton = document.getElementById("closeButton");
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.close();
      }
    });
  }

  // Event delegation for dynamic invite action buttons
  const invitesContainer = document.getElementById(
    "existingInvitesListContainer",
  );
  if (invitesContainer) {
    invitesContainer.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;

      switch (action) {
        case "copy":
          handleCopyLinkClick(event);
          break;
        case "share-telegram":
          handleShareTelegramClick(event);
          break;
        case "share-native":
          handleShareNativeClick(event);
          break;
        case "share-inline": {
          const inviteItem = event.target.closest(".invite-item");
          if (inviteItem) {
            handleInlineQueryShare(inviteItem.dataset.token);
            updateSharedInviteUI(inviteItem);
          }
          break;
        }
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePage);
} else {
  initializePage();
}

// Export functions for testing (if in test environment)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseUrlParameters,
    validateRequiredParameters,
    fetchInviteContext,
    generateNewInviteToken,
    constructStartAppLink,
    constructLegacyLink,
    formatInviteStatus,
    createInviteListItemDOM,
    updateGenerateInviteButtonState,
    renderInvitePage,
    handleGenerateInviteClick,
    handleCopyLinkClick,
    handleShareTelegramClick,
    handleShareNativeClick,
    handleInlineQueryShare,
    updateInviteStatusInDOM,
    refreshInviteStatuses,
    handlePageFocus,
    setupAutoRefresh,
    setupAutoRefreshTimer,
    loadInviteDataAndRenderPage,
    showLoadingState,
    hideLoadingState,
    displayPageError,
    displayInlineError,
    updateSharedInviteUI,
  };
}
