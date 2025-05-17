require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const GoogleCalendarTool = require("../src/tools/googleCalendar");
const prisma = require("../src/core/prisma");
const { addDays, startOfDay } = require("date-fns");
const readline = require("readline");
const { toZonedTime, fromZonedTime, formatInTimeZone } = require("date-fns-tz"); // Use older API names based on observed loaded module

// This global practitionerTimeZone will be overridden by the one from DB rules
let practitionerTimeZone = "America/Chicago"; // Fallback, but should be replaced

function promptUser(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase()); // Trim whitespace
    }),
  );
}

// Helper to create ISO strings for date ranges
// NOW uses the dynamically fetched practitionerTimeZone
function getTestDateRange(
  startDayOffset = 0,
  endDayOffset = 0,
  currentPractitionerTz,
) {
  const todayLocal = new Date(); // Base for offset calculation
  const baseDateInPractitionerTz = toZonedTime(
    todayLocal,
    currentPractitionerTz,
  );

  // Start of the first day in the range
  const rangeStartDatePractitioner = startOfDay(
    addDays(baseDateInPractitionerTz, startDayOffset),
  );
  // To cover the full endDayOffset day, the range should go up to the start of the day *after* the endDayOffset day.
  const rangeEndDatePractitioner = startOfDay(
    addDays(baseDateInPractitionerTz, endDayOffset + 1),
  );

  return {
    startDateRange: fromZonedTime(
      rangeStartDatePractitioner,
      currentPractitionerTz,
    ).toISOString(),
    endDateRange: fromZonedTime(
      rangeEndDatePractitioner,
      currentPractitionerTz,
    ).toISOString(),
  };
}

async function runTests() {
  console.log(
    "--- Starting findFreeSlots Test Script (V2.1 - DB Timezone Logic) ---",
  );

  if (!process.env.GOOGLE_CALENDAR_ID) {
    // Personal calendar is optional for some tests
    console.error(
      "CRITICAL: GOOGLE_CALENDAR_ID must be set in .env for this test script.",
    );
    await prisma.$disconnect();
    return;
  }
  if (!process.env.GOOGLE_PERSONAL_CALENDAR_ID) {
    console.warn(
      "WARNING: GOOGLE_PERSONAL_CALENDAR_ID is not set. Personal calendar checks will be skipped or may behave unexpectedly if the tool tries to access it.",
    );
  }

  // Pass console as the logger for GoogleCalendarTool
  const googleCalendarTool = new GoogleCalendarTool({
    logger: console,
    prisma,
  });

  console.log("Fetching availability rules from database...");
  const rules = await googleCalendarTool.getAvailabilityRule();
  if (
    !rules ||
    !rules.weekly_availability ||
    typeof rules.weekly_availability !== "object" ||
    !rules.practitioner_timezone
  ) {
    console.error(
      "CRITICAL: Could not load valid availability rules (including practitioner_timezone) from DB. Exiting test.",
    );
    await prisma.$disconnect();
    return;
  }
  // Set the global practitionerTimeZone for this test run from the DB rules
  practitionerTimeZone = rules.practitioner_timezone;
  console.log(
    "Checkpoint 1: practitionerTimeZone set to:",
    practitionerTimeZone,
  );

  try {
    console.log("Current Availability Rules (from DB):");
    console.log("  - Practitioner Timezone:", practitionerTimeZone);
    console.log(
      "  - Weekly Availability (Keys only):",
      rules.weekly_availability
        ? Object.keys(rules.weekly_availability)
        : "N/A",
    );
    // If you need to see the content and suspect it's large/complex:
    // try { console.log("  - Weekly Availability (JSON):", JSON.stringify(rules.weekly_availability, null, 2)); } catch (e) { console.error('Error stringifying weekly_availability', e); }
    console.log("  - Max Advance Days:", rules.max_advance_days);
    console.log("  - Min Notice Hours:", rules.min_notice_hours);
    console.log("  - Buffer Time Minutes:", rules.buffer_time_minutes);
    console.log("  - Max Bookings Per Day:", rules.max_bookings_per_day);
    console.log("  - Slot Increment Minutes:", rules.slot_increment_minutes); // Log the new field
  } catch (errorLoggingRules) {
    console.error("ERROR trying to log availability rules:", errorLoggingRules);
  }

  console.log("Checkpoint 2: After logging rules object details.");

  console.log(
    "Current Availability Rules (original object log attempt - CAREFUL if large/complex):",
    {
      weekly: rules.weekly_availability,
      timezone: practitionerTimeZone, // Use the fetched one
      maxAdvance: rules.max_advance_days,
      minNotice: rules.min_notice_hours,
      buffer: rules.buffer_time_minutes,
      maxPerDay: rules.max_bookings_per_day,
    },
  );
  console.log("Checkpoint 3: After original rules object log attempt.");
  console.log(`Session Calendar ID: ${googleCalendarTool.sessionCalendarId}`);
  console.log(
    `Personal Calendar ID: ${googleCalendarTool.personalCalendarId || "Not Set"}`,
  );

  // Reusable testScenario logic
  async function executeScenarioAction(
    name,
    options,
    manualSetupInstructions = "",
  ) {
    console.log(`\n--- SCENARIO: ${name} ---`);
    if (manualSetupInstructions) {
      console.log(`MANUAL GCAL SETUP REQUIRED: ${manualSetupInstructions}`);
    }
    const { startDateRange, endDateRange, sessionDurationMinutes } = options;
    console.log(
      `Testing with duration: ${sessionDurationMinutes}min, Buffer: ${rules.buffer_time_minutes}min`,
    );
    const startDateForLog = new Date(startDateRange);
    const endDateForLog = new Date(endDateRange);
    console.log(`Range (UTC): ${startDateRange} to ${endDateRange}`);
    console.log(
      `       Practitioner TZ (${practitionerTimeZone}): ${formatInTimeZone(startDateForLog, practitionerTimeZone, "yyyy-MM-dd HH:mm:ss zzzz")} to ${formatInTimeZone(endDateForLog, practitionerTimeZone, "yyyy-MM-dd HH:mm:ss zzzz")}`,
    );
    try {
      const slots = await googleCalendarTool.findFreeSlots(options);
      console.log(`Found Slots (${slots.length}):`);
      slots.forEach((slot) =>
        console.log(
          `  UTC: ${slot} --- Practitioner TZ (${practitionerTimeZone}): ${formatInTimeZone(new Date(slot), practitionerTimeZone, "yyyy-MM-dd HH:mm:ss zzzz")}`,
        ),
      );
      if (slots.length === 0)
        console.log("  (No slots found for this scenario)");
    } catch (error) {
      console.error(`Error in Scenario "${name}":`, error);
    }
  }

  const sessionDurationStd = 60;

  // Define test scenarios
  const scenarios = [
    {
      name: "Basic Availability (Tomorrow)",
      manualSetup:
        "Ensure tomorrow is generally available per weekly rules and GCal is clear.",
      action: async () =>
        executeScenarioAction(
          "Basic Availability (Tomorrow)",
          {
            ...getTestDateRange(1, 1, practitionerTimeZone),
            sessionDurationMinutes: sessionDurationStd,
          },
          "Ensure tomorrow is generally available per weekly rules and GCal is clear.",
        ),
    },
    {
      name: "Busy Event on PERSONAL Calendar (Tomorrow 1pm-3pm PT)",
      manualSetup: `Add a busy event to PERSONAL GCal (ID: ${googleCalendarTool.personalCalendarId || "N/A"}) for tomorrow 1:00 PM - 3:00 PM (${practitionerTimeZone}).`,
      action: async () =>
        executeScenarioAction(
          "Busy Event on PERSONAL Calendar (Tomorrow 1pm-3pm PT)",
          {
            ...getTestDateRange(1, 1, practitionerTimeZone),
            sessionDurationMinutes: sessionDurationStd,
          },
          `Add a busy event to PERSONAL GCal (ID: ${googleCalendarTool.personalCalendarId || "N/A"}) for tomorrow 1:00 PM - 3:00 PM (${practitionerTimeZone}).`,
        ),
    },
    {
      name: "Admin Block on SESSION Calendar (Tomorrow 10am-12pm PT)",
      manualSetup: `Add a 'Blocked' event to SESSION GCal (ID: ${googleCalendarTool.sessionCalendarId}) for tomorrow 10:00 AM - 12:00 PM (${practitionerTimeZone}).`,
      action: async () =>
        executeScenarioAction(
          "Admin Block on SESSION Calendar (Tomorrow 10am-12pm PT)",
          {
            ...getTestDateRange(1, 1, practitionerTimeZone),
            sessionDurationMinutes: sessionDurationStd,
          },
          `Add a 'Blocked' event to SESSION GCal (ID: ${googleCalendarTool.sessionCalendarId}) for tomorrow 10:00 AM - 12:00 PM (${practitionerTimeZone}).`,
        ),
    },
    {
      name: `Max Bookings Per Day (Limit: ${rules.max_bookings_per_day})`,
      manualSetup: `Add ${rules.max_bookings_per_day - 1} distinct Kambo session events to SESSION GCal (ID: ${googleCalendarTool.sessionCalendarId}) for the day after tomorrow. Expected: only 1 more slot if time allows.`,
      action: async () =>
        executeScenarioAction(
          `Max Bookings Per Day (Limit: ${rules.max_bookings_per_day})`,
          {
            ...getTestDateRange(2, 2, practitionerTimeZone),
            sessionDurationMinutes: sessionDurationStd,
          },
          `Add ${rules.max_bookings_per_day - 1} distinct Kambo session events to SESSION GCal (ID: ${googleCalendarTool.sessionCalendarId}) for the day after tomorrow. Expected: only 1 more slot if time allows.`,
        ),
    },
    {
      name: `Booking Window - Too Far (>${rules.max_advance_days} days)`,
      manualSetup: "Expected: 0 slots.",
      action: async () =>
        executeScenarioAction(
          `Booking Window - Too Far (>${rules.max_advance_days} days)`,
          {
            ...getTestDateRange(
              rules.max_advance_days + 5,
              rules.max_advance_days + 5,
              practitionerTimeZone,
            ),
            sessionDurationMinutes: sessionDurationStd,
          },
          "Expected: 0 slots.",
        ),
    },
    {
      name: `Booking Window - Too Soon (<${rules.min_notice_hours} hours notice)`,
      manualSetup: `Expected: Slots only appear if >= ${rules.min_notice_hours} hours from now (${practitionerTimeZone}).`,
      action: async () =>
        executeScenarioAction(
          `Booking Window - Too Soon (<${rules.min_notice_hours} hours notice)`,
          {
            ...getTestDateRange(0, 0, practitionerTimeZone),
            sessionDurationMinutes: sessionDurationStd,
          },
          `Expected: Slots only appear if >= ${rules.min_notice_hours} hours from now (${practitionerTimeZone}).`,
        ),
    },
    {
      name: "Buffer Between Kambo Sessions (on SESSION GCal)",
      manualSetup: `Add a Kambo session (1 hour) to SESSION GCal (ID: ${googleCalendarTool.sessionCalendarId}) for 9:00 AM - 10:00 AM (${practitionerTimeZone}) three days from now. Buffer is ${rules.buffer_time_minutes} min. Expected: 10:00 AM slot (for 60min session) NOT available.`,
      action: async () =>
        executeScenarioAction(
          "Buffer Between Kambo Sessions (on SESSION GCal)",
          {
            ...getTestDateRange(3, 3, practitionerTimeZone),
            sessionDurationMinutes: sessionDurationStd,
          },
          `Add a Kambo session (1 hour) to SESSION GCal (ID: ${googleCalendarTool.sessionCalendarId}) for 9:00 AM - 10:00 AM (${practitionerTimeZone}) three days from now. Buffer is ${rules.buffer_time_minutes} min. Expected: 10:00 AM slot (for 60min session) NOT available.`,
        ),
    },
    {
      name: "Buffer with PERSONAL GCal Event",
      manualSetup: `Add personal event to PERSONAL GCal (ID: ${googleCalendarTool.personalCalendarId || "N/A"}) for 11:00 AM - 12:00 PM (${practitionerTimeZone}) three days from now. (Keep 9-10 AM Kambo on Session GCal).`,
      action: async () =>
        executeScenarioAction(
          "Buffer with PERSONAL GCal Event",
          {
            ...getTestDateRange(3, 3, practitionerTimeZone),
            sessionDurationMinutes: sessionDurationStd,
          },
          `Add personal event to PERSONAL GCal (ID: ${googleCalendarTool.personalCalendarId || "N/A"}) for 11:00 AM - 12:00 PM (${practitionerTimeZone}) three days from now. (Keep 9-10 AM Kambo on Session GCal).`,
        ),
    },
  ];

  // Loop through scenarios and run them interactively
  for (const scenario of scenarios) {
    console.log(
      `\n\n------------------------------------------------------------------`,
    );
    console.log(`UP NEXT: SCENARIO - ${scenario.name}`);
    console.log(
      `------------------------------------------------------------------`,
    );
    if (scenario.manualSetup) {
      console.log(`MANUAL GCAL SETUP REQUIRED:\n${scenario.manualSetup}`); // Changed to console.log
    }
    process.stdout.write("\n"); // Ensure newline before prompt in the loop
    const response = await promptUser("Ready to run this scenario? (y/n): ");
    if (response === "y") {
      await scenario.action();
    } else {
      console.log(`Skipping scenario: ${scenario.name}`);
    }
  }

  console.log("\n--- findFreeSlots Test Script (V2.1) Finished ---");
  await prisma.$disconnect();
  console.log("All scenarios processed.");
}

runTests().catch(async (e) => {
  // Enhanced error logging already uses console.error for the main parts
  console.error("--- DETAILED ERROR START ---");
  console.error("Raw error object seen by catch block:", e);
  console.error("Unhandled error in V2.1 test script.");
  if (e instanceof Error) {
    console.error(`Error Message: ${e.message}`);
    console.error(`Error Name: ${e.name}`);
    if (e.stack) {
      console.error("Stack trace:\n" + e.stack);
    }
  } else {
    try {
      console.error(
        "Error object (not an Error instance): " + JSON.stringify(e, null, 2),
      );
      // eslint-disable-next-line no-unused-vars
    } catch (_stringifyError) {
      console.error(
        "Error object (not an Error instance, and could not stringify): " +
          String(e),
      );
    }
  }
  console.error("--- DETAILED ERROR END ---");

  try {
    await prisma.$disconnect();
    console.log("Prisma client disconnected successfully after error.");
  } catch (pdErr) {
    console.error("Error during prisma disconnect after script error:", pdErr);
  }
  process.exit(1);
});
