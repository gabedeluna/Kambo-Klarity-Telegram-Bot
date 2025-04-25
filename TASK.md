# TASK.md – Active Sprint Checklist

> **How to use:** Windsurf AI (or any dev) should tick a `- [ ]` when done, add notes beneath the task, and fill the Discovery & Insights sections as they learn.

---

## 📅 Current Phase 2 – LangChain Tools & Core Enhancements

| ID        | Task                                                                   | Why / Acceptance Criteria                                                                                                                        |
| :-------- | :--------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| [X]**PH2‑01** | **Setup Structured Logging (`core/logger.js`)**                        | Implement Pino/Winston for filterable JSON logs. Replace key `console.log`s in existing core files. *Pass*: Logger singleton created, basic logs appear, unit tests pass. |
| [X]**PH2‑02** | **Setup Centralized Error Handling**                                  | Create `src/errors/AppError.js`, `src/errors/NotFoundError.js`, and `src/middleware/errorHandler.js`. Register in app.js. *Pass*: Test suite confirms errors are caught, logged, and return appropriate JSON responses. |Unit/Integration tests pass. |
| [X]**PH2‑03** | **Create `src/tools/` directory**                                      | Establish the dedicated home for LangChain-callable tools. *Pass*: Directory exists. (If not already created in previous explorations). |
| [X]**PH2‑04** | **Tool: `src/tools/stateManager.js` - `resetUserState` function**        | Create tool to reset user state (`state`, `session_type`, etc.) in Prisma. *Pass*: Unit tests confirm DB update call with correct parameters using mock Prisma. |
| [X]**PH2‑05** | **Tool: `src/tools/stateManager.js` - `updateUserState` function**       | Add tool to update specific user fields (e.g., set `state` to 'BOOKING'). *Pass*: Unit tests confirm DB update call with correct parameters and data. |
| [X]**PH2‑06** | **Tool: `src/tools/stateManager.js` - `storeBookingData` function**      | Create specific tool to store confirmed session details. *Pass*: Unit tests confirm DB update call with correct parameters using mock Prisma. |
| [X]**PH2‑07** | **Tool: `src/tools/telegramNotifier.js` - `sendWaiverLink` function**   | Create tool to send waiver link message and store msg_id. *Pass*: Unit tests confirm mock bot API and Prisma calls with correct parameters. |
| [X]**PH2‑08** | **Tool: `src/tools/telegramNotifier.js` - `sendTextMessage` function**   | Create generic tool to send a simple text message via Telegraf. *Pass*: Unit tests confirm mock bot API call with correct parameters. |
| [X]**PH2‑09** | **Tool: `src/tools/googleCalendar.js` - Stub `findFreeSlots`**         | Create **stub** function mimicking finding calendar slots (returns fake data structure matching expected GCal format). No API call. *Pass*: Unit tests confirm function returns expected fake data structure. |
| [X]**PH2‑10** | **Tool: `src/tools/googleCalendar.js` - Stub `createCalendarEvent`**     | Create **stub** function mimicking creating a calendar event (logs input, returns fake success/event ID). No API call. *Pass*: Unit tests confirm function logs input and returns fake success. |
| [ ]**PH2‑11** | **Define LangChain Tool Schemas/Standard**                             | Implement standard schema (e.g., Zod) for tools created (`stateManager`, `telegramNotifier`, `googleCalendar` stubs). Define in `src/tools/schemas.js` or similar. *Pass*: Schemas defined, unit tests validate tool input/output against schemas. |
| [ ]**PH2‑12** | **Implement Veteran/Responder Status Feature**                         | Update Prisma schema (`User` model: `is_veteran_or_responder` boolean). Update `registration-form.html` with checkbox/dropdown. *Pass*: Migration successful, form updated. *(Note: Backend handler update deferred to Phase 5)*. |
| [ ]**PH2‑13** | **Tool: `src/tools/telegramNotifier.js` - `setRoleSpecificCommands` function** | Create tool to set role-specific commands using `bot.telegram.setMyCommands` with scope. *Pass*: Unit tests confirm mock bot API call with correct scope and command list. *(Note: Tool usage deferred to Phase 6)*. |
| [ ]**PH2‑14** | **Test Coverage:**                                                     | Ensure all new/modified modules in PH2 (logger, error handler, tools, schemas) have unit tests, achieving >= 90% coverage for these modules. *Pass*: `npm test` shows sufficient coverage. |
| [ ]**PH2‑15** | **Update `docs/architecture.md`:**                                     | Add new directories (`tools`, `middleware`, `errors`, `automations`) and key files created in Phase 2. Update status section for Phase 2 progress. |
| [ ]**PH2‑16** | **Final Review:**                                                      | Tick all Phase 2 task boxes here when done and ensure Discoveries/Insights are recorded. |

### 🚧 Discovered During Work
*(Add new subtasks here, e.g., `PH2‑D1`)*
*   **PH2-D1 (PH2-01):** Pino and pino-pretty were already installed in the project (pino v9.6.0, pino-pretty v13.0.0).
*   **PH2-D2 (PH2-01):** Updated tests to mock the logger module to avoid breaking existing tests that relied on console.log spies.
*   **PH2-D3 (PH2-01):** Needed to be careful with circular dependencies - env.js can't use logger since logger might depend on env vars.
*   **PH2-D4 (PH2-01):** Updated error logging format to follow Pino's convention (error object as first parameter, message as second).
*   **PH2-D5 (PH2-01):** Added automatic test environment detection to silence logs during test runs.
*   **PH2-D6 (PH2-01):** Had to simplify some complex tests that were tightly coupled to console.log/error spies.
*   **PH2-D7 (PH2-01):** Implemented dependency injection for logger in server.js and prisma.js to make tests more reliable and maintainable.
*   **PH2-D8 (PH2-01):** Improved test coverage by adding more test cases for the logger module, achieving 100% coverage.
*   **PH2-D9 (PH2-02):** Implemented global Express error handler in middleware/errorHandler.js. Added basic AppError/NotFoundError classes. Registered middleware last in app.js.
*   **PH2-D10 (PH2-02):** Used dependency injection via proxyquire for testing the error handler middleware, allowing tests to verify logger interactions without tight coupling.
*   **PH2-D11 (PH2-03):** Ensured `src/tools/` directory exists. Used `--allow-empty` commit to mark task completion as the directory was likely created in a previous phase.
*   **PH2-D12 (PH2-04):** Created `stateManager.js` tool. Implemented `resetUserState` using Prisma. Used Sinon stubs via proxyquire for Prisma in unit tests. Added logger DI setter.
*   **PH2-D13 (PH2-05):** Added generic `updateUserState` function to `stateManager.js`. Included handling for Prisma P2025 (RecordNotFound) error.
*   **PH2-D14 (PH2-06):** Added dedicated `storeBookingData` function to `stateManager.js` for saving confirmed session/slot.
*   **PH2-D15 (PH2-07/08):** Created `telegramNotifier.js` tool with `initialize` and `sendTextMessage` functions. Added conditional exports for testing and a `_resetForTest` helper function to ensure test isolation.
*   **PH2-D16 (PH2-08):** Simplified testing approach by directly importing the module and using dependency injection rather than proxyquire, which improved test reliability and readability.
*   **PH2-D17 (PH2-09):** Refactored `googleCalendar.js` from simple functions to a `GoogleCalendarTool` class to better manage state (like the injected logger). Debugged failing logger tests by switching from `sinon.stub()` mocks to `sinon.spy()` on a plain object and resetting spy history correctly within the test case.
*   **PH2-D18 (PH2-10):** Added createCalendarEvent stub to googleCalendar.js tool. Logs input and returns fake success object.

### 💡 Insights & Decisions
*(Explain logger choice, error handling strategy, tool design choices, mocking strategies, tool definition standard, etc.)*
*   **PH2-01:** Selected Pino for structured logging due to its excellent performance and simple API. Configured with pino-pretty for development (human-readable) and JSON for production (machine-parseable). This approach provides better context and filterability than console.log while maintaining good developer experience during development. The conditional transport configuration based on NODE_ENV ensures we get the right format in each environment without changing code.
*   **PH2-01:** Implemented a test detection mechanism in the logger to automatically silence logs during test runs, preventing test output pollution while maintaining the ability to test logging behavior through mocks.
*   **PH2-01:** Adopted Pino's error logging convention (error object as first parameter, message as second) which enables better error tracking and aggregation in production environments.
*   **PH2-01:** Used dependency injection pattern for logger in key modules (server.js, prisma.js) to improve testability. This approach allows tests to inject mock loggers without relying on require cache manipulation, making tests more reliable and less brittle.
*   **PH2-02:** Centralized handler provides consistent error response and logging. Custom errors allow differentiating operational vs. unexpected errors and setting specific status codes.
*   **PH2-03:** Formally acknowledged creation of dedicated directory for LangChain tools as per planning.
*   **PH2-04:** Encapsulating DB state resets into a tool function simplifies calling logic for AI/Graph. Unit tests verify DB interaction logic without hitting the actual DB.
*   **PH2-05:** Generic update function provides flexibility for AI/Graph to modify user state. Testing with `proxyquire` ensures correct Prisma calls for various inputs and error conditions.
*   **PH2-06:** Specific tool function for storing booking data improves clarity of intent compared to generic update. Followed established testing pattern using proxyquire.
*   **PH2-10:** Stubbing creation functions allows testing workflows that involve booking confirmation before live API is ready. Defined expected input/output contract for event creation.

### 🧪 Quick‑Run Commands

npm test          # run mocha suite with coverage
npm run lint      # eslint check
npm run format    # prettier write
node bin/server   # local server

---
**Last updated:** 2025-04-24 21:00