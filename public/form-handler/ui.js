/**
 * @file public/form-handler/ui.js
 * @description UI management functions for form handler
 */

/**
 * Initialize static content (appointment info, session type)
 * @param {object} params - URL parameters
 */
async function initializeStaticContent(params) {
  try {
    // Fetch session type details
    const sessionTypeResponse = await fetch(
      `/api/session-types/${params.sessionTypeId}`,
    );
    if (sessionTypeResponse.ok) {
      const sessionTypeData = await sessionTypeResponse.json();
      if (sessionTypeData.success) {
        document.getElementById("sessionType").textContent =
          sessionTypeData.data.label;
      }
    }

    // Format and display appointment date/time
    if (params.appointmentDateTimeISO) {
      const appointmentDate = new Date(params.appointmentDateTimeISO);
      const formattedDateTime = appointmentDate.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
      document.getElementById("appointmentDateTime").textContent =
        formattedDateTime;
    }

    // Show appointment info
    document.getElementById("appointmentInfo").classList.remove("hidden");
  } catch (error) {
    console.error("Error initializing static content:", error);
  }
}

/**
 * Initialize dynamic form based on form type
 * @param {string} formType - Type of form to render
 */
async function initializeDynamicForm(formType) {
  const errorDisplay = document.getElementById("errorDisplay");
  const errorMessage = document.getElementById("errorMessage");

  // Handle various Kambo waiver types
  if (
    formType === "KAMBO_WAIVER_V1" ||
    formType === "KAMBO_WAIVER_FRIEND_V1" ||
    formType === "KAMBO_V1" ||
    formType === "KAMBO_FRIEND_V1"
  ) {
    try {
      // Load Kambo waiver content dynamically
      const response = await fetch("/forms/kambo-waiver-content.html");
      if (!response.ok) {
        throw new Error(`Failed to load waiver content: ${response.status}`);
      }

      const waiverContent = await response.text();
      const kamboWaiverSection = document.getElementById("kamboWaiverSection");

      if (kamboWaiverSection) {
        kamboWaiverSection.innerHTML = waiverContent;
        kamboWaiverSection.style.display = "block";
      }

      document.getElementById("formTitle").textContent =
        "Kambo Preparation, Contra-Indications & Liability Form";

      console.log(
        "[FormHandler] Initialized Kambo waiver form for type:",
        formType,
      );
      return true;
    } catch (error) {
      console.error(
        "[FormHandler] Failed to load Kambo waiver content:",
        error,
      );
      errorMessage.textContent = `Failed to load waiver form: ${error.message}`;
      errorDisplay.classList.remove("hidden");
      return false;
    }
  } else {
    // Unsupported form type
    console.error("[FormHandler] Unsupported form type:", formType);
    errorMessage.textContent = `Unsupported form type: ${formType}`;
    errorDisplay.classList.remove("hidden");
    return false;
  }
}

/**
 * Setup conditional UI based on form parameters
 * @param {object} params - URL parameters
 */
function setupConditionalUI(params) {
  // Show/hide conditional elements based on form type or parameters
  if (params.inviteToken) {
    // This is a friend invitation flow
    const pageTitle = document.querySelector("h1");
    if (pageTitle) {
      pageTitle.textContent = "Complete Waiver - Friend Invitation";
    }

    // Update submit button text
    const submitButton = document.getElementById("submitButton");
    if (submitButton) {
      submitButton.innerHTML = `
        <span id="submitSpinner" class="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin hidden"></span>
        <span id="submitButtonText">Join Session</span>
      `;
    }
  } else {
    // Primary booker flow
    const submitButton = document.getElementById("submitButton");
    if (submitButton) {
      submitButton.innerHTML = `
        <span id="submitSpinner" class="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin hidden"></span>
        <span id="submitButtonText">Complete Booking</span>
      `;
    }
  }

  // Add Telegram WebApp back button handling
  if (typeof Telegram !== "undefined" && Telegram.WebApp) {
    Telegram.WebApp.BackButton.show();
    Telegram.WebApp.BackButton.onClick(() => {
      handleBackButton(params);
    });
  }
}

/**
 * Handle back button navigation
 * @param {object} params - URL parameters
 */
async function handleBackButton(params) {
  try {
    // Delete placeholder if it exists (primary booker flow)
    if (params.placeholderId) {
      await fetch("/api/booking-flow/delete-placeholder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeholderId: params.placeholderId }),
      });
    }

    // Navigate back to calendar
    const calendarUrl = `calendar-app.html?telegramId=${params.telegramId}&initialSessionTypeId=${params.sessionTypeId}`;
    window.location.href = calendarUrl;
  } catch (error) {
    console.error("Error handling back button:", error);
    // Still navigate back even if placeholder deletion fails
    if (typeof Telegram !== "undefined" && Telegram.WebApp) {
      Telegram.WebApp.close();
    }
  }
}

/**
 * Display error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  const errorDisplay = document.getElementById("errorDisplay");
  const errorMessage = document.getElementById("errorMessage");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const submitButton = document.getElementById("submitButton");
  const submitButtonText = document.getElementById("submitButtonText");
  const submitSpinner = document.getElementById("submitSpinner");

  if (errorMessage) {
    errorMessage.textContent = message;
  }
  if (errorDisplay) {
    errorDisplay.classList.remove("hidden");
  }
  if (loadingIndicator) {
    loadingIndicator.classList.add("hidden");
  }
  if (submitButton) {
    submitButton.disabled = false;
  }
  if (submitButtonText) {
    submitButtonText.textContent = "Submit";
  }
  if (submitSpinner) {
    submitSpinner.classList.add("hidden");
  }
}

/**
 * Display success message
 * @param {string} message - Success message to display
 */
function showSuccess(message) {
  const successDisplay = document.getElementById("successDisplay");
  const successMessage = document.getElementById("successMessage");
  const loadingIndicator = document.getElementById("loadingIndicator");

  if (successMessage) {
    successMessage.textContent = message;
  }
  if (successDisplay) {
    successDisplay.classList.remove("hidden");
  }
  if (loadingIndicator) {
    loadingIndicator.classList.add("hidden");
  }
}

/**
 * Setup UI specific to friend invitation flow
 * @param {object} sessionDetails - Session details from invite context
 */
function setupFriendInvitationUI(sessionDetails) {
  // Update page title/header for friend invitation
  const pageTitle = document.querySelector("h1, .page-title");
  if (pageTitle) {
    pageTitle.textContent = "Complete Your Waiver - Friend Invitation";
  }

  // Show session details for context
  const sessionInfo =
    document.getElementById("sessionInfoDisplay") ||
    document.createElement("div");
  if (sessionDetails) {
    sessionInfo.innerHTML = `
      <div class="session-context bg-blue-50 p-4 rounded-lg mb-4">
        <h3 class="font-semibold text-blue-900">You've been invited to join:</h3>
        <p class="text-blue-800">${sessionDetails.sessionTypeLabel}</p>
        <p class="text-blue-700 text-sm">${sessionDetails.formattedDateTime}</p>
      </div>
    `;

    // Insert at the beginning of form container
    const formContainer =
      document.getElementById("formContainer") ||
      document.querySelector(".form-container");
    if (formContainer && !document.getElementById("sessionInfoDisplay")) {
      sessionInfo.id = "sessionInfoDisplay";
      formContainer.insertBefore(sessionInfo, formContainer.firstChild);
    }
  }

  // Show friend-specific messaging
  const submitButton = document.getElementById("submitButton");
  if (submitButton) {
    submitButton.textContent = "Complete Waiver & Join Session";
  }
}

/**
 * Show loading spinner with custom message
 * @param {string} message - Loading message
 */
function showLoadingSpinner(message) {
  const loadingIndicator = document.getElementById("loadingIndicator");
  const loadingMessage = document.getElementById("loadingMessage");

  if (loadingMessage) {
    loadingMessage.textContent = message;
  }
  if (loadingIndicator) {
    loadingIndicator.classList.remove("hidden");
  }
}

/**
 * Hide loading spinner
 */
function hideLoadingSpinner() {
  const loadingIndicator = document.getElementById("loadingIndicator");
  if (loadingIndicator) {
    loadingIndicator.classList.add("hidden");
  }
}

// Export functions for testing and other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    initializeStaticContent,
    initializeDynamicForm,
    setupConditionalUI,
    handleBackButton,
    showError,
    showSuccess,
    setupFriendInvitationUI,
    showLoadingSpinner,
    hideLoadingSpinner,
  };
} else {
  window.formHandlerUI = {
    initializeStaticContent,
    initializeDynamicForm,
    setupConditionalUI,
    handleBackButton,
    showError,
    showSuccess,
    setupFriendInvitationUI,
    showLoadingSpinner,
    hideLoadingSpinner,
  };
}
