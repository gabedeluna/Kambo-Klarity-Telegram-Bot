/**
 * @file public/form-handler.js
 * @description Generic form handler for dynamic form rendering and processing
 */

// Global variables
let urlParams = {};
let countdownInterval = null;
let signaturePad = null;

// Initialize Telegram WebApp
if (typeof Telegram !== "undefined" && Telegram.WebApp) {
  Telegram.WebApp.ready();
}

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

  // Mouse events
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseout", stopDrawing);

  // Touch events for mobile
  canvas.addEventListener("touchstart", handleTouch);
  canvas.addEventListener("touchmove", handleTouch);
  canvas.addEventListener("touchend", stopDrawing);

  function startDrawing(e) {
    isDrawing = true;
    [lastX, lastY] = getCoordinates(e);
  }

  function draw(e) {
    if (!isDrawing) return;

    const [currentX, currentY] = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    [lastX, lastY] = [currentX, currentY];

    // Update hidden field with signature data
    document.getElementById("signature").value = canvas.toDataURL();
  }

  function stopDrawing() {
    isDrawing = false;
  }

  function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(
      e.type === "touchstart"
        ? "mousedown"
        : e.type === "touchmove"
          ? "mousemove"
          : "mouseup",
      {
        clientX: touch.clientX,
        clientY: touch.clientY,
      },
    );
    canvas.dispatchEvent(mouseEvent);
  }

  function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
  }

  // Clear signature button
  clearButton.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById("signature").value = "";
  });
}

/**
 * Pre-fill user data from API
 * @param {string} telegramId - User's Telegram ID
 */
async function prefillUserData(telegramId) {
  try {
    const response = await fetch(`/api/user-data?telegramId=${telegramId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        const userData = data.data;

        // Pre-fill form fields
        const fieldMapping = {
          firstName: "firstName",
          lastName: "lastName",
          email: "email",
          phone: "phoneNumber", // API returns phoneNumber, form expects phone
          dob: "dateOfBirth", // API returns dateOfBirth, form expects dob
          emergencyFirstName: "emergencyContactFirstName", // API returns emergencyContactFirstName
          emergencyLastName: "emergencyContactLastName", // API returns emergencyContactLastName
          emergencyPhone: "emergencyContactPhone", // API returns emergencyContactPhone
        };

        Object.keys(fieldMapping).forEach((formField) => {
          const apiField = fieldMapping[formField];
          const element = document.getElementById(formField);
          if (element && userData[apiField]) {
            element.value = userData[apiField];
          }
        });
      }
    }
  } catch (error) {
    console.error("Error pre-filling user data:", error);
    // Don't show error to user, just log it
  }
}

/**
 * Setup conditional UI based on user type (primary booker vs friend)
 * @param {object} params - URL parameters
 */
function setupConditionalUI(params) {
  const reservationTimer = document.getElementById("reservationTimer");
  const guestNotice = document.getElementById("guestNotice");
  const guestNoticeText = document.getElementById("guestNoticeText");

  // Show Telegram back button
  if (typeof Telegram !== "undefined" && Telegram.WebApp) {
    Telegram.WebApp.BackButton.show();
  }

  if (params.inviteToken) {
    // Friend flow
    reservationTimer.style.display = "none";

    if (params.primaryBookerName) {
      guestNoticeText.textContent = `Invited by ${params.primaryBookerName}`;
      guestNotice.classList.remove("hidden");
    }

    // Setup back button for friend
    if (typeof Telegram !== "undefined" && Telegram.WebApp) {
      Telegram.WebApp.BackButton.onClick(() => {
        Telegram.WebApp.close();
      });
    }
  } else {
    // Primary booker flow
    guestNotice.style.display = "none";

    if (params.placeholderId && params.expiresAt) {
      // Show reservation timer
      reservationTimer.style.display = "block";
      setupReservationTimer(params.expiresAt);
    }

    // Setup back button for primary booker
    if (typeof Telegram !== "undefined" && Telegram.WebApp) {
      Telegram.WebApp.BackButton.onClick(() => {
        handleBackButtonPrimaryBooker(params);
      });
    }
  }
}

/**
 * Setup reservation countdown timer for primary bookers
 * @param {string} expiresAt - ISO timestamp when reservation expires
 */
function setupReservationTimer(expiresAt) {
  const expiryTime = new Date(expiresAt);
  const expiryTimeElement = document.getElementById("expiryTime");
  const countdownElement = document.getElementById("countdownTimer");

  if (expiryTimeElement) {
    expiryTimeElement.textContent = expiryTime.toLocaleTimeString();
  }

  if (countdownElement) {
    countdownInterval = setInterval(() => {
      const now = new Date();
      const timeLeft = expiryTime - now;

      if (timeLeft <= 0) {
        countdownElement.textContent = "EXPIRED";
        clearInterval(countdownInterval);
        return;
      }

      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);
      countdownElement.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }, 1000);
  }
}

/**
 * Handle back button click for primary booker
 * @param {object} params - URL parameters
 */
async function handleBackButtonPrimaryBooker(params) {
  try {
    // Show loading
    document.body.classList.add("loading");

    // Delete placeholder if it exists
    if (params.placeholderId) {
      await fetch(`/api/gcal-placeholder-bookings/${params.placeholderId}`, {
        method: "DELETE",
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
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if email is valid
 */
function validateEmail(email) {
  if (!email || typeof email !== "string") {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate form fields
 * @returns {boolean} True if form is valid
 */
function validateForm() {
  let isValid = true;
  const errorMessage = document.getElementById("errorMessage");
  const errorDisplay = document.getElementById("errorDisplay");

  // Clear previous errors
  if (errorDisplay) {
    errorDisplay.classList.add("hidden");
  }
  if (errorMessage) {
    errorMessage.textContent = "";
  }

  document.querySelectorAll(".error-outline").forEach((el) => {
    el.classList.remove("error-outline");
  });
  document.querySelectorAll(".error-message.visible").forEach((el) => {
    el.classList.remove("visible");
  });

  // Get all required fields
  const requiredFields =
    document.querySelectorAll(
      "#waiverForm [required], #genericForm [required]",
    ) || [];

  // Check each required field
  for (const field of requiredFields) {
    const errorElement = document.getElementById(`${field.id}-error`);
    let fieldValid = true;
    let errorMsg = "";

    if (field.type === "checkbox") {
      if (!field.checked) {
        fieldValid = false;
        errorMsg = "This field is required";
      }
    } else if (field.type === "email") {
      if (!field.value.trim()) {
        fieldValid = false;
        errorMsg = "Email is required";
      } else if (!validateEmail(field.value)) {
        fieldValid = false;
        errorMsg = "Please enter a valid email address";
      }
    } else if (field.type === "hidden" && field.id === "signature") {
      if (!field.value) {
        fieldValid = false;
        errorMsg = "Please provide your digital signature";
      }
    } else {
      if (!field.value.trim()) {
        fieldValid = false;
        errorMsg = "This field is required";
      }
    }

    if (!fieldValid) {
      isValid = false;
      field.classList.add("error-outline");
      if (errorElement) {
        errorElement.textContent = errorMsg;
        errorElement.classList.add("visible");
      }

      // Show general error message
      if (errorMessage) {
        if (
          field.type === "email" &&
          field.value.trim() &&
          !validateEmail(field.value)
        ) {
          errorMessage.textContent = "Please enter a valid email address";
        } else if (field.type === "hidden" && field.id === "signature") {
          errorMessage.textContent = "Please provide your digital signature";
        } else {
          errorMessage.textContent = "Please fill in all required fields";
        }
      }
      if (errorDisplay) {
        errorDisplay.classList.remove("hidden");
      }

      // Focus on first invalid field
      if (field.focus) {
        field.focus();
      }
      break; // Stop at first error for cleaner UX
    }
  }

  return isValid;
}

/**
 * Check slot availability for primary bookers
 * @param {object} params - URL parameters
 * @returns {Promise<boolean>} True if slot is available
 */
async function checkSlotAvailability(params) {
  try {
    const response = await fetch("/api/slot-check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        placeholderId: params.placeholderId,
        appointmentDateTimeISO: params.appointmentDateTimeISO,
        sessionTypeId: params.sessionTypeId,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.success && data.status === "AVAILABLE";
    }

    return false;
  } catch (error) {
    console.error("Error checking slot availability:", error);
    return false;
  }
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
  if (!validateForm()) {
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
      const slotAvailable = await checkSlotAvailability(params);
      if (!slotAvailable) {
        showError(
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
      showError(
        errorData.message || "An error occurred while submitting the form.",
      );
    }
  } catch (error) {
    console.error("Error submitting form:", error);
    showError("An error occurred while submitting the form. Please try again.");
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
      showSuccess(response.nextStep.message || "Form submitted successfully!");

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
    showError(
      response.message || "An error occurred while processing your submission.",
    );
  }
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
  const errorDisplay = document.getElementById("errorDisplay");
  const errorMessage = document.getElementById("errorMessage");
  const submitButton = document.getElementById("submitButton");

  if (errorMessage) {
    errorMessage.textContent = message;
  }
  if (errorDisplay) {
    errorDisplay.classList.remove("hidden");
  }
  if (submitButton) {
    submitButton.disabled = false;
  }

  // Scroll to error if element exists
  if (errorDisplay) {
    errorDisplay.scrollIntoView({ behavior: "smooth" });
  }
}

/**
 * Show success message
 * @param {string} message - Success message
 */
function showSuccess(message) {
  const successMessage = document.getElementById("successMessage");
  const form =
    document.getElementById("waiverForm") ||
    document.getElementById("genericForm");
  const loadingIndicator =
    document.getElementById("loadingIndicator") ||
    document.getElementById("loadingSpinner");

  if (successMessage) {
    successMessage.textContent = message;
    successMessage.classList.remove("hidden");
  }

  if (form) {
    form.classList.add("hidden");
  }

  if (loadingIndicator) {
    loadingIndicator.innerHTML = `
      <div class="text-center">
        <div class="text-6xl mb-4">✅</div>
        <h2 class="text-2xl font-bold mb-4">Success!</h2>
        <p class="text-lg">${message}</p>
      </div>
    `;
    loadingIndicator.classList.remove("hidden");
  }
}

/**
 * Main initialization function
 */
async function initializeFormHandler() {
  try {
    // Parse URL parameters
    urlParams = parseUrlParameters();

    // Validate critical parameters
    if (
      !urlParams.flowToken ||
      !urlParams.formType ||
      !urlParams.telegramId ||
      !urlParams.sessionTypeId ||
      !urlParams.appointmentDateTimeISO
    ) {
      showError(
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
    await initializeStaticContent(urlParams);

    // Initialize dynamic form
    const formInitialized = await initializeDynamicForm(urlParams.formType);
    if (!formInitialized) {
      return;
    }

    // Pre-fill user data
    await prefillUserData(urlParams.telegramId);

    // Setup conditional UI
    setupConditionalUI(urlParams);

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
    showError("An error occurred while loading the form. Please try again.");
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
    parseUrlParameters,
    initializeStaticContent,
    initializeDynamicForm,
    prefillUserData,
    setupConditionalUI,
    validateEmail,
    validateForm,
    handleFormSubmit,
    handleSubmissionResponse,
    checkSlotAvailability,
    collectFormData,
    showError,
    showSuccess,
    initializeFormHandler,
  };
}
