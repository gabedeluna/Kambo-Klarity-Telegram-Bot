/* global window, document, fetchMonthOverview, fetchSessionTypeDetails, getSlotsForDate, validateSlotAvailability, getDateString */

/**
 * Calendar App JavaScript
 * Dynamic calendar functionality for Kambo Klarity booking system
 */

// Global variables
let telegramId = null;
let initialSessionTypeId = null;
let sessionDurationMinutes = null;
let _availabilityData = {}; // Object mapping date strings to arrays of slot strings
let monthSlotData = {}; // Cache for all slots in the current month
let monthCache = new Map(); // Cache for month data with timestamps
const MONTH_CACHE_DURATION = 120000; // 2 minutes
let currentMonth = new Date().getMonth(); // 0-indexed
let currentYear = new Date().getFullYear();
let selectedDate = null;
let selectedTimeSlotISO = null;

// Make monthSlotData accessible globally for the calendar API
if (typeof window !== "undefined") {
  window.monthSlotData = monthSlotData;
}

// Utility functions
function showError(message) {
  const errorContainer = document.getElementById("errorContainer");
  if (errorContainer) {
    errorContainer.textContent = message;
    errorContainer.style.display = "block";

    // Hide after 5 seconds
    setTimeout(() => {
      errorContainer.style.display = "none";
    }, 5000);
  } else {
    console.error("Error container not found, message:", message);
  }
}

function _setLoading(isLoading) {
  const loadingElement = document.getElementById("loadingAnimation");
  if (loadingElement) {
    loadingElement.style.display = isLoading ? "flex" : "none";
  }
}

// Calendar rendering functions
function renderCalendar(year, month, overviewData = {}) {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Update month/year display
  document.getElementById("currentMonthYear").textContent =
    `${monthNames[month]} ${year}`;

  // Get calendar grid
  const calendarGrid = document.getElementById("calendarGrid");

  // Remove ALL existing elements except the day headers (first 7 children)
  while (calendarGrid.children.length > 7) {
    calendarGrid.removeChild(calendarGrid.lastChild);
  }

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1, 12, 0, 0, 0);
  const lastDay = new Date(year, month + 1, 0, 12, 0, 0, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  // Create day buttons
  for (let i = 0; i < startDayOfWeek; i++) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "h-10 w-full";
    calendarGrid.appendChild(emptyDiv);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayDate = new Date(year, month, day, 12, 0, 0, 0);
    const dateString = getDateString(dayDate);
    const hasSlots = overviewData[dateString] === true;

    const button = document.createElement("button");
    button.className = `calendar-day h-10 w-full text-white text-sm font-medium leading-normal ${hasSlots ? "available" : ""}`;
    button.innerHTML = `<div class="flex size-full items-center justify-center rounded-full">${day}</div>`;
    button.dataset.date = dateString;
    button.dataset.fullDate = dayDate.toISOString();

    // Add click handler
    button.addEventListener("click", () => selectDate(dayDate, dateString));

    calendarGrid.appendChild(button);
  }

  // Hide loading animation once calendar is rendered
  hideLoadingAnimation();
}

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
    // No slots available - show final message
    const fullDayName = date.toLocaleDateString([], { weekday: "long" });
    const month = date.toLocaleDateString([], { month: "long" });
    const day = date.getDate();
    const year = date.getFullYear();
    document.getElementById("selectedBookingInfo").textContent =
      `${fullDayName}, ${month} ${day}, ${year} - No slots available`;
  } else {
    // Slots available - show first available slot immediately
    const firstSlot = slots[0];
    updateBookingInfoWithTime(firstSlot);
  }

  // Enable submit button immediately when date is selected
  const submitButton = document.getElementById("submitBookingButton");
  submitButton.disabled = false;
  submitButton.className =
    "flex flex-1 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-[#53d22c] text-[#162013] text-base font-bold leading-normal tracking-[0.015em]";
  submitButton.querySelector("span").textContent = "Book";

  // Load and render time slots for selected date (async)
  loadAndRenderTimeSlotsForDate(dateString);
}

// Helper function to update booking info with just the date (removed - no longer needed)

// Load time slots for a specific date from cached month data
function loadAndRenderTimeSlotsForDate(dateString) {
  try {
    const slots = getSlotsForDate(dateString);
    renderTimeSlotsForDate(dateString, slots);
  } catch (error) {
    console.error("Error loading time slots:", error);
    showError("Failed to load time slots");
  }
}

function renderTimeSlotsForDate(dateString, availableSlots = []) {
  const timeSlotList = document.getElementById("timeSlotList");

  // Clear existing slots
  timeSlotList.innerHTML = "";

  if (availableSlots.length === 0) {
    const noSlotsDiv = document.createElement("div");
    noSlotsDiv.className =
      "snap-center h-12 flex items-center justify-center text-lg font-bold text-[#5a844d] time-slot-item";
    noSlotsDiv.textContent = "No slots available for this day.";
    timeSlotList.appendChild(noSlotsDiv);

    // Keep booking info visible but update text for no slots
    if (selectedDate) {
      const fullDayName = selectedDate.toLocaleDateString([], {
        weekday: "long",
      });
      const month = selectedDate.toLocaleDateString([], { month: "long" });
      const day = selectedDate.getDate();
      const year = selectedDate.getFullYear();
      document.getElementById("selectedBookingInfo").textContent =
        `${fullDayName}, ${month} ${day}, ${year} - No slots available`;
    }
    return;
  }

  // Create time slot items (without click handlers)
  availableSlots.forEach((slotISO) => {
    const slotDate = new Date(slotISO);

    const timeString = slotDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const slotDiv = document.createElement("div");
    slotDiv.className =
      "snap-center h-12 flex items-center justify-center text-lg font-bold text-[#5a844d] time-slot-item";
    slotDiv.textContent = timeString;
    slotDiv.dataset.slotIso = slotISO;

    timeSlotList.appendChild(slotDiv);
  });

  // Reset scroll position to top
  timeSlotList.scrollTop = 0;

  // Set up scroll listener for dynamic time display
  setupTimeSlotScrollDisplay();
}

function setupTimeSlotScrollDisplay() {
  const timeSlotList = document.getElementById("timeSlotList");

  function updateTimeDisplay() {
    const containerRect = timeSlotList.getBoundingClientRect();
    const containerCenterY = containerRect.top + containerRect.height / 2;
    const timeSlots = timeSlotList.querySelectorAll(".time-slot-item");

    let centerSlot = null;
    let minDistance = Infinity;

    timeSlots.forEach((slot) => {
      // Only consider slots that have actual time data
      if (!slot.dataset.slotIso) return;

      // Calculate distance from center
      const rect = slot.getBoundingClientRect();
      const slotCenterY = rect.top + rect.height / 2;
      const distance = Math.abs(slotCenterY - containerCenterY);

      // Track the slot closest to center
      if (distance < minDistance) {
        minDistance = distance;
        centerSlot = slot;
      }
    });

    // Update booking info with the centered time slot only if it's a valid slot
    if (centerSlot && centerSlot.dataset.slotIso && selectedDate) {
      updateBookingInfoWithTime(centerSlot.dataset.slotIso);
    }
  }

  // Add scroll event listener
  timeSlotList.addEventListener("scroll", updateTimeDisplay);

  // Trigger initial display update
  setTimeout(updateTimeDisplay, 100);
}

// Helper function to update booking info with specific time
function updateBookingInfoWithTime(slotISO) {
  const slotDate = new Date(slotISO);
  const fullDayName = slotDate.toLocaleDateString([], { weekday: "long" });
  const month = slotDate.toLocaleDateString([], { month: "long" });
  const day = slotDate.getDate();
  const year = slotDate.getFullYear();
  const time = slotDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // Get timezone abbreviation
  const timezoneAbbr =
    slotDate
      .toLocaleDateString("en-US", {
        timeZoneName: "short",
      })
      .split(", ")[1] ||
    slotDate
      .toLocaleTimeString("en-US", {
        timeZoneName: "short",
      })
      .split(" ")
      .pop();

  const bookingText = `${fullDayName}, ${month} ${day}, ${year} at ${time} (${timezoneAbbr})`;
  document.getElementById("selectedBookingInfo").textContent = bookingText;

  // Store the currently displayed slot for submission
  selectedTimeSlotISO = slotISO;
}

// UI state management functions
function _resetButtonState() {
  const submitButton = document.getElementById("submitBookingButton");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.className =
      "flex flex-1 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-gray-600 text-white text-base font-bold leading-normal tracking-[0.015em] disabled:cursor-not-allowed";
    submitButton.querySelector("span").textContent = "Select a Time";
  }
}

function _hideTimePickerAndShowMessage() {
  const timePickerContainer = document.getElementById("timePickerContainer");
  const selectDateMessage = document.getElementById("selectDateMessage");

  if (timePickerContainer) {
    timePickerContainer.style.visibility = "hidden";
  }
  if (selectDateMessage) {
    selectDateMessage.style.display = "block";
  }
}

// Enhanced month caching and preloading
function getMonthCacheKey(year, month) {
  return `${year}-${month}-${sessionDurationMinutes}`;
}

function getCachedMonthData(year, month) {
  const cacheKey = getMonthCacheKey(year, month);
  const cached = monthCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < MONTH_CACHE_DURATION) {
    return cached.data;
  }

  return null;
}

function setCachedMonthData(year, month, data) {
  const cacheKey = getMonthCacheKey(year, month);
  monthCache.set(cacheKey, {
    data: data,
    timestamp: Date.now(),
  });
}

// Preload adjacent months
async function preloadAdjacentMonths(year, month) {
  if (!sessionDurationMinutes) return;

  // Calculate previous and next month
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  // Preload previous month if not cached
  if (!getCachedMonthData(prevYear, prevMonth)) {
    try {
      const prevData = await fetchMonthOverview(
        prevYear,
        prevMonth,
        sessionDurationMinutes,
      );
      setCachedMonthData(prevYear, prevMonth, prevData);
      console.log(`Preloaded previous month: ${prevYear}-${prevMonth + 1}`);
    } catch (error) {
      console.warn("Failed to preload previous month:", error);
    }
  }

  // Preload next month if not cached
  if (!getCachedMonthData(nextYear, nextMonth)) {
    try {
      const nextData = await fetchMonthOverview(
        nextYear,
        nextMonth,
        sessionDurationMinutes,
      );
      setCachedMonthData(nextYear, nextMonth, nextData);
      console.log(`Preloaded next month: ${nextYear}-${nextMonth + 1}`);
    } catch (error) {
      console.warn("Failed to preload next month:", error);
    }
  }
}

function showLoadingAnimation() {
  const calendarGrid = document.getElementById("calendarGrid");

  // Remove all existing day elements except headers
  while (calendarGrid.children.length > 7) {
    calendarGrid.removeChild(calendarGrid.lastChild);
  }

  // Create loading animation container
  const loadingContainer = document.createElement("div");
  loadingContainer.className =
    "col-span-7 flex items-center justify-center py-8";
  loadingContainer.id = "loadingAnimation";

  // Create spinning loader
  const spinner = document.createElement("div");
  spinner.className =
    "animate-spin rounded-full h-8 w-8 border-b-2 border-[#53d22c]";

  const loadingText = document.createElement("p");
  loadingText.className = "text-[#5a844d] text-sm ml-3";
  loadingText.textContent = "Loading calendar...";

  loadingContainer.appendChild(spinner);
  loadingContainer.appendChild(loadingText);
  calendarGrid.appendChild(loadingContainer);
}

function hideLoadingAnimation() {
  const loadingAnimation = document.getElementById("loadingAnimation");
  if (loadingAnimation) {
    loadingAnimation.remove();
  }
}

// Main initialization and data fetching
async function loadMonthOverview(year, month) {
  if (!sessionDurationMinutes) {
    console.warn("Session duration not yet loaded, skipping overview fetch");
    return {};
  }

  // Check cache first
  const cachedData = getCachedMonthData(year, month);
  if (cachedData) {
    console.log(`Using cached data for ${year}-${month + 1}`);
    monthSlotData = cachedData.slotsByDate || {};
    window.monthSlotData = monthSlotData;
    renderCalendar(year, month, cachedData.overview || {});

    // Still preload adjacent months in background if not cached
    setTimeout(() => preloadAdjacentMonths(year, month), 100);

    return cachedData.overview || {};
  }

  // Show loading animation while fetching
  showLoadingAnimation();

  try {
    console.log(
      `Loading overview for ${year}-${month + 1} with FreeBusy optimization`,
    );
    const monthData = await fetchMonthOverview(
      year,
      month,
      sessionDurationMinutes,
    );

    // Cache the data
    setCachedMonthData(year, month, monthData);

    // Store the slot data for this month
    monthSlotData = monthData.slotsByDate || {};
    window.monthSlotData = monthSlotData;

    // Update calendar with availability indicators (this will hide loading animation)
    renderCalendar(year, month, monthData.overview || {});

    // Preload adjacent months in the background
    setTimeout(() => preloadAdjacentMonths(year, month), 100);

    return monthData.overview || {};
  } catch (error) {
    console.error("Error loading month overview:", error);
    hideLoadingAnimation();
    showError("Could not load month overview. Please try again.");
    return {};
  }
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
    const sessionTypeData = await fetchSessionTypeDetails(initialSessionTypeId);

    document.getElementById("sessionTypeLabel").textContent =
      sessionTypeData.data?.label || "Unknown Session";
    document.getElementById("sessionTypeDuration").textContent =
      `${sessionTypeData.data?.durationMinutes || 60} minutes`;

    sessionDurationMinutes = sessionTypeData.data?.durationMinutes || 60;

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

// Event listener setup (legacy function, kept for compatibility)
function _setupEventListeners() {
  // This function is no longer used as event listeners are set up in DOMContentLoaded
  console.log("Legacy setupEventListeners called");
}

// Month navigation
function navigateMonth(direction) {
  if (direction === 1) {
    // Next month
    if (currentMonth === 11) {
      currentMonth = 0;
      currentYear++;
    } else {
      currentMonth++;
    }
  } else {
    // Previous month
    if (currentMonth === 0) {
      currentMonth = 11;
      currentYear--;
    } else {
      currentMonth--;
    }
  }

  // Load the new month
  loadMonthData(currentYear, currentMonth);
}

// Load month data function
async function loadMonthData(year, month) {
  try {
    // Check cache first
    const cachedData = getCachedMonthData(year, month);
    if (cachedData) {
      console.log(`Using cached data for ${year}-${month + 1}`);
      monthSlotData = cachedData.slotsByDate || {};
      if (typeof window !== "undefined") {
        window.monthSlotData = monthSlotData;
      }
      renderCalendar(year, month, cachedData.overview || {});
      return cachedData.overview || {};
    }

    console.log(
      `Loading overview for ${year}-${month + 1} with FreeBusy optimization`,
    );
    const monthData = await fetchMonthOverview(
      year,
      month,
      sessionDurationMinutes,
    );

    // Cache the data
    setCachedMonthData(year, month, monthData);

    // Store the slot data for this month
    monthSlotData = monthData.slotsByDate || {};
    if (typeof window !== "undefined") {
      window.monthSlotData = monthSlotData;
    }

    // Render calendar with availability indicators
    renderCalendar(year, month, monthData.overview || {});

    // Preload next month in background
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    fetchMonthOverview(nextYear, nextMonth, sessionDurationMinutes).catch(
      (err) => {
        console.warn("Failed to preload next month:", err);
      },
    );

    // Preload previous month in background
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    fetchMonthOverview(prevYear, prevMonth, sessionDurationMinutes).catch(
      (err) => {
        console.warn("Failed to preload previous month:", err);
      },
    );

    return monthData.overview || {};
  } catch (error) {
    console.error("Error loading month data:", error);
    showError("Failed to load calendar data");
    return {};
  }
}

// Function to refresh month data and update slots for a specific date
async function refreshMonthDataAndSlots(dateString) {
  if (!selectedDate || !sessionDurationMinutes) return;

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  try {
    console.log(
      `Refreshing month data for ${year}-${month + 1} due to slot validation failure`,
    );

    // Clear the cache for this month to force fresh data
    const cacheKey = getMonthCacheKey(year, month);
    monthCache.delete(cacheKey);

    // Fetch fresh month data
    const monthData = await fetchMonthOverview(
      year,
      month,
      sessionDurationMinutes,
    );

    // Update cache and local data
    setCachedMonthData(year, month, monthData);
    monthSlotData = monthData.slotsByDate || {};
    if (typeof window !== "undefined") {
      window.monthSlotData = monthSlotData;
    }

    // Re-render the calendar with fresh data
    renderCalendar(year, month, monthData.overview || {});

    // Reload slots for the selected date
    const slots = getSlotsForDate(dateString);
    renderTimeSlotsForDate(dateString, slots);

    console.log(`Month data refreshed successfully for ${dateString}`);
  } catch (error) {
    console.error("Error refreshing month data:", error);
    showError("Failed to refresh calendar data");
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    telegramId = urlParams.get("telegramId");
    initialSessionTypeId = urlParams.get("sessionTypeId");

    if (!telegramId || !initialSessionTypeId) {
      showError("Missing required parameters");
      return;
    }

    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }

    // Set up navigation
    document
      .getElementById("prevMonthButton")
      .addEventListener("click", () => navigateMonth(-1));
    document
      .getElementById("nextMonthButton")
      .addEventListener("click", () => navigateMonth(1));

    // Set up submit button
    const submitButton = document.getElementById("submitBookingButton");
    submitButton.addEventListener("click", async () => {
      if (!selectedTimeSlotISO) {
        showError("Please select a time slot");
        return;
      }

      // Validate the slot is still available before proceeding
      const dateString = getDateString(selectedDate);
      const isStillAvailable = await validateSlotAvailability(
        dateString,
        selectedTimeSlotISO,
        sessionDurationMinutes,
      );

      if (!isStillAvailable) {
        showError(
          "Sorry, this time slot is no longer available. Please select another time.",
        );

        // Refresh the slots for this day
        await refreshMonthDataAndSlots(dateString);
        return;
      }

      // Navigate to waiver form with booking details
      const waiverUrl = `waiver-form.html?telegramId=${encodeURIComponent(telegramId)}&sessionTypeId=${encodeURIComponent(initialSessionTypeId)}&appointmentDateTime=${encodeURIComponent(selectedTimeSlotISO)}`;
      window.location.href = waiverUrl;
    });

    // Set up cancel button
    document
      .getElementById("cancelBookingButton")
      .addEventListener("click", () => {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.close();
        }
      });

    // Initialize the app
    await initializeApp();
  } catch (error) {
    console.error("Error during app initialization:", error);
    showError("Failed to initialize calendar app");
  }
});
