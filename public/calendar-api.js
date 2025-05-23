/* global window */

/**
 * Calendar API JavaScript
 * API calls and caching functionality for Kambo Klarity booking system
 */

// Cache for availability data with timestamps
let availabilityCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

// Utility functions
function formatDateToUTCISO(date) {
  return date.toISOString();
}

function getMonthDateRange(year, month) {
  const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  return {
    startDateRange: formatDateToUTCISO(startDate),
    endDateRange: formatDateToUTCISO(endDate),
  };
}

function getDateString(date) {
  // Return YYYY-MM-DD format in LOCAL timezone, not UTC
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// API functions
async function _fetchSessionTypeDetails(sessionTypeId) {
  try {
    const response = await fetch(`/api/session-types/${sessionTypeId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching session type details:", error);
    throw error;
  }
}

// Enhanced availability fetching that gets all slots for the entire month
async function fetchAvailability(
  startDateRange,
  endDateRange,
  sessionDurationMinutes,
) {
  try {
    const params = new URLSearchParams({
      startDateRange,
      endDateRange,
      sessionDurationMinutes: sessionDurationMinutes.toString(),
    });

    const response = await fetch(`/api/calendar/availability?${params}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to fetch availability");
    }

    return data.slots || [];
  } catch (error) {
    console.error("Error fetching availability:", error);
    throw error;
  }
}

// Month overview fetching with caching
async function _fetchMonthOverview(year, month, sessionDurationMinutes) {
  const cacheKey = `overview-${year}-${month}-${sessionDurationMinutes}`;
  const cached = availabilityCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.overview;
  }

  try {
    const { startDateRange, endDateRange } = getMonthDateRange(year, month);

    // Fetch all slots for the month using FreeBusy optimization
    const allSlots = await fetchAvailability(
      startDateRange,
      endDateRange,
      sessionDurationMinutes,
    );

    // Process into overview format (which days have availability)
    const overview = {};
    const slotsByDate = {};

    allSlots.forEach((slotISO) => {
      const slotDate = new Date(slotISO);
      const localDateString = getDateString(slotDate);

      // Mark this date as having availability
      overview[localDateString] = true;

      // Group slots by date for later use
      if (!slotsByDate[localDateString]) {
        slotsByDate[localDateString] = [];
      }
      slotsByDate[localDateString].push(slotISO);
    });

    const result = {
      overview,
      slotsByDate,
    };

    availabilityCache.set(cacheKey, {
      overview: result,
      timestamp: Date.now(),
    });

    return result;
  } catch (error) {
    console.error("Error fetching month overview:", error);
    return { overview: {}, slotsByDate: {} };
  }
}

// Get slots for a specific date from cached month data
function _getSlotsForDate(dateString) {
  // First check if we have slots in the current monthSlotData (from calendar-app.js)
  if (
    typeof window !== "undefined" &&
    window.monthSlotData &&
    window.monthSlotData[dateString]
  ) {
    console.log(
      `Found ${window.monthSlotData[dateString].length} slots for ${dateString} in monthSlotData`,
    );
    return window.monthSlotData[dateString];
  }

  // Fallback: Look through cache to find slots for this date
  for (const [cacheKey, cachedData] of availabilityCache.entries()) {
    if (
      cacheKey.startsWith("overview-") &&
      cachedData.overview &&
      cachedData.overview.slotsByDate
    ) {
      const slots = cachedData.overview.slotsByDate[dateString];
      if (slots && slots.length > 0) {
        console.log(`Found ${slots.length} slots for ${dateString} in cache`);
        return slots;
      }
    }
  }

  console.log(`No slots found for ${dateString}`);
  return [];
}

// Validate slot availability before booking (still needed for final validation)
async function _validateSlotAvailability(
  dateString,
  timeSlotISO,
  sessionDurationMinutes,
) {
  try {
    console.log(
      `Validating slot availability for ${dateString} at ${timeSlotISO}`,
    );

    // Get fresh slots for just this date
    const startDate = new Date(dateString + "T00:00:00.000Z");
    const endDate = new Date(dateString + "T23:59:59.999Z");

    const response = await fetch(
      `/api/calendar/availability?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&sessionDurationMinutes=${sessionDurationMinutes}`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Check if the specific slot is still available
    const availableSlots = data.slots || [];
    const isStillAvailable = availableSlots.some(
      (slot) => slot.startTime === timeSlotISO,
    );

    console.log(
      `Slot validation result: ${isStillAvailable ? "AVAILABLE" : "NOT AVAILABLE"}`,
    );
    return isStillAvailable;
  } catch (error) {
    console.error("Error validating slot availability:", error);
    return false; // Assume not available on error
  }
}
