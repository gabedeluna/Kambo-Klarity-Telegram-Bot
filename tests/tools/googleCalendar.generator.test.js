// GoogleCalendarTool Slot Generation Tests

const {
  mockLogger,
  mockPrisma,
  setupEnvironment,
  teardownEnvironment,
  clearAllMocks,
} = require("./googleCalendar.setup");

const GoogleCalendarTool = require("../../src/tools/googleCalendar");

describe("GoogleCalendarTool - Slot Generation", () => {
  let googleCalendarTool;

  beforeAll(() => {
    setupEnvironment();
  });

  afterAll(() => {
    teardownEnvironment();
  });

  beforeEach(() => {
    clearAllMocks();

    const dependencies = {
      logger: mockLogger,
      prisma: mockPrisma,
    };
    googleCalendarTool = new GoogleCalendarTool(dependencies);
  });

  describe("generateAvailableSlots", () => {
    it("should generate slots for available time blocks", () => {
      const startDate = new Date("2024-01-15T00:00:00.000Z"); // Monday
      const endDate = new Date("2024-01-15T23:59:59.999Z");
      const durationMinutes = 60;
      const busyTimes = [];
      const availabilityRule = {
        weekly_availability: {
          MON: [{ start: "09:00", end: "12:00" }],
        },
        buffer_time_minutes: 0,
      };

      const result = googleCalendarTool.generateAvailableSlots(
        startDate,
        endDate,
        durationMinutes,
        busyTimes,
        availabilityRule,
      );

      expect(result.length).toBeGreaterThan(0);

      // Should have slots starting at 9:00, 9:30, 10:00, 10:30, 11:00
      // (11:30 would end at 12:30, which is past the 12:00 end time)
      expect(result.length).toBe(5);
    });

    it("should exclude slots that overlap with busy times", () => {
      const startDate = new Date("2024-01-15T00:00:00.000Z");
      const endDate = new Date("2024-01-15T23:59:59.999Z");
      const durationMinutes = 60;
      const busyTimes = [
        {
          start: "2024-01-15T10:00:00.000Z",
          end: "2024-01-15T11:00:00.000Z",
        },
      ];
      const availabilityRule = {
        weekly_availability: {
          MON: [{ start: "09:00", end: "12:00" }],
        },
        buffer_time_minutes: 0,
      };

      const result = googleCalendarTool.generateAvailableSlots(
        startDate,
        endDate,
        durationMinutes,
        busyTimes,
        availabilityRule,
      );

      // Should exclude the 10:00 slot due to conflict
      const conflictingSlots = result.filter((slot) => {
        const slotStart = new Date(slot.start);
        return slotStart.getUTCHours() === 10;
      });

      expect(conflictingSlots).toHaveLength(0);
    });

    it("should respect buffer time around busy periods", () => {
      const startDate = new Date("2024-01-15T00:00:00.000Z");
      const endDate = new Date("2024-01-15T23:59:59.999Z");
      const durationMinutes = 60;
      const busyTimes = [
        {
          start: "2024-01-15T10:00:00.000Z",
          end: "2024-01-15T11:00:00.000Z",
        },
      ];
      const availabilityRule = {
        weekly_availability: {
          MON: [{ start: "09:00", end: "13:00" }],
        },
        buffer_time_minutes: 30,
      };

      const result = googleCalendarTool.generateAvailableSlots(
        startDate,
        endDate,
        durationMinutes,
        busyTimes,
        availabilityRule,
      );

      // Should exclude slots that would conflict with buffer time
      // 9:30 slot (9:30-10:30) would conflict with busy time + buffer (9:30-11:30)
      const conflictingSlots = result.filter((slot) => {
        const slotStart = new Date(slot.start);
        return (
          slotStart.getUTCHours() === 9 && slotStart.getUTCMinutes() === 30
        );
      });

      expect(conflictingSlots).toHaveLength(0);
    });

    it("should handle multiple availability blocks in a day", () => {
      const startDate = new Date("2024-01-15T00:00:00.000Z"); // Monday
      const endDate = new Date("2024-01-15T23:59:59.999Z");
      const durationMinutes = 60;
      const busyTimes = [];
      const availabilityRule = {
        weekly_availability: {
          MON: [
            { start: "09:00", end: "11:00" },
            { start: "13:00", end: "15:00" },
          ],
        },
        buffer_time_minutes: 0,
      };

      const result = googleCalendarTool.generateAvailableSlots(
        startDate,
        endDate,
        durationMinutes,
        busyTimes,
        availabilityRule,
      );

      expect(result.length).toBeGreaterThan(0);

      // Should have slots from both morning and afternoon blocks
      // Morning: 09:00, 09:30, 10:00 (3 slots)
      // Afternoon: 13:00, 13:30, 14:00 (3 slots)
      expect(result.length).toBe(6);
    });

    it("should return empty array when no availability for the day", () => {
      const startDate = new Date("2024-01-13T00:00:00.000Z"); // Saturday
      const endDate = new Date("2024-01-13T23:59:59.999Z");
      const durationMinutes = 60;
      const busyTimes = [];
      const availabilityRule = {
        weekly_availability: {
          MON: [{ start: "09:00", end: "17:00" }],
          // No SAT availability
        },
        buffer_time_minutes: 0,
      };

      const result = googleCalendarTool.generateAvailableSlots(
        startDate,
        endDate,
        durationMinutes,
        busyTimes,
        availabilityRule,
      );

      expect(result).toEqual([]);
    });

    it("should handle sessions that span multiple days", () => {
      const startDate = new Date("2024-01-15T00:00:00.000Z"); // Monday
      const endDate = new Date("2024-01-16T23:59:59.999Z"); // Tuesday
      const durationMinutes = 60;
      const busyTimes = [];
      const availabilityRule = {
        weekly_availability: {
          MON: [{ start: "09:00", end: "11:00" }],
          TUE: [{ start: "14:00", end: "16:00" }],
        },
        buffer_time_minutes: 0,
      };

      const result = googleCalendarTool.generateAvailableSlots(
        startDate,
        endDate,
        durationMinutes,
        busyTimes,
        availabilityRule,
      );

      expect(result.length).toBeGreaterThan(0);

      // Should have slots from both Monday and Tuesday
      // Monday: 09:00, 09:30, 10:00 (3 slots)
      // Tuesday: 14:00, 14:30, 15:00 (3 slots)
      expect(result.length).toBe(6);
    });
  });
});
