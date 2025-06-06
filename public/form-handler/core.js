/**
 * @file public/form-handler/core.js
 * @description Core functionality for form handler
 */

// State management
let urlParams = {};
let countdownInterval = null;
let signaturePad = null;

/**
 * Parse URL parameters from the current page
 * @returns {object} Parsed parameters
 */
function parseUrlParameters() {
  const searchParams = new URLSearchParams(window.location.search);
  const params = {};

  // Required parameters
  params.flowToken = searchParams.get("flowToken");
  params.formType = searchParams.get("formType");
  params.telegramId = searchParams.get("telegramId");
  params.sessionTypeId = searchParams.get("sessionTypeId");
  params.appointmentDateTimeISO = searchParams.get("appointmentDateTimeISO");

  // If we have a flowToken but missing required parameters, try to extract them from the token
  if (
    params.flowToken &&
    (!params.telegramId ||
      !params.sessionTypeId ||
      !params.appointmentDateTimeISO)
  ) {
    try {
      // Decode the JWT token to extract flow state
      const tokenParts = params.flowToken.split(".");
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));

        // Extract missing parameters from flow state
        if (!params.telegramId && payload.userId) {
          params.telegramId = payload.userId.toString();
        }
        if (!params.sessionTypeId && payload.sessionTypeId) {
          params.sessionTypeId = payload.sessionTypeId;
        }
        if (!params.appointmentDateTimeISO && payload.appointmentDateTimeISO) {
          params.appointmentDateTimeISO = payload.appointmentDateTimeISO;
        }
        if (!params.placeholderId && payload.placeholderId) {
          params.placeholderId = payload.placeholderId;
        }
        if (!params.inviteToken && payload.inviteToken) {
          params.inviteToken = payload.inviteToken;
        }

        console.log("[FormHandler] Extracted parameters from flowToken:", {
          telegramId: params.telegramId,
          sessionTypeId: params.sessionTypeId,
          appointmentDateTimeISO: params.appointmentDateTimeISO,
        });
      }
    } catch (error) {
      console.warn("[FormHandler] Failed to decode flowToken:", error);
    }
  }

  // Optional parameters
  if (!params.placeholderId)
    params.placeholderId = searchParams.get("placeholderId");
  if (!params.inviteToken) params.inviteToken = searchParams.get("inviteToken");
  params.primaryBookerName = searchParams.get("primaryBookerName");
  params.waiverType = searchParams.get("waiverType");
  params.allowsGroupInvites = searchParams.get("allowsGroupInvites") === "true";
  params.maxGroupSize = parseInt(searchParams.get("maxGroupSize")) || 1;
  params.expiresAt = searchParams.get("expiresAt");

  return params;
}

/**
 * Check slot availability before form submission
 * @param {object} params - URL parameters
 * @returns {Promise<boolean>} Slot availability status
 */
async function checkSlotAvailability(params) {
  if (!params.appointmentDateTimeISO) {
    console.warn("[FormHandler] No appointment date provided for slot check");
    return true; // Allow submission if no date to check
  }

  try {
    const response = await fetch("/api/booking-flow/check-slot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentDateTimeISO: params.appointmentDateTimeISO,
        placeholderId: params.placeholderId,
      }),
    });

    if (!response.ok) {
      console.error(
        "[FormHandler] Slot availability check failed:",
        response.status,
      );
      return false;
    }

    const result = await response.json();
    return result.success && result.data.isAvailable;
  } catch (error) {
    console.error("[FormHandler] Error checking slot availability:", error);
    return false;
  }
}

/**
 * State getters and setters
 */
function getUrlParams() {
  return urlParams;
}

function setUrlParams(params) {
  urlParams = params;
}

function getCountdownInterval() {
  return countdownInterval;
}

function setCountdownInterval(interval) {
  countdownInterval = interval;
}

function getSignaturePad() {
  return signaturePad;
}

function setSignaturePad(pad) {
  signaturePad = pad;
}

// Export functions for testing and other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseUrlParameters,
    checkSlotAvailability,
    getUrlParams,
    setUrlParams,
    getCountdownInterval,
    setCountdownInterval,
    getSignaturePad,
    setSignaturePad,
  };
} else {
  window.formHandlerCore = {
    parseUrlParameters,
    checkSlotAvailability,
    getUrlParams,
    setUrlParams,
    getCountdownInterval,
    setCountdownInterval,
    getSignaturePad,
    setSignaturePad,
  };
}
