// Shared setup for GoogleCalendarTool tests

// Mock dependencies before requiring the module
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};

const mockPrisma = {
  availabilityRule: {
    findFirst: jest.fn(),
  },
};

// Mock googleapis
const mockCalendarEvents = {
  list: jest.fn(),
};

const mockCalendarFreeBusy = {
  query: jest.fn(),
};

const mockCalendar = {
  events: mockCalendarEvents,
  freebusy: mockCalendarFreeBusy,
};

jest.mock("googleapis", () => ({
  google: {
    calendar: jest.fn(() => mockCalendar),
  },
}));

// Mock google-auth-library
const mockJWT = jest.fn();
jest.mock("google-auth-library", () => ({
  JWT: mockJWT,
}));

// Mock pino
jest.mock("pino", () => {
  const mockPino = jest.fn(() => mockLogger);
  mockPino.destination = jest.fn(() => ({}));
  return mockPino;
});

// Set up environment variables for testing
const originalEnv = process.env;

const setupEnvironment = () => {
  process.env = {
    ...originalEnv,
    GOOGLE_APPLICATION_CREDENTIALS: "/path/to/test/credentials.json",
    GOOGLE_CALENDAR_ID: "test-session-calendar@example.com",
    GOOGLE_PERSONAL_CALENDAR_ID: "test-personal-calendar@example.com",
    PRACTITIONER_TIMEZONE: "America/Chicago",
    TEMP_WEEKLY_AVAILABILITY_JSON: JSON.stringify({
      MON: [{ start: "09:00", end: "17:00" }],
      TUE: [{ start: "09:00", end: "17:00" }],
      WED: [{ start: "09:00", end: "17:00" }],
      THU: [{ start: "09:00", end: "17:00" }],
      FRI: [{ start: "09:00", end: "17:00" }],
    }),
    TEMP_MAX_ADVANCE_DAYS: "60",
    TEMP_MIN_NOTICE_HOURS: "24",
    TEMP_BUFFER_TIME_MINUTES: "30",
    TEMP_MAX_BOOKINGS_PER_DAY: "4",
  };
};

const teardownEnvironment = () => {
  process.env = originalEnv;
};

const clearAllMocks = () => {
  jest.clearAllMocks();

  // Reset mock implementations
  mockJWT.mockClear();
  mockCalendarEvents.list.mockClear();
  mockCalendarFreeBusy.query.mockClear();
  mockPrisma.availabilityRule.findFirst.mockClear();

  // Clear logger calls
  Object.values(mockLogger).forEach((fn) => fn.mockClear());
};

const createMockRule = (overrides = {}) => ({
  weekly_availability: {
    MON: [{ start: "09:00", end: "17:00" }],
    TUE: [{ start: "09:00", end: "17:00" }],
    WED: [{ start: "09:00", end: "17:00" }],
    THU: [{ start: "09:00", end: "17:00" }],
    FRI: [{ start: "09:00", end: "17:00" }],
  },
  practitioner_timezone: "America/Chicago",
  max_advance_days: 60,
  min_notice_hours: 1, // Set to 1 hour for easier testing
  buffer_time_minutes: 30,
  max_bookings_per_day: 4,
  slot_increment_minutes: 15,
  ...overrides,
});

const getNextMonday = () => {
  const futureMonday = new Date();
  futureMonday.setDate(
    futureMonday.getDate() + ((8 - futureMonday.getDay()) % 7) || 7,
  );
  return futureMonday.toISOString().split("T")[0];
};

module.exports = {
  mockLogger,
  mockPrisma,
  mockCalendarEvents,
  mockCalendarFreeBusy,
  mockCalendar,
  mockJWT,
  setupEnvironment,
  teardownEnvironment,
  clearAllMocks,
  createMockRule,
  getNextMonday,
};
