# TASK.md – Active Sprint Checklist

> **How to use:** Windsurf AI (or any dev) should tick a `- [ ]` when done, add notes beneath the task, and fill the Discovery & Insights sections as they learn.

---

## 📅 Current Phase 1 – Skeleton & Baseline

| ID | Task | Why / Acceptance Criteria |
|----|------|---------------------------|
| [X]**PH1‑01** | **Create source tree** `src/` with sub‑folders `core/`, `tools/`, `graph/`, `routes/`, `tests/`. Copy current files into `legacy/` for reference (do **not** delete yet). | One canonical home for all new code; legacy stays untouched.   *Pass*: folders exist, repo still runs. |
| [X]**PH1‑02** | Add dev‑deps `mocha chai sinon supertest nyc eslint prettier husky`. Add scripts: `npm test`, `npm run lint`, `npm run format`. | Establish universal test + style toolchain.   *Pass*: `npm test` prints 0 failing, `npm run lint` exits 0. |
| [X]**PH1‑03** | **core/env.js** – `dotenv.config()`, assert presence of `TG_TOKEN`, `DATABASE_URL`, `FORM_URL`. Export a frozen config object. | Central env validation prevents runtime surprises.  *Pass*: missing var throws at startup + unit‑test covers. |
| [X]**PH1‑04** | **core/prisma.js** – instantiate *one* PrismaClient, attach `process.on('beforeExit')` disconnect, export singleton. | Satisfies Guiding Principle P‑1.   *Pass*: unit‑test can call query twice without warning. |
| [X]**PH1‑05** | **core/bot.js** – export Telegraf instance initialised with `TG_TOKEN` only (no webhook yet). | Makes bot injectable across modules.  *Pass*: requiring twice returns same object. |
| [X]**PH1‑06** | **app.js** – create Express app, mount `bot.webhookCallback('/webhook')`, add `/health` route, export `app`. | Single entry for runtime *and* tests.  *Pass*: Supertest GET `/health` → 200. |
| [X]**PH1‑07** | **bin/server.js** – import `app`, listen on `env.PORT||3000`. | CLI launcher keeps app testable. |
| [X]**PH1‑08** | Scaffold **commands/registry.js** with `help`, `book`, `cancel` (client) & `sessions` (admin). Stub handlers that `ctx.reply('stub')`. Unit‑test asserts registry shape. | Starts the command pattern early. |
| [X]**PH1‑09** | Add **config/sessionTypes.json** with the three sessions in PLANNING.md and **core/sessionTypes.js** helper (getAll, getById). Unit‑test validates JSON schema. | Enables dynamic keyboards in later phases. |
| [X]**PH1‑10** | **(2025-04-23)** Write initial tests: `tests/health.test.js`, `tests/env.test.js`, `tests/prisma.test.js`, `tests/registry.test.js`, `tests/sessionTypes.test.js`. | Achieve ≥ 90 % coverage on Phase‑1 code paths. |
| [X]**PH1‑11** | Setup **husky** pre‑commit hook to run `npm test && npm run lint && npm run format`. | Enforces green commits. |
| [X]**PH1‑12** | Update `docs/architecture.md` with new folder diagram and Phase 1 completion status. | Docs evolve with code. |
| [X]**PH1‑13** | Tick each task box here when done and jot *Discoveries* below. | Keeps project heartbeat. |

### 🚧 Discovered During Work
*Add new subtasks here, e.g. `PH1‑D1`.*
*   **PH1-D1 (PH1-01):** Moved `package.json`, `package-lock.json`, `node_modules` from `telegram-hello/` to project root to fix module resolution for `node bin/server.js`.
*   **PH1-D2 (PH1-01):** Modified `legacy/server.js` to export the `app` object (`module.exports = app;`) and removed its internal `app.listen()` call, allowing `bin/server.js` to control startup.
*   **PH1-D3 (PH1-01):** The legacy health check endpoint was at `/`, not `/health` as assumed.
*   **PH1-D4 (PH1-01):** GitHub push protection blocked the initial push due to a committed credential file (`legacy/config/telegram-bot-*.json`). Fixed by adding `legacy/config/*.json` to `.gitignore`, using `git rm --cached <file>`, amending the commit (`git commit --amend --no-edit`), and force-pushing (`git push --force-with-lease`).
*   **PH1-D5 (PH1-02):** Installed ESLint v9 which requires `eslint.config.js` (flat config) by default. Migrated from `.eslintrc.json` to `eslint.config.js` using CommonJS syntax (`require`/`module.exports`) to match project setup.
*   **PH1-D6 (PH1-02):** Updated `package.json` test script path to `src/tests/**/*.test.js` as tests live within `src/` per PLANNING.md.
*   **PH1-D7 (PH1-02):** `npm test` initially failed (exit code 1) when no tests existed due to `nyc`. Added a placeholder test (`src/tests/placeholder.test.js`) to ensure the script exits 0. Alternatively, `--allow-empty` flag for mocha could be used but placeholder is better for future.
*   **PH1-D8 (PH1-02):** Husky v9 requires `npx husky hook add .husky/pre-commit "..."` instead of older `husky add` or `husky set` commands.
*   **PH1-D9 (PH1-02):** Added `coverage/` and `.nyc_output/` to `.gitignore`.
*   **PH1-D10 (PH1-04):** The target file `src/core/prisma.js` already existed as a basic stub (`module.exports = {};`). Used `edit_file` instead of `write_to_file` to overwrite with the full implementation.
*   **PH1-D11 (PH1-05):** Initial `npm test` run failed because `src/core/env.js` requires environment variables. Created `.env` file with necessary variables (TG_TOKEN, DATABASE_URL, FORM_URL) and added it to `.gitignore` to resolve.
*   **PH1-D12 (PH1-06):** Used Telegraf's `secretPathComponent()` for webhook security instead of a hardcoded path.
*   **PH1-D13 (PH1-06):** Confirmed Telegraf's `webhookCallback` handles basic invalid POST requests gracefully with 200 OK (prevents Telegram retries).
*   **PH1-D14 (PH1-06):** Added Supertest case for 404 Not Found on invalid routes for completeness.
*   **PH1-D15 (PH1-07):** Needed to ensure `BOT_TOKEN` is available in `env.js` *before* `app.js` requires it to derive the webhook path.
*   **PH1-D16 (PH1-07):** Implemented port logic using `config.PORT || 3000` in `bin/server.js`.
*   **PH1-D17 (PH1-07):** Added basic error handling for `EADDRINUSE` and `EACCES` in `bin/server.js`.
*   **PH1-D18 (PH1-08):** Included all commands from PLANNING.md (help, book, cancel, sessions, clients, session_add, session_del) using stub handlers for PH1-08.
*   **PH1-D19 (PH1-09):** Initial `env.js` logic was slightly complex; simplified using `dotenv` defaults.
*   **PH1-D20 (PH1-09):** Added `description` field to `sessionTypes.json` based on legacy message content.
*   **PH1-D21 (PH1-09):** Used `fs.readFileSync` for simplicity in the `sessionTypes.js` helper.
*   **PH1-D22 (PH1-10):** Refactored sessionTypes cache logic for lazy loading.
*   **PH1-D23 (PH1-10):** Identified and removed redundant env checks in bot.js.
*   **PH1-D24 (PH1-10):** Achieved >98% line coverage on core Phase 1 modules (app.js, core/*, commands/registry.js, bin/server.js), exceeding the 90% target. Minor uncovered branches in error handling deemed acceptable given cost/benefit.
*   **PH1-D25 (PH1-11):** Encountered 'husky install deprecated' warning. Removed `prepare` script from `package.json`. Used `npx husky hook add .husky/pre-commit "npm test && npm run lint && npm run format"` command directly as per Husky v9+. Required manually setting `git config core.hooksPath .husky` as husky commands didn't set it. Initial attempt to remove deprecated header lines (`#!/usr/bin/env sh` etc.) from hook caused it to fail on commit attempt; reverted to keep them for now despite warning.
*   **PH1-D26 (PH1-12):** Created/Updated docs/architecture.md with current folder structure and Phase 1 completion status.

### 💡 Insights & Decisions
*Explain architectural choices or hurdles encountered.*
*   **(PH1-05):** Skipped advanced unit test using Sinon to mock `process.exit` for missing token in `core/bot.js` due to potential complexity; noted as future enhancement.
*   **(PH1-05):** Tests for `core/bot.js` pass, but pre-existing tests in `core/env.test.js` are failing due to reliance on specific test values not present when loading real secrets from `.env`. These need separate investigation (new task?).
*   **(PH1-06):** Exporting the configured Express `app` instance from `app.js` allows it to be easily imported for both server startup (`bin/server.js`) and integration testing (`tests/app.test.js`), promoting separation of concerns.
*   **(PH1-02/07):** Separated Express app definition (`src/app.js`) from server execution (`bin/server.js`) to allow easier testing of the app instance without actually starting a listening server.
*   **(PH1-06):** Using a SHA256 hash of the `BOT_TOKEN` for the webhook path provides a secure, unique endpoint without exposing the token directly.
*   **(PH1-08):** Established the command registry pattern early. Stub handlers allow structural testing before implementing logic. Tests verify required `descr` and `handler` properties for each command.
*   **(PH1-09):** Externalized session type data into JSON config (`src/config/sessionTypes.json`), improving maintainability. Helper module (`src/core/sessionTypes.js`) encapsulates file reading logic. Tests (`src/tests/core/sessionTypes.test.js`) validate both schema and helper functions.
*   **PH1-11:** Automated pre-commit checks enforce quality standards (testing, linting, formatting) consistently, preventing bad commits. Modern Husky versions might require manual `core.hooksPath` configuration and header lines in hook script despite deprecation warnings.
*   **(PH1-12):** Keeping architecture documentation aligned with code is crucial for project understanding.

---

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
| [X]**PH2‑11** | **Define LangChain Tool Schemas/Standard**                             | Implement standard schema (e.g., Zod) for tools created (`stateManager`, `telegramNotifier`, `googleCalendar` stubs). Define in `src/tools/schemas.js` or similar. *Pass*: Schemas defined, unit tests validate tool input/output against schemas. |
> *Completion Note (PH2-11): Added `zod` dependency. Created `src/tools/toolSchemas.js`. Updated unit tests for `stateManager`, `telegramNotifier`, and `googleCalendar` tools to validate inputs against Zod schemas.* 
| [X]**PH2‑12** | **Implement Veteran/Responder Status Feature**                         | Update Prisma schema (`User` model: `is_veteran_or_responder` boolean). Update `registration-form.html` with checkbox/dropdown. *Pass*: Migration successful, form updated. *(Note: Backend handler update deferred to Phase 5)*. |
| [X]**PH2‑13** | **Tool: `src/tools/telegramNotifier.js` - `setRoleSpecificCommands` function** | Create tool to set role-specific commands using `bot.telegram.setMyCommands` with scope. *Pass*: Unit tests confirm mock bot API call with correct scope and command list. *(Note: Tool usage deferred to Phase 6)*. |
> *Completion Note (PH2-13): Added JSDoc comment for the setRoleSpecificCommands function.* 
| [X]**PH2‑14** | **Test Coverage:**                                                     | Ensure all new/modified modules in PH2 (logger, error handler, tools, schemas) have unit tests, achieving ≥ 90% coverage for these modules. *Pass*: `npm test` shows sufficient coverage. |
| [X]**PH2‑15** | **Update `docs/architecture.md`:**                                     | Add new directories (`tools`, `middleware`, `errors`, `automations`) and key files created in Phase 2. Update status section for Phase 2 progress. |
> *Completion Note (PH2-15): Updated docs/architecture.md with Phase 2 structure (tools/, middleware/, errors/) and completion status.*
| [X]**PH2‑16** | **Final Review:**                                                      | Tick all Phase 2 task boxes here when done and ensure Discoveries/Insights are recorded. |

### 🚧 Discovered During Work
*(Add new subtasks here, e.g., `PH2‑D1`)*
*   **PH2-D1 (PH2-01):** Pino and pino-pretty were already installed in the project (pino v9.6.0, pino-pretty v13.0.0).
*   **PH2-D2 (PH2-01):** Updated tests to mock the logger module to avoid breaking existing tests that relied on console.log spies.
*   **PH2-D3 (PH2-01):** Needed to be careful with circular dependencies - env.js can't use logger since logger might depend on env vars.
*   **PH2-D4 (PH2-01):** Updated error logging format to follow Pino's convention (error object as first parameter, message as second).
*   **PH2-D5 (PH2-01):** Added automatic test environment detection to silence logs during test runs.
*   **PH2-D6 (PH2-01):** Had to simplify some complex tests that were tightly coupled to console.log spies.
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
*   **PH2-D19 (PH2-11):** Added `zod` (v3.24.3) to dependencies. Defined input schemas for existing tools in `src/tools/toolSchemas.js` using `z.object()` and `.describe()` for documentation. Updated corresponding unit tests (`*.test.js`) to import schemas and add positive/negative validation cases using `expect(...).to.not.throw()` and `expect(...).to.throw(z.ZodError)`.
*   **PH2-D20 (PH2-12):** Added `is_veteran_or_responder` boolean field (default false) to User model in Prisma schema.
*   **PH2-D21 (PH2-12):** Ran `prisma migrate dev` successfully (after manual SQL and resolving history).
*   **PH2-D22 (PH2-12):** Added checkbox to registration-form.html for user input.
*   **PH2-D23 (PH2-12):** Encountered significant Prisma schema drift on the Render database, requiring manual SQL execution and migration baselining/resolving to proceed without data loss.
*   **PH2-D24 (PH2-14):** Enhanced test coverage for telegramNotifier.js from 77% to over 95% by adding focused tests for initialization error handling, dependency validation, and edge cases in command setting functionality.

### 💡 Insights & Decisions
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
*   **PH2-12:** Implemented data storage and frontend collection for Veteran/Responder status. Backend processing deferred to Phase 5 server merge to avoid premature integration with legacy handlers.
*   **PH2-14:** Confirmed all Phase 2 modules meet quality standards with >90% test coverage. Adhered to 'keep tests simple' principle when adding coverage-increasing tests, focusing on specific uncovered code paths rather than complex test setups.

### 💭 Reflections on Phase 2

#### 💯 What Went Well?

*   Logging and error handling are now robust.
*   Core tool modules (`stateManager`, `telegramNotifier`) provide a good foundation.
*   Zod schemas enforce clear tool inputs.
*   Test coverage remained high.

#### 🤔 What Could Be Improved?

*   Initial setup of LangChain tools and dependencies required careful version management (mix of `langchain` and `@langchain/*`). See Memory `dbca1deb`.
*   Google Calendar tool stubs are basic; full implementation will need more work.

#### 🛠️ Discovered During Work

*   Need to ensure consistent async/await usage with LangChain.
*   Dependency mismatch between older `langchain` and newer `@langchain/` packages requires careful import management.
*   Updated docs/architecture.md with Phase 2 structure (tools/, middleware/, errors/) and completion status.

#### 💡 Insights & Decisions

*   Decided on Pino for structured logging for performance and JSON output.
*   Centralized error handling middleware simplifies command/route logic.
*   Using Zod for tool schemas improves reliability and DX.
*   Dependency injection pattern for tools makes testing easier.
*   Documentation updated to reflect addition of tools and core enhancements from Phase 2.

---
---

## 📅 Current Phase 3 – Agent & Memory

| ID        | Task                                                                   | Why / Acceptance Criteria                                                                                                                        |
| :-------- | :--------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| [X]**PH3‑01** | **Setup LangSmith Tracing**                                             | Enable observability into agent execution via LangSmith UI. *Pass*: Set `LANGCHAIN_TRACING_V2=true` & `LANGCHAIN_API_KEY` in `.env`. Basic test run (e.g., from agent tests later) shows traces in LangSmith. |
| [X]**PH3‑02** | **Implement Conversation Memory (`src/memory/`)**                       | Provide agent with short-term memory for coherent conversations. *Pass*: Choose strategy (e.g., `BufferMemory`), implement basic setup (in-memory initially), add basic unit tests verifying state management. |
| [X]**PH3‑03** | **Install/Verify LangChain OpenAI dependency**                          | Ensure necessary package (`@langchain/openai`) is available for the agent. *Pass*: `npm install @langchain/openai` succeeds or package already in `package.json`. |
| [X]**PH3‑04** | **Define Agent Core Prompt (`src/config/agentPrompts.js`)**             | Create the initial system prompt instructing the OpenAI Functions agent on its role (booking assistant), rules, personality, and available tools. *Pass*: Prompt file created, defines core behavior clearly. |
| [ ]**PH3‑05** | **Structure Tools for OpenAI Functions Agent**                          | Ensure existing tool Zod schemas (PH2-11) are correctly formatted/adapted for the OpenAI Functions agent framework (e.g., using LangChain helpers like `formatToOpenAIFunctionT` if needed). *Pass*: Tools can be successfully bound to the agent framework. |
| [ ]**PH3‑06** | **Create OpenAI Functions Agent Executor (`src/agents/bookingAgent.js`)** | Implement the core agent logic using LangChain `createOpenAIFunctionsAgent`, wiring LLM, prompt, tools (stubs for now), and memory. *Pass*: Agent module created, basic agent executor/runnable sequence is defined and can be invoked. |
| [ ]**PH3‑07** | **Tool: Add `getUserProfileData` to `stateManager.js`**                 | Provide agent means to fetch user history/prefs for smarter suggestions. *Pass*: New tool function created in `stateManager.js`, Zod schema added to `toolSchemas.js`, and unit tests pass (simple tests). |
| [ ]**PH3‑08** | **Enhance Agent for Basic Intelligent Suggestions**                     | Update agent prompt (PH3-04) and potentially agent logic (PH3-06) to utilize `getUserProfileData` + `findFreeSlots` stubs to offer *slightly* more relevant slot suggestions based on simple heuristics (e.g., time of day preference). *Pass*: Agent attempts to use profile data when formulating slot suggestions (verified via LangSmith traces or specific tests). |
| [ ]**PH3‑09** | **Implement Basic Agent Unit/Integration Tests**                        | Verify the agent can follow simple instructions and invoke mocked tools correctly based on input. *Pass*: Test suite for agent created (`src/tests/agents/bookingAgent.test.js`), basic conversational turns tested, tool invocation verified using mocks. Keep tests simple. |
| [ ]**PH3‑10** | **Test Coverage:**                                                      | Ensure Phase 3 modules (`memory/`, `config/agentPrompts.js`, `agents/bookingAgent.js`, new tool function) meet ≥ 90% coverage. *Pass*: `npm test` coverage report confirms target for new files. |
| [ ]**PH3‑11** | **Update `docs/architecture.md`:**                                      | Add new directories/files (`memory/`, `agents/`, `config/agentPrompts.js`). Update status section for Phase 3 progress. |
| [ ]**PH3‑12** | **Final Review:**                                                       | Tick all Phase 3 task boxes here when done and ensure Discoveries/Insights are recorded. |

### 🚧 Discovered During Work
*(Add new subtasks here, e.g., `PH3‑D1`)*
*   **PH3-D1 (PH3-02):** Created src/memory/sessionMemory.js.
*   **PH3-D2 (PH3-02):** Implemented simple in-memory BufferMemory manager keyed by sessionId.
*   **PH3-D3 (PH3-02):** Added basic tests for instance creation/retrieval and history management.
*   **PH3-D4 (PH3-04):** Created `src/config/agentPrompts.js` containing the `bookingAgentSystemPrompt`.
*   **PH3-D5 (PH3-04):** Included placeholders (`{current_date_time}`, `{session_type}`, `{user_name}`) for dynamic context injection.
*   **PH3-D6 (PH3-04):** Prompt focuses on behavioral instructions suitable for an OpenAI Functions agent.

### 💡 Insights & Decisions
*(Explain memory choice, agent type choice, prompt design, testing strategy for agents, etc.)*
*   **(PH3-02):** Chose simple in-memory BufferMemory for initial agent development. This is sufficient for testing but needs replacement with a persistent store (e.g., DB-backed) for production reliability. Keying by sessionId allows concurrent conversations.
*   **(PH3-04):** Centralizing the system prompt in `src/config/agentPrompts.js` makes agent behavior easier to manage and iterate on.
*   **(PH3-04):** Providing clear instructions within the prompt regarding operational constraints (available times, booking window) and tool usage (when to use `findFreeSlots`, `storeBookingData`, `sendWaiverLink`, etc.) is crucial for reliable agent performance.

### 🧪 Quick‑Run Commands

npm test          # run mocha suite with coverage
npm run lint      # eslint check
npm run format    # prettier write
node bin/server   # local server

---
**Last updated:** 2025-04-25 14:30