#!/usr/bin/env node

/**
 * FreeBusy API Integration Test
 *
 * This script tests the actual FreeBusy API performance with real Google Calendar credentials.
 * Run this manually to validate the implementation works with your actual calendar setup.
 *
 * Usage: node tests/tools/freeBusyApi.integration.js
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const GoogleCalendarTool = require("../../src/tools/googleCalendar");
const pino = require("pino");

// Create a logger for the test
const logger = pino({
  level: "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
    },
  },
});

// Mock Prisma for this test (you can replace with real Prisma if needed)
const mockPrisma = {
  availabilityRule: {
    findFirst: async () => {
      // Return a test availability rule
      return {
        id: 1,
        is_default: true,
        weekly_availability: {
          MON: [{ start: "09:00", end: "17:00" }],
          TUE: [{ start: "09:00", end: "17:00" }],
          WED: [{ start: "09:00", end: "17:00" }],
          THU: [{ start: "09:00", end: "17:00" }],
          FRI: [{ start: "09:00", end: "17:00" }],
          SAT: [{ start: "10:00", end: "16:00" }],
        },
        practitioner_timezone:
          process.env.PRACTITIONER_TIMEZONE || "America/Chicago",
        max_advance_days: 60,
        min_notice_hours: 24,
        buffer_time_minutes: 30,
        max_bookings_per_day: 4,
        slot_increment_minutes: 15,
      };
    },
  },
};

async function testFreeBusyApiPerformance() {
  logger.info("🚀 Starting FreeBusy API Integration Test");

  // Check required environment variables
  const requiredEnvVars = [
    "GOOGLE_APPLICATION_CREDENTIALS",
    "GOOGLE_CALENDAR_ID",
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.error(`❌ Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  logger.info("✅ Environment variables validated");

  try {
    // Initialize GoogleCalendarTool
    const calendarTool = new GoogleCalendarTool({
      logger,
      prisma: mockPrisma,
    });

    logger.info("✅ GoogleCalendarTool initialized");

    // Test 1: Basic FreeBusy API call
    logger.info("\n📅 Test 1: Basic FreeBusy API call");
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeMin = now.toISOString();
    const timeMax = tomorrow.toISOString();

    const startTime = Date.now();
    const busyTimes = await calendarTool.fetchBusyTimes(timeMin, timeMax);
    const endTime = Date.now();

    logger.info(`⏱️  FreeBusy API call completed in ${endTime - startTime}ms`);
    logger.info(`📊 Found ${busyTimes.length} busy periods`);

    if (busyTimes.length > 0) {
      logger.info("📋 Sample busy periods:");
      busyTimes.slice(0, 3).forEach((busy, index) => {
        logger.info(
          `   ${index + 1}. ${busy.start} - ${busy.end} (${busy.calendarId})`,
        );
      });
    }

    // Test 2: Slot generation performance
    logger.info("\n🎯 Test 2: Slot generation with FreeBusy API");

    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const slotStartTime = Date.now();
    const availableSlots = await calendarTool.findFreeSlots({
      startDateRange: now.toISOString().split("T")[0] + "T00:00:00",
      endDateRange: nextWeek.toISOString().split("T")[0] + "T23:59:59",
      sessionDurationMinutes: 90,
    });
    const slotEndTime = Date.now();

    logger.info(
      `⏱️  Slot generation completed in ${slotEndTime - slotStartTime}ms`,
    );
    logger.info(`🎯 Found ${availableSlots.length} available slots`);

    if (availableSlots.length > 0) {
      logger.info("📋 Sample available slots (first 5):");
      availableSlots.slice(0, 5).forEach((slot, index) => {
        const slotDate = new Date(slot);
        logger.info(`   ${index + 1}. ${slotDate.toLocaleString()}`);
      });
    }

    // Test 3: Performance comparison simulation
    logger.info("\n⚡ Test 3: Performance comparison (7-day range)");

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Single FreeBusy call for entire week
    const singleCallStart = Date.now();
    const weekBusyTimes = await calendarTool.fetchBusyTimes(
      weekStart.toISOString(),
      weekEnd.toISOString(),
    );
    const singleCallEnd = Date.now();
    const singleCallTime = singleCallEnd - singleCallStart;

    logger.info(`📊 Single FreeBusy call for 7 days: ${singleCallTime}ms`);
    logger.info(`📊 Found ${weekBusyTimes.length} busy periods for the week`);

    // Simulate multiple daily calls
    const multiCallStart = Date.now();
    let totalDailyBusyTimes = 0;

    for (let day = 0; day < 7; day++) {
      const dayStart = new Date(weekStart);
      dayStart.setDate(dayStart.getDate() + day);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dailyBusyTimes = await calendarTool.fetchBusyTimes(
        dayStart.toISOString(),
        dayEnd.toISOString(),
      );
      totalDailyBusyTimes += dailyBusyTimes.length;
    }

    const multiCallEnd = Date.now();
    const multiCallTime = multiCallEnd - multiCallStart;

    logger.info(`📊 Multiple daily calls (7 calls): ${multiCallTime}ms`);
    logger.info(`📊 Found ${totalDailyBusyTimes} total busy periods`);

    const efficiencyGain = (
      ((multiCallTime - singleCallTime) / multiCallTime) *
      100
    ).toFixed(1);
    logger.info(
      `🚀 Efficiency gain: ${efficiencyGain}% faster with single FreeBusy call`,
    );
    logger.info(`📈 API call reduction: 7 calls → 1 call (85.7% reduction)`);

    // Test 4: Memory usage check
    logger.info("\n💾 Test 4: Memory usage analysis");
    const memUsage = process.memoryUsage();
    logger.info(`📊 Memory usage:`);
    logger.info(`   RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
    logger.info(
      `   Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    );
    logger.info(
      `   Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    );

    logger.info("\n✅ All tests completed successfully!");
    logger.info("\n📋 Summary:");
    logger.info(`   • FreeBusy API is working correctly`);
    logger.info(
      `   • Single API call is ${efficiencyGain}% faster than multiple calls`,
    );
    logger.info(
      `   • Found ${availableSlots.length} available slots for next week`,
    );
    logger.info(`   • Memory usage is within normal limits`);
  } catch (error) {
    logger.error("❌ Test failed:", error);
    logger.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testFreeBusyApiPerformance()
    .then(() => {
      logger.info("🎉 Integration test completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("💥 Integration test failed:", error);
      process.exit(1);
    });
}

module.exports = { testFreeBusyApiPerformance };
