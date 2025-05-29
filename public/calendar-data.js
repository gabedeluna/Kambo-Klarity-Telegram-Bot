/**
 * Calendar Data Module
 * Handles data management, caching, and month loading for the calendar
 */

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
    window.monthSlotData = monthSlotData;

    // Update calendar with new availability indicators
    renderCalendar(year, month, monthData.overview || {});

    // Refresh the time slots for the selected date
    const updatedSlots = getSlotsForDate(dateString);
    renderTimeSlotsForDate(dateString, updatedSlots);

    // Update booking info based on new slot availability
    if (updatedSlots.length === 0) {
      // No slots available anymore
      const fullDayName = selectedDate.toLocaleDateString([], {
        weekday: "long",
      });
      const month = selectedDate.toLocaleDateString([], { month: "long" });
      const day = selectedDate.getDate();
      const year = selectedDate.getFullYear();
      document.getElementById("selectedBookingInfo").textContent =
        `${fullDayName}, ${month} ${day}, ${year} - No slots available`;
      selectedTimeSlotISO = null;
    } else {
      // Show first available slot
      const firstSlot = updatedSlots[0];
      updateBookingInfoWithTime(firstSlot);
    }

    console.log(
      `Month data refreshed. Found ${updatedSlots.length} slots for ${dateString}`,
    );
  } catch (error) {
    console.error("Error refreshing month data:", error);
    showError("Could not refresh availability. Please try again.");
  }
}

// Load time slots for a specific date from cached month data
function loadAndRenderTimeSlotsForDate(dateString) {
  // Get slots from cached month data
  const slots = getSlotsForDate(dateString);

  // Render the slots immediately (no loading state)
  renderTimeSlotsForDate(dateString, slots);
}
