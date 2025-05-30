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

  // Set up submit button with final validation
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
      submitButton.querySelector("span").textContent = "Validating...";

      try {
        // Final validation check
        console.log(
          "Performing final slot validation for:",
          selectedTimeSlotISO,
        );
        const isStillAvailable = await validateSlotAvailability(
          selectedTimeSlotISO,
          sessionDurationMinutes,
        );

        if (isStillAvailable) {
          // Slot is still available - proceed with booking
          console.log("Final validation passed. Submit booking:", {
            telegramId,
            sessionTypeId: initialSessionTypeId,
            selectedSlot: selectedTimeSlotISO,
          });

          // PH6-15: Transition to waiver form with booking context
          submitButton.querySelector("span").textContent = "Proceeding...";

          // Validate required parameters before transition
          if (telegramId && initialSessionTypeId && selectedTimeSlotISO) {
            const waiverFormUrl = `waiver-form.html?telegramId=${telegramId}&sessionTypeId=${initialSessionTypeId}&appointmentDateTimeISO=${selectedTimeSlotISO}`;

            console.log(
              "Transitioning to waiver form with URL:",
              waiverFormUrl,
            );

            // Navigate to waiver form
            window.location.href = waiverFormUrl;
          } else {
            // This case should ideally be prevented by disabling button if data is missing
            showError("Critical information missing. Cannot proceed.");
            console.error("Missing data for waiver form transition:", {
              telegramId,
              initialSessionTypeId,
              selectedTimeSlotISO,
            });

            // Reset button state
            submitButton.disabled = false;
            submitButton.className =
              "btn-primary flex-1 h-12 text-base font-bold";
            submitButton.querySelector("span").textContent = originalText;
          }
        } else {
          // Slot is no longer available
          showError(
            "This time slot was just booked by someone else. Please select another time.",
          );

          // Reset button state
          submitButton.disabled = false;
          submitButton.className =
            "btn-primary flex-1 h-12 text-base font-bold";
          submitButton.querySelector("span").textContent = originalText;

          // Refresh the month data and day's slots with fresh API data
          const dateString = getDateString(selectedDate);
          await refreshMonthDataAndSlots(dateString);
        }
      } catch (error) {
        console.error("Error during final validation:", error);
        showError("Could not verify slot availability. Please try again.");

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
