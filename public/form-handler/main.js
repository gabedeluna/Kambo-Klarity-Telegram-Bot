/**
 * @file public/form-handler/main.js
 * @description Main orchestrator for form handler modules
 */

// Initialize Telegram WebApp
if (typeof Telegram !== "undefined" && Telegram.WebApp) {
  Telegram.WebApp.ready();
}

/**
 * Pre-fill user data from API
 * @param {string} telegramId - User's Telegram ID
 */
async function prefillUserData(telegramId) {
  if (!telegramId) return;

  try {
    const response = await fetch(`/api/users/${telegramId}/data`);
    if (!response.ok) return;

    const userData = await response.json();
    if (!userData.success || !userData.data) return;

    const user = userData.data;

    // Pre-fill form fields
    const fieldMappings = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      dob: user.dob,
    };

    Object.entries(fieldMappings).forEach(([fieldId, value]) => {
      const field = document.getElementById(fieldId);
      if (field && value) {
        field.value = value;
      }
    });

    console.log("[FormHandler] Pre-filled user data for:", user.firstName);
  } catch (error) {
    console.warn("[FormHandler] Could not pre-fill user data:", error);
  }
}

/**
 * Initialize signature pad for digital signatures
 */
function initializeSignaturePad() {
  const canvas = document.getElementById("signatureCanvas");
  const clearButton = document.getElementById("clearSignature");

  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  // Set up canvas
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  function startDrawing(e) {
    isDrawing = true;
    [lastX, lastY] = getEventPos(e);
  }

  function draw(e) {
    if (!isDrawing) return;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    const [currentX, currentY] = getEventPos(e);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();
    [lastX, lastY] = [currentX, currentY];

    // Update hidden signature field
    const signatureField = document.getElementById("signature");
    if (signatureField) {
      signatureField.value = canvas.toDataURL();
    }
  }

  function stopDrawing() {
    isDrawing = false;
  }

  function getEventPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    return [clientX - rect.left, clientY - rect.top];
  }

  // Mouse events
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseout", stopDrawing);

  // Touch events
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    startDrawing(e);
  });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    draw(e);
  });
  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    stopDrawing();
  });

  // Clear button
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const signatureField = document.getElementById("signature");
      if (signatureField) {
        signatureField.value = "";
      }
    });
  }

  console.log("[FormHandler] Initialized signature pad");
}

/**
 * Collect form data for submission
 * @returns {object} Form data object
 */
function collectFormData() {
  const stepData = {};

  // List of form field IDs to collect
  const fieldIds = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "dob",
    "emergencyFirstName",
    "emergencyLastName",
    "emergencyPhone",
    "signature",
  ];

  // Collect basic form fields
  fieldIds.forEach((fieldId) => {
    const element = document.getElementById(fieldId);
    if (element && element.value) {
      stepData[fieldId] = element.value;
    }
  });

  // Collect confirmation checkboxes
  const confirmationFields = [
    "avoidAgreement",
    "substanceAgreement",
    "liabilityAgreement",
    "electronicSignature",
  ];
  confirmationFields.forEach((fieldId) => {
    const element = document.getElementById(fieldId);
    if (element) {
      stepData[fieldId] = element.checked;
    }
  });

  // Collect contraindications with descriptions
  const contraindications = [];
  document
    .querySelectorAll('input[name="contraindications"]')
    .forEach((checkbox) => {
      const label = checkbox.closest("li").textContent.trim();
      contraindications.push({
        description: label,
        checked: checkbox.checked,
      });
    });
  stepData.contraindications = contraindications;

  // Collect substance agreements with descriptions
  const substanceAgreements = [];
  document.querySelectorAll(".substance-check").forEach((checkbox) => {
    const row = checkbox.closest("tr");
    if (row) {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 3) {
        substanceAgreements.push({
          substance: cells[0].textContent.trim(),
          prior: cells[1].textContent.trim(),
          post: cells[2].textContent.trim(),
          checked: checkbox.checked,
        });
      }
    }
  });
  stepData.substanceAgreements = substanceAgreements;

  // Get flow control fields
  const flowToken = document.getElementById("flowToken")?.value;
  const telegramId = document.getElementById("telegramId")?.value;
  const sessionTypeId = document.getElementById("sessionTypeId")?.value;
  const appointmentDateTimeISO = document.getElementById(
    "appointmentDateTimeISO",
  )?.value;
  const placeholderId = document.getElementById("placeholderId")?.value;
  const inviteToken = document.getElementById("inviteToken")?.value;

  return {
    flowToken: flowToken,
    telegramId: telegramId,
    stepId: "waiver_submission",
    stepData: stepData,
    sessionTypeId: sessionTypeId,
    appointmentDateTimeISO: appointmentDateTimeISO,
    placeholderId: placeholderId,
    inviteToken: inviteToken,
  };
}

/**
 * Handle form submission
 * @param {Event} event - Form submit event
 * @param {object} params - URL parameters
 */
async function handleFormSubmit(event, params) {
  event.preventDefault();

  // Validate form
  if (!window.formHandlerValidation.validateForm()) {
    return;
  }

  // Disable submit button and show loading
  const submitButton = document.getElementById("submitButton");
  const submitButtonText = document.getElementById("submitButtonText");
  const submitSpinner = document.getElementById("submitSpinner");
  const loadingIndicator = document.getElementById("loadingIndicator");

  if (submitButton) {
    submitButton.disabled = true;
  }
  if (submitButtonText) {
    submitButtonText.textContent = "Submitting...";
  }
  if (submitSpinner) {
    submitSpinner.classList.remove("hidden");
  }
  if (loadingIndicator) {
    loadingIndicator.classList.remove("hidden");
  }

  try {
    // For primary bookers, check slot availability first
    if (params.placeholderId) {
      const slotAvailable =
        await window.formHandlerCore.checkSlotAvailability(params);
      if (!slotAvailable) {
        window.formHandlerUI.showError(
          "Sorry, the selected slot is no longer available. Please return to the calendar and choose a new time.",
        );
        return;
      }
    }

    // Collect and submit form data
    const formData = collectFormData();

    const response = await fetch("/api/booking-flow/continue", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      const result = await response.json();
      handleSubmissionResponse(result);
    } else {
      const errorData = await response.json();
      window.formHandlerUI.showError(
        errorData.message || "An error occurred while submitting the form.",
      );
    }
  } catch (error) {
    console.error("Error submitting form:", error);
    window.formHandlerUI.showError(
      "An error occurred while submitting the form. Please try again.",
    );
  } finally {
    // Re-enable submit button
    if (submitButton) {
      submitButton.disabled = false;
    }
    if (submitButtonText) {
      submitButtonText.textContent = "Submit Form";
    }
    if (submitSpinner) {
      submitSpinner.classList.add("hidden");
    }
    if (loadingIndicator) {
      loadingIndicator.classList.add("hidden");
    }
  }
}

/**
 * Handle submission response from booking flow API
 * @param {object} response - API response
 */
function handleSubmissionResponse(response) {
  if (response.success) {
    // Hide back button
    if (typeof Telegram !== "undefined" && Telegram.WebApp) {
      Telegram.WebApp.BackButton.hide();
    }

    if (response.nextStep.type === "REDIRECT") {
      window.location.href = response.nextStep.url;
    } else if (response.nextStep.type === "COMPLETE") {
      // Show completion message
      window.formHandlerUI.showSuccess(
        response.nextStep.message || "Form submitted successfully!",
      );

      // Close WebApp after delay if specified
      if (response.nextStep.closeWebApp) {
        setTimeout(() => {
          if (typeof Telegram !== "undefined" && Telegram.WebApp) {
            Telegram.WebApp.close();
          }
        }, 2000);
      }
    }
  } else {
    window.formHandlerUI.showError(
      response.message || "An error occurred while processing your submission.",
    );
  }
}

/**
 * Handle StartApp invite flow initialization
 * @param {string} inviteToken - The invite token from startapp parameter
 */
async function handleStartAppInviteFlow(inviteToken) {
  try {
    window.formHandlerUI.showLoadingSpinner("Loading invitation details...");

    // Fetch invitation context from the new API endpoint
    const response = await fetch(`/api/invite-context/${inviteToken}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      window.formHandlerUI.showError(
        data.message || "Failed to load invitation. Please try again.",
      );
      return;
    }

    // Initialize friend invitation form with the fetched data
    await initializeInviteFriendForm(data.data);
  } catch (error) {
    console.error("Error handling startapp invite flow:", error);
    window.formHandlerUI.showError(
      "Failed to load invitation. Please try again.",
    );
  } finally {
    window.formHandlerUI.hideLoadingSpinner();
  }
}

/**
 * Initialize form for friend invitation flow
 * @param {object} inviteData - Data from invite context API
 */
async function initializeInviteFriendForm(inviteData) {
  try {
    // Extract session and flow configuration
    const {
      sessionDetails,
      flowConfiguration,
      inviteToken,
      sessionTypeId,
      appointmentDateTimeISO,
    } = inviteData;

    // Set URL params for friend flow
    const urlParams = {
      formType: flowConfiguration.formType || "KAMBO_WAIVER_FRIEND_V1",
      telegramId: null, // Will be set by user data API
      sessionTypeId: sessionTypeId,
      appointmentDateTimeISO: appointmentDateTimeISO,
      inviteToken: inviteToken,
      flowToken: null, // StartApp flow doesn't use flow tokens
    };

    window.formHandlerCore.setUrlParams(urlParams);

    // Populate hidden form fields
    const sessionTypeIdField = document.getElementById("sessionTypeId");
    const appointmentDateTimeField = document.getElementById(
      "appointmentDateTimeISO",
    );
    const inviteTokenField = document.getElementById("inviteToken");

    if (sessionTypeIdField) sessionTypeIdField.value = sessionTypeId;
    if (appointmentDateTimeField)
      appointmentDateTimeField.value = appointmentDateTimeISO;
    if (inviteTokenField) inviteTokenField.value = inviteToken;

    // Initialize static content with session details
    await window.formHandlerUI.initializeStaticContent(
      urlParams,
      sessionDetails,
    );

    // Initialize dynamic form for friend waiver
    const formInitialized = await window.formHandlerUI.initializeDynamicForm(
      urlParams.formType,
    );
    if (!formInitialized) {
      return;
    }

    // Setup friend-specific UI
    window.formHandlerUI.setupFriendInvitationUI(sessionDetails);

    // Show form and hide loading
    const loadingIndicator = document.getElementById("loadingIndicator");
    const form =
      document.getElementById("waiverForm") ||
      document.getElementById("genericForm");

    if (loadingIndicator) {
      loadingIndicator.classList.add("hidden");
    }
    if (form) {
      form.classList.remove("hidden");
    }

    // Setup form submission for friend flow
    if (form) {
      form.addEventListener("submit", (event) => {
        handleFormSubmit(event, urlParams);
      });
    }

    // Enable submit button
    const submitButton = document.getElementById("submitButton");
    if (submitButton) {
      submitButton.disabled = false;
    }
  } catch (error) {
    console.error("Error initializing friend invitation form:", error);
    window.formHandlerUI.showError(
      "An error occurred while loading the invitation form.",
    );
  }
}

/**
 * Main initialization function
 */
async function initializeFormHandler() {
  try {
    // Check for StartApp invite flow first
    if (
      typeof Telegram !== "undefined" &&
      Telegram.WebApp &&
      Telegram.WebApp.initDataUnsafe
    ) {
      const startParam = Telegram.WebApp.initDataUnsafe.start_param;
      if (startParam && startParam.startsWith("invite_")) {
        const inviteToken = startParam.replace("invite_", "");
        await handleStartAppInviteFlow(inviteToken);
        return; // Exit early as we're handling a different flow
      }
    }

    // Parse URL parameters
    const urlParams = window.formHandlerCore.parseUrlParameters();
    window.formHandlerCore.setUrlParams(urlParams);

    // Validate critical parameters
    if (
      !urlParams.flowToken ||
      !urlParams.formType ||
      !urlParams.telegramId ||
      !urlParams.sessionTypeId ||
      !urlParams.appointmentDateTimeISO
    ) {
      window.formHandlerUI.showError(
        "Missing required parameters. Please return to the calendar and try again.",
      );
      return;
    }

    // Populate hidden fields if they exist
    const flowTokenField = document.getElementById("flowToken");
    const telegramIdField = document.getElementById("telegramId");
    const sessionTypeIdField = document.getElementById("sessionTypeId");
    const appointmentDateTimeField = document.getElementById(
      "appointmentDateTimeISO",
    );
    const placeholderIdField = document.getElementById("placeholderId");
    const inviteTokenField = document.getElementById("inviteToken");

    if (flowTokenField) flowTokenField.value = urlParams.flowToken;
    if (telegramIdField) telegramIdField.value = urlParams.telegramId;
    if (sessionTypeIdField) sessionTypeIdField.value = urlParams.sessionTypeId;
    if (appointmentDateTimeField)
      appointmentDateTimeField.value = urlParams.appointmentDateTimeISO;
    if (placeholderIdField && urlParams.placeholderId)
      placeholderIdField.value = urlParams.placeholderId;
    if (inviteTokenField && urlParams.inviteToken)
      inviteTokenField.value = urlParams.inviteToken;

    // Initialize static content
    await window.formHandlerUI.initializeStaticContent(urlParams);

    // Initialize dynamic form
    const formInitialized = await window.formHandlerUI.initializeDynamicForm(
      urlParams.formType,
    );
    if (!formInitialized) {
      return;
    }

    // Pre-fill user data
    await prefillUserData(urlParams.telegramId);

    // Setup conditional UI
    window.formHandlerUI.setupConditionalUI(urlParams);

    // Initialize signature pad
    initializeSignaturePad();

    // Show form and hide loading
    const loadingIndicator = document.getElementById("loadingIndicator");
    const form =
      document.getElementById("waiverForm") ||
      document.getElementById("genericForm");

    if (loadingIndicator) {
      loadingIndicator.classList.add("hidden");
    }
    if (form) {
      form.classList.remove("hidden");
    }

    // Setup form submission
    if (form) {
      form.addEventListener("submit", (event) => {
        handleFormSubmit(event, urlParams);
      });
    }

    // Enable submit button
    const submitButton = document.getElementById("submitButton");
    if (submitButton) {
      submitButton.disabled = false;
    }
  } catch (error) {
    console.error("Error initializing form handler:", error);
    window.formHandlerUI.showError(
      "An error occurred while loading the form. Please try again.",
    );
  }
}

// Initialize when DOM is loaded (only if not in test environment)
if (typeof module === "undefined" || !module.exports) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeFormHandler);
  } else {
    initializeFormHandler();
  }
}

// Export functions for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    prefillUserData,
    initializeSignaturePad,
    collectFormData,
    handleFormSubmit,
    handleSubmissionResponse,
    handleStartAppInviteFlow,
    initializeInviteFriendForm,
    initializeFormHandler,
  };
}
