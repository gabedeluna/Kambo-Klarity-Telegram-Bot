// tests/core/prisma.test.js

const mockPrismaClientInstance = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  // user: { findUnique: jest.fn() }, // Example, add if needed by other modules
  // sessionType: { findMany: jest.fn() } // Example
};

// This variable will hold the mock constructor. It's defined in the outer scope
// so it can be referenced by both jest.mock and the tests.
let MockPrismaClientConstructor;

jest.mock('@prisma/client', () => {
  // Assign the mock function to the outer scope variable
  MockPrismaClientConstructor = jest.fn(() => mockPrismaClientInstance);
  return {
    PrismaClient: MockPrismaClientConstructor,
  };
});

const mockAppLogger = {
  child: jest.fn(),
  info: jest.fn(), // For appLogger itself if used directly
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  debug: jest.fn(),
};
const mockPrismaChildLogger = { // This is what appLogger.child will return
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  debug: jest.fn(),
};
mockAppLogger.child.mockReturnValue(mockPrismaChildLogger); // Setup child mock

jest.mock('../../src/core/logger', () => mockAppLogger);


const ORIGINAL_ENV = process.env;
let prisma; // This will hold the instance of the module under test

describe('Core Prisma Client (prisma.js)', () => {

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV }; // Reset process.env for each test

    // Clear mocks
    if (MockPrismaClientConstructor) MockPrismaClientConstructor.mockClear();
    mockPrismaClientInstance.$connect.mockClear();
    mockPrismaClientInstance.$disconnect.mockClear();
    mockAppLogger.child.mockClear();
    Object.values(mockPrismaChildLogger).forEach(fn => fn.mockClear());
    Object.values(mockAppLogger).forEach(fn => {
        if(jest.isMockFunction(fn) && fn !== mockAppLogger.child) fn.mockClear();
    });


    // Spy on process.on before requiring the module
    jest.spyOn(process, 'on').mockImplementation(jest.fn());
    jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); }); // Prevent actual exit

    // Require the module under test *after* resetting modules, env, and clearing mocks.
    prisma = require('../../src/core/prisma');
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV; // Restore original environment
    jest.restoreAllMocks(); // Restore process.on and process.exit spies
  });

  it('should instantiate PrismaClient, create a child logger, and log instantiation', () => {
    expect(MockPrismaClientConstructor).toHaveBeenCalledTimes(1);
    expect(mockAppLogger.child).toHaveBeenCalledWith({ component: "prisma" });
    expect(mockPrismaChildLogger.info).toHaveBeenCalledWith("Prisma Client instantiated.");
    expect(prisma).toBe(mockPrismaClientInstance);
  });

  it('should have $connect and $disconnect methods from the mocked instance', () => {
    expect(prisma.$connect).toEqual(expect.any(Function));
    expect(prisma.$disconnect).toEqual(expect.any(Function));
  });

  it('calling $connect on the exported prisma instance should call the mock $connect', async () => {
    await prisma.$connect();
    expect(mockPrismaClientInstance.$connect).toHaveBeenCalledTimes(1);
    // Ensure constructor wasn't called again during this specific test action
    expect(MockPrismaClientConstructor).toHaveBeenCalledTimes(1); // Still 1 from beforeEach's require
  });

  it('calling $disconnect on the exported prisma instance should call the mock $disconnect', async () => {
    await prisma.$disconnect();
    expect(mockPrismaClientInstance.$disconnect).toHaveBeenCalledTimes(1);
    // Ensure constructor wasn't called again
    expect(MockPrismaClientConstructor).toHaveBeenCalledTimes(1); // Still 1 from beforeEach's require
  });
});

describe('Prisma Client Logging Configuration', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    if (MockPrismaClientConstructor) MockPrismaClientConstructor.mockClear();
    mockAppLogger.child.mockClear(); // Ensure child logger mock is clean for these specific tests
    mockAppLogger.child.mockReturnValue(mockPrismaChildLogger); // Re-assign mock return value
    Object.values(mockPrismaChildLogger).forEach(fn => fn.mockClear());
  });
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('should configure PrismaClient with no log levels if PRISMA_LOGGING is not set', () => {
    delete process.env.PRISMA_LOGGING;
    require('../../src/core/prisma');
    expect(MockPrismaClientConstructor).toHaveBeenCalledWith({
      log: undefined, // Or an empty array, depending on PrismaClient behavior with undefined
    });
  });

  it('should configure PrismaClient with specified valid log levels from PRISMA_LOGGING', () => {
    process.env.PRISMA_LOGGING = 'query,warn';
    require('../../src/core/prisma');
    expect(MockPrismaClientConstructor).toHaveBeenCalledWith({
      log: ['query', 'warn'],
    });
  });

  it('should filter out invalid log levels from PRISMA_LOGGING', () => {
    process.env.PRISMA_LOGGING = 'query,invalid,error,another_invalid';
    require('../../src/core/prisma');
    expect(MockPrismaClientConstructor).toHaveBeenCalledWith({
      log: ['query', 'error'],
    });
  });

  it('should configure with no log levels if PRISMA_LOGGING contains only invalid levels', () => {
    process.env.PRISMA_LOGGING = 'invalid,another_invalid';
    require('../../src/core/prisma');
    expect(MockPrismaClientConstructor).toHaveBeenCalledWith({
      log: undefined, // Or an empty array
    });
  });
});

describe('Prisma Client Shutdown Handlers', () => {
  let localPrismaInstance;
  let originalProcessOn;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };

    if (MockPrismaClientConstructor) MockPrismaClientConstructor.mockClear();
    mockPrismaClientInstance.$disconnect.mockClear();
    mockAppLogger.child.mockClear();
    mockAppLogger.child.mockReturnValue(mockPrismaChildLogger);
    Object.values(mockPrismaChildLogger).forEach(fn => fn.mockClear());
    
    // Store original process.on and mock it
    originalProcessOn = process.on;
    process.on = jest.fn(); // Mock process.on

    localPrismaInstance = require('../../src/core/prisma');
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    process.on = originalProcessOn; // Restore original process.on
    jest.restoreAllMocks(); // This should also cover process.exit if spied on
  });

  it('should register shutdown handlers for SIGINT, SIGTERM, beforeExit, uncaughtException, and unhandledRejection', () => {
    // setupPrismaShutdownHandlers is called during the initial require in beforeEach
    expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('beforeExit', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
  });

  // More detailed tests for disconnectFn would require exporting it or more complex event simulation.
  // For now, we test that $disconnect is called by simulating one of the events.
  it('should call $disconnect on SIGINT', async () => {
    const sigintCallback = process.on.mock.calls.find(call => call[0] === 'SIGINT')[1];
    
    // Mock process.exit to prevent test runner from exiting and to check if it's called
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    
    await sigintCallback(); // Manually invoke the registered SIGINT handler

    expect(mockPrismaClientInstance.$disconnect).toHaveBeenCalledTimes(1);
    expect(mockPrismaChildLogger.info).toHaveBeenCalledWith("Received SIGINT. Disconnecting Prisma Client...");
    expect(mockPrismaChildLogger.info).toHaveBeenCalledWith("Prisma Client disconnected successfully.");
    expect(mockExit).toHaveBeenCalledWith(0);
    
    mockExit.mockRestore();
  });

  it('should prevent multiple disconnects if already disconnecting', async () => {
    const beforeExitCallback = process.on.mock.calls.find(call => call[0] === 'beforeExit')[1];
    
    // Simulate first call starting disconnection
    mockPrismaClientInstance.$disconnect.mockImplementationOnce(async () => {
      // Simulate a delay in disconnection
      await new Promise(resolve => setTimeout(resolve, 0));
      // isDisconnecting should be true here from the first call
      // Now, trigger the callback again *while the first is "in progress"*
      await beforeExitCallback();
    });

    await beforeExitCallback(); // First call

    expect(mockPrismaClientInstance.$disconnect).toHaveBeenCalledTimes(1); // Should only be called once
    expect(mockPrismaChildLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Prisma Client disconnection already in progress"));
  });

   it('should prevent disconnect if already disconnected', async () => {
    const beforeExitCallback = process.on.mock.calls.find(call => call[0] === 'beforeExit')[1];
    
    // First call to disconnect
    await beforeExitCallback();
    expect(mockPrismaClientInstance.$disconnect).toHaveBeenCalledTimes(1);
    mockPrismaClientInstance.$disconnect.mockClear(); // Clear for next check

    // Second call after "disconnection"
    await beforeExitCallback();
    expect(mockPrismaClientInstance.$disconnect).not.toHaveBeenCalled();
    expect(mockPrismaChildLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Prisma Client already disconnected"));
  });

});