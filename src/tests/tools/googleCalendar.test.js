const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire"); // Keep for potential future use
const { z } = require("zod"); // Import Zod
const {
  // Import schemas
  findFreeSlotsSchema,
  createCalendarEventSchema,
} = require("../../../src/tools/toolSchemas");

// Import the class
const GoogleCalendarTool = require("../../../src/tools/googleCalendar");

describe("Google Calendar Tool Class (Stubs)", () => {
  let calendarInstance;
  let simpleLogger; // A plain object
  let infoSpy; // The spy attached to simpleLogger.info

  beforeEach(() => {
    // Create a simple logger object
    simpleLogger = {
      info: (_arg1, _arg2) => {
        /* Real function (can be empty or log) */
      },
      warn: () => {}, // Add other methods if needed by constructor/etc.
      error: () => {},
      debug: () => {},
      fatal: () => {},
    };
    // SPY on the 'info' method of the simpleLogger object
    infoSpy = sinon.spy(simpleLogger, "info");

    // Instantiate the class with the simple logger
    calendarInstance = new GoogleCalendarTool({ logger: simpleLogger });
  });

  afterEach(() => {
    sinon.restore(); // Should restore the spy and any stubs
  });

  describe("Constructor", () => {
    it("should create an instance with a logger and log success", () => {
      // Check the spy attached to simpleLogger.info was called by constructor
      expect(
        infoSpy.calledWith(
          "[GoogleCalendarTool] Instance created successfully (with stubs).",
        ),
      ).to.be.true;
    });

    // Adjusted fallback test: Only check console.error, not pino specifics
    it("should log error via console if logger dependency is missing during construction", () => {
      const consoleErrorStub = sinon.stub(console, "error");
      // We cannot easily mock the internal pino fallback without the old setup.
      const instanceWithoutLogger = new GoogleCalendarTool({});
      expect(
        consoleErrorStub.calledWith(
          "FATAL: GoogleCalendarTool construction failed. Missing logger dependency. Using console.",
        ),
      ).to.be.true;
      expect(instanceWithoutLogger.logger).to.exist; // Check *a* logger exists (the internal fallback)
      consoleErrorStub.restore(); // Restore console stub here
    });
  });

  describe("findFreeSlots Method (stub)", () => {
    // --- Schema Validation Tests ---
    describe("Schema Validation", () => {
      const validDate = new Date().toISOString();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const validEndDate = tomorrow.toISOString();

      it("should accept valid input (empty object - all optional)", () => {
        const validInput = {};
        expect(() => findFreeSlotsSchema.parse(validInput)).to.not.throw();
      });

      it("should accept valid input with all fields", () => {
        const validInput = {
          startDate: validDate,
          endDate: validEndDate,
          durationMinutes: 60,
        };
        expect(() => findFreeSlotsSchema.parse(validInput)).to.not.throw();
      });

      it("should accept valid input with only some fields", () => {
        const validInput = { durationMinutes: 90 };
        expect(() => findFreeSlotsSchema.parse(validInput)).to.not.throw();
        const validInput2 = { startDate: validDate };
        expect(() => findFreeSlotsSchema.parse(validInput2)).to.not.throw();
      });

      it("should reject invalid input (wrong type for startDate)", () => {
        const invalidInput = { startDate: 12345 };
        expect(() => findFreeSlotsSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (invalid date string for endDate)", () => {
        const invalidInput = { endDate: "not-a-date" };
        expect(() => findFreeSlotsSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (wrong type for durationMinutes)", () => {
        const invalidInput = { durationMinutes: "60" };
        expect(() => findFreeSlotsSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (non-positive durationMinutes)", () => {
        const invalidInput = { durationMinutes: 0 };
        expect(() => findFreeSlotsSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
        const invalidInput2 = { durationMinutes: -30 };
        expect(() => findFreeSlotsSchema.parse(invalidInput2)).to.throw(
          z.ZodError,
        );
      });
    });
    // --- End Schema Validation Tests ---

    // Test structure validity (remains the same)
    it("should return an array of objects with start and end string properties", async () => {
      // ... same assertions ...
      const result = await calendarInstance.findFreeSlots();
      expect(result).to.be.an("array");
      expect(result).to.have.length.greaterThan(0);
      expect(result[0]).to.be.an("object");
      expect(result[0]).to.have.all.keys("start", "end");
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
      expect(result[0].start).to.match(iso8601Regex);
      expect(result[0].end).to.match(iso8601Regex);
    });

    // Test hardcoded data (remains the same)
    it("should return the expected hardcoded fake slots", async () => {
      // ... setup expectedSlots ...
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const dayAfter = new Date(today);
      dayAfter.setDate(today.getDate() + 2);
      const formatDate = (date, hour) => {
        const d = new Date(date);
        d.setUTCHours(hour, 0, 0, 0);
        return d.toISOString();
      };
      const expectedSlots = [
        { start: formatDate(tomorrow, 10), end: formatDate(tomorrow, 11) },
        { start: formatDate(tomorrow, 14), end: formatDate(tomorrow, 15) },
        { start: formatDate(dayAfter, 11), end: formatDate(dayAfter, 12) },
      ];
      const result = await calendarInstance.findFreeSlots();
      expect(result).to.deep.equal(expectedSlots);
    });

    // Updated Logging Test - Assert on the infoSpy
    it("should log the call with options using the instance logger", async () => {
      const testOptions = { durationMinutes: 60, testId: "logging_test" };
      // Reset spy history *after* constructor call, *before* the call we want to test
      infoSpy.resetHistory();

      await calendarInstance.findFreeSlots(testOptions);

      // Assert on the spy attached to simpleLogger.info
      expect(infoSpy.calledOnce).to.be.true; // <<< Check this assertion
      const logArgs = infoSpy.getCall(0).args;
      expect(logArgs[0]).to.deep.equal({ options: testOptions });
      expect(logArgs[1]).to.equal("STUB: findFreeSlots called on instance");
    });

    // Test for behavior if called on an instance created *without* a proper logger (using fallback)
    it("should still work using fallback logger if constructed without one", async () => {
      const consoleErrorStub = sinon.stub(console, "error");

      // --- Mock Pino for this specific test --- //
      const mockPinoInstance = {
        info: sinon.stub(),
        warn: sinon.stub(),
        error: sinon.stub(),
        debug: sinon.stub(),
        fatal: sinon.stub(),
      };
      const mockPinoFactory = sinon.stub().returns(mockPinoInstance);
      const mockPinoDestination = sinon.stub().returns({}); // Mock pino.destination
      // Need to mock the destination property on the factory function itself
      mockPinoFactory.destination = mockPinoDestination;

      // Use proxyquire to inject the mock pino
      const ToolWithMockedPino = proxyquire(
        "../../../src/tools/googleCalendar",
        {
          pino: mockPinoFactory,
        },
      );
      // ---------------------------------------- //

      // Construct without providing a logger, triggering fallback
      const instanceWithoutLogger = new ToolWithMockedPino({});

      // Verify console error was logged during construction
      expect(
        consoleErrorStub.calledWith(
          "FATAL: GoogleCalendarTool construction failed. Missing logger dependency. Using console.",
        ),
      ).to.be.true;
      consoleErrorStub.resetHistory(); // Reset after constructor log

      // Call the method
      const testOptions = { testId: "fallback_test" };
      const result = await instanceWithoutLogger.findFreeSlots(testOptions);

      // Check the fallback logger (mockPinoInstance) was called by findFreeSlots
      // Note: The fallback pino instance also logs in the constructor, so reset history or check call count/args
      // Easiest is to check the specific call from findFreeSlots
      expect(
        mockPinoInstance.info.calledWith(
          { options: testOptions },
          "STUB: findFreeSlots called on instance",
        ),
      ).to.be.true;

      // Should still return data
      expect(result).to.be.an("array");
      expect(result.length).to.be.greaterThan(0);

      // No need to restore consoleErrorStub here, afterEach handles sinon.restore()
    });
  });

  describe("createCalendarEvent Method (stub)", () => {
    const eventDetails = {
      start: "2024-01-25T10:00:00Z",
      end: "2024-01-25T11:00:00Z",
      summary: "Test Event Creation",
      description: "A test event for the stub function.",
      attendeeEmail: "test@example.com",
    };

    // --- Schema Validation Tests ---
    describe("Schema Validation", () => {
      it("should accept valid input with required fields", () => {
        const validInput = {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour later
          summary: "Valid Event",
        };
        expect(() =>
          createCalendarEventSchema.parse(validInput),
        ).to.not.throw();
      });

      it("should accept valid input with all fields", () => {
        const validInput = {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          summary: "Valid Event Full",
          description: "Optional description here.",
          attendeeEmail: "attendee@example.org",
        };
        expect(() =>
          createCalendarEventSchema.parse(validInput),
        ).to.not.throw();
      });

      it("should reject invalid input (missing start)", () => {
        const invalidInput = {
          end: eventDetails.end,
          summary: eventDetails.summary,
        };
        expect(() => createCalendarEventSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (missing end)", () => {
        const invalidInput = {
          start: eventDetails.start,
          summary: eventDetails.summary,
        };
        expect(() => createCalendarEventSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (missing summary)", () => {
        const invalidInput = {
          start: eventDetails.start,
          end: eventDetails.end,
        };
        expect(() => createCalendarEventSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (empty string summary)", () => {
        const invalidInput = {
          start: eventDetails.start,
          end: eventDetails.end,
          summary: "",
        };
        expect(() => createCalendarEventSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (invalid date string for start)", () => {
        const invalidInput = { ...eventDetails, start: "not-a-date" };
        expect(() => createCalendarEventSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (invalid email for attendeeEmail)", () => {
        const invalidInput = {
          ...eventDetails,
          attendeeEmail: "invalid-email",
        };
        expect(() => createCalendarEventSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });

      it("should reject invalid input (wrong type for summary)", () => {
        const invalidInput = { ...eventDetails, summary: 123 };
        expect(() => createCalendarEventSchema.parse(invalidInput)).to.throw(
          z.ZodError,
        );
      });
    });
    // --- End Schema Validation Tests ---

    it("should return a success object with a fake eventId", async () => {
      const result = await calendarInstance.createCalendarEvent(eventDetails);

      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result.eventId).to.be.a("string").and.not.be.empty;
      expect(result.eventId).to.include("fake-event-");
    });

    it("should log the received event details", async () => {
      await calendarInstance.createCalendarEvent(eventDetails);

      // Initialize logs once, createCalendarEvent logs once
      expect(infoSpy.calledTwice).to.be.true;
      // The second log call should be from createCalendarEvent
      expect(infoSpy.secondCall.args[0].eventDetails).to.deep.equal(
        eventDetails,
      );
      expect(infoSpy.secondCall.args[1]).to.equal(
        "STUB: createCalendarEvent called",
      );
    });
  });
});
