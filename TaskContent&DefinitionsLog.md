# Project Task Context & Definitions Log

## Phase 1: Skeleton & Baseline

### PH1-01: Create source tree

**Goal:**  
Establish the primary directory (`src/`) for all new application code and organize it with initial sub-folders, moving existing code to `legacy/`.

**Why:**  
Creates a clean separation between new, structured code and the old codebase. Enforces the planned folder layout from the start, improving organization and maintainability. Keeps legacy code available for reference during refactoring.

**What to Expect:**  
Creation of `src/` and sub-folders (`core/`, `tools/`, `graph/`, `routes/`, `tests/`). Existing files moved into a new `legacy/` directory.

**Definitions:**
#### Key Terms
- **Source Tree:** The main directory structure containing the application's source code.
- **Legacy Code:** The original codebase before the refactoring process began.

### PH1-02: Add dev-deps & basic npm scripts

**Goal:**  
Install necessary development tools (testing frameworks, linter, formatter, Git hooks manager) and configure basic npm scripts to run them.

**Why:**  
Establishes a universal toolchain for maintaining code quality, consistency, and testing across the project. Makes it easy for any developer (or AI) to run checks using standard commands (`npm test`, `npm run lint`, `npm run format`).

**What to Expect:**  
Updates to `package.json`'s devDependencies. Addition of test, lint, format scripts in `package.json`. Initial configuration files for these tools might be created.

**Definitions:**
#### Key Terms
- **Dev Dependencies:** Packages needed for development and testing but not required for the application to run in production.
- **npm Scripts:** Custom commands defined in `package.json` that can be run using `npm run <script_name>`.
- **Linter (ESLint):** A tool that analyzes code for potential errors, style issues, and anti-patterns.
- **Formatter (Prettier):** A tool that automatically reformats code to ensure consistent style.
- **Test Runner (Mocha):** A framework for organizing and running tests.
- **Mocking Library (Sinon):** Helps create test doubles (stubs, spies, mocks) to isolate code under test.
- **HTTP Testing (Supertest):** Library for testing HTTP servers like Express apps.
- **Coverage Tool (NYC/Istanbul):** Measures how much of the codebase is executed by tests.
- **Git Hooks Manager (Husky):** Simplifies managing Git hooks (scripts run on Git events).

---

### PH1-03: `core/env.js` - Environment Configuration

**Goal:**
- Create a module to load environment variables from a `.env` file, validate the presence of essential variables, and export a secure configuration object.

**Why:**
- Centralizes environment variable loading and validation.
- Prevents runtime errors caused by missing configuration.
- Ensures configuration is loaded consistently across the application.
- Freezing the exported object prevents accidental modification.
- Implements P-1 (Single Source of Truth) for environment config.

**What to Expect:**
- Creation of `src/core/env.js`.
- Uses `dotenv` package.
- Checks for `TG_TOKEN`, `DATABASE_URL`, `FORM_URL`.
- Exits process if required variables are missing.
- Exports a frozen JavaScript object containing the loaded variables.

**Definitions:**
#### Key Terms
- **Environment Variables:** Variables set outside the application code (e.g., in a .env file or system environment) used for configuration (API keys, database URLs, ports).
- **.env file:** A standard file (usually ignored by Git) to store environment variables locally during development.
- **dotenv package:** An npm package that loads variables from a .env file into process.env.
- **Frozen Object (`Object.freeze()`):** Makes an object immutable; its properties cannot be added, deleted, or changed.

### PH1-04: `core/prisma.js` - Prisma Client Singleton

**Goal:**  
Create a module that instantiates and exports a single instance of the Prisma database client, handling graceful disconnection.

**Why:**  
Enforces P-1 (Single Source of Truth) for database connections, ensuring the application uses a single connection pool efficiently. Prevents resource leaks by ensuring the database connection is closed cleanly when the application exits. Makes the Prisma client easily accessible for dependency injection.

**What to Expect:**  
Creation of `src/core/prisma.js`. Imports `PrismaClient`. Creates one instance. Registers a `process.on('beforeExit', ...)` handler to call `prisma.$disconnect()`. Exports the instance.

**Definitions:**
- **Prisma Client:** An auto-generated, type-safe database client provided by the Prisma ORM.
- **Singleton:** A design pattern ensuring only one instance of a class (here, PrismaClient) exists.
- **Connection Pool:** A cache of database connections maintained so that connections can be reused, improving performance.
- **Graceful Shutdown:** The process of cleanly releasing resources (like DB connections, network ports) before an application exits.
- **`process.on('beforeExit', ...)`:** A Node.js event listener that triggers just before the Node.js process exits naturally.

---
### PH1-05: `core/bot.js` - Telegraf Instance Singleton

**Goal:**  
Create a module that initializes and exports a single instance of the Telegraf bot using the token from the environment configuration.

**Why:**  
Enforces P-1 (Single Source of Truth) for the Telegram bot instance. Ensures consistent initialization with the correct token. Makes the bot instance easily injectable into other modules (like `app.js` for webhook setup or command handlers) without them needing direct access to the token. Separates bot creation from its runtime wiring (webhook).

**What to Expect:**  
Creation of `src/core/bot.js`. Imports `Telegraf` and `core/env.js`. Creates one Telegraf instance using `config.TG_TOKEN`. Exports the instance. Does not set up webhooks or launch the bot.

**Definitions:**
- **Telegraf:** A popular Node.js framework for building Telegram bots.
- **Bot Token:** A secret credential provided by Telegram's BotFather used to authenticate API requests for a specific bot.
- **Singleton:** Ensuring only one Telegraf instance is created.
- **Dependency Injection (Implicit):** Making the bot instance available for other modules to require.

---
### PH1-06: `app.js` - Core Express App

**Goal:**  
Create the main Express application file, configure essential middleware, mount the Telegraf webhook handler, add a health check route, and export the configured app instance.

**Why:**  
Implements P-1 (Single Server) by creating the central Express application. Provides the foundation for handling all HTTP requests (Telegram webhook, APIs, web apps). Separates app definition from server startup (handled in `bin/server.js`), which is crucial for testability (using Supertest without a live server). Mounts the bot webhook securely.

**What to Expect:**  
Creation of `src/app.js`. Imports `express` and `core/bot.js`. Creates an Express app instance. Uses `express.json()` middleware. Uses `bot.webhookCallback()` with a secret path. Adds a `/health` GET route. Exports the app instance.

**Definitions:**
- **Express:** Node.js web framework.
- **Middleware:** Functions executing during the Express request-response cycle.
- **Webhook:** An HTTP endpoint called by an external service (Telegram) to send updates.
- **`bot.webhookCallback()`:** Telegraf middleware to handle Telegram updates received via webhook.
- **`bot.secretPathComponent()`:** Telegraf utility to generate a secure random string for the webhook URL.
- **Health Check (`/health`):** Simple API endpoint for monitoring application status.
- **Supertest:** Library for testing HTTP servers without needing a live network port.

---
### PH1-07: `bin/server.js` - Server Startup Script

**Goal:**  
Create the script that imports the configured Express application (`app.js`) and starts it listening for HTTP connections on the correct port.

**Why:**  
Separates the concerns of defining the application (`app.js`) from running it. This makes `app.js` easily importable for integration tests. Provides the single entry point (`node bin/server.js`) to launch the server. Handles port configuration based on environment variables.

**What to Expect:**  
Creation of `bin/server.js`. Imports app from `src/app.js` and config from `src/core/env.js`. Determines the `PORT` (from `config.PORT` or default 3000). Calls `app.listen(PORT, ...)`. Includes basic error handling for port conflicts (`EADDRINUSE`, `EACCES`).

**Definitions:**
- **`app.listen(PORT, callback)`:** Express function to start the HTTP server.
- **`process.env.PORT`:** Standard environment variable for hosting platforms to specify the listening port.

---
### PH1-08: `commands/registry.js` - Command Registry Scaffolding

**Goal:**  
Create the initial structure for registering and organizing Telegram bot commands, separating them by user role and using placeholder handlers.

**Why:**  
Implements the Command Registry pattern (`PLANNING.md` Section 7.1) for better organization, scalability, and maintainability compared to scattering `bot.command` calls. Decouples command definition (metadata, role) from implementation (handler logic). Allows testing the registry structure independently.

**What to Expect:**  
Creation of `src/commands/registry.js`. Exports an object with `client` and `admin` keys. Each key holds command definitions (e.g., help, book, sessions) containing a `descr` string and a handler function (initially stubs like `(ctx) => ctx.reply('stub')`).

**Definitions:**
- **Command Registry:** Central definition point for bot commands, metadata, and handlers.
- **Stub Function:** Placeholder function with minimal logic used during development.
- **Scaffolding:** Creating the basic structure without full implementation.

---
### PH1-09: `config/sessionTypes.json` & `core/sessionTypes.js`

**Goal:**  
Define available session types in a configuration file (`.json`) and create a helper module to read and access this data programmatically.

**Why:**  
Externalizes session type data (`PLANNING.md` Section 7.2, although planned to move to DB later), making it easier to manage and update than hardcoding values in the logic. Provides a single source of truth for session offerings. The helper module encapsulates file reading logic.

**What to Expect:**  
Creation of `src/config/sessionTypes.json` with an array of session objects (id, label, duration, description). Creation of `src/core/sessionTypes.js` using `fs` and `path` to read the JSON. Exports `getAll()` and `getById(id)` functions.

**Definitions:**
- **JSON:** Standard data interchange format.
- **Schema:** The expected structure of the data (e.g., required keys and types in session objects).
- **Helper Module:** Provides utility functions related to specific data/functionality.
- **fs module:** Node.js module for file system interaction.
- **path module:** Node.js module for handling file paths.

---
### PH1-10: Initial Test Suite & Coverage

**Goal:**  
Create and finalize the initial suite of unit/integration tests for Phase 1 modules, achieving ≥ 90% code coverage.

**Why:**  
Implements P-3 (Test Early, Test Often). Verifies Phase 1 code correctness. Creates a regression safety net. Serves as executable documentation. Builds confidence for future refactoring/features.

**What to Expect:**  
Creation/updating of test files in `src/tests/` mirroring the `src/` structure (`health.test.js`, `env.test.js`, `prisma.test.js`, etc.). Uses `chai`, `sinon`, `supertest`. Running `npm test` executes tests via Mocha and calculates coverage via NYC, aiming for ≥ 90% on Phase 1 code.

**Definitions:**
- **Unit Test:** Tests isolated code pieces (uses mocking).
- **Integration Test:** Tests interactions between components (e.g., Supertest hitting Express routes).
- **Test Coverage:** Percentage of code executed by tests.
- **Mocking/Stubbing/Spying:** Using test doubles (via Sinon) to fake dependencies.
- **nyc:** Command-line tool for Istanbul code coverage.

---
### PH1-11: Husky Pre-Commit Hook Setup

**Goal:**  
Configure Husky to automatically run tests, linter, and formatter before any Git commit is finalized.

**Why:**  
Automates quality checks, enforcing standards (P-3, lint/format rules) on every commit. Prevents broken or poorly formatted code from entering the codebase. Improves consistency and reduces manual effort/errors.

**What to Expect:**  
Use `npx husky hook add ...` (or similar) to create/update `.husky/pre-commit` script containing `npm test && npm run lint && npm run format`. Verification involves testing successful and failing commit attempts.

**Definitions:**
- **Git Hooks:** Scripts run automatically by Git on specific events.
- **Pre-Commit Hook:** Runs before a commit is finalized. Aborts commit on failure.
- **Husky:** Tool to manage Git hooks easily.
- **npx:** Tool to run package binaries without global installation.
- **&& (Shell Operator):** Logical AND; runs next command only if previous succeeds.

---
### PH1-12: Update Architecture Document

**Goal:**  
Update `docs/architecture.md` to reflect the Phase 1 folder structure and completion status.

**Why:**  
Keeps documentation (📚 Documentation & Explainability) synchronized with the actual codebase state. Provides an accurate overview for understanding the project structure.

**What to Expect:**  
Editing `docs/architecture.md`. Updating the folder layout diagram to match the current structure (`src/`, `bin/`, `legacy/`, etc.). Adding a status note confirming Phase 1 completion.

**Definitions:**
- **Markdown:** Lightweight markup language for documentation.
- **Architecture Diagram:** Visual representation of system structure.

---
### PH1-13: Final Phase 1 Review in `TASK.md`

**Goal:**  
Perform a final review of the Phase 1 section in `TASK.md`, ensuring all tasks are checked off and discoveries/insights are documented.

**Why:**  
Ensures completeness of the phase tracking. Captures important learnings and decisions. Provides a clean closure before starting the next phase.

**What to Expect:**  
Manually reviewing and editing `TASK.md`. Checking all Phase 1 boxes (`[X]`). Ensuring "Discovered During Work" and "Insights & Decisions" sections are complete and accurate. Updating the "Last updated" timestamp.

**Definitions:**
- **Meta Task:** A task about the project management process itself.

---
## Phase 2: LangChain Tools & Core Enhancements

### PH2-01: Setup Structured Logging (`core/logger.js`)

**Goal:**  
Implement a singleton structured logger (Pino) and replace key `console.log` calls in existing core modules.

**Why:**  
Implements P-7. Structured logs (JSON) are filterable and machine-readable, vastly improving debugging and potential production monitoring compared to plain text `console.log`. Pino is chosen for performance.

**What to Expect:**  
Install `pino`, `pino-pretty`. Create `src/core/logger.js` exporting a configured Pino instance (singleton), using `pino-pretty` in development. Update `console.log/error` calls in core files to use `logger.info/error`. Add unit tests for the logger.

**Definitions:**
- **Structured Logging:** Logging events as structured data (JSON).
- **Pino:** Fast Node.js JSON logger.
- **pino-pretty:** Development utility to format Pino JSON logs readably.
- **Log Levels:** Standard severity indicators (info, error, etc.).

---
### PH2-02: Setup Centralized Error Handling (`middleware/errorHandler.js`)

**Goal:**  
Implement a global Express error handling middleware to catch unhandled errors, log them structurally, and send standardized, safe responses.

**Why:**  
Implements P-7. Provides a safety net for unexpected errors. Ensures consistent, non-leaky error responses to clients. Guarantees centralized logging of all unhandled errors. Allows for potential differentiation based on custom error types.

**What to Expect:**  
Create `src/middleware/errorHandler.js` exporting middleware (`err, req, res, next`). Middleware logs error details using `core/logger`. Sends standardized JSON response (e.g., 500 Internal Server Error, or uses `err.statusCode` if available). Optionally create custom error classes (`src/errors/`). Register middleware last in `src/app.js`. Add integration tests.

**Definitions:**
- **Express Error Handling Middleware:** Specific signature (`err, req, res, next`) to catch errors passed via `next(err)` or uncaught exceptions.
- **Custom Error Class:** User-defined error types extending `Error` to add properties like `statusCode` or `isOperational`.

---
### PH2-03: Create `src/tools/` directory

**Goal:**  
Create the dedicated directory for LangChain tool modules.

**Why:**  
Aligns with `PLANNING.md` folder structure. Organizes tool code logically.

**What to Expect:**  
Creation of the `src/tools/` directory.

**Definitions:**  
N/A (Directory creation).

---
### PH2-04: Tool: `src/tools/stateManager.js` - `resetUserState` function

**Goal:**  
Create the `stateManager.js` tool module and implement `resetUserState` to clear specific user fields (state, session info, etc.) in the database via Prisma.

**Why:**  
Provides a reusable, testable function for cleaning up user state after workflows complete or are canceled. Encapsulates Prisma logic. Makes this action easily callable by AI/Graph.

**What to Expect:**  
Creation of `src/tools/stateManager.js`. Imports `prisma`, `logger`. Exports async function `resetUserState(telegramId)`. Function validates input, calls `prisma.users.update` setting specific fields to null/defaults. Includes try/catch and logging. Unit tests mock Prisma using Sinon to verify correct arguments.

**Definitions:**
- **Tool Function:** Function designed to be called by AI/Graph to perform an action.
- **State Reset:** Returning specific DB fields to a default/neutral state.
- **Prisma update:** Method to modify existing DB records.

Task Expansion: PH2-05 - State Manager Tool: updateUserState
Goal: Add a generic function updateUserState to stateManager.js that allows updating specific fields in a user's database record.
Why are we doing this?
While resetUserState handles clearing specific fields, we often need to update individual fields during a conversation or workflow. For example, setting state = 'BOOKING' when the user starts the booking flow, or storing a temporary piece of information gathered by the AI. Creating a generic updateUserState function provides a flexible and centralized way to perform these updates via Prisma, callable by our AI/Graph.
What to expect:
Windsurf will:
Modify src/tools/stateManager.js.
Add a new exported async function updateUserState(telegramId, dataToUpdate).
Inside the function:
Log the attempt, including telegramId and the dataToUpdate object.
Perform input validation (check telegramId, check dataToUpdate is a non-empty object). Convert telegramId to BigInt.
Use prisma.users.update() with a where clause for telegramId and the provided dataToUpdate object as the data.
Include try...catch error handling around the Prisma call, logging errors via the logger.
Return a success/failure indicator.
Update src/tests/tools/stateManager.test.js to add unit tests for updateUserState.
The tests will use proxyquire (as per our updated convention) to inject mock logger and mock prisma (with a stubbed users.update method). Tests will verify that prisma.users.update is called with the correct telegramId and the exact dataToUpdate object provided to the function. Error handling will also be tested.
Definitions:
Generic Update: Modifying arbitrary fields in a record based on provided input, as opposed to a fixed reset operation. 

Task Expansion: PH2-06 - State Manager Tool: storeBookingData
Goal: Add a dedicated function storeBookingData to stateManager.js specifically for saving the session type and the confirmed booking slot (timestamp) identified during the AI conversation to the user's record in Prisma.
Why are we doing this?
While updateUserState could be used for this, having a dedicated function storeBookingData makes the AI agent's/graph's intent clearer when it needs to persist the final results of a successful scheduling conversation. It provides a specific interface for this common and critical step in the booking flow, potentially allowing for extra validation or logic specific to booking data in the future. It encapsulates the action of storing the session_type and booking_slot.
What to expect:
Windsurf will:
Modify src/tools/stateManager.js.
Add a new exported async function storeBookingData(telegramId, sessionType, bookingSlot).
Inside the function:
Log the attempt (logger.info).
Perform input validation (check telegramId, sessionType is a non-empty string, bookingSlot is provided - potentially validating its format as an ISO string or Date object later if needed). Convert telegramId to BigInt.
Use prisma.users.update() with where for telegramId and data: { session_type: sessionType, booking_slot: bookingSlot }.
Include try...catch error handling, logging errors (logger.error) and handling Prisma's 'RecordNotFound' (P2025) specifically.
Return a success/failure indicator.
Update src/tests/tools/stateManager.test.js to add unit tests for storeBookingData.
The tests will use proxyquire to inject mock logger and mock prisma (with a stubbed users.update method). Tests will verify the correct telegramId, session_type, and booking_slot are passed to prisma.users.update. Input validation and error handling will also be tested.
Definitions:
Booking Slot: The specific date and time confirmed for the session (likely stored as an ISO 8601 timestamp string or a Date object in the database).
Session Type: The identifier for the type of session being booked (e.g., '1hr-kambo').

Task Expansion: PH2-07 - Tool: Send Waiver Link
Goal: Create the first function within our telegramNotifier tool. This specific function, sendWaiverLink, will be responsible for sending the message containing the "Book Now" button (which opens the waiver form web app) to the user and, crucially, storing the ID of that sent message in the database for potential future updates.
Why are we doing this?
This functionality existed in the legacy bookingTools.js (sendForm function). We are recreating it here as a dedicated, testable tool function following our new structure. The reason for storing the message_id is critical for the waiver completion flow:
The user clicks the "Book Now" button and fills out the waiver form in the web app.
The web app submits the form to our server (/api/submit-waiver, which we'll rebuild in Phase 5).
The server processes the waiver and needs to update the original "Book Now" message in Telegram to say "Booking Confirmed!".
To edit that specific message, the server needs its chat_id (which is the user's Telegram ID) and the message_id.
Storing the message_id (in the edit_msg_id field of the users table) right after sending the message makes it available for the server to retrieve later when the waiver is completed.
What to expect:
Windsurf will create src/tools/telegramNotifier.js if it doesn't exist. It will implement the sendWaiverLink async function inside it. This function will:
Accept parameters like telegramId, sessionType, and potentially a messageText override.
Construct the web app URL for the waiver form, including query parameters.
Use the injected Telegraf bot instance (bot.telegram.sendMessage) to send the message with the webApp button.
Use the injected Prisma prisma instance to update the user's record, storing the message_id from the sent message into the edit_msg_id field.
Include error handling.
Windsurf will also create src/tests/tools/telegramNotifier.test.js with unit tests for sendWaiverLink. These tests will use proxyquire and sinon to mock the bot and prisma dependencies, ensuring we can verify that the correct API calls (sendMessage, users.update) are made with the expected parameters without actually hitting Telegram or the database.
Definitions:
Tool: In our context, a module containing functions designed to be potentially called by LangChain agents/graphs or other application logic to perform specific actions (interacting with Telegram, DB, APIs, etc.).
Dependency Injection (DI): Instead of telegramNotifier.js directly require-ing core/bot and core/prisma, we'll design it to accept these instances as arguments (or via a setter function). This makes testing much easier, as we can pass in mocks during tests. proxyquire is a library that helps achieve this by intercepting require calls during testing.
edit_msg_id: The field in our users Prisma schema intended to temporarily store the message_id of a message that might need to be edited later (like the waiver link message). It should probably be nullable.
bot.telegram.sendMessage(chatId, text, extra): The core Telegraf function for sending messages. extra is an object where we specify things like reply_markup for buttons.
Markup.button.webApp(text, url): Telegraf helper to create a button that opens a web app.

Task Expansion: PH2-08 - Tool: Send Text Message
Goal: Add a generic function sendTextMessage to the telegramNotifier tool for sending simple text messages to users via Telegram.
Why are we doing this?
While sendWaiverLink handles a specific message type (with a web app button), we'll frequently need the AI agent or other parts of the system to send basic text replies, confirmations, or notifications. Creating a dedicated, reusable tool function for this keeps the logic clean and centralizes interaction with the Telegraf API for sending messages. It also ensures consistent error handling and logging for this common action.
What to expect:
Windsurf will modify the existing src/tools/telegramNotifier.js file, adding the sendTextMessage async function. This function will take parameters like telegramId and text, use the injected bot instance to send the message, handle errors, and log appropriately using the injected logger. Windsurf will also add new unit tests for this function to src/tests/tools/telegramNotifier.test.js, using the existing proxyquire setup to mock dependencies and verify the function's behavior.

Task Expansion: PH2-09 - Stub Google Calendar findFreeSlots Tool
Goal: Create the googleCalendar.js tool module and implement a stub version of the findFreeSlots function that returns predefined fake availability data, mimicking the structure expected from the real Google Calendar API.
Why are we doing this?
Integrating with external APIs like Google Calendar can be complex (authentication, API quotas, error handling). By creating a stub first, we can:
Define the Interface: Decide exactly what inputs findFreeSlots needs (e.g., date range, duration) and what structure its output should have (e.g., an array of available { start: ISOString, end: ISOString } objects).
Enable Parallel Development: Other parts of the system (like the booking agent) can be built and tested using this predictable fake data before the real Google Calendar logic is ready.
Simplify Early Testing: Unit tests for the booking agent can rely on the consistent output of the stub, making them easier to write and faster to run.
What to expect:
Windsurf will create src/tools/googleCalendar.js. It will implement an async function findFreeSlots(options). This function will not make any external calls. Instead, it will simply return a hardcoded array of fake available time slots, matching the expected structure. Windsurf will also create src/tests/tools/googleCalendar.test.js with basic unit tests verifying that findFreeSlots returns the expected fake data structure. Dependency Injection setup (using initialize) will be included for consistency, even if the stub doesn't use dependencies yet.
Definitions:
Stub: A placeholder function that simulates the behavior of a real function, typically returning hardcoded data.
API Interface/Contract: The defined inputs, outputs, and behavior of a function or service. The stub helps us define this contract early.
ISO 8601 String: A standard format for representing dates and times (e.g., 2025-05-15T10:00:00Z). We'll use this for the fake slot times.