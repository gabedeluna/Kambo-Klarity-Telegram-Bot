const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire'); // Keep for potential future use

// Import the class
const GoogleCalendarTool = require('../../../src/tools/googleCalendar');

describe('Google Calendar Tool Class (Stubs)', () => {
    let calendarInstance;
    let simpleLogger; // A plain object
    let infoSpy;      // The spy attached to simpleLogger.info

    beforeEach(() => {
        // Create a simple logger object
        simpleLogger = {
            info: (_arg1, _arg2) => { /* Real function (can be empty or log) */ },
            warn: () => {}, // Add other methods if needed by constructor/etc.
            error: () => {},
            debug: () => {},
            fatal: () => {},
        };
        // SPY on the 'info' method of the simpleLogger object
        infoSpy = sinon.spy(simpleLogger, 'info');

        // Instantiate the class with the simple logger
        calendarInstance = new GoogleCalendarTool({ logger: simpleLogger });

    });

    afterEach(() => {
        sinon.restore(); // Should restore the spy and any stubs
    });

    describe('Constructor', () => {
        it('should create an instance with a logger and log success', () => {
            // Check the spy attached to simpleLogger.info was called by constructor
            expect(infoSpy.calledWith('[GoogleCalendarTool] Instance created successfully (with stubs).')).to.be.true;
        });

        // Adjusted fallback test: Only check console.error, not pino specifics
        it('should log error via console if logger dependency is missing during construction', () => {
             const consoleErrorStub = sinon.stub(console, 'error');
             // We cannot easily mock the internal pino fallback without the old setup.
             const instanceWithoutLogger = new GoogleCalendarTool({});
             expect(consoleErrorStub.calledWith('FATAL: GoogleCalendarTool construction failed. Missing logger dependency. Using console.')).to.be.true;
             expect(instanceWithoutLogger.logger).to.exist; // Check *a* logger exists (the internal fallback)
             consoleErrorStub.restore(); // Restore console stub here
        });
    });

    describe('findFreeSlots Method (stub)', () => {
        // Test structure validity (remains the same)
        it('should return an array of objects with start and end string properties', async () => {
            // ... same assertions ...
            const result = await calendarInstance.findFreeSlots();
            expect(result).to.be.an('array');
            expect(result).to.have.length.greaterThan(0);
            expect(result[0]).to.be.an('object');
            expect(result[0]).to.have.all.keys('start', 'end');
            const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
            expect(result[0].start).to.match(iso8601Regex);
            expect(result[0].end).to.match(iso8601Regex);
        });

        // Test hardcoded data (remains the same)
        it('should return the expected hardcoded fake slots', async () => {
            // ... setup expectedSlots ...
            const today = new Date();
            const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
            const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
            const formatDate = (date, hour) => {
                const d = new Date(date); d.setUTCHours(hour, 0, 0, 0); return d.toISOString();
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
        it('should log the call with options using the instance logger', async () => {
            const testOptions = { durationMinutes: 60, testId: 'logging_test' };
            // Reset spy history *after* constructor call, *before* the call we want to test
            infoSpy.resetHistory();

            await calendarInstance.findFreeSlots(testOptions);

            // Assert on the spy attached to simpleLogger.info
            expect(infoSpy.calledOnce).to.be.true; // <<< Check this assertion
            const logArgs = infoSpy.getCall(0).args;
            expect(logArgs[0]).to.deep.equal({ options: testOptions });
            expect(logArgs[1]).to.equal('STUB: findFreeSlots called on instance');
        });

        // Test for behavior if called on an instance created *without* a proper logger (using fallback)
        it('should still work using fallback logger if constructed without one', async () => {
             const consoleErrorStub = sinon.stub(console, 'error');

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
             const ToolWithMockedPino = proxyquire('../../../src/tools/googleCalendar', {
                  'pino': mockPinoFactory
             });
             // ---------------------------------------- //

             // Construct without providing a logger, triggering fallback
             const instanceWithoutLogger = new ToolWithMockedPino({});

             // Verify console error was logged during construction
             expect(consoleErrorStub.calledWith('FATAL: GoogleCalendarTool construction failed. Missing logger dependency. Using console.')).to.be.true;
             consoleErrorStub.resetHistory(); // Reset after constructor log

             // Call the method
             const testOptions = { testId: 'fallback_test' };
             const result = await instanceWithoutLogger.findFreeSlots(testOptions);

             // Check the fallback logger (mockPinoInstance) was called by findFreeSlots
             // Note: The fallback pino instance also logs in the constructor, so reset history or check call count/args
             // Easiest is to check the specific call from findFreeSlots
             expect(mockPinoInstance.info.calledWith({ options: testOptions }, 'STUB: findFreeSlots called on instance')).to.be.true;

             // Should still return data
             expect(result).to.be.an('array');
             expect(result.length).to.be.greaterThan(0);

             // No need to restore consoleErrorStub here, afterEach handles sinon.restore()
        });
    });
});
