/**
 * @file public/invite-friends/events.js
 * @description Event handling functions for invite-friends mini-app
 */

/**
 * Handle generate invite button click
 */
async function handleGenerateInviteClick() {
  const generateButton = document.getElementById("generateInviteButton");
  const buttonText = document.getElementById("generateButtonText");

  if (!generateButton || generateButton.disabled) return;

  // Disable button and show loading state
  generateButton.disabled = true;
  const originalText = buttonText ? buttonText.textContent : "";
  if (buttonText) {
    buttonText.innerHTML = '<div class="loading-spinner"></div>Generating...';
  }

  try {
    const currentSessionId = window.inviteFriendsCore.getCurrentSessionId();
    const currentTelegramId = window.inviteFriendsCore.getCurrentTelegramId();

    const response = await window.inviteFriendsCore.generateNewInviteToken(
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
        const botUsername = window.inviteFriendsCore.getBotUsername();
        const webAppName = window.inviteFriendsCore.getWebAppName();
        const newListItem = window.inviteFriendsUI.createInviteListItemDOM(
          response.data,
          botUsername,
          webAppName,
        );
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
        window.inviteFriendsUI.updateGenerateInviteButtonState();
      }
    }
  } catch (error) {
    console.error("Error generating invite:", error);
    const parentElement = generateButton.parentElement;
    if (parentElement) {
      window.inviteFriendsCore.displayInlineError(error.message, parentElement);
    }
  } finally {
    // Re-enable button if not at limit
    if (buttonText) buttonText.textContent = originalText;
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
  const buttonText = button?.querySelector?.(".button-text");

  if (!token || !button || !buttonText) return;

  try {
    const botUsername = window.inviteFriendsCore.getBotUsername();
    const webAppName = window.inviteFriendsCore.getWebAppName();
    const inviteLink = window.inviteFriendsUtils.constructStartAppLink(
      token,
      botUsername,
      webAppName,
    );

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

  const botUsername = window.inviteFriendsCore.getBotUsername();
  const webAppName = window.inviteFriendsCore.getWebAppName();
  const inviteLink = window.inviteFriendsUtils.constructStartAppLink(
    token,
    botUsername,
    webAppName,
  );

  if (!inviteLink) {
    console.error("Could not generate invite link for sharing");
    return;
  }

  const message = encodeURIComponent("Join me for a Kambo session!");
  const encodedLink = encodeURIComponent(inviteLink);
  const shareUrl = `https://t.me/share/url?url=${encodedLink}&text=${message}`;

  window.open(shareUrl, "_blank");

  // Update UI to show shared state
  window.inviteFriendsUtils.updateSharedInviteUI(inviteItem);
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
  const buttonText = button?.querySelector?.(".button-text");

  if (!token || !button || !buttonText) return;

  const botUsername = window.inviteFriendsCore.getBotUsername();
  const webAppName = window.inviteFriendsCore.getWebAppName();
  const inviteLink = window.inviteFriendsUtils.constructStartAppLink(
    token,
    botUsername,
    webAppName,
  );

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
      window.inviteFriendsUtils.updateSharedInviteUI(inviteItem);

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
 * Refresh invite statuses from the server
 */
async function refreshInviteStatuses() {
  try {
    const currentSessionId = window.inviteFriendsCore.getCurrentSessionId();
    const currentTelegramId = window.inviteFriendsCore.getCurrentTelegramId();

    if (currentSessionId && currentTelegramId) {
      window.inviteFriendsCore.showLoadingState();
      const data = await window.inviteFriendsCore.fetchInviteContext(
        currentSessionId,
        currentTelegramId,
      );
      window.inviteFriendsUI.renderInvitePage(data);
      window.inviteFriendsCore.hideLoadingState();
    }
  } catch (error) {
    console.error("Error refreshing invite statuses:", error);
    window.inviteFriendsCore.hideLoadingState();
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
  const currentInterval = window.inviteFriendsCore.getAutoRefreshInterval();
  if (currentInterval) {
    clearInterval(currentInterval);
  }

  const newInterval = setInterval(() => {
    refreshInviteStatuses();
  }, 30000); // 30 seconds

  window.inviteFriendsCore.setAutoRefreshInterval(newInterval);
}

// Export functions for testing and other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    handleGenerateInviteClick,
    handleCopyLinkClick,
    handleShareTelegramClick,
    handleShareNativeClick,
    refreshInviteStatuses,
    handlePageFocus,
    setupAutoRefresh,
    setupAutoRefreshTimer,
  };
}
