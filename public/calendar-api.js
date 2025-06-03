/**
 * Calendar API Module
 * Handles all API calls and data fetching for the calendar
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
async function fetchSessionTypeDetails(sessionTypeId) {
  try {
    const response = await fetch(`/api/session-types/${sessionTypeId}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to fetch session type details");
    }

    return data.data;
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

// Get month overview and full slot data in one call using FreeBusy optimization
async function fetchMonthOverview(year, month, sessionDurationMinutes) {
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
function getSlotsForDate(dateString) {
  // First check if we have slots in the current monthSlotData (from calendar-app.js)
  if (window.monthSlotData && window.monthSlotData[dateString]) {
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
      if (slots) {
        console.log(`Found ${slots.length} cached slots for ${dateString}`);
        return slots;
      }
    }
  }

  console.log(`No cached slots found for ${dateString}`);
  return [];
}

// Validate slot availability before booking (still needed for final validation)
async function validateSlotAvailability(slotISO, sessionDurationMinutes) {
  try {
    // Get the date from the slot
    const slotDate = new Date(slotISO);
    const dateString = getDateString(slotDate);

    // Clear cache for this month to force fresh data
    const year = slotDate.getFullYear();
    const month = slotDate.getMonth();
    const cacheKey = `overview-${year}-${month}-${sessionDurationMinutes}`;
    availabilityCache.delete(cacheKey);

    // Fetch fresh availability for this month
    const monthData = await fetchMonthOverview(
      year,
      month,
      sessionDurationMinutes,
    );
    const currentSlots = monthData.slotsByDate[dateString] || [];

    // Check if the selected slot is still in the available slots
    return currentSlots.includes(slotISO);
  } catch (error) {
    console.error("Error validating slot:", error);
    return false;
  }
}

// Feature 4: Create Google Calendar placeholder booking
async function createGCalPlaceholder(data) {
  try {
    const response = await fetch("/api/gcal-placeholder-bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to create placeholder");
    }

    return result;
  } catch (error) {
    console.error("Error creating placeholder:", error);
    throw error;
  }
}

// Feature 4: Start primary booking flow
async function startPrimaryBookingFlow(data) {
  try {
    const response = await fetch("/api/booking-flow/start-primary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to start booking flow");
    }

    return result;
  } catch (error) {
    console.error("Error starting booking flow:", error);
    throw error;
  }
}

// Feature 4: Delete Google Calendar placeholder booking
async function deleteGCalPlaceholder(placeholderId) {
  try {
    const response = await fetch(
      `/api/gcal-placeholder-bookings/${placeholderId}`,
      {
        method: "DELETE",
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to delete placeholder");
    }

    return result;
  } catch (error) {
    console.error("Error deleting placeholder:", error);
    throw error;
  }
}
