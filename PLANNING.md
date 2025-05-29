# PLANNING.md (Revised 2025-05-02 v6)

> **Prompt to AI (internal):** _“Use the structure and decisions outlined in `PLANNING.md`.”_ Every new conversation must load this file before proposing code.

---

## 1 Purpose & Vision

Build a **scalable, observable, feature-rich Telegram assistant, But most importantly, a community building app** for **Kambo Klarity** that:

1.  Converses naturally with clients using LangChain + LangGraph (**including intelligent scheduling suggestions**).
2.  Finds free slots & books events in Google Calendar (**with flexible admin availability controls**).
3.  Collects registration (**including veteran/responder status**) / waiver forms via Telegram web-app.
4.  Notifies admins and lets them manage sessions, clients, offerings, **availability, packages, vouchers, referrals, and broadcasts** – all inside Telegram (minimal quick commands + **Admin Dashboard mini-app**).
5.  Provides AI analysis (**contra-indication/anomaly checks**, FAQ, **trends**, **prep guidance**).
6.  Includes robust logging, error handling, and observability using manual verification as the primary testing strategy.
7.  **Offers clients profile management and referral capabilities.**

The system must automate practitioner tasks, empower admins via Telegram, and provide a supportive, streamlined client journey, fostering a strong sense of community.

---

## 2 Guiding Principles

| ID  | Principle                                                               | Why it matters                                         |
| :-- | :---------------------------------------------------------------------- | :----------------------------------------------------- |
| P-1 | Single Source of Truth – one Prisma client & one Express server         | prevents duplicated state / ports                      |
| P-2 | Files ≤ 500 lines                                                       | keeps review manageable; forces modularity             |
| P-3 | LangChain-first orchestration                                           | agent logic expressed declaratively in LangGraph       |
| P-4 | Always consult Context7 MCP when using apis, deps, packages, tools, etc | ensures best-practice integrations                     |
| P-5 | Admin can configure data (Primarily from Admin Dashboard)               | rich UI preffered over many individual commands        |
| P-6 | Structured Logging & Error Handling                                     | enhances debuggability and production stability        |
| P-7 | Observable AI Interactions                                              | facilitates debugging and evaluation of agent behavior |
| P-8 | Through Manual Verification                                             | ensures features meet requirements across key scenarios|

---

## 3 Tech Stack

- **Runtime:** Node 18+, ES2020 (CommonJS)
- **Bot:** Telegraf (Telegram)
- **Web:** Express 4 – serves mini-apps and API routes
- **DB:** PostgreSQL via Prisma singleton `core/prisma.js`
- **AI:** LangChain JS + LangGraph. LLM selected via AI_PROVIDER env var ('openai' for GPT-4.1, 'gemini' for Gemini 2.5 Flash). Agent via createToolCallingAgent
- **Lint/Format:** ESLint (`recommended`) + Prettier
- **Logging:** Pino via singleton `core/logger.js`
- **AI Observability:** LangSmith
- **Testing:** Jest (Unit & Integration Tests). Manual Verification for E2E and exploratory testing.

---

## 4 Folder Layout (Actual - 2025-05-29)

[`src/`](src/)
├─ [`src/app.js`](src/app.js:0) # Main application setup: Express app, Telegraf bot wiring, global middleware.
├─ [`src/commands/`](src/commands/) # Bot command handlers and related logic.
│  ├─ [`src/commands/.gitkeep`](src/commands/.gitkeep:0) # Placeholder to ensure Git tracks the directory.
│  ├─ [`src/commands/handlers.js`](src/commands/handlers.js:0) # Shared or common logic for command handlers.
│  ├─ [`src/commands/registry.js`](src/commands/registry.js:0) # Maps command strings to their respective handler functions, often role-based.
│  └─ [`src/commands/client/`](src/commands/client/) # Command handlers specific to client users.
│     └─ [`src/commands/client/book.js`](src/commands/client/book.js:0) # Handler for the client '/book' command to initiate session booking.
├─ [`src/config/`](src/config/) # Static configuration files for the application.
│  ├─ [`src/config/.gitkeep`](src/config/.gitkeep:0) # Placeholder to ensure Git tracks the directory.
│  └─ [`src/config/sessionTypes.json`](src/config/sessionTypes.json:0) # Static JSON configuration for session types (may be superseded by DB).
├─ [`src/core/`](src/core/) # Core singleton modules providing essential services.
│  ├─ [`src/core/.gitkeep`](src/core/.gitkeep:0) # Placeholder to ensure Git tracks the directory.
│  ├─ [`src/core/bot.js`](src/core/bot.js:0) # Singleton Telegraf bot instance.
│  ├─ [`src/core/env.js`](src/core/env.js:0) # Loads, validates, and provides access to environment variables.
│  ├─ [`src/core/logger.js`](src/core/logger.js:0) # Singleton for structured application logging (e.g., using Pino).
│  ├─ [`src/core/prisma.js`](src/core/prisma.js:0) # Singleton Prisma client instance for database interaction.
│  └─ [`src/core/sessionTypes.js`](src/core/sessionTypes.js:0) # Helper module for managing session types (fetching from DB, etc.).
├─ [`src/errors/`](src/errors/) # Custom error class definitions for consistent error handling.
│  ├─ [`src/errors/AppError.js`](src/errors/AppError.js:0) # Base custom application error class.
│  └─ [`src/errors/NotFoundError.js`](src/errors/NotFoundError.js:0) # Custom error for 'Resource Not Found' scenarios.
├─ [`src/handlers/`](src/handlers/) # Handlers for various types of incoming requests or events (non-command specific).
│  ├─ [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0) # General handler for incoming API requests.
│  ├─ [`src/handlers/callbackQueryHandler.js`](src/handlers/callbackQueryHandler.js:0) # Handles Telegram callback queries (e.g., from inline buttons).
│  ├─ [`src/handlers/commandHandler.js`](src/handlers/commandHandler.js:0) # Central handler for parsing and dispatching bot commands.
│  ├─ [`src/handlers/registrationHandler.js`](src/handlers/registrationHandler.js:0) # Manages user registration processes and related logic.
│  └─ [`src/handlers/api/`](src/handlers/api/) # Handlers specific to API endpoints.
│     └─ [`src/handlers/api/sessionTypesApiHandler.js`](src/handlers/api/sessionTypesApiHandler.js:0) # API handler for requests related to session types.
├─ [`src/middleware/`](src/middleware/) # Express and Telegraf middleware functions.
│  ├─ [`src/middleware/errorHandler.js`](src/middleware/errorHandler.js:0) # Global Express error handling middleware.
│  ├─ [`src/middleware/errorHandlerMiddleware.js`](src/middleware/errorHandlerMiddleware.js:0) # (Potentially another or more specific error handler for Express).
│  ├─ [`src/middleware/loggingMiddleware.js`](src/middleware/loggingMiddleware.js:0) # Middleware for logging incoming requests.
│  ├─ [`src/middleware/rateLimiterMiddleware.js`](src/middleware/rateLimiterMiddleware.js:0) # Middleware for implementing rate limiting on requests.
│  ├─ [`src/middleware/updateRouter.js`](src/middleware/updateRouter.js:0) # Main Telegraf router; directs updates based on message type/state.
│  └─ [`src/middleware/userLookup.js`](src/middleware/userLookup.js:0) # Middleware to fetch or create user data and attach to request/context.
├─ [`src/routes/`](src/routes/) # Express route definitions for the web server.
│  ├─ [`src/routes/.gitkeep`](src/routes/.gitkeep:0) # Placeholder to ensure Git tracks the directory.
│  ├─ [`src/routes/api.js`](src/routes/api.js:0) # Defines general API routes.
│  ├─ [`src/routes/booking.js`](src/routes/booking.js:0) # Defines API routes related to the booking process.
│  ├─ [`src/routes/forms.js`](src/routes/forms.js:0) # Defines routes for serving and handling web forms.
│  └─ [`src/routes/sessions.js`](src/routes/sessions.js:0) # Defines API routes related to sessions.
└─ [`src/tools/`](src/tools/) # Utility modules, including LangChain tools and external service integrations.
   ├─ [`src/tools/.gitkeep`](src/tools/.gitkeep:0) # Placeholder to ensure Git tracks the directory.
   ├─ [`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0) # Tool for interacting with the Google Calendar API (finding slots, creating events).
   ├─ [`src/tools/googleCalendarEvents.js`](src/tools/googleCalendarEvents.js:0) # Helper module or specific event logic for the googleCalendar.js tool.
   ├─ [`src/tools/stateManager.js`](src/tools/stateManager.js:0) # LangChain tool for managing persistent user state and profile data in the database.
   ├─ [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) # LangChain tool for sending various types of messages and notifications via Telegraf.
   └─ [`src/tools/calendar/`](src/tools/calendar/) # Utilities and helpers specifically for calendar-related functionalities.
      ├─ [`src/tools/calendar/configUtils.js`](src/tools/calendar/configUtils.js:0) # Utility functions for calendar configuration.
      ├─ [`src/tools/calendar/freeBusyUtils.js`](src/tools/calendar/freeBusyUtils.js:0) # Utility functions for handling free/busy logic with calendars.
      └─ [`src/tools/calendar/slotGenerator.js`](src/tools/calendar/slotGenerator.js:0) # Logic for generating available time slots based on various rules.

[`bin/`](bin/) # Executable scripts for server operations, setup, and testing.
├─ [`bin/server.js`](bin/server.js:0) # Main script to start the application's Express server.
├─ [`bin/set_webhook.js`](bin/set_webhook.js:0) # Script to configure the Telegram bot's webhook URL.
├─ [`bin/test_find_slots_v2.js`](bin/test_find_slots_v2.js:0) # Test script for version 2 of the 'find free slots' functionality.
└─ [`bin/test_sessionTypes_module.js`](bin/test_sessionTypes_module.js:0) # Test script for the `core/sessionTypes.js` module.

[`docs/`](docs/) # Project documentation files.
└─ [`docs/architecture.md`](docs/architecture.md:0) # Document describing the overall architecture of the application.

[`prisma/`](prisma/) # Prisma ORM configuration, schema, and migration files.
├─ [`prisma/schema.prisma`](prisma/schema.prisma:0) # Defines the database schema, models, and relations.
└─ [`prisma/migrations/`](prisma/migrations/) # Contains all database migration files generated by Prisma.
   ├─ [`prisma/migrations/migration_lock.toml`](prisma/migrations/migration_lock.toml:0) # Prisma's mechanism to prevent concurrent migration applications.
   ├─ [`prisma/migrations/20250511073739_add_session_type_model/`](prisma/migrations/20250511073739_add_session_type_model/) # Folder for a specific migration.
   │  └─ [`migration.sql`](prisma/migrations/20250511073739_add_session_type_model/migration.sql:0) # The SQL script for the 'add_session_type_model' migration.
   ├─ [`prisma/migrations/20250511074832_refactor_timestamps_and_model_names/`](prisma/migrations/20250511074832_refactor_timestamps_and_model_names/)
   │  └─ [`migration.sql`](prisma/migrations/20250511074832_refactor_timestamps_and_model_names/migration.sql:0) # SQL for 'refactor_timestamps_and_model_names' migration.
   ├─ [`prisma/migrations/20250515131856_remove_conversation_fields/`](prisma/migrations/20250515131856_remove_conversation_fields/)
   │  └─ [`migration.sql`](prisma/migrations/20250515131856_remove_conversation_fields/migration.sql:0) # SQL for 'remove_conversation_fields' migration.
   ├─ [`prisma/migrations/20250515141336_added/`](prisma/migrations/20250515141336_added/)
   │  └─ [`migration.sql`](prisma/migrations/20250515141336_added/migration.sql:0) # SQL for 'added' migration (name could be more descriptive).
   ├─ [`prisma/migrations/20250516065742_add_availability_rules/`](prisma/migrations/20250516065742_add_availability_rules/)
   │  └─ [`migration.sql`](prisma/migrations/20250516065742_add_availability_rules/migration.sql:0) # SQL for 'add_availability_rules' migration.
   └─ [`prisma/migrations/20250516224617_add_slot_increment_to_rules/`](prisma/migrations/20250516224617_add_slot_increment_to_rules/)
      └─ [`migration.sql`](prisma/migrations/20250516224617_add_slot_increment_to_rules/migration.sql:0) # SQL for 'add_slot_increment_to_rules' migration.

[`public/`](public/) # Static assets served to clients (HTML, CSS, JavaScript, images for web apps).
├─ [`public/background-for-calendar.png`](public/background-for-calendar.png:0) # Background image asset for the calendar interface.
├─ [`public/backgroundVideo.mov`](public/backgroundVideo.mov:0) # Background video asset in MOV format.
├─ [`public/backgroundVideo.webm`](public/backgroundVideo.webm:0) # Background video asset in WebM format.
├─ [`public/calendar-api.js`](public/calendar-api.js:0) # Client-side JavaScript for interacting with calendar-related APIs.
├─ [`public/calendar-app.html`](public/calendar-app.html:0) # HTML structure for the calendar web application.
├─ [`public/calendar-app.js`](public/calendar-app.js:0) # Client-side JavaScript logic for the calendar web application.
├─ [`public/calendar-data.js`](public/calendar-data.js:0) # Client-side JavaScript for managing or providing data to the calendar app.
├─ [`public/calendar-ui.js`](public/calendar-ui.js:0) # Client-side JavaScript focused on the user interface of the calendar app.
├─ [`public/frog.png`](public/frog.png:0) # Image asset (frog.png).
├─ [`public/pristine.min.js`](public/pristine.min.js:0) # Minified client-side JavaScript library (Pristine) for form validation.
├─ [`public/registration-form.css`](public/registration-form.css:0) # CSS styles for the user registration web form.
├─ [`public/registration-form.html`](public/registration-form.html:0) # HTML structure for the user registration web form.
├─ [`public/waiver-form.css`](public/waiver-form.css:0) # CSS styles for the waiver web form.
└─ [`public/waiver-form.html`](public/waiver-form.html:0) # HTML structure for the waiver web form.

[`scripts/`](scripts/) # Utility or maintenance scripts not part of the main application flow.
├─ [`scripts/benchmark-freebusy.js`](scripts/benchmark-freebusy.js:0) # Script for benchmarking the FreeBusy API performance.
├─ [`scripts/demote_admin_users.js`](scripts/demote_admin_users.js:0) # Script to change user roles from admin to a standard user.
└─ [`scripts/set_all_commands.js`](scripts/set_all_commands.js:0) # Script to set or update all registered Telegram bot commands.

[`tests/`](tests/) # Automated test files (unit, integration). Structure mirrors `src/`.
├─ [`tests/sample.test.js`](tests/sample.test.js:0) # An example or placeholder test file.
├─ [`tests/setupTests.js`](tests/setupTests.js:0) # Configuration or setup script executed before tests run.
├─ [`tests/commands/`](tests/commands/)
│  ├─ [`tests/commands/handlers.test.js`](tests/commands/handlers.test.js:0) # Tests for `src/commands/handlers.js`.
│  └─ [`tests/commands/client/`](tests/commands/client/)
│     └─ [`tests/commands/client/book.test.js`](tests/commands/client/book.test.js:0) # Tests for `src/commands/client/book.js`.
├─ [`tests/core/`](tests/core/)
│  ├─ [`tests/core/bot.test.js`](tests/core/bot.test.js:0) # Tests for `src/core/bot.js`.
│  ├─ [`tests/core/env.test.js`](tests/core/env.test.js:0) # Tests for `src/core/env.js`.
│  ├─ [`tests/core/logger.test.js`](tests/core/logger.test.js:0) # Tests for `src/core/logger.js`.
│  ├─ [`tests/core/prisma.test.js`](tests/core/prisma.test.js:0) # Tests for `src/core/prisma.js`.
│  └─ [`tests/core/sessionTypes.test.js`](tests/core/sessionTypes.test.js:0) # Tests for `src/core/sessionTypes.js`.
├─ [`tests/handlers/`](tests/handlers/)
│  ├─ [`tests/handlers/apiHandler.test.js`](tests/handlers/apiHandler.test.js:0) # Tests for `src/handlers/apiHandler.js`.
│  ├─ [`tests/handlers/callbackQueryHandler.test.js`](tests/handlers/callbackQueryHandler.test.js:0) # Tests for `src/handlers/callbackQueryHandler.js`.
│  ├─ [`tests/handlers/commandHandler.test.js`](tests/handlers/commandHandler.test.js:0) # Tests for `src/handlers/commandHandler.js`.
│  └─ [`tests/handlers/registrationHandler.test.js`](tests/handlers/registrationHandler.test.js:0) # Tests for `src/handlers/registrationHandler.js`.
├─ [`tests/middleware/`](tests/middleware/)
│  ├─ [`tests/middleware/errorHandler.test.js`](tests/middleware/errorHandler.test.js:0) # Tests for `src/middleware/errorHandler.js`.
│  ├─ [`tests/middleware/errorHandlerMiddleware.test.js`](tests/middleware/errorHandlerMiddleware.test.js:0) # Tests for `src/middleware/errorHandlerMiddleware.js`.
│  ├─ [`tests/middleware/loggingMiddleware.test.js`](tests/middleware/loggingMiddleware.test.js:0) # Tests for `src/middleware/loggingMiddleware.js`.
│  ├─ [`tests/middleware/rateLimiterMiddleware.test.js`](tests/middleware/rateLimiterMiddleware.test.js:0) # Tests for `src/middleware/rateLimiterMiddleware.js`.
│  ├─ [`tests/middleware/updateRouter.test.js`](tests/middleware/updateRouter.test.js:0) # Tests for `src/middleware/updateRouter.js`.
│  └─ [`tests/middleware/userLookup.test.js`](tests/middleware/userLookup.test.js:0) # Tests for `src/middleware/userLookup.js`.
├─ [`tests/routes/`](tests/routes/)
│  ├─ [`tests/routes/api.test.js`](tests/routes/api.test.js:0) # Tests for `src/routes/api.js`.
│  ├─ [`tests/routes/booking.test.js`](tests/routes/booking.test.js:0) # Tests for `src/routes/booking.js`.
│  ├─ [`tests/routes/forms.test.js`](tests/routes/forms.test.js:0) # Tests for `src/routes/forms.js`.
│  ├─ [`tests/routes/sessions.test.js`](tests/routes/sessions.test.js:0) # Tests for `src/routes/sessions.js`.
│  └─ [`tests/routes/api/`](tests/routes/api/) # Tests for specific API route handlers.
│     ├─ [`tests/routes/api/getUserDataApi.test.js`](tests/routes/api/getUserDataApi.test.js:0) # Tests for an API endpoint that gets user data.
│     ├─ [`tests/routes/api/submitWaiverApi.test.js`](tests/routes/api/submitWaiverApi.test.js:0) # Tests for the API endpoint that submits waiver data.
│     └─ [`tests/routes/api/waiverCompletedWebhook.test.js`](tests/routes/api/waiverCompletedWebhook.test.js:0) # Tests for the waiver completed webhook handler.
└─ [`tests/tools/`](tests/tools/)
   ├─ [`tests/tools/freeBusyApi.integration.js`](tests/tools/freeBusyApi.integration.js:0) # Integration tests for the FreeBusy API.
   ├─ [`tests/tools/freeBusyApi.performance.test.js`](tests/tools/freeBusyApi.performance.test.js:0) # Performance tests for the FreeBusy API.
   ├─ [`tests/tools/googleCalendar.availability.test.js`](tests/tools/googleCalendar.availability.test.js:0) # Tests for Google Calendar availability logic.
   ├─ [`tests/tools/googleCalendar.constructor.test.js`](tests/tools/googleCalendar.constructor.test.js:0) # Tests for the constructor of the Google Calendar tool.
   ├─ [`tests/tools/googleCalendar.edgeCases.slots.test.js`](tests/tools/googleCalendar.edgeCases.slots.test.js:0) # Edge case tests for Google Calendar slot generation.
   ├─ [`tests/tools/googleCalendar.edgeCases.timezone.test.js`](tests/tools/googleCalendar.edgeCases.timezone.test.js:0) # Edge case tests for Google Calendar timezone handling.
   ├─ [`tests/tools/googleCalendar.generator.test.js`](tests/tools/googleCalendar.generator.test.js:0) # Tests for the Google Calendar slot generator logic.
   ├─ [`tests/tools/googleCalendar.setup.js`](tests/tools/googleCalendar.setup.js:0) # Setup file specific to Google Calendar tests.
   ├─ [`tests/tools/googleCalendar.slots.test.js`](tests/tools/googleCalendar.slots.test.js:0) # Tests for Google Calendar slot logic.
   ├─ [`tests/tools/googleCalendarEvents.test.js`](tests/tools/googleCalendarEvents.test.js:0) # Tests for `src/tools/googleCalendarEvents.js`.
   ├─ [`tests/tools/stateManager.test.js`](tests/tools/stateManager.test.js:0) # Tests for `src/tools/stateManager.js`.
   └─ [`tests/tools/telegramNotifier.test.js`](tests/tools/telegramNotifier.test.js:0) # Tests for `src/tools/telegramNotifier.js`.

# Root Level Configuration & Project Files
[`eslintrc.json`](.eslintrc.json:0) # ESLint configuration for JavaScript code linting.
[`.gitignore`](.gitignore:0) # Specifies intentionally untracked files that Git should ignore.
[`.prettierrc.json`](.prettierrc.json:0) # Prettier configuration for consistent code formatting.
[`.windsurfrules`](.windsurfrules:0) # Custom rules file (purpose specific to project tooling, possibly AI related).
[`babel.config.js`](babel.config.js:0) # Babel configuration for JavaScript transpilation (e.g., for Jest compatibility).
[`CALENDAR_IMPLEMENTATION.md`](CALENDAR_IMPLEMENTATION.md:0) # Markdown document detailing the calendar feature implementation.
[`eslint.config.js`](eslint.config.js:0) # Alternative or newer ESLint configuration file (project might use multiple).
[`FREEBUSY_API_PERFORMANCE_REPORT.md`](FREEBUSY_API_PERFORMANCE_REPORT.md:0) # Performance report for the FreeBusy API integration.
[`FREEBUSY_IMPLEMENTATION_GUIDE.md`](FREEBUSY_IMPLEMENTATION_GUIDE.md:0) # Guide for implementing the FreeBusy API.
[`generate_mcp_yaml.py`](generate_mcp_yaml.py:0) # Python script to generate MCP (Model Context Protocol) YAML configuration.
[`JEST_INTEGRATION_PLAN.md`](JEST_INTEGRATION_PLAN.md:0) # Planning document for integrating the Jest testing framework.
[`jest.config.js`](jest.config.js:0) # Jest configuration file for test runner settings.
[`package-lock.json`](package-lock.json:0) # Records exact versions of all installed npm dependencies.
[`package.json`](package.json:0) # Project manifest: lists dependencies, scripts, and metadata.
[`PLANNING.md`](PLANNING.md:0) # This main project planning and strategy document.
[`pre-commit.hook.disabled`](pre-commit.hook.disabled:0) # A pre-commit git hook that is currently disabled.
[`README.md`](README.md:0) # General project overview, setup instructions, and usage guide.
[`TASK.md`](TASK.md:0) # Document for tracking current development tasks or sprint goals.
---

## 5 Phased Roadmap (**Highly Detailed from Phase 6 Onwards**)

| Phase                         | Sub-Phase / Deliverable                                                                                                    | Detailed Goal & Key Features/Milestones                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 Foundation**              | Core Setup & Singletons                                                                                                    | ✅ **Completed:** Project structure, core singletons (env, prisma, bot, logger), basic Express app, Telegraf webhook, Manual DI pattern adopted, Husky for lint/format.                                                                                                                                                                                                      |
| **2 Core Tools & Enhancements**| Logging, Errors, Basic Tools, Schemas                                                                                      | ✅ **Completed:** Structured logging (Pino), global error handling, `stateManager` (user state, booking data), `telegramNotifier` (text, waiver link, role commands), GCal stubs, Zod schemas for tools, Veteran/Responder DB/form update. |
| **3 Agent & Memory**          | Conversational AI Core                                                                                                       | ✅ **Completed:** LangSmith, Session-based `BufferMemory`, `AI_PROVIDER` for OpenAI/Gemini, `bookingAgent.js` (using `createToolCallingAgent`), agent prompt (using user context), agent manually verified with tool stubs. |
| **4 LangGraph Flow**          | Orchestrating Booking Conversation                                                                                         | ✅ **Completed:** `bookingGraph` state, nodes (using initialized tools/agent), conditional edges defined and assembled into a runnable graph. Basic graph execution manually verified.                                                                |
| **5 Routing & Server Merge**  | Unifying Server & Activating Basic Bot Interaction                                                                         | ✅ **Completed:** `userLookup` & `updateRouter` middleware implemented. `bookingGraph` integrated for `BOOKING` state messages. Static file serving for forms. Form API/submission routes (`/submit-registration`, `/api/user-data`, `/api/submit-waiver`, `/waiver-completed`) implemented. Legacy server code removed. |
|                               |                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **6 Admin Essentials & Booking Activation** | **Overall Goal:** Establish basic admin controls, fully activate the AI-driven client booking flow, and transition session type management to the database (read-only from bot commands, full CRUD via future dashboard). |
|                               | **6.1 Admin Role & Command Infrastructure Setup**                                                                          | **Features:** Designate admin users; set up routing for commands based on role. <br> **Milestones:** `bin/set_admin.js` script successfully assigns 'admin' DB role and calls `telegramNotifier.setRoleSpecificCommands` to update admin's Telegram command menu. `src/middleware/updateRouter.js` correctly delegates commands to `commandHandler.handleCommand`. Distinct `/help` handlers (stubs with role-specific text replies) for 'client' and 'admin' exist and are correctly invoked. `src/middleware/updateRouter.js` correctly delegates commands to `commandHandler.handleCommand`. Manually verified. |
|                               | **6.2 Session Type DB Foundation & Read Access**                                                                           | **Features:** Move session type definitions to a database table for dynamic management. <br> **Milestones:** `SessionType` model defined in `prisma/schema.prisma` (id, label, durationMinutes, description, price, active). Migration run. Initial session types populated into DB. `src/core/sessionTypes.js` refactored: `getAll()` fetches active types from `prisma.sessionType`, `getById()` implemented. *(CRUD functions for internal/dashboard use added, but no Telegram commands for add/del/update in this phase)*. |
|                               | **6.3 Activate `/book` Command to Full AI Booking Flow**                                                                   | **Features:** Enable clients to initiate booking via /book, select session type, converse with AI agent to find/confirm a slot, receive a waiver link, and understand the next steps. Admin is notified of tentative booking. <br> Milestones: <br> 1. /book client command handler (src/commands/client/book.js) implemented: calls telegramNotifier.sendSessionTypeSelector tool. <br> 2. sendSessionTypeSelector tool (updated in PH6.4) uses DB-driven session types, sends selector message, stores message_id in user.edit_msg_id. <br> 3. callbackQueryHandler processes session type selection: sets user state (BOOKING, session_type, active_session_id), clears user.edit_msg_id, invokes bookingGraph (first turn via bookingAgent.runBookingAgent). The agent's first response (e.g., "Let's book your {session_type}. I'm retrieving your profile...") edits the selector message. <br> 4. Agent/Graph Conversation (Core): User interacts with agent (which uses getUserProfileData, getUserPastSessions, findFreeSlots stub). Agent acknowledges first-time/returning user, suggests slots based on history (if any) or general availability. User and agent finalize a date/time. <br> 5. Booking Finalization (Agent/Graph Actions): Upon user confirmation of a slot: Agent/Graph calls stateManager.storeBookingData (saves confirmedSlot to user's booking_slot). Then calls googleCalendar.createCalendarEvent (stub - saves fake googleEventId in graph state). <br> 6. Waiver Sending (Agent/Graph Action): Agent/Graph calls telegramNotifier.sendWaiverLink tool. This tool sends a new message with "Complete Your Booking - Waiver Form" button (URL to waiver form, includes telegramId, sessionType, and the newly created sessionId). The message_id of this waiver link message is stored in user.edit_msg_id. <br> 7. Agent Concludes Pre-Waiver Flow: Agent informs user: "Your slot {Date/Time} is held. Please complete the waiver form sent in the next message to confirm your booking." Graph ends this interaction. <br> 8. Admin Notification (Tentative Booking): After waiver link is sent, telegramNotifier.sendAdminNotification is called: "Client {Name} has tentatively booked {Session Type} for {Date/Time}. Awaiting waiver." <br> 9. Manual end-to-end flow verification successful. These are mostly completed in Phase 5 but are critical prerequisites for the full booking loop. <br> ✔️ /api/submit-waiver handler processes form data, creates Session record (status 'WAIVER_SUBMITTED'), updates User record (emergency contacts, clears booking_slot). (PH5-09) <br> ✔️ /api/submit-waiver handler notifies admin of waiver submission (e.g., "Client {Name} submitted waiver for {Date/Time} session. Awaiting final confirmation message edit."). (Part of PH5-09) <br> ✔️ /waiver-completed webhook handler (called internally by /api/submit-waiver if merged, or by form system) updates Session status to 'CONFIRMED', clears user.edit_msg_id, and edits the waiver link message to "✅ Booking Confirmed! Your session for {Date/Time} is set." (PH5-10). <br> ✔️ Admin Notification (Final Confirmation): After the /waiver-completed webhook successfully edits the client's message, it also sends a final notification to the admin: "Booking for {Client Name}, {Session Type} on {Date/Time} is NOW CONFIRMED. [Deep link stub to dashboard session view: `/admin_dashboard#/sessions/<sessionId>]". |
|                               | **6.4 Update Session Type Selector & Admin View Commands**                                                                 | **Features:** Ensure session selector uses DB. Provide basic admin views via Telegram. <br> **Milestones:** `telegramNotifier.sendSessionTypeSelector` tool refactored to use `core/sessionTypes.getAll({ active: true })`. `/sessions` admin command (view only) implemented, queries `sessions` table, replies with formatted list. `/dashboard` admin command implemented, sends WebApp button for future Admin Dashboard. |
|                               |                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **7 GCal Live & Dashboard UI Shell** | **Overall Goal:** Integrate live Google Calendar for real bookings. Construct the non-functional UI shell for the Admin Dashboard, laying groundwork for rich admin interactions. |
|                               | **7.1 Live Google Calendar Tooling (CRUD)**                                                                                | **Features:** Replace GCal stubs with real API calls for creating, reading, updating (implicitly via delete/create for changes), and deleting calendar events. <br> **Milestones:** `tools/googleCalendar.js`: `findFreeSlots`, `createCalendarEvent`, `deleteCalendarEvent` now use `googleapis` library (OAuth2 handled). `Session` DB schema stores `google_event_id`. `createCalendarEvent` tool stores this ID. Booking flow creates real GCal events. Cancellation logic (both pre-waiver by agent and post-waiver by `/cancel` command) correctly calls `deleteCalendarEvent`. MCP consulted. Manually verified. |
|                               | **7.2 Admin Dashboard UI Shell Construction (Static Frontend)**                                                            | **Features:** Build the visual framework for the Admin Dashboard based on provided image samples/style guidance. <br> **Milestones:** Secure admin web app served at `/admin_dashboard` (or similar route). Static HTML, CSS, and placeholder JavaScript for all planned dashboard sections/pages: Home/Overview, Client Management (List, Detail), Session Management (List, Detail, Calendar View), Session Type Management (List, Add/Edit Form), Availability Management (Calendar Interface), Package Management (List, Add/Edit Form), Voucher Management (List, Add/Edit Form), Broadcast Tool UI. Basic navigation between sections implemented. **Focus is on UI structure, not backend integration for management features yet.** |
|                               | **7.3 Basic Read-Only APIs & Data Display for Dashboard Shell**                                                            | **Features:** Enable the UI shell to display some initial, non-editable data. <br> **Milestones:** Minimal, secure API endpoints in `src/routes/adminApi.js` to fetch (read-only): list of clients, list of sessions (with client details), list of *active* session types. Admin Dashboard UI views for Client List, Session List, and Session Type List populate with this data. |
|                               |                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **8 Dashboard Backend & Automations** | **Overall Goal:** Make the Admin Dashboard fully functional for managing core entities (Session Types, Availability, Packages, Vouchers, Session Notes). Launch initial automated admin support features. |
|                               | **8.1 Dashboard Backend: Session Type Management (Full CRUD)**                                                             | **Features:** Enable full management of session types via the dashboard. <br> **Milestones:** API endpoints in `adminApi.js` and corresponding UI interactions in Admin Dashboard for: **Creating new Session Types**, **Updating existing Session Types** (label, duration, description, price, active status), **Deleting/Deactivating Session Types**. Uses `core/sessionTypes.js` CRUD functions. Manually verified. |
|                               | **8.2 Dashboard Backend: Availability Management (Blocking/Unblocking)**                                                   | **Features:** Allow admins to manage their availability directly via the dashboard calendar interface. <br> **Milestones:** API endpoints and UI in Admin Dashboard for admins to select date/time ranges on a calendar and **Block** or **Unblock** those times. These actions call `tools/googleCalendar.js` functions to create/delete "busy" or "blocked" events in Google Calendar. `findFreeSlots` heavily refactored to use these GCal events as the source of truth. AI slot suggestions become highly optimized. |
|                               | **8.3 Dashboard Backend: Package & Voucher Management (Full CRUD)**                                                        | **Features:** Enable creation and management of session packages and gift vouchers via the dashboard. <br> **Milestones:** Prisma schemas for `Package` (e.g., name, description, includes_sessions_of_type, num_sessions, price) and `Voucher` (e.g., code, discount_type, value, expiry_date, uses_left, applies_to_package_id) created & migrated. `tools/packageVoucherMgr.js` implemented with CRUD functions. API endpoints and UI in Admin Dashboard for creating, listing, updating, and deleting packages/vouchers. Manually verified. |
|                               | **8.4 Dashboard Backend: Session Notes & Outcome Logging**                                                                 | **Features:** Enable admins to log session notes and outcomes via the dashboard. <br> **Milestones:** API endpoints and UI in Admin Dashboard for admins to add/edit rich text notes to `Session` records. API/UI to update `session_status` (e.g., 'COMPLETED', 'NO_SHOW') from dashboard. Manually verified. |
|                               | **8.5 Admin Morning Brief (Automation)**                                                                                   | **Features:** Proactive daily summary for admin. <br> **Milestones:** `src/automations/morningBrief.js` (using `node-cron`) runs daily. Fetches admin users. For each admin, fetches their upcoming sessions for the day. For each session, AI generates a brief summary of client's past session notes and stated intent (from waiver/session data) for the upcoming session. Sends consolidated "Morning Brief" Telegram message via `telegramNotifier` with client name (clickable `tg://user?id=` link), session type, time, and AI summary. Manually verified for a test day. |
|                               | **8.6 Post-Session Logging Prompt (Automation)**                                                                           | **Features:** Timely prompt for admin to log session outcome and add notes. <br> **Milestones:** `src/automations/postSessionCheck.js` (using `node-cron`) runs periodically. Identifies sessions that have recently ended (status 'CONFIRMED'). Sends Telegram message to admin with session details and inline buttons: "✅ Attended - Add Notes" and "❌ No-Show". Callback handler for "No-Show" updates `sessions.session_status` to 'NO_SHOW'. Callback handler for "Attended" updates `sessions.session_status` to 'ATTENDED_PENDING_NOTES' (or 'COMPLETED') and replies with a message containing a deep link WebApp button to the Admin Dashboard's session notes page for that specific session. Manually verified. |
|                               |                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **9 AI Analysis & Client Prep** | **Overall Goal:** Utilize AI for data analysis, enhanced safety checks, and personalized client preparation, improving service quality and admin efficiency. |
|                               | **9.1 FAQ/Document Q&A (Basic RAG)**                                                                                       | **Features:** Allow admins (and potentially clients later) to ask questions against a predefined set of documents (FAQs, Kambo info). <br> **Milestones:** Basic RAG pipeline set up: Vector store created with initial documents. LangChain chain implemented to take a query, retrieve relevant document chunks, and use an LLM to synthesize an answer. Accessible via an admin command (e.g., `/ask_docs <query>`). Manually verified with sample questions. |
|                               | **9.2 AI-Assisted Waiver Review (Anomaly/Contra-indication Check)**                                                       | **Features:** Provide an AI-driven second look at submitted waiver data for potential concerns. <br> **Milestones:** `tools/waiverAnalyzer.js` tool created. After waiver submission (PH5-09 handler), this tool is invoked. It sends waiver data to an LLM with a prompt to identify potential contra-indications, anomalies, or areas needing clarification based on Kambo best practices. If concerns are flagged, a detailed notification is sent to the admin via `telegramNotifier` for manual review. Manually verified with test waiver data containing potential flags. |
|                               | **9.3 Personalized Pre-Session Preparation Guidance (Automation)**                                                       | **Features:** Send clients tailored advice before their session. <br> **Milestones:** `tools/prepAdvisor.js` created. It takes client data (e.g., veteran status, reason for seeking, past session count) and session type. Uses an LLM with a prompt to generate personalized preparation tips. Automated pre-session reminder messages (e.g., 24/48h before, likely a new automation script in `src/automations/`) now include this personalized guidance from `prepAdvisor`. Manually verified for different client profiles. |
|                               | **9.4 Admin Trend Analysis Command (`/analyze`)**                                                                          | **Features:** Allow admins to get AI-driven insights from booking data via a simple command. <br> **Milestones:** `/analyze <natural language query>` admin command implemented. The handler passes the query to `tools/analysisReporter.js`. This tool uses an LLM to interpret the NL query, formulate a Prisma query against `sessions` or `users` tables (e.g., "most popular session type last month", "booking count by day of week"), executes the query, and then uses the LLM again to summarize the results into a human-readable report sent back to the admin. Manually verified with sample analysis queries. |
|                               |                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **10 Client Empowerment**     | **Overall Goal:** Provide clients with more self-service options, enhance their connection with the practitioner, and foster community growth. |
|                               | **10.1 Client Profile Management (`/profile`)**                                                                              | **Features:** Allow clients to view and potentially update their basic information. <br> **Milestones:** `/profile` client command handler implemented. Displays stored user information (name, contact info – redacting sensitive parts if not updating). Optionally, provides a WebApp button to a simple form (`public/client-profile-form.html` served by `src/routes/clientApi.js`) where they can update their (non-critical) details, which POSTs to an API endpoint that updates the `User` record. Manually verified. |
|                               | **10.2 Direct Admin Contact (`/contact_admin`)**                                                                             | **Features:** Provide clients an easy way to get practitioner contact info or send a message. <br> **Milestones:** `/contact_admin` client command handler implemented. Displays practitioner's contact details (from config/env). Optionally, if direct messaging via bot is preferred: takes user's message, forwards it to admin via `telegramNotifier.sendAdminNotification` (with client context). Manually verified. |
|                               | **10.3 Cancellation of Confirmed Sessions (`/cancel`)**                                                                    | **Features:** Allow clients to cancel sessions they have already fully booked. <br> **Milestones:** `/cancel` client command handler implemented. Fetches user's 'CONFIRMED' sessions from DB. If multiple, presents inline keyboard for selection. On selection/confirmation, calls live `googleCalendar.deleteCalendarEvent` tool, updates `sessions.session_status` to 'CANCELLED_BY_CLIENT', notifies admin (via `telegramNotifier`), and confirms to client. Manually verified. |
|                               | **10.4 Basic Referral Program (`/referral`)**                                                                              | **Features:** Introduce a referral system. <br> **Milestones:** `User` model updated with `referral_code` (unique, generated) and `referred_by_user_id` (optional). `/referral` client command: generates/displays user's referral code. Registration form (`public/registration-form.html`) updated to include an optional "Referral Code" input field. `/submit-registration` handler (PH5-07) updated to validate code and store `referred_by_user_id`. Basic tracking in place. Special acknowledgment/note for Veteran/Responder referrals in admin notifications. |
|                               |                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **11 Advanced Admin Communication & Offerings** | **Overall Goal:** Equip admins with tools for targeted mass communication and flexible commercial offerings, managed primarily through the Admin Dashboard. |
|                               | **11.1 Broadcast Tool (via Admin Dashboard)**                                                                              | **Features:** Allow admin to send messages to multiple clients. <br> **Milestones:** Admin Dashboard UI section for "Broadcast". Admin can compose a message and select target audience (e.g., all clients, clients with upcoming sessions, clients with specific tags like 'veteran'). Backend API endpoint processes request, fetches target `telegramId`s, and uses `telegramNotifier.sendTextMessage` in a loop (with appropriate delays to respect rate limits). |
|                               | **11.2 Package & Voucher Management (Full Backend & Dashboard UI)**                                                        | **Features:** Allow admin to create and manage session packages and discount vouchers. <br> **Milestones:** This completes the Package/Voucher management features from Phase 8 (DB models, tools, API, Dashboard UI for CRUD). Booking flow (Agent/Graph) updated to understand and apply selected packages/vouchers during price calculation/confirmation (details TBD, might involve new tools/agent prompt updates). |
|                               |                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **12+ AI-Driven Scheduling, Advanced Dashboard & Community** | **Overall Goal:** Implement highly sophisticated AI scheduling, evolve the Admin Dashboard into a comprehensive management and analytics hub, and expand community-building functionalities. |
|                               | **12.1 AI Dynamic Scheduling (`/set_schedule`)**                                                                           | **Features:** Allow admin to update their availability using natural language. <br> **Milestones:** `/set_schedule <NL description of availability>` admin command. `tools/availabilityManager.js` uses an LLM to parse NL into structured availability rules (e.g., recurring blocks, specific date overrides) and updates Google Calendar accordingly (e.g., creating/deleting many "available" or "busy" blocks). `findFreeSlots` heavily refactored to use these GCal events as the source of truth. AI slot suggestions become highly optimized. |
|                               | **12.2 Advanced Admin Dashboard Features**                                                                                 | **Features:** Enhance dashboard with rich analytics and more user management. <br> **Milestones:** Dashboard includes visual analytics (charts/graphs) for booking trends, client demographics, revenue (if pricing integrated). More granular client management tools. |
|                               | **12.3 Enhanced Community Building Features**                                                                              | **Features:** Explore and implement features to deepen client engagement and community. <br> **Milestones:** Based on Kambo Klarity's needs, potentially implement: opt-in themed group chats managed/announced by bot, shared resource libraries (articles, videos) accessible via bot/dashboard, "Kambo Journey" visualization for clients (session history, notes with consent), AI-assisted post-session integration support (e.g., opt-in daily journal prompts via bot, AI reflections). |

---

## 6 Key Modules & Responsibilities (**Revised**)

| Module                       | Responsibility                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| core/env.js                  | load + validate .env vars                                                                                        |
| core/prisma.js               | singleton Prisma client                                                                                          |
| core/bot.js                  | Telegraf instance                                                                                                |
| core/logger.js               | singleton structured logger instance (Pino)                                                                      |
| core/sessionTypes.js         | helper for session types CRUD from DB (Phase 6+)                                                                 |
| tools/stateManager.js        | LangChain tools for managing persistent user state/profile in DB (incl. active_session_id)                       |
| tools/telegramNotifier.js    | LangChain tools for sending messages/forms/broadcasts via Telegraf, setting role-specific command scopes         |
| tools/googleCalendar.js      | LangChain tools for GCal interaction (stubs Phase 2, live Phase 7), incl. availability blocking & event deletion |
| tools/analysisReporter.js    | LangChain tools for querying DB/generating reports for admin (Phase 9+)                                          |
| tools/waiverAnalyzer.js      | LangChain tools for contra-indication/anomaly checks (Phase 9+)                                                  |
| tools/prepAdvisor.js         | LangChain tools for generating personalized prep guidance (Phase 9+)                                             |
| tools/packageVoucherMgr.js   | Tools for managing packages/vouchers in DB (Phase 11+)                                                           |
| tools/referralManager.js     | Tools for managing referral codes/tracking (Phase 10+)                                                           |
| tools/availabilityManager.js | (Future Phase 12+) Tools for parsing NL schedule commands & managing complex availability rules                  |
| handlers/commandHandler.js   | Handles command parsing and execution based on role and registry.                                                  |
| commands/registry.js         | maps command → handler by role                                                                                   |
| graph/\*                     | LangGraph definitions (booking, analysis flows)                                                                  |
| routes/...                   | Express routers (forms, admin mini-app, APIs)                                                                    |
| app.js                       | Express app setup, core middleware (incl. error handling), webhook routing                                       |
| memory/\*                    | LangChain conversation memory components/configuration (session-based)                                           |
| middleware/errorHandler.js   | Global Express error handler                                                                                     |
| middleware/userLookup.js     | (Existing) Fetches/creates user, attaches to `ctx.state.user`                                                    |
| middleware/updateRouter.js   | (Refined) Main router; directs to booking graph, command handler, or callback handler based on message/state       |
| middleware/authHandler.js    | Middleware to check user roles for Express routes (e.g., admin mini-app)                                         |
| config/\*                    | Static config, prompt templates, etc.                                                                            |
| errors/\*                    | Custom error class definitions                                                                                   |
| automations/\*               | Scheduled jobs (reminders, analysis, session end detection)                                                      |
| bin/set_admin.js             | Script to assign admin role via CLI                                                                              |
| bin/set_default_commands.js  | Script to set default Telegram commands                                                                          |

---

## 7 Bot Commands & Configurable Entities (**Revised**)

### 7.1 Command Registry Pattern

```js
// src/commands/registry.js
module.exports = {
  client: {
    help:   { descr: 'Show available commands', handler: handleHelp },
    book:   { descr: 'Start the session booking process', handler: startBooking }, 
    cancel: { descr: 'Cancel a *confirmed*, scheduled session', handler: handleCancel }, 
    profile: { descr: 'View/Update your profile', handler: handleProfile }, 
    contact_admin: { descr: 'Get direct contact info for the practitioner', handler: handleContactAdmin }, 
    referral: { descr: 'Get your referral code (Vet focus)', handler: handleReferral }, 
    // Future: integration_start, journal
  admin: {
    help: { descr: 'Show available commands', handler: handleHelp },
    sessions: { descr: 'List upcoming or recent sessions', handler: listSessions }, 
    broadcast: { descr: 'Send message to all registered clients', handler: handleBroadcast }, 
    dashboard: { descr: 'View admin dashboard', handler: handleDashboard } 
  }
};
```

** Middleware (`updateRouter.js` calling `src/handlers/commandHandler.js`) routes /command based on `ctx.state.user.role`. Admin role typically assigned manually via DB script or dedicated setup command initially (See Phase 6). Telegram `setMyCommands` can be used (via a tool/helper like `telegramNotifier.setRoleSpecificCommands(userId, role)`) to show role-specific commands to users.**

# 7.2 Session-Type Config (Database Driven from Phase 6)

Database Table: SessionTypes defined in prisma/schema.prisma.
Fields: id (PK), label (String), duration (Int), description (String, optional), active (Boolean, optional), etc.
CRUD Operations: Primarily managed via Admin Dashboard UI/API (Phase 8). Initial population and basic core/sessionTypes.js read access setup in PH6.

# 7.3 Other Configurable Entities (DB Driven)

Practitioner Availability: Primarily managed via Admin Dashboard UI (Phase 8) interacting with Google Calendar.
Packages/Bundles, Vouchers: Created and managed via Admin Dashboard UI/API (Phase 8).
Sessions: Status (e.g., 'SCHEDULED', 'WAIVER_SUBMITTED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_ADMIN', 'ATTENDED_PENDING_NOTES', 'NO_SHOW', 'COMPLETED') updated via booking flow, /cancel command, and Post-Session Logging Prompt/Dashboard.

# 7.4 Tests

(Scope expands to cover all new commands, tools, automations, and phases with automated tests where feasible.)

### Automated Testing with Jest

*   **Framework:** Jest will be used for automated unit and integration testing.
*   **Test Location:** Tests will reside in the `tests/` directory at the project root, with subdirectories mirroring the `src/` structure (e.g., `tests/core/`, `tests/tools/`).
*   **Unit Tests:** Focus on testing individual modules and functions in isolation. Mocks will be used for external dependencies (e.g., Prisma client, Google APIs, Telegraf).
*   **Integration Tests:** Focus on testing interactions between different modules, API endpoints (using `supertest`), and database interactions (potentially with a test database or transaction-based cleanup).
*   **Coverage:** Code coverage will be collected and reported, with a target threshold defined in `jest.config.js`.
*   **Execution:** Tests can be run via `npm test`.

### Manual Verification

*   **Purpose:** Manual verification will continue to be used for End-to-End (E2E) testing of user flows, exploratory testing, and verifying features that are difficult to automate comprehensively.
*   **Pattern:** Manual verification of features against defined scenarios before deployment, especially for complex user interactions and visual elements.
*   **Assertion Helpers:**
  - Verify bot responses and interactions in Telegram.
  - Check application logs (`logger` output).
  - Inspect database state changes (using a DB client).
  - Confirm interactions with external services (like Google Calendar).


# 8 External Integrations

Service Purpose Notes
Google Calendar availability + event creation Phase 2 stubs → Phase 7 live → Phase 14+ advanced mgmt
Context7 MCP knowledge-base for best-practice must query before new deps
Telegram chat & web-app Telegraf handles webhook
LangSmith AI Tracing, Debugging, Evaluation Recommended for integration during Phase 3+
Logging Service Log Aggregation (optional, future) Structured logs enable easier integration
Payment Processor For Packages/Vouchers (optional, future) e.g., Stripe, PayPal - Phase 11+ if selling
Render Application Hosting (Planned) Hosts Node.js app, DB


# 10 Constraints & Conventions

CommonJS, no TypeScript.
JSDoc for every exported symbol.
No file > 500 lines – split into helpers when near limit. Test files should also respect this limit conceptually; split if excessively complex.
Commit messages follow Conventional Commits (feat:, fix:, docs:, test:, chore:…).
Use structured logger (core/logger.js) instead of console.log in application code.
Handle errors gracefully (custom errors, centralized handler).
Dependency Injection: Use Manual DI pattern. Modules requiring dependencies (logger, prisma, bot, config, other tools) should export an initialize(dependencies) function and store received dependencies in module scope. 
Prioritize user privacy and data security in all features.

## 11 Feature Details & Explanations (**Comprehensive Expansion Needed Here**)

*(This section now requires comprehensive narratives for EACH sub-phase/deliverable listed in Section 5. I will provide the expanded details for the Admin Automations as examples, and you will need to apply this level of detail to ALL other features.)*

**Phase 6: Admin Essentials & Booking Activation**
*   **6.1 Admin Role & Command Infrastructure Setup:**
    *   **Goal:** Securely designate administrative users and establish a system where Telegram commands are routed and executed based on the user's role (client or admin).
    *   **`bin/set_admin.js` Script:** A command-line tool run by the project owner. Input: Telegram ID. Action: Updates the specified user's `role` to 'admin' in the `User` database table. It then immediately calls the `telegramNotifier.setRoleSpecificCommands` tool, providing the user's Telegram ID and their new 'admin' role. This ensures their Telegram command menu updates instantly to show admin commands. Error handling for non-existent user IDs or DB issues.
    *   **`src/middleware/updateRouter.js`:** This Telegraf middleware receives context (`ctx`) after user lookup. It extracts the command (e.g., `/help` -> `help`) and the user's role from `ctx.state.user.role`. It then consults `src/commands/registry.js` looking *only* in the section for that specific role (e.g., `commandRegistry.admin['help']`). If a handler is found, it's executed. If not (command unknown for that role, or command doesn't exist), a "Unknown command or unauthorized..." message is sent.
    *   **Distinct `/help` Handlers:** The `commandRegistry` defines separate `/help` entries for `client` and `admin`, pointing to different handler functions (e.g., `handleClientHelp`, `handleAdminHelp`). These handlers (initially stubs, then implemented to list relevant commands from the registry) provide role-tailored help messages.
    *   **Integration with `updateRouter.js`:** The `updateRouterMiddleware` (from Phase 5) identifies if an incoming message is a command. If so, it delegates the `ctx` to `commandHandler.handleCommand`.
    *   **Command Registry (`commands/registry.js`):**
{{ ... }}
*   **6.2 Session Type DB Foundation & Read Access:**
    *   **Goal:** Move session type definitions (1hr Kambo, 3x3 Kambo etc.) from a static JSON file to a database table for dynamic management and to serve as the single source of truth.
    *   **`SessionType` Prisma Model:** Define fields like `id` (String, e.g., "1hr-kambo"), `label` (String, "1 hr Kambo"), `durationMinutes` (Int), `description` (String), `price` (Decimal, optional), `active` (Boolean, default true). Migration creates the table.
    *   **Initial Data Population:** A one-time script or manual DB operation to transfer data from the old `sessionTypes.json` into the new `SessionType` table.
    *   **`core/sessionTypes.js` Refactor:** The existing helper is updated. `getAll()` now uses `prisma.sessionType.findMany({ where: { active: true } })` to fetch only active types for display to clients. `getById(id)` uses `prisma.sessionType.findUnique()`. Basic CRUD functions (`createType`, `updateType`, `deleteTypeOrDeactivate`) are added for future use by the Admin Dashboard (not exposed as Telegram commands).
*   **6.3 Activate `/book` Command to Full AI Booking Flow:**
    *   **Goal:** Enable clients to fully initiate booking via /book, converse with the AI agent to select and confirm a time slot, receive a waiver link, and complete the booking by submitting the waiver. Admins are notified at key stages.
    *   **Client `/book` Trigger:** Client sends /book.  
        Bot replies: "Please choose your session type:" with inline buttons (e.g., "1 hr Kambo," "3x3 Kambo") generated from active SessionTypes in the DB.  
        The `message_id` of this selector message is stored in `User.edit_msg_id`.
    *   **User Action (Selects Type):** Client clicks a session‑type button.
    *   **System (`callbackQueryHandler`):**  
        Acknowledges callback. Retrieves `User.edit_msg_id` (selectorMessageId).  
        Generates new unique `sessionId`; stores it in `User.active_session_id`.  
        Updates user state: `state='BOOKING'`, `session_type=selectedType`, sets `User.edit_msg_id = null`.  
        Invokes `bookingGraph` via `bookingAgent.runBookingAgent` with input "User selected {session type label}. Please retrieve their profile and begin booking."  
        The graph’s first output (e.g., “Hi {Name}, let's book your {session type}… Retrieving available slots…”) edits the `selectorMessageId`, replacing the buttons.
    *   **System (Agent/Graph Conversation – `bookingGraph`):**  
        User and agent converse. Agent may call:  
            * `getUserProfileData`  
            * `getUserPastSessions`  
            * `findFreeSlots` (stub returns fake slots)  
        Agent presents slots → user chooses → agent confirms.
    *   **Upon Final Slot Confirmation:**  
        * `stateManager.storeBookingData` saves chosen slot to `User.booking_slot`.  
        * `googleCalendar.createCalendarEvent` (stub) returns `googleEventId`, kept in graph state.  
        * `telegramNotifier.sendWaiverLink` constructs waiver URL  
          `YOUR_FORM_URL/waiver-form.html?telegramId=X&sessionType=Y&sessionId=Z&appointmentDateTime=ISO_SLOT_START`  
          and sends: “Great! Your slot for {Date} at {Time} is tentatively held. Please complete this waiver…” (WebApp button).  
          That waiver‑link message’s `message_id` is stored in `User.edit_msg_id`.  
        * Agent tells user: “I've sent you a link to the waiver form. Please complete it…”  
        * `telegramNotifier.sendAdminNotification` alerts admins: “Client {Name}… has tentatively booked… Awaiting waiver.”
    *   **Pre‑Waiver Cancellation (User types "cancel"):**  
        Graph sees `googleEventId`; if present, calls `googleCalendar.deleteCalendarEvent`.  
        Calls `stateManager.resetUserState` (clears booking fields).  
        Agent confirms cancellation.
    *   **User Action (Submits Waiver – Phase 5 logic):**  
        User fills waiver web‑app → browser `POST /api/submit-waiver` (PH5‑09).  
        Handler:  
            * Creates `Session` (status `WAIVER_SUBMITTED`)  
            * Updates `User` (emergency contacts, clears `booking_slot`)  
            * Notifies admin (“Waiver submitted by…”)  
        `/api/submit-waiver` triggers `/waiver-completed` (PH5‑10):  
            * Receives `telegramId`, `sessionId`  
            * Looks up `User.edit_msg_id` (waiver‑link message)  
            * Gets `Session` details (`appointment_datetime`)  
            * Sets `Session.session_status = 'CONFIRMED'`  
            * Sets `User.edit_msg_id = null`  
            * **Edits** waiver‑link message to: “✅ Booking Confirmed! …”  
            * Sends final admin alert: “Booking for {Client Name}… is NOW CONFIRMED. View: /admin_dashboard#/sessions/<sessionId>”

*   **6.4 Admin `/dashboard` Command & `/sessions` View:**
    *   **Goal:** Provide admins access to the future web dashboard and a quick Telegram view of sessions.
    *   **`/dashboard` Command Handler (`src/commands/admin/dashboard.js`):** When an admin sends `/dashboard`, this handler replies with a message containing a single WebApp button. The button's text is "Open Admin Dashboard" and its URL points to the future location of the admin mini-app (e.g., `config.FORM_URL/admin_dashboard`).
    *   **`/sessions` Command Handler (`src/commands/admin/sessions.js`):** When an admin sends `/sessions`, this handler queries the `sessions` table in Prisma for upcoming (and perhaps recently past) sessions (e.g., `where: { appointment_datetime: { gte: oneWeekAgo, lte: oneMonthFromNow } }, orderBy: { appointment_datetime: 'asc' }`). It fetches relevant fields like client name (via relation to User), session type, date/time, status. It then formats this information into a readable text message (or multiple messages if long) and sends it to the admin.

**Phase 7: Google Calendar Live & Dashboard UI Shell**
*   **7.1 Live Google Calendar Tooling (CRUD):**
    *   **Goal:** Replace all GCal stub functions with live API calls, enabling real event creation and availability checks.
    *   **OAuth2 Setup:** Implement robust Google OAuth2 authentication (server-to-server flow using a service account is often preferred for backend applications, or a one-time admin OAuth flow to get refresh tokens). Securely store credentials/tokens (e.g., in `.env` or a secure config store, managed by admin). Consult MCP for approved auth pattern.
    *   **`tools/googleCalendar.js` Refactor:**
        *   `findFreeSlots`: Now queries the live Google Calendar for free/busy information for the practitioner's calendar within the requested date/time range, considering existing events and specified session duration. Must also respect any "busy" blocks set by the admin (see 7.2). Returns an array of `{start: ISOString, end: ISOString}`.
        *   `createCalendarEvent`: Takes event details (start, end, summary, description with client name/session type, potentially attendee email). Creates an event in the live Google Calendar. Returns `{ success: true, eventId: 'actualGoogleEventId' }`. This `eventId` is then stored in the corresponding `Session` record in our database by the graph node that calls this tool.
        *   `deleteCalendarEvent`: Takes a `googleEventId`. Deletes the corresponding event from the live Google Calendar. Returns `{ success: true }`.
    *   **Error Handling:** Implement comprehensive error handling for API call failures, rate limits, auth issues.
*   **7.2 Admin Dashboard UI Shell Construction (Static Frontend):**
    *   **Goal:** Build the complete visual structure and navigation for all planned sections of the Admin Dashboard, based on provided image samples/style guidance. This phase focuses on the *frontend shell* only.
    *   **Technology:** HTML, CSS, client-side JavaScript (vanilla JS or a simple framework like Alpine.js/petite-vue if desired for minimal interactivity, but avoid heavy frameworks unless specifically planned). Served as static assets from the `public/admin_dashboard/` directory.
    *   **Pages/Layouts to Create (as static HTML/CSS shells):**
        *   Main Dashboard Layout (header, sidebar navigation, main content area).
        *   Client Management: List view (table: name, email, phone, last session), Detail view (all client fields, session history list).
        *   Session Management: List view (table: client, type, date/time, status), Detail view (all session details, waiver data snapshot, notes area), Calendar View (placeholder for GCal integration).
        *   Session Type Management: List view (table: label, duration, price, active), Add/Edit Form (all `SessionType` fields).
        *   Availability Management: Calendar interface mock-up for blocking/unblocking time.
        *   Package Management: List view, Add/Edit Form.
        *   Voucher Management: List view, Add/Edit Form.
        *   Broadcast Tool: UI for message composition and audience selection.
    *   **Styling:** Implement based on guidance. Ensure responsiveness.
    *   **Client-Side JS:** Minimal JS for navigation, showing/hiding sections, basic form validation stubs if any. No data fetching/saving logic yet beyond what's needed for 7.3.
*   **7.3 Basic Read-Only APIs & Dashboard Views:**
    *   **Goal:** Allow the UI shell to display some initial, non-editable data to make it feel more alive during development.
    *   **API Endpoints (`src/routes/adminApi.js`):** Create secure (admin-role checked) GET endpoints:
        *   `/api/admin/clients`: Returns a list of users with `role='client'`.
        *   `/api/admin/sessions`: Returns a list of all sessions (or recent/upcoming).
        *   `/api/admin/session_types`: Returns a list of *active* `SessionType` records.
    *   **Dashboard UI Integration:** The Client List, Session List, and Session Type List views in the dashboard shell (from 7.2) will use `fetch` to call these APIs and populate their tables/displays.

**Phase 8: Dashboard Backend & Automations**
*   **8.1 Dashboard Backend: Session Type & Availability Management:**
    *   **Goal:** Implement the backend logic to make the Session Type and Availability Management sections of the Admin Dashboard fully functional.
    *   **Session Type Management (CRUD APIs & UI Logic):**
        *   API Endpoints (in `src/routes/adminApi.js`):
            *   `POST /api/admin/session_types`: Accepts data, calls `core/sessionTypes.createType`.
            *   `PUT /api/admin/session_types/:id`: Accepts data, calls `core/sessionTypes.updateType`.
            *   `DELETE /api/admin/session_types/:id`: Calls `core/sessionTypes.deleteTypeOrDeactivate`.
        *   Dashboard UI (client-side JS in `public/admin_dashboard/`): Forms for adding/editing session types now submit to these APIs. List view updates dynamically. Delete/deactivate buttons call the API.
    *   **Availability Management (Dashboard UI to GCal):**
        *   API Endpoints:
            *   `POST /api/admin/availability/block`: Accepts start/end times. Calls `tools/googleCalendar.createBlockingEvent` (a new function that creates a specific type of "busy" event).
            *   `DELETE /api/admin/availability/unblock`: Accepts event ID or start/end of a block. Calls `tools/googleCalendar.deleteCalendarEvent`.
        *   Dashboard UI: Calendar interface allows admin to select time ranges. "Block Time" button calls the block API. Clicking on existing blocks and choosing "Unblock" calls the unblock API. The calendar display might need to periodically refresh from GCal (or use `findFreeSlots` to show availability).
*   **8.2 Dashboard Backend: Package & Voucher Management (Full CRUD):**
    *   **Goal:** Enable admins to create, manage, and view session packages and discount vouchers via the dashboard.
    *   **DB Models:** Define `Package` (name, description, price, included_session_types_and_counts, active) and `Voucher` (code, discount_type [% or fixed], value, expiry, uses_left, applies_to_package_id/session_type_id, active) in `prisma/schema.prisma`. Migrate.
    *   **Tool (`tools/packageVoucherMgr.js`):** Create functions for CRUD operations on Packages and Vouchers using Prisma.
    *   **API Endpoints (`src/routes/adminApi.js`):** Implement `POST`, `GET`, `PUT`, `DELETE` endpoints for `/api/admin/packages` and `/api/admin/vouchers`, calling the new tool functions.
    *   **Dashboard UI:** Frontend forms and lists in the Package Management and Voucher Management sections now interact with these APIs for full CRUD functionality.
*   **8.3 Dashboard Backend: Session Notes & Outcome Logging:**
    *   **Goal:** Allow admins to add detailed notes to sessions and log outcomes from the dashboard.
    *   **API Endpoints:**
        *   `PUT /api/admin/sessions/:sessionId/notes`: Accepts note content, updates `notes` field on `Session` record.
        *   `PUT /api/admin/sessions/:sessionId/status`: Accepts new status (e.g., 'COMPLETED', 'NO_SHOW'), updates `session_status`.
    *   **Dashboard UI:** Session Detail view's notes area is now a rich text editor (or textarea) that saves to the notes API. Buttons/dropdowns allow changing session status via the status API.
*   **8.4 Admin Morning Brief (Automation):**
    *   **Goal & Logic:** (As detailed in previous response: daily cron job, fetches admin, their upcoming sessions, client's past notes/current intent, uses AI for summary, sends consolidated Telegram message with `tg://user?id=` links).
    *   **Implementation:** `src/automations/morningBrief.js` using `node-cron`, Prisma, `telegramNotifier`, and a simple LLM call for summarization.
*   **8.5 Post-Session Logging Prompt (Automation):**
    *   **Goal & Logic:** (As detailed in previous response: periodic cron, finds recently ended sessions, sends admin Telegram message with "Attended - Add Notes" / "No-Show" buttons).
    *   **Implementation:** `src/automations/postSessionCheck.js` using `node-cron`, Prisma, `telegramNotifier`.
    *   **Callback Handler Update:** Extend `callbackQueryHandler.js` (or create new handler) to process `log_session_outcome:attended:<sessionId>` (updates status to 'ATTENDED_PENDING_NOTES', replies with deep link WebApp button to Admin Dashboard notes page: `config.FORM_URL/admin_dashboard#/sessions/${sessionId}/notes`) and `log_session_outcome:noshow:<sessionId>` (updates status to 'NO_SHOW', edits message).

**Phase 9: AI Analysis & Client Prep**
*   **9.1 FAQ/Document Q&A (Basic RAG):**
    *   **Goal:** Enable querying a knowledge base of Kambo-related documents or FAQs.
    *   **Implementation:** Set up a simple vector store (e.g., in-memory with LangChain, or a local file-based one like FAISS/Chroma if feasible). Load provided documents (text files, PDFs) into it, creating embeddings. Create a LangChain RAG (Retrieval Augmented Generation) chain in a new tool `tools/docQa.js`. This tool takes a user query, retrieves relevant document chunks from the vector store, and passes them with the query to an LLM to synthesize an answer. Implement an admin command `/ask_docs <query>` that uses this tool.
*   **9.2 AI-Assisted Waiver Review (Anomaly/Contra-indication Check):**
    *   **Goal:** Add an AI layer to help flag potential issues in submitted waiver forms.
    *   **Implementation:** Create `tools/waiverAnalyzer.js`. This tool takes the full waiver form data (JSON). It uses an LLM with a specific prompt designed to identify potential contra-indications, inconsistencies, or answers that might warrant practitioner attention based on Kambo safety guidelines. The prompt should ask for a structured output (e.g., list of flags with reasons). The `/api/submit-waiver` handler (PH5-09), after saving the session, will call this tool. If the tool returns any significant flags, `telegramNotifier.sendAdminNotification` is used to send a detailed alert to the admin including the client's name, session time, and the flagged concerns, urging manual review.
*   **9.3 Personalized Pre-Session Preparation Guidance (Automation):**
    *   **Goal:** Provide clients with tailored advice leading up to their session.
    *   **Implementation:** Create `tools/prepAdvisor.js`. This tool takes client context (e.g., `is_veteran_or_responder`, `reason_for_seeking` from `User` or `Session` data, number of past sessions) and the `sessionType`. It uses an LLM with a dynamic prompt to generate personalized preparation tips (diet, hydration, mental prep, what to bring, etc.). Create a new automation script `src/automations/sessionReminders.js` (using `node-cron`) that runs daily. It finds sessions scheduled for, e.g., 48 hours and 24 hours out. For each, it calls `prepAdvisor.js` and then uses `telegramNotifier.sendTextMessage` to send the reminder, including the personalized prep guidance.
*   **9.4 Admin Trend Analysis Command (`/analyze`):**
    *   **Goal:** Allow admins to get high-level insights from their booking data using natural language.
    *   **Implementation:** `/analyze <natural language query>` admin command. The handler passes the query to a new tool `tools/analysisReporter.js`. This tool first uses an LLM to convert the NL query into a structured Prisma query (e.g., query: "How many 1hr Kambo sessions did I do last month?" -> LLM generates parameters for `prisma.sessions.count({ where: { session_type: '1hr-kambo', appointment_datetime: { gte: startLastMonth, lt: startThisMonth }, session_status: 'COMPLETED' } })`). The tool executes the Prisma query. The raw results are then passed back to the LLM with another prompt to summarize them into a human-readable sentence or two. This summary is sent to the admin. (This is complex; start with very simple query types).

**Phase 10: Client Empowerment**
*   **10.1 Client Profile Management (`/profile`):**
    *   **Goal:** Allow clients to view and update their basic, non-critical information.
    *   **Implementation:** `/profile` client command. Handler fetches user data via `stateManager.getUserProfileData` and displays selected fields (name, email, phone - perhaps redacting parts of email/phone for display). Includes a WebApp button "Update My Info". This button opens `public/client-profile-form.html` (served via `src/routes/clientApi.js` - new router). The form allows editing name, email, phone. Submission (POST to `/api/client/profile`) updates the `User` record via a new handler in `clientApi.js`.
*   **10.2 Direct Admin Contact (`/contact_admin`):**
    *   **Goal:** Provide clients an easy way to get practitioner contact details or send a message.
    *   **Implementation:** `/contact_admin` client command handler. Option 1: Displays practitioner's static contact info (phone/email from `config` or admin user record). Option 2 (Preferred for privacy): Takes user's message (`/contact_admin <your message>`), then uses `telegramNotifier.sendAdminNotification` to forward `{Client Name} ({Client TG ID}) says: {message}` to the admin. Admin can then reply directly via Telegram.
*   **10.3 Cancellation of Confirmed Sessions (`/cancel`):**
    *   **Goal:** Allow clients to self-cancel sessions they have already fully booked and confirmed.
    *   **Implementation:** `/cancel` client command handler (`src/commands/client/cancel.js`).
        1.  Queries `sessions` table via Prisma for user's 'CONFIRMED' sessions with `appointment_datetime` in the future.
        2.  If none, replies "No upcoming confirmed sessions to cancel."
        3.  If one, replies "Found your session for {Date} at {Time}. Cancel? (Yes/No buttons)". Callback updates.
        4.  If multiple, replies with "Which session to cancel?" and inline buttons for each. Callback updates.
        5.  On "Yes" or selection: Retrieves `google_event_id` for the session. Calls `googleCalendar.deleteCalendarEvent(google_event_id)` (live tool from PH7). Updates `sessions.session_status` to 'CANCELLED_BY_CLIENT'. Calls `telegramNotifier.sendAdminNotification` ("Client {Name} cancelled session..."). Replies to client "Your session has been cancelled."
*   **10.4 Basic Referral Program (`/referral`):**
    *   **Goal:** Introduce a simple referral system.
    *   **Implementation:**
        1.  `User` Prisma model: Add `referral_code String? @unique` (short, memorable, generated), `referred_by_user_id BigInt?`. Migrate.
        2.  `/referral` client command handler (`src/commands/client/referral.js`):
            *   If user has no `referral_code`, generate one (e.g., using `uuid` substring or random string generator), save to user, display it.
            *   If user has one, display it. Also show info like "Share this code! If someone new books using it, [benefit - TBD, e.g., you get a discount note]."
        3.  `public/registration-form.html`: Add optional "Referral Code" input field.
        4.  `/submit-registration` handler (PH5-07): If referral code provided, validate it (find user with that code). If valid, store `referred_by_user_id` on the new user's record. Send enhanced admin notification mentioning referral.
        5.  Admin Dashboard (later phase) to view referral connections.
        6.  Note Veteran/Responder referrals for potential special handling.

**Phase 11: Advanced Admin Communication & Offerings**
*   **11.1 Broadcast Tool (via Admin Dashboard):**
    *   **Goal:** Allow admin to send targeted messages to multiple clients.
    *   **Implementation:**
        1.  Admin Dashboard UI ("Broadcast" section): Admin composes message (supports basic Markdown/HTML). Selects audience: "All Clients", "Clients with Upcoming Sessions", "Clients with No Bookings Since X", "Veterans/Responders".
        2.  Backend API (`POST /api/admin/broadcast`): Receives message and target criteria.
        3.  Handler fetches target `telegramId`s from Prisma based on criteria.
        4.  Uses a new function in `telegramNotifier.js` (e.g., `broadcastMessage(targetUserIds, messageText)`) which iterates through IDs and calls `sendTextMessage` with appropriate delays (e.g., 1 message per 1-2 seconds) to avoid Telegram rate limits. Logs successes and failures. Reports summary to admin.
        5.  Consider client opt-out preference (new field on User model).
*   **11.2 Package & Voucher Management (Full Backend & Dashboard UI Integration):**
    *   **Goal:** Allow admin to create and manage session packages and discount vouchers, and integrate them into the booking flow.
    *   **Implementation (Completes work from PH8.2):**
        1.  Ensure `Package` and `Voucher` DB models, `tools/packageVoucherMgr.js` CRUD functions, and Admin Dashboard UI/API for their management are fully functional.
        2.  **Booking Flow Integration (Agent/Graph - Phase 3/4 update needed):**
            *   Agent Prompt (PH3-04 update): When discussing session cost or at confirmation, agent can ask "Do you have a package or voucher code?".
            *   New Tools for Agent:
                *   `applyVoucher(code, sessionId_or_sessionType)`: Tool validates code via `packageVoucherMgr.js`, checks applicability, returns discount details or error.
                *   `applyPackage(packageId, userId)`: Tool checks if user owns package and has uses left via `packageVoucherMgr.js`.
            *   Graph State: Add fields for `appliedDiscount`, `appliedPackage`.
            *   Agent/Graph Nodes: New nodes to call these tools. Edges to handle valid/invalid codes/packages.
            *   Confirmation: Final price confirmed by agent reflects discount.
            *   `storeBookingData` / `createCalendarEvent`: May need to log voucher/package usage.
            *   Optional Payment: If selling directly, this is where payment processor integration would occur *after* price confirmation.

**Phase 12+: AI-Driven Scheduling, Advanced Dashboard & Community**
*   **12.1 AI Dynamic Scheduling (`/set_schedule`):**
    *   **Goal:** Allow admin to update their general availability using natural language commands.
    *   **Implementation:** `/set_schedule <NL description>` admin command (e.g., "/set_schedule I'm available next week Mon-Wed 10am to 2pm, but not Tuesday 12pm").
    *   `tools/availabilityManager.js`: This complex tool uses an LLM to parse the NL.
        *   LLM identifies dates, times, recurrences, exceptions.
        *   Tool translates these into a series of actions for Google Calendar: create "available" blocks, delete existing blocks, create "busy" blocks for exceptions. This will likely involve creating many fine-grained events or modifying existing ones in GCal.
        *   `findFreeSlots` tool in `googleCalendar.js` needs to be heavily refactored to primarily query based on these GCal "available" blocks, or free-busy checks if that's more reliable with the new GCal event structure.
*   **12.2 Advanced Admin Dashboard Features:**
    *   **Goal:** Evolve the dashboard into a comprehensive control center.
    *   **Implementation:** Add rich visual analytics (charts using a library like Chart.js) for booking trends, client demographics, revenue (if pricing is tracked), referral success rates. More granular client management: tagging, segmentation for broadcasts. UI for configuring bot settings (e.g., reminder timings, messages – if moved to DB).
*   **12.3 Enhanced Community Building Features:**
    *   **Goal:** Implement features to foster connection and provide ongoing value.
    *   **Opt-in Group Chats/Channels:** Bot could facilitate creation or announcement of themed group chats (e.g., "Post-Kambo Integration Circle") based on user interest or tags.
    *   **Shared Resource Library:** Admin Dashboard section to upload articles/videos. Client command or WebApp section for clients to browse/search these resources (potentially with AI-powered RAG).
    *   **"Kambo Journey" Visualization:** Client-facing section in a mini-app (launched from `/profile` or similar) showing their session history, maybe linking to their own (future) journal entries or intentions set.
    *   **AI-Assisted Post-Session Integration Support:** An opt-in flow where after a session, the bot sends daily/periodic journal prompts (e.g., "How are you feeling today? Any insights?"). User replies are stored. Agent could (with explicit consent) offer reflections or point to resources based on journal themes. Requires very careful design around privacy and scope.

---

# 12 Potential Future Explorations (Beyond Phase 14)

AI Post-Session Integration Support: Offer clients an opt-in program via the bot for integration guidance post-session. Use LangGraph to manage daily journal prompts, retrieve relevant resources (RAG), and potentially offer AI-generated reflections based on journal entries. Requires careful design around privacy, scope, and avoiding therapeutic claims. (Formerly Phase 12)

Client "Kambo Journey" Visualization: Enhance the client-facing web app (requires Phase 10 profile/mini-app foundation) to display a timeline or dashboard of their session history. Could potentially include AI-summarized themes from journal entries (with consent) or intentions set. (Formerly Phase 13)

Advanced Personalization: Deeper analysis of client journey data to tailor suggestions, resources, or check-ins even further.
External Health Platform Integration: Allow clients (with explicit consent) to connect data from wearables or health apps for richer context (requires significant security/privacy work).

Multi-Practitioner Support: Adapt the system to handle multiple practitioners with separate schedules and client lists.
Automated A/B Testing: Experiment with different reminder messages, booking flow prompts, etc., and track conversion/effectiveness.

Sentiment Analysis: Analyze journal entries or feedback to gauge client well-being and potentially tailor integration support or flag concerns for the practitioner.

Community Features: Opt-in group chats, shared resource libraries within Telegram or the web app, broadcasting based on attributes of clients Like sending veteran or first responders a special deal or announcement about an event that will have buttons that Say they will attend or a button that says maybe next time. Keep track of both in the admin dashboard.

Admin dashboard: Treat as its own complete program that we will start on after everything else is in place and we can focus on just that. Increasing functionality and and ease of use will be the main focus. Creating a power admin to really be able to form a community around this and communicate with that community. To provide incredible value to the community and practitioners. Not putting in features to just fluff it up. Putting in features that once experienced, will become a must have. This app is a community builder. That is the mantra.

## 13 Document Version
*   v15 (YYYY-MM-DD): Overhauled Section 5 (Phased Roadmap) and Section 11 (Feature Details) to provide highly detailed, granular descriptions and goals for each sub-phase and feature, including new features like Admin Morning Brief and Post-Session Logging Prompt. Emphasized Admin Dashboard as central management hub. Aligned command list and feature phasing.

**(End of COMPLETE PLANNING.MD v15 - Highly Detailed Explanations)**
