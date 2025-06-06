/**
 * @file public/invite-friends/utils.js
 * @description Utility functions for invite-friends mini-app
 */

/**
 * Construct a startapp link for an invite token
 * @param {string} token - Invite token
 * @param {string} botUsername - Bot username
 * @param {string} webAppName - WebApp name
 * @returns {string|null} Startapp link or null if config missing
 */
function constructStartAppLink(token, botUsername, webAppName) {
  if (!botUsername || !webAppName) {
    console.error("Bot configuration missing for startapp links");
    return null;
  }

  return `https://t.me/${botUsername}/${webAppName}?startapp=invite_${token}`;
}

/**
 * Construct a legacy link for an invite token
 * @param {string} token - Invite token
 * @param {string} botUsername - Bot username
 * @returns {string|null} Legacy link or null if config missing
 */
function constructLegacyLink(token, botUsername) {
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
 * Handle inline query share (Telegram rich sharing)
 * @param {string} token - Invite token
 * @param {string} botUsername - Bot username
 */
function handleInlineQueryShare(token, botUsername) {
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

// Export functions for testing and other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    constructStartAppLink,
    constructLegacyLink,
    formatInviteStatus,
    updateSharedInviteUI,
    handleInlineQueryShare,
    updateInviteStatusInDOM,
  };
}
