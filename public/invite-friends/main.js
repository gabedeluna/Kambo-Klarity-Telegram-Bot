/**
 * @file public/invite-friends/main.js
 * @description Main initialization and orchestration for invite-friends mini-app
 */

/**
 * Load invite data and render the page
 */
async function loadInviteDataAndRenderPage() {
  window.inviteFriendsCore.showLoadingState();

  try {
    const currentSessionId = window.inviteFriendsCore.getCurrentSessionId();
    const currentTelegramId = window.inviteFriendsCore.getCurrentTelegramId();
    const data = await window.inviteFriendsCore.fetchInviteContext(
      currentSessionId,
      currentTelegramId,
    );
    window.inviteFriendsUI.renderInvitePage(data);
  } catch (error) {
    console.error("Error loading invite data:", error);
    window.inviteFriendsCore.displayPageError(
      "Could not load invite details. Please try again.",
    );
  } finally {
    window.inviteFriendsCore.hideLoadingState();
  }
}

/**
 * Setup event listeners for the page
 */
function setupEventListeners() {
  // Generate invite button
  const generateButton = document.getElementById("generateInviteButton");
  if (generateButton) {
    generateButton.addEventListener(
      "click",
      window.inviteFriendsEvents.handleGenerateInviteClick,
    );
  }

  // Refresh button
  const refreshButton = document.getElementById("refreshStatusesButton");
  if (refreshButton) {
    refreshButton.addEventListener(
      "click",
      window.inviteFriendsEvents.refreshInviteStatuses,
    );
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
          window.inviteFriendsEvents.handleCopyLinkClick(event);
          break;
        case "share-telegram":
          window.inviteFriendsEvents.handleShareTelegramClick(event);
          break;
        case "share-native":
          window.inviteFriendsEvents.handleShareNativeClick(event);
          break;
        case "share-inline": {
          const inviteItem = event.target.closest(".invite-item");
          if (inviteItem) {
            const botUsername = window.inviteFriendsCore.getBotUsername();
            window.inviteFriendsUtils.handleInlineQueryShare(
              inviteItem.dataset.token,
              botUsername,
            );
            window.inviteFriendsUtils.updateSharedInviteUI(inviteItem);
          }
          break;
        }
      }
    });
  }
}

/**
 * Initialize the invite friends page
 */
async function initializePage() {
  // Parse URL parameters
  const urlParams = window.inviteFriendsCore.parseUrlParameters();
  window.inviteFriendsCore.setUrlParams(urlParams);

  if (!window.inviteFriendsCore.validateRequiredParameters(urlParams)) {
    return;
  }

  // Store current values
  window.inviteFriendsCore.setCurrentSessionId(urlParams.sessionId);
  window.inviteFriendsCore.setCurrentTelegramId(urlParams.telegramId);

  // Fetch configuration
  const config = await window.inviteFriendsCore.fetchConfiguration();
  window.inviteFriendsCore.setBotUsername(config.botUsername);
  window.inviteFriendsCore.setWebAppName(config.webAppName);

  // Setup event listeners
  setupEventListeners();

  // Setup auto-refresh
  window.inviteFriendsEvents.setupAutoRefresh();

  // Load initial data
  await loadInviteDataAndRenderPage();
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePage);
} else {
  initializePage();
}

// Export functions for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    loadInviteDataAndRenderPage,
    setupEventListeners,
    initializePage,
  };
}
