/**
 * Calendar App JavaScript
 * Main application logic and event handlers for Kambo Klarity booking system
 */

// Global variables
let telegramId = null;
let initialSessionTypeId = null;
let sessionDurationMinutes = null;
let availabilityData = {}; // Object mapping date strings to arrays of slot strings
let monthSlotData = {}; // Cache for all slots in the current month
let monthCache = new Map(); // Cache for month data with timestamps
const MONTH_CACHE_DURATION = 120000; // 2 minutes
let currentMonth = new Date().getMonth(); // 0-indexed
let currentYear = new Date().getFullYear();
let selectedDate = null;
let selectedTimeSlotISO = null;

// Make monthSlotData accessible globally for the calendar API
window.monthSlotData = monthSlotData;

function selectDate(date, dateString) {
  // Clear previous selection
  document.querySelectorAll(".calendar-day.selected").forEach((el) => {
    el.classList.remove("selected");
  });

  // Mark new selection
  const dayButton = document.querySelector(`[data-date="${dateString}"]`);
  if (dayButton) {
    dayButton.classList.add("selected");
  }

  // COMPLETELY reset all selection state first
  selectedDate = date;
  selectedTimeSlotISO = null;

  // Clear any existing time slot selections
  document.querySelectorAll(".time-slot-item.selected").forEach((el) => {
    el.classList.remove("selected");
  });

  // Show time picker and hide select date message
  document.getElementById("timePickerContainer").style.display = "block";
  document.getElementById("selectDateMessage").style.display = "none";

  // Show the booking info section and immediately update with final date info
  const bookingSummary = document.querySelector(".booking-summary");
  bookingSummary.style.display = "block";
  document.getElementById("selectedBookingInfo").style.visibility = "visible";

  // Get slots from cached month data
  const slots = getSlotsForDate(dateString);

  // Update booking info based on whether slots are available
  if (slots.length === 0) {
    // No slots available - show final message and keep button disabled
    const fullDayName = date.toLocaleDateString([], { weekday: "long" });
    const month = date.toLocaleDateString([], { month: "long" });
    const day = date.getDate();
    const year = date.getFullYear();
    document.getElementById("selectedBookingInfo").textContent =
      `${fullDayName}, ${month} ${day}, ${year} - No slots available`;

    // Keep submit button disabled for unavailable days
    const submitButton = document.getElementById("submitBookingButton");
    submitButton.disabled = true;
    submitButton.className =
      "btn-primary flex-1 h-12 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed";
    submitButton.querySelector("span").textContent = "Book";
  } else {
    // Slots available - show first available slot immediately and enable button
    const firstSlot = slots[0];
    updateBookingInfoWithTime(firstSlot);

    // Enable submit button only when slots are available
    const submitButton = document.getElementById("submitBookingButton");
    submitButton.disabled = false;
    submitButton.className = "btn-primary flex-1 h-12 text-base font-bold";
    submitButton.querySelector("span").textContent = "Book";
  }

  // Load and render time slots for selected date (async)
  loadAndRenderTimeSlotsForDate(dateString);
}

async function initializeApp() {
  try {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    telegramId = urlParams.get("telegramId");
    initialSessionTypeId = urlParams.get("sessionTypeId");

    console.log(
      "Calendar App Loaded. TG ID:",
      telegramId,
      "SessionTypeID:",
      initialSessionTypeId,
    );

    // Validate required parameters
    if (!telegramId || !initialSessionTypeId) {
      throw new Error(
        "Missing required booking information. Please start over from Telegram.",
      );
    }

    // Show loading animation immediately
    showLoadingAnimation();

    // Load session type details first
    const sessionType = await fetchSessionTypeDetails(initialSessionTypeId);

    // Update UI with session details
    document.getElementById("sessionTypeNamePlaceholder").textContent =
      `${sessionType.label}`;
    document.getElementById("sessionTypeDurationPlaceholder").textContent =
      `(${sessionType.durationMinutes} mins)`;
    sessionDurationMinutes = sessionType.durationMinutes;

    // Now load the month overview with availability indicators
    // This will replace the loading animation with the actual calendar
    await loadMonthOverview(currentYear, currentMonth);

    console.log("App initialization complete");
  } catch (error) {
    console.error("Initialization error:", error);
    hideLoadingAnimation();
    showError(
      error.message || "Failed to initialize calendar. Please try again.",
    );

    // Show back button if available
    const tg = window.Telegram?.WebApp;
    if (tg && tg.BackButton) {
      tg.BackButton.show();
      tg.BackButton.onClick(() => {
        console.log("Telegram BackButton clicked");
        tg.close();
      });
    }
  }
}

function setupEventListeners() {
  // Set up month navigation
  document
    .getElementById("prevMonthButton")
    .addEventListener("click", async () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }

      selectedDate = null;
      selectedTimeSlotISO = null;

      // Clear cached slot data for the new month
      monthSlotData = {};
      window.monthSlotData = monthSlotData;

      // Hide time picker and show select date message
      hideTimePickerAndShowMessage();

      // Reset UI state
      document.getElementById("selectedBookingInfo").textContent =
        "Select a date and time";
      resetButtonState();

      // Load month overview (will show loading animation if needed)
      await loadMonthOverview(currentYear, currentMonth);
    });

  document
    .getElementById("nextMonthButton")
    .addEventListener("click", async () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }

      selectedDate = null;
      selectedTimeSlotISO = null;

      // Clear cached slot data for the new month
      monthSlotData = {};
      window.monthSlotData = monthSlotData;

      // Hide time picker and show select date message
      hideTimePickerAndShowMessage();

      // Reset UI state
      document.getElementById("selectedBookingInfo").textContent =
        "Select a date and time";
      resetButtonState();

      // Load month overview (will show loading animation if needed)
      await loadMonthOverview(currentYear, currentMonth);
    });

  // Set up Telegram back button
  const tg = window.Telegram?.WebApp;
  if (tg && tg.BackButton) {
    tg.BackButton.show();
    tg.BackButton.onClick(() => {
      console.log("Telegram BackButton clicked");
      tg.close();
    });
  }

  // Set up cancel button with red effect
  const cancelButton = document.getElementById("cancelBookingButton");
  cancelButton.addEventListener("mousedown", () => {
    cancelButton.classList.add("cancel-pressed");
  });

  cancelButton.addEventListener("mouseup", () => {
    setTimeout(() => {
      cancelButton.classList.remove("cancel-pressed");
    }, 150);
  });

  cancelButton.addEventListener("mouseleave", () => {
    cancelButton.classList.remove("cancel-pressed");
  });

  cancelButton.addEventListener("click", () => {
    console.log("Cancel Booking Button clicked");
    if (tg) {
      tg.close();
    }
  });

  // Set up submit button with Feature 4: Two-step booking process
  document
    .getElementById("submitBookingButton")
    .addEventListener("click", async () => {
      if (!selectedTimeSlotISO || !selectedDate) {
        showError("Please select a date and time slot.");
        return;
      }

      const submitButton = document.getElementById("submitBookingButton");
      const originalText = submitButton.querySelector("span").textContent;

      // Show loading state
      submitButton.disabled = true;
      submitButton.className =
        "btn-primary flex-1 h-12 text-base font-bold opacity-75";
      submitButton.querySelector("span").textContent = "Reserving slot...";

      try {
        // Step 1: Create placeholder booking
        console.log("Step 1: Creating placeholder for:", {
          telegramId,
          sessionTypeId: initialSessionTypeId,
          appointmentDateTimeISO: selectedTimeSlotISO,
        });

        const placeholderResponse = await createGCalPlaceholder({
          telegramId,
          sessionTypeId: initialSessionTypeId,
          appointmentDateTimeISO: selectedTimeSlotISO,
        });

        if (
          !placeholderResponse.success ||
          !placeholderResponse.placeholderId ||
          !placeholderResponse.sessionTypeDetails
        ) {
          throw new Error(
            placeholderResponse.message || "Failed to reserve slot.",
          );
        }

        console.log("Step 1 completed: Placeholder created", {
          placeholderId: placeholderResponse.placeholderId,
          sessionTypeDetails: placeholderResponse.sessionTypeDetails,
        });

        // Update loading state
        submitButton.querySelector("span").textContent =
          "Preparing your booking...";

        // Step 2: Start booking flow
        console.log("Step 2: Starting booking flow");

        const flowStartResponse = await startPrimaryBookingFlow({
          telegramId,
          sessionTypeId: initialSessionTypeId,
          appointmentDateTimeISO: selectedTimeSlotISO,
          placeholderId: placeholderResponse.placeholderId,
          initialSessionTypeDetails: placeholderResponse.sessionTypeDetails,
        });

        if (!flowStartResponse.success || !flowStartResponse.nextStep) {
          // Attempt to clean up placeholder if flow start failed
          console.log("Step 2 failed: Attempting to cleanup placeholder");
          try {
            await deleteGCalPlaceholder(placeholderResponse.placeholderId);
            console.log("Placeholder cleanup successful");
          } catch (cleanupError) {
            console.error("Placeholder cleanup failed:", cleanupError);
          }
          throw new Error(
            flowStartResponse.message || "Failed to start booking process.",
          );
        }

        console.log("Step 2 completed: Flow started", {
          flowToken: flowStartResponse.flowToken,
          nextStep: flowStartResponse.nextStep,
        });

        // Handle the response from BookingFlowManager
        if (
          flowStartResponse.nextStep.type === "REDIRECT" &&
          flowStartResponse.nextStep.url
        ) {
          // Construct full URL if needed (assuming relative URL from API)
          const redirectUrl = flowStartResponse.nextStep.url.startsWith("http")
            ? flowStartResponse.nextStep.url
            : window.location.origin + flowStartResponse.nextStep.url;

          console.log("Redirecting to:", redirectUrl);
          window.location.href = redirectUrl;
        } else if (flowStartResponse.nextStep.type === "COMPLETE") {
          // Display completion message
          const message =
            flowStartResponse.nextStep.message ||
            "Booking confirmed! You will receive a confirmation message shortly.";

          // Show success message in the UI
          showSuccess(message);

          // Close WebApp if requested
          if (flowStartResponse.nextStep.closeWebApp) {
            const tg = window.Telegram?.WebApp;
            if (tg) {
              setTimeout(() => {
                console.log("Closing Telegram WebApp");
                tg.close();
              }, 3000); // Give user time to read the message
            }
          }
        } else {
          throw new Error("Invalid response from booking flow manager.");
        }
      } catch (error) {
        console.error("Booking submission error:", error);

        // Determine appropriate error message
        let errorMessage = "Could not complete your booking. Please try again.";
        if (
          error.message.includes("slot") &&
          error.message.includes("available")
        ) {
          errorMessage =
            "This time slot was just booked by someone else. Please select another time.";

          // Refresh the month data and day's slots with fresh API data
          const dateString = getDateString(selectedDate);
          try {
            await refreshMonthDataAndSlots(dateString);
          } catch (refreshError) {
            console.error("Error refreshing slot data:", refreshError);
          }
        } else if (
          error.message.includes("reserve") ||
          error.message.includes("placeholder")
        ) {
          errorMessage =
            "Could not reserve the slot. The time may have just been taken. Please try again.";
        }

        showError(errorMessage);

        // Reset button state
        submitButton.disabled = false;
        submitButton.className = "btn-primary flex-1 h-12 text-base font-bold";
        submitButton.querySelector("span").textContent = originalText;
      }
    });
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Initialize the app
  initializeApp();

  // Set up event listeners
  setupEventListeners();
});
