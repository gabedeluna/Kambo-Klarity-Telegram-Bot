/**
 * Calendar UI Module
 * Handles UI rendering and interactions for the calendar
 */

// Utility functions
function showError(message) {
  const errorContainer = document.createElement("div");
  errorContainer.style.cssText = `
        color: white;
        padding: 20px;
        text-align: center;
        background: rgba(220, 38, 38, 0.9);
        backdrop-filter: blur(10px);
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 9999;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        max-width: 90%;
        font-weight: 600;
    `;
  errorContainer.innerHTML = `<p>${message}</p>`;
  document.body.appendChild(errorContainer);

  setTimeout(() => {
    errorContainer.remove();
  }, 5000);
}

function showSuccess(message) {
  const successContainer = document.createElement("div");
  successContainer.style.cssText = `
        color: white;
        padding: 20px;
        text-align: center;
        background: rgba(34, 197, 94, 0.9);
        backdrop-filter: blur(10px);
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 9999;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        max-width: 90%;
        font-weight: 600;
    `;
  successContainer.innerHTML = `<p>${message}</p>`;
  document.body.appendChild(successContainer);

  setTimeout(() => {
    successContainer.remove();
  }, 5000);
}

function setLoading(isLoading) {
  const elements = [
    "calendarGrid",
    "timeSlotList",
    "prevMonthButton",
    "nextMonthButton",
  ];
  elements.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (isLoading) {
        el.classList.add("loading");
      } else {
        el.classList.remove("loading");
      }
    }
  });
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

  // Create empty cells for days before the first day of the month
  for (let i = 0; i < startDayOfWeek; i++) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "h-8 w-full";
    calendarGrid.appendChild(emptyDiv);
  }

  // Create day buttons
  for (let day = 1; day <= daysInMonth; day++) {
    const dayDate = new Date(year, month, day, 12, 0, 0, 0);
    const dateString = getDateString(dayDate);
    const hasSlots = overviewData[dateString] === true;

    const button = document.createElement("button");
    button.className = `calendar-day h-8 w-full rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${hasSlots ? "available" : ""}`;
    button.textContent = day;
    button.dataset.date = dateString;
    button.dataset.fullDate = dayDate.toISOString();

    // Add click handler
    button.addEventListener("click", () => selectDate(dayDate, dateString));

    calendarGrid.appendChild(button);
  }

  // Hide loading animation once calendar is rendered
  hideLoadingAnimation();
}

function renderTimeSlotsForDate(dateString, availableSlots = []) {
  const timeSlotList = document.getElementById("timeSlotList");

  // Clear existing slots
  timeSlotList.innerHTML = "";

  if (availableSlots.length === 0) {
    const noSlotsDiv = document.createElement("div");
    noSlotsDiv.className =
      "snap-center h-8 flex items-center justify-center text-lg font-semibold text-amber-100 opacity-60 time-slot-item";
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
        `${fullDayName}, ${month} ${day} - No slots available`;
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
      "snap-center h-8 flex items-center justify-center text-lg font-semibold text-amber-100 time-slot-item";
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

  const bookingText = `${fullDayName}, ${month} ${day} - ${time} (${timezoneAbbr})`;
  document.getElementById("selectedBookingInfo").textContent = bookingText;

  // Store the currently displayed slot for submission
  selectedTimeSlotISO = slotISO;
}

function resetButtonState() {
  const submitButton = document.getElementById("submitBookingButton");

  submitButton.disabled = true;
  submitButton.className =
    "btn-primary flex-1 h-12 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed";
  submitButton.querySelector("span").textContent = "Book";
}

function hideTimePickerAndShowMessage() {
  // Hide time picker and show select date message
  document.getElementById("timePickerContainer").style.display = "none";
  document.getElementById("selectDateMessage").style.display = "block";

  // Keep the booking info section visible but hide the text
  document.querySelector(".booking-summary").style.display = "block";
  document.getElementById("selectedBookingInfo").style.visibility = "hidden";
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
  loadingText.className = "text-amber-100 text-sm ml-3 opacity-80";
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
