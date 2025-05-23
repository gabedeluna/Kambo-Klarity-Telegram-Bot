#!/usr/bin/env node

/**
 * FreeBusy API Benchmark Script
 *
 * This script runs performance benchmarks on the FreeBusy API implementation
 * to ensure optimal performance over time.
 *
 * Usage: node scripts/benchmark-freebusy.js [options]
 * Options:
 *   --days <number>     Number of days to test (default: 7)
 *   --iterations <number> Number of test iterations (default: 3)
 *   --verbose           Enable verbose logging
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const GoogleCalendarTool = require("../src/tools/googleCalendar");
const pino = require("pino");

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  days: 7,
  iterations: 3,
  verbose: false,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--days":
      options.days = parseInt(args[++i]) || 7;
      break;
    case "--iterations":
      options.iterations = parseInt(args[++i]) || 3;
      break;
    case "--verbose":
      options.verbose = true;
      break;
    case "--help":
      console.log(`
FreeBusy API Benchmark Script

Usage: node scripts/benchmark-freebusy.js [options]

Options:
  --days <number>       Number of days to test (default: 7)
  --iterations <number> Number of test iterations (default: 3)
  --verbose             Enable verbose logging
  --help                Show this help message
`);
      process.exit(0);
  }
}

// Create logger
const logger = pino({
  level: options.verbose ? "debug" : "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
    },
  },
});

// Mock Prisma for benchmarking
const mockPrisma = {
  availabilityRule: {
    findFirst: async () => ({
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
    }),
  },
};

async function runBenchmark() {
  logger.info(`🚀 Starting FreeBusy API Benchmark`);
  logger.info(
    `📊 Configuration: ${options.days} days, ${options.iterations} iterations`,
  );

  // Check environment
  if (
    !process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    !process.env.GOOGLE_CALENDAR_ID
  ) {
    logger.error("❌ Missing required environment variables");
    process.exit(1);
  }

  try {
    // Initialize calendar tool
    const calendarTool = new GoogleCalendarTool({
      logger: options.verbose
        ? logger
        : {
            info: () => {},
            error: logger.error,
            warn: logger.warn,
            debug: () => {},
          },
      prisma: mockPrisma,
    });

    const results = {
      freeBusyTimes: [],
      slotGenerationTimes: [],
      slotCounts: [],
      memoryUsage: [],
    };

    // Run benchmark iterations
    for (let i = 0; i < options.iterations; i++) {
      logger.info(`\n🔄 Iteration ${i + 1}/${options.iterations}`);

      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + options.days);

      // Benchmark FreeBusy API call
      const freeBusyStart = Date.now();
      const busyTimes = await calendarTool.fetchBusyTimes(
        now.toISOString(),
        endDate.toISOString(),
      );
      const freeBusyTime = Date.now() - freeBusyStart;
      results.freeBusyTimes.push(freeBusyTime);

      // Benchmark slot generation
      const slotStart = Date.now();
      const slots = await calendarTool.findFreeSlots({
        startDateRange: now.toISOString().split("T")[0] + "T00:00:00",
        endDateRange: endDate.toISOString().split("T")[0] + "T23:59:59",
        sessionDurationMinutes: 90,
      });
      const slotTime = Date.now() - slotStart;
      results.slotGenerationTimes.push(slotTime);
      results.slotCounts.push(slots.length);

      // Memory usage
      const memUsage = process.memoryUsage();
      results.memoryUsage.push({
        rss: memUsage.rss / 1024 / 1024,
        heapUsed: memUsage.heapUsed / 1024 / 1024,
        heapTotal: memUsage.heapTotal / 1024 / 1024,
      });

      logger.info(
        `  FreeBusy: ${freeBusyTime}ms, Slots: ${slotTime}ms, Count: ${slots.length}, Busy: ${busyTimes.length}`,
      );

      // Small delay between iterations
      if (i < options.iterations - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Calculate statistics
    const stats = {
      freeBusy: calculateStats(results.freeBusyTimes),
      slotGeneration: calculateStats(results.slotGenerationTimes),
      slotCount: calculateStats(results.slotCounts),
      memory: {
        rss: calculateStats(results.memoryUsage.map((m) => m.rss)),
        heapUsed: calculateStats(results.memoryUsage.map((m) => m.heapUsed)),
        heapTotal: calculateStats(results.memoryUsage.map((m) => m.heapTotal)),
      },
    };

    // Display results
    logger.info("\n📊 Benchmark Results");
    logger.info("===================");
    logger.info(`FreeBusy API Performance:`);
    logger.info(`  Average: ${stats.freeBusy.avg.toFixed(1)}ms`);
    logger.info(`  Min: ${stats.freeBusy.min}ms`);
    logger.info(`  Max: ${stats.freeBusy.max}ms`);
    logger.info(`  Std Dev: ${stats.freeBusy.stdDev.toFixed(1)}ms`);

    logger.info(`\nSlot Generation Performance:`);
    logger.info(`  Average: ${stats.slotGeneration.avg.toFixed(1)}ms`);
    logger.info(`  Min: ${stats.slotGeneration.min}ms`);
    logger.info(`  Max: ${stats.slotGeneration.max}ms`);
    logger.info(`  Std Dev: ${stats.slotGeneration.stdDev.toFixed(1)}ms`);

    logger.info(`\nSlot Count:`);
    logger.info(`  Average: ${stats.slotCount.avg.toFixed(1)} slots`);
    logger.info(`  Min: ${stats.slotCount.min} slots`);
    logger.info(`  Max: ${stats.slotCount.max} slots`);

    logger.info(`\nMemory Usage:`);
    logger.info(
      `  RSS: ${stats.memory.rss.avg.toFixed(1)} MB (±${stats.memory.rss.stdDev.toFixed(1)})`,
    );
    logger.info(
      `  Heap Used: ${stats.memory.heapUsed.avg.toFixed(1)} MB (±${stats.memory.heapUsed.stdDev.toFixed(1)})`,
    );
    logger.info(
      `  Heap Total: ${stats.memory.heapTotal.avg.toFixed(1)} MB (±${stats.memory.heapTotal.stdDev.toFixed(1)})`,
    );

    // Performance assessment
    logger.info("\n🎯 Performance Assessment");
    logger.info("========================");

    if (stats.freeBusy.avg < 300) {
      logger.info("✅ FreeBusy API performance: EXCELLENT");
    } else if (stats.freeBusy.avg < 500) {
      logger.info("✅ FreeBusy API performance: GOOD");
    } else {
      logger.warn("⚠️  FreeBusy API performance: NEEDS ATTENTION");
    }

    if (stats.slotGeneration.avg < 500) {
      logger.info("✅ Slot generation performance: EXCELLENT");
    } else if (stats.slotGeneration.avg < 1000) {
      logger.info("✅ Slot generation performance: GOOD");
    } else {
      logger.warn("⚠️  Slot generation performance: NEEDS ATTENTION");
    }

    if (stats.memory.heapUsed.avg < 150) {
      logger.info("✅ Memory usage: EXCELLENT");
    } else if (stats.memory.heapUsed.avg < 250) {
      logger.info("✅ Memory usage: GOOD");
    } else {
      logger.warn("⚠️  Memory usage: HIGH");
    }

    logger.info("\n🎉 Benchmark completed successfully!");
  } catch (error) {
    logger.error("❌ Benchmark failed:", error);
    process.exit(1);
  }
}

function calculateStats(values) {
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  const variance =
    values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) /
    values.length;
  const stdDev = Math.sqrt(variance);

  return { avg, min, max, stdDev };
}

// Run benchmark if this file is executed directly
if (require.main === module) {
  runBenchmark()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Benchmark failed:", error);
      process.exit(1);
    });
}

module.exports = { runBenchmark };
