/**
 * @file public/invite-friends/ui.js
 * @description UI rendering and manipulation functions for invite-friends mini-app
 */

/**
 * Create a DOM element for an invite list item
 * @param {object} invite - Invite data object
 * @param {string} botUsername - Bot username for links
 * @param {string} webAppName - WebApp name for links
 * @returns {HTMLElement} List item element
 */
function createInviteListItemDOM(invite, botUsername, webAppName) {
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
    const statusText = window.inviteFriendsUtils.formatInviteStatus(
      invite.status,
      invite.friendName,
    );
    statusElement.textContent = statusText;
    statusElement.className = `invite-status ${invite.status || "pending"}`;
  }

  // Set invite link
  const linkElement = listItem.querySelector("[data-invite-link]");
  if (linkElement) {
    const inviteLink = window.inviteFriendsUtils.constructStartAppLink(
      invite.token,
      botUsername,
      webAppName,
    );
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
    const maxInvitesAllowed = window.inviteFriendsCore.getMaxInvitesAllowed();
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
    window.inviteFriendsCore.displayPageError("Invalid response from server");
    return;
  }

  const data = apiData.data;
  window.inviteFriendsCore.setMaxInvitesAllowed(data.maxInvites || 0);

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
  const remainingInvites =
    window.inviteFriendsCore.getMaxInvitesAllowed() - existingInvites.length;

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

      const botUsername = window.inviteFriendsCore.getBotUsername();
      const webAppName = window.inviteFriendsCore.getWebAppName();

      existingInvites.forEach((invite) => {
        const listItem = createInviteListItemDOM(
          invite,
          botUsername,
          webAppName,
        );
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

// Export functions for testing and other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    createInviteListItemDOM,
    updateGenerateInviteButtonState,
    renderInvitePage,
  };
}
