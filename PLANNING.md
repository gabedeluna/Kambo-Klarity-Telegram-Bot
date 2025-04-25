# PLANNING.md (Revised 2025-04-24 v5)

> **Prompt to AI (internal):** _“Use the structure and decisions outlined in `PLANNING.md`.”_ Every new conversation must load this file before proposing code.

---

## 1 Purpose & Vision

Build a **scalable, test-first, observable, feature-rich Telegram assistant** for **Kambo Klarity** that:

1.  Converses naturally with clients using LangChain + LangGraph (**including intelligent scheduling suggestions**).
2.  Finds free slots & books events in Google Calendar (**with flexible admin availability controls**).
3.  Collects registration (**including veteran/responder status**) / waiver forms via Telegram web-app.
4.  Notifies admins and lets them manage sessions, clients, offerings, **availability, packages, vouchers, referrals, and broadcasts** – all inside Telegram (commands + **mini-app**).
5.  Provides AI analysis (**contra-indication/anomaly checks**, FAQ, **trends**, **prep guidance**).
6.  Includes robust logging, error handling, and observability.
7.  **Offers clients profile management and referral capabilities.**

The system must automate practitioner tasks, empower admins via Telegram, and provide a supportive, streamlined client journey.

---

## 2 Guiding Principles

| ID  | Principle                                    | Why it matters                                            |
| :-- | :------------------------------------------- | :-------------------------------------------------------- |
| P-1 | Single Source of Truth – one Prisma client & one Express server | prevents duplicated state / ports                         |
| P-2 | Files ≤ 500 lines                            | keeps review manageable; forces modularity                |
| P-3 | Test Early, Test Often                       | every function/class/tool has Mocha unit tests            |
| P-4 | LangChain-first orchestration                | agent logic expressed declaratively in LangGraph          |
| P-5 | Consult Context7 MCP before new deps         | ensures best-practice integrations                        |
| P-6 | Admin can configure data from Telegram       | no external dashboard required                            |
| P-7 | Structured Logging & Error Handling          | enhances debuggability and production stability         |
| P-8 | Observable AI Interactions                   | facilitates debugging and evaluation of agent behavior    |

---

## 3 Tech Stack

*   **Runtime:** Node 18+, ES2020 (CommonJS)
*   **Bot:** Telegraf (Telegram)
*   **Web:** Express 4 – serves mini-apps and API routes
*   **DB:** PostgreSQL via Prisma singleton `core/prisma.js`
*   **AI:** LangChain JS + LangGraph, default LLM = OpenAI GPT-4
*   **Testing:** Mocha + Chai + Sinon + Supertest + NYC (≥ 90 % coverage)
*   **Lint/Format:** ESLint (`recommended`) + Prettier, husky pre-commit
*   **Logging:** **Pino** (or Winston) via singleton `core/logger.js`
*   **AI Observability:** **LangSmith** (recommended)

---

## 4 Folder Layout (target)
Use code with caution.
Markdown
src/
├─ core/ # env, prisma, bot, logger singletons, sessionTypes (DB helper)
├─ tools/ # LangChain tools (stateManager, telegramNotifier, googleCalendar, analysis, etc.)
├─ graph/ # LangGraph node/edge definitions (booking, analysis flows)
├─ commands/ # registry + individual Telegraf command handlers (client & admin)
├─ routes/ # Express routers (forms, admin mini-app, APIs)
├─ config/ # Static config (e.g., initial roles, prompt templates)
├─ errors/ # Custom error class definitions
├─ middleware/ # Custom Express middleware (auth, error handling, update routing)
├─ memory/ # LangChain memory management components
├─ automations/ # Scheduled jobs (reminders, analysis triggers, session end detection)
├─ views/ # (Optional) Templates for web-apps if not using static HTML/JS entirely
├─ app.js # Express + Telegraf wiring + global middleware
└─ tests/ # mirrors structure
bin/
├─ server.js # Starts the Express server
└─ set_admin.js # (Optional) Script to designate an admin user
---

## 5 Phased Roadmap (**Revised & Reordered**)

| Phase                      | Deliverable                                                                                             | Key Milestones                                                                                                           |
| :------------------------- | :------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------- |
| **1 Skeleton & Tests**     | singletons, Express+Telegraf bootstrap, base CI                                                         | ✔ health + DB tests, base coverage, core structure                                                                       |
| **2 LangChain Tools**      | logging, error handling, state/telegram tools, GCal stubs, tool defs, **ask veteran/responder status**   | ✔ logger/error middleware, tool unit tests, schema standard, **registration form updated**                               |
| **3 Agent & Memory**       | OpenAI Functions agent calling tools, LangSmith setup, memory impl., **basic intelligent suggestions**   | ✔ booking via agent, traces visible, memory strategy tested, **agent suggests slots based on history/preference**      |
| **4 LangGraph Flow**       | Model booking conversation as nodes/edges                                                               | ✔ node tests, graph execution tests for booking                                                                          |
| **5 Core Routing & Server Merge** | **Implement Core Update Router (New User/Existing logic)**, Move form server routes into main app | ✔ **New User flow working**, integration tests for forms/APIs, **basic message routing structure in place**          |
| **6 Admin Foundational**   | **Designate Admin**, **Implement Role-Based Command Routing**, DB-based session types, `/admin` menu, client/session list commands | ✔ **Admin user identified**, **Admin commands restricted via middleware & set via API**, admin commands mutate `SessionTypes` DB, `/sessions`, `/clients` work |
| **7 Google Calendar Live** | Replace GCal tool stubs with real API, **add Admin Availability Management (commands)**                 | ✔ booking creates GCal event, **`/block_time`, `/unblock_time` commands modify GCal/availability**                     |
| **8 Admin Mini-App v1**    | TG web-app: view clients, sessions, calendar view (**basic**), add session notes, **client lookup**       | ✔ role-based auth, basic dashboard loads data, **notes saved to session record**, search works                         |
| **9 AI Analysis & Prep**   | FAQ/Doc-QA, Contra-indication/Anomaly check, **Admin Trend Analysis**, **Pre-Session Prep Guidance**   | ✔ RAG test, waiver analysis flags, `/analyze` command works, **reminders include personalized prep**                     |
| **10 Client Features v1**  | **/profile command**, **/contact_admin command**, **Basic Referral Program (Vet Focus)**              | ✔ clients can view/update profile, get admin contact, referral codes generated/tracked, **vet referral noted**           |
| **11 Admin Features v2**   | **Broadcast command**, **Package/Bundle Management**, **Gift Voucher Management**                   | ✔ `/broadcast` sends to clients, admin commands for packages/vouchers, booking reflects discounts/redemption             |
| **12+ AI Dynamic Scheduling** | **NL Admin Availability Control**, advanced scheduling logic                                        | ✔ Admin can set complex schedules via chat, AI optimizes slot suggestions                                                |

---

## 6 Key Modules & Responsibilities (**Revised**)

| Module                          | Responsibility                                                                                      |
| :------------------------------ | :-------------------------------------------------------------------------------------------------- |
| **core/env.js**                 | load + validate `.env` vars                                                                         |
| **core/prisma.js**              | singleton Prisma client                                                                             |
| **core/bot.js**                 | Telegraf instance                                                                                   |
| **core/logger.js**              | singleton structured logger instance (e.g., Pino)                                                   |
| **core/sessionTypes.js**        | helper for session types CRUD from DB (Phase 6+)                                                    |
| **tools/stateManager.js**       | LangChain tools for managing persistent user state/profile in DB                                      |
| **tools/telegramNotifier.js**   | LangChain tools for sending messages/forms/broadcasts via Telegraf, **setting role-specific command scopes (`setRoleSpecificCommands`)** |
| **tools/googleCalendar.js**     | LangChain tools for GCal interaction (stubs Phase 2, live Phase 7), **incl. availability blocking** |
| **tools/analysisReporter.js**   | LangChain tools for querying DB/generating reports for admin (Phase 9+)                             |
| **tools/waiverAnalyzer.js**     | LangChain tools for contra-indication/anomaly checks (Phase 9+)                                     |
| **tools/prepAdvisor.js**        | LangChain tools for generating personalized prep guidance (Phase 9+)                                  |
| **tools/packageVoucherMgr.js**  | Tools for managing packages/vouchers in DB (Phase 11+)                                               |
| **tools/referralManager.js**    | Tools for managing referral codes/tracking (Phase 10+)                                              |
| **tools/availabilityManager.js**| (Future Phase 12+) Tools for parsing NL schedule commands & managing complex availability rules   |
| **commands/registry.js**        | maps command → handler by role                                                                      |
| **graph/\***                    | LangGraph definitions (booking, analysis flows)                                                     |
| **routes/...**                  | Express routers (forms, admin mini-app, APIs)                                                       |
| **app.js**                      | Express app setup, core middleware (incl. error handling), webhook routing                          |
| **memory/\***                   | LangChain conversation memory components/configuration                                            |
| **middleware/errorHandler.js**  | Global Express error handler                                                                        |
| **middleware/userLookup.js**    | (New/Refined) Middleware to find/attach user data (`ctx.state.user`, `isNewUser`)                   |
| **middleware/updateRouter.js**  | (New) Middleware to route incoming updates (new user, command, message, callback)                 |
| **middleware/commandRouter.js** | (New/Refined) Middleware (or part of updateRouter) for role-based command execution               |
| **middleware/authHandler.js**   | Middleware to check user roles for *Express* routes (e.g., admin mini-app)                          |
| **config/\***                   | Static config, prompt templates, etc.                                                               |
| **errors/\***                   | Custom error class definitions (optional)                                                           |
| **automations/\***              | Scheduled jobs (reminders, analysis, session end detection)                                         |
| **bin/set_admin.js**            | (Optional) Script to assign admin role via CLI                                                      |

---

## 7 Bot Commands & Configurable Entities (**Revised**)

### 7.1 Command Registry Pattern
```js
// src/commands/registry.js
module.exports = {
  client: {
    help:   { descr: 'Show available commands', handler: handleHelp },
    book:   { descr: 'Start the session booking process', handler: startBooking }, // Likely triggers graph
    cancel: { descr: 'Cancel an ongoing booking or a scheduled session', handler: handleCancel },
    profile: { descr: 'View/Update your profile', handler: handleProfile }, // Phase 10
    contact_admin: { descr: 'Get direct contact info for the practitioner', handler: handleContactAdmin }, // Phase 10
    referral: { descr: 'Get your referral code (Vet focus)', handler: handleReferral }, // Phase 10
    integration_start: { descr: 'Begin post-session integration support', handler: handleIntegrationStart }, // Phase 12
    journal: { descr: 'Add a post-session journal entry', handler: handleJournal }, // Phase 12
  },
  admin: {
    sessions: { descr: 'List upcoming or recent sessions', handler: listSessions }, // Phase 6
    clients: { descr: 'List registered clients', handler: listClients }, // Phase 6
    session_add: { descr: 'Add session-type (DB)', handler: addSessionType }, // Phase 6
    session_del: { descr: 'Remove session-type (DB)', handler: removeSessionType }, // Phase 6
    block_time: { descr: 'Block specific time slots in calendar', handler: handleBlockTime }, // Phase 7
    unblock_time: { descr: 'Unblock specific time slots', handler: handleUnblockTime }, // Phase 7
    broadcast: { descr: 'Send message to all registered clients', handler: handleBroadcast }, // Phase 11
    package_add: { descr: 'Define a new session package', handler: handlePackageAdd }, // Phase 11
    package_list: { descr: 'List active packages', handler: handlePackageList }, // Phase 11
    voucher_add: { descr: 'Create a gift voucher code', handler: handleVoucherAdd }, // Phase 11
    voucher_list: { descr: 'List active vouchers', handler: handleVoucherList }, // Phase 11
    analyze: { descr: 'Ask questions about booking trends (AI)', handler: handleAnalysis }, // Phase 9
    set_schedule: { descr: 'Update availability using natural language (AI)', handler: handleSetSchedule }, // Phase 14+
  }
};
```
** Middleware (middleware/commandRouter.js or within middleware/updateRouter.js) routes /command based on ctx.state.user.role. Admin role typically assigned manually via DB script or dedicated setup command initially (See Phase 6). Telegram setMyCommands can be used (via a tool/helper like telegramNotifier.setRoleSpecificCommands(userId, role)) to show role-specific commands to users.**

# 7.2 Session-Type Config (Database Driven from Phase 6)
Database Table: SessionTypes defined in prisma/schema.prisma.
Fields: id (PK), label (String), duration (Int), description (String, optional), active (Boolean, optional), etc.
Admin Commands: /session_add, /session_del interact via Prisma.
Helper: core/sessionTypes.js interacts with DB (Phase 6+).

# 7.3 Other Configurable Entities (DB Driven)
Packages/Bundles (Phase 11): DB table, managed via admin commands.
Vouchers (Phase 11): DB table, managed via admin commands.
Referral Rules (Phase 10): Simple config or DB entries (e.g., ReferralPrograms table).
Practitioner Availability Rules (Phase 7 basic, Phase 14+ advanced): Stored/managed via GCal events and/or dedicated DB tables (AvailabilityRules).

# 7.4 Tests
(Scope expands to cover all new commands, tools, automations, and phases)

# 8 External Integrations
Service	Purpose	Notes
Google Calendar	availability + event creation	Phase 2 stubs → Phase 7 live → Phase 14+ advanced mgmt
Context7 MCP	knowledge-base for best-practice	must query before new deps
Telegram	chat & web-app	Telegraf handles webhook
LangSmith	AI Tracing, Debugging, Evaluation	Recommended for integration during Phase 3+
Logging Service	Log Aggregation (optional, future)	Structured logs enable easier integration
Payment Processor	For Packages/Vouchers (optional, future)	e.g., Stripe, PayPal - Phase 11+ if selling

# 9 Testing & CI
Unit: Mocha for functions, tools, command handlers, helpers (using mocking).
Integration: Supertest spins up app on random port (tests routes, middleware).
Coverage: NYC gate ≥ 90 % (for application code in src/).
Lint/Format: ESLint + Prettier, enforced in husky pre-commit.
AI Testing: LangSmith evaluations (manual/automated) for agent/graph quality. Scenario tests for complex flows.

# 10 Constraints & Conventions
CommonJS, no TypeScript
JSDoc for every exported symbol
No file > 500 lines – split into helpers when near 450
Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`…)
Use structured logger (`core/logger.js`) instead of `console.log`.
Handle errors gracefully (custom errors, centralized handler).
Testing Dependency Injection:** Use **`proxyquire`** to inject mocked dependencies (like logger, prisma client) into modules during unit/integration testing to ensure isolation and verify interactions. *(Alternatively, or where appropriate, setter injection may be used, especially for testing singleton behavior itself).
Prioritize user privacy and data security in all features.

# 11 Feature Details & Explanations
### Structured Logging (Phase 2)

*   **Goal:** Replace standard `console.log`/`error` with a more robust logging system.
*   **Implementation:** Introduce the `pino` library. Create a singleton logger instance in `src/core/logger.js`. This logger will be configured to output structured JSON logs (ideal for production monitoring and analysis) but use `pino-pretty` to format logs readably during development (`NODE_ENV !== 'production'`). Update all core modules (`app.js`, `bin/server.js`, `core/*`, tool modules) to `require` and use this logger instance (`logger.info`, `logger.error({ err, ... }, 'message')`, etc.), passing error objects directly for detailed logging.
*   **Benefit:** Greatly improves debuggability and observability, especially in complex flows or production environments. Allows easy filtering and searching of logs.

---

### Centralized Error Handling (Phase 2)

*   **Goal:** Create a safety net to catch any unhandled errors within Express routes or middleware.
*   **Implementation:** Create an Express error-handling middleware function in `src/middleware/errorHandler.js` (signature: `(err, req, res, next)`). This middleware will be registered using `app.use()` as the *very last* middleware in `src/app.js`. Inside the handler, use the structured logger (`core/logger.js`) to log detailed error information (error object, stack trace, request details). Determine an appropriate HTTP status code (e.g., 500 for unexpected errors, or `err.statusCode` if using custom operational errors). Send a standardized, generic JSON error response to the client (e.g., `{ status: 'error', message: 'Internal Server Error' }`) to avoid leaking sensitive details. Optionally, define custom error classes (e.g., `AppError`, `NotFoundError` in `src/errors/`) extending `Error` to allow specific status codes and operational error flagging (`err.isOperational`).
*   **Benefit:** Prevents application crashes on unhandled errors, provides consistent error responses, ensures all critical errors are logged centrally.

---

### Ask Veteran/Responder Status (Phase 2)

*   **Goal:** Capture whether a registering user is a veteran or first responder.
*   **Implementation:**
    1.  **DB Schema:** Add a boolean field (e.g., `is_veteran_or_responder`) to the `User` model in `prisma/schema.prisma`. Run `npx prisma migrate dev`.
    2.  **Form:** Modify `public/registration-form.html` to include a checkbox or dropdown menu asking this question.
    3.  **Handler:** Update the form submission handler (conceptual, implemented in Phase 5) to read this new field from the submitted data and save it to the corresponding user record during the `prisma.users.create` or `upsert` call.
*   **Benefit:** Allows for potential future targeted programs, discounts (like the Vet Referral), or analytics.

---

### Basic Intelligent Scheduling Suggestions (Phase 3)

*   **Goal:** Make the AI's slot suggestions slightly more relevant than just random available times.
*   **Implementation:** When the booking agent (built in Phase 3) suggests slots, enhance its logic/prompt:
    1.  Give it access to a tool function retrieving basic client history (e.g., last session date/type via `tools/stateManager.js`) or preferences (`users` table field, set via `/profile`).
    2.  Instruct the agent (via prompt) to *consider* this context when selecting from available slots returned by `findFreeSlots` (stub in Phase 3). Examples: "Suggest slots around the same time of day," or "Prioritize morning slots if preferred."
*   **Benefit:** Improves client experience by offering potentially more convenient times without complex dynamic scheduling yet.

---

### LangSmith Integration (Phase 3)

*   **Goal:** Enable detailed tracing and debugging of LangChain agent/graph executions.
*   **Implementation:** Sign up for LangSmith ([https://smith.langchain.com/](https://smith.langchain.com/)). Obtain an API key. Set environment variables: `LANGCHAIN_TRACING_V2=true` and `LANGCHAIN_API_KEY=<your_api_key>` in `.env`. LangChain automatically sends traces.
*   **Benefit:** Provides invaluable visibility into LLM calls, prompt chains, tool usage, and agent decision-making.

---

### Conversation Memory Implementation (Phase 3)

*   **Goal:** Provide the AI agent with memory of the current conversation for multi-turn interactions.
*   **Implementation:** Choose a LangChain memory strategy (e.g., `BufferMemory`, `ConversationSummaryBufferMemory`). Implement in `src/memory/` or where the agent is initialized. Decide on persistence (temporary, graph state, DB field). Configure the agent/graph to use the memory object.
*   **Benefit:** Enables coherent dialogue, prevents repetitive questions, helps manage LLM token limits.

---

### Core Update Router (Phase 5)

*   **Goal:** Create the central logic hub for processing incoming Telegram updates based on user status and update type.
*   **Implementation:** Implement middleware (e.g., `src/middleware/updateRouter.js`, registered in `app.js` after user lookup). Logic:
    1.  `if (ctx.state.isNewUser)`: Trigger registration flow (e.g., call `telegramNotifier.sendRegistrationLink(ctx)`). Stop processing.
    2.  `else (existing user)`:
        *   `if (isCommand(ctx))`: Pass to Role-Based Command Router (Phase 6).
        *   `else if (isCallbackQuery(ctx))`: Handle callbacks (route to handlers or LangGraph).
        *   `else if (isTextMessage(ctx))`: Route to conversational AI (agent/graph - Phase 3/4).
        *   `else`: Handle other types or ignore.
*   **Benefit:** Organizes the entry point for all user interactions, directing them appropriately.

---

### Server Merge (Phase 5)

*   **Goal:** Consolidate all web server functionality into `src/app.js`, eliminating legacy `server.js`.
*   **Implementation:**
    1.  Identify routes/static logic in `legacy/server.js`.
    2.  Re-implement routes using `express.Router()` in `src/routes/` (e.g., `forms.js`, `api.js`), mounted in `src/app.js`.
    3.  Implement static file serving (`express.static('public')`) in `src/app.js`.
    4.  Update HTML forms (`fetch` calls) to point to the main app's endpoints.
    5.  Ensure route handlers use singleton `prisma` and `bot` from `src/core/`.
    6.  Delete `legacy/server.js` and related legacy code/dependencies.
*   **Benefit:** Achieves **P-1 (Single Source of Truth)**, simplifies deployment, eliminates inter-server calls.

---

### Designate Admin (Phase 6)

*   **Goal:** Establish a mechanism to grant administrative privileges.
*   **Implementation:**
    1.  **Method 1 (Script):** Create `bin/set_admin.js`. Takes Telegram ID, uses `prisma.users.update` to set `role: 'admin'`.
    2.  **Method 2 (Manual DB):** Directly update the `role` column in the `users` table.
    3.  **(Future) Method 3 (Admin Command):** `/add_admin <userId>` command performs the update.
*   **Benefit:** Allows activating admin-only features.

---

### Role-Based Command Routing (Phase 6)

*   **Goal:** Ensure only authorized users can execute specific commands based on role.
*   **Implementation:** Enhance `updateRouter.js` or create `middleware/commandRouter.js`. Logic:
    1.  Detect command (e.g., starts with '/'). Extract command name.
    2.  Check `ctx.state.user.role`.
    3.  Look up command in `commandRegistry[role][commandName]`.
    4.  If handler exists, execute `handler(ctx)`.
    5.  If not found, reply "Unknown command." or similar.
    6.  **Set Command Scope:** After role assignment (registration completion/admin designation), call `telegramNotifier.setRoleSpecificCommands(userId, role)`. This tool uses `bot.telegram.setMyCommands` with a chat-specific scope and the command list from the registry for that role.
*   **Benefit:** Enforces command access control, provides tailored command list visibility in Telegram.

---

### DB-Based Session Types (Phase 6)

*   **Goal:** Manage session offerings dynamically via the database.
*   **Implementation:**
    1.  **Schema:** Define `SessionType` model in `prisma/schema.prisma` (fields: `id`, `label`, `duration`, `description`, `active`, etc.). Run `prisma migrate dev`.
    2.  **Migration:** Populate `SessionType` table from `sessionTypes.json` data (script/manual).
    3.  **Helper Update:** Modify `src/core/sessionTypes.js` to use Prisma (`findMany`, `findUnique`, `create`, `delete`, `update`) instead of `fs`. Filter by `active` flag in `getAll`.
    4.  **Admin Commands:** Implement `/session_add`, `/session_del` handlers using the updated helper functions.
    5.  **(Cleanup)** Delete `src/config/sessionTypes.json`. Update dependent code.
*   **Benefit:** Dynamic, robust management of session offerings via admin commands.

---

### Client/Session List Commands (Phase 6)

*   **Goal:** Provide basic admin commands to view client and session data.
*   **Implementation:** Create handlers for `/clients` and `/sessions` in `src/commands/`. Use `prisma` (`findMany`) to query data. Format results and reply via `ctx.reply()` or `tools/telegramNotifier.js`. Protect commands using role-based routing middleware.
*   **Benefit:** Basic data visibility for admins within Telegram.

---

### Admin Availability Management (Phase 7)

*   **Goal:** Allow admins to manually block time slots in the Google Calendar.
*   **Implementation:** Create handlers for `/block_time`, `/unblock_time` commands. Parse date/time arguments. Call functions in `tools/googleCalendar.js` (now live) like `createBlockingEvent(start, end, reason)` or `deleteBlockingEvent(start, end)`. Update `findFreeSlots` tool to query and respect these blocking events.
*   **Benefit:** Practitioner can manage schedule exceptions via Telegram.

---

### Admin Mini-App v1 (Phase 8)

*   **Goal:** Create a basic web dashboard for admins within Telegram.
*   **Implementation:**
    1.  **Routing:** Create Express router (`src/routes/adminDashboard.js`) for serving static files and API endpoints (e.g., `/api/admin/clients`, `/api/admin/sessions`, `/api/admin/sessions/:id/notes`).
    2.  **Authentication:** Protect routes/API via middleware (`middleware/authHandler.js`) checking for admin role via `Telegram.WebApp` data.
    3.  **Backend API:** Implement handlers using `prisma` (fetch data, save notes) and potentially `googleCalendar.js` (fetch events). Implement client lookup.
    4.  **Frontend:** Build UI (`public/admin/` or `src/views/`) using HTML/CSS/JS. Authenticate using `WebApp` data. Use `fetch` to interact with backend API.
*   **Benefit:** Richer interface for admin data viewing and interaction (session notes).

---

### AI Analysis & Prep (Phase 9)

*   **Goal:** Add AI-driven insights and proactive assistance.
*   **Implementation:**
    *   *FAQ/Doc-QA:* Set up vector store. Create RAG tool (`tools/docQa.js`). Wire to `/ask` command or agent.
    *   *Contra-indication/Anomaly Check:* Enhance `tools/waiverAnalyzer.js`. Trigger after waiver submission. Use LLM to review full form data for subtle issues. Tool notifies admin via `telegramNotifier.js`.
    *   *Admin Trend Analysis:* Implement `/analyze` command. Triggers agent/graph using `tools/analysisReporter.js`. Tool translates NL query to Prisma aggregate query, executes, formats results.
    *   *Pre-Session Prep Guidance:* Create `tools/prepAdvisor.js`. Create scheduled job (`automations/reminder.js`). Job finds upcoming sessions, calls `prepAdvisor.js` for personalized advice (based on session type/client data), includes advice in reminder sent via `telegramNotifier.js`.
*   **Benefit:** Leverages AI for safety checks, admin insights, and personalized client guidance.

---

### Client Features v1 (Phase 10)

*   **Goal:** Add basic self-service features for clients.
*   **Implementation:**
    *   *Profile Command:* Implement `/profile` handler. Uses `stateManager.js` to fetch/display info. May offer button to web-app editor (served via `routes/clientApi.js`).
    *   *Contact Admin:* Implement `/contact_admin` handler. Retrieves practitioner contact info (env/config) and displays, possibly using `tg://user?id=` link.
    *   *Referral Program:* Add `referralCode`, `referredById` to `User` schema. Implement `/referral` handler using `tools/referralManager.js` (generate/retrieve code). Update registration (Phase 5) to accept code, validate, store referrer ID. Add logic for applying referral benefits (Vet focus).
*   **Benefit:** Empowers clients, encourages engagement/growth.

---

### Admin Features v2 (Phase 11)

*   **Goal:** Add advanced administrative tools for communication and offerings.
*   **Implementation:**
    *   *Broadcast:* Implement `/broadcast` handler. Fetches client IDs (Prisma). Iterates and sends message via `telegramNotifier.js` **with delays** to avoid rate limits. Consider client opt-out.
    *   *Packages/Vouchers:* Define `Package`, `Voucher` Prisma models. Create admin CRUD commands using `tools/packageVoucherMgr.js`. Update booking flow (Agent/Graph) to handle selection/redemption. Optional: Integrate payment processor.
*   **Benefit:** Enables mass communication and flexible management of pricing/offerings.

---

### AI Dynamic Scheduling (Phase 12+)

*   **Goal:** Allow NL admin availability control and optimized scheduling.
*   **Implementation:** (Significant effort)
    1.  Implement `/set_schedule` command/agent/graph.
    2.  Create `tools/availabilityManager.js` using NLP/LLM to parse NL commands into structured rules (stored in DB).
    3.  Heavily refactor `googleCalendar.js` `findFreeSlots` to use GCal events + DB rules + buffers + session duration to calculate availability.
    4.  Update booking agent/graph to use enhanced `findFreeSlots` and potentially optimize suggestions.
*   **Benefit:** Ultimate scheduling flexibility for practitioner via NL interface.

# 12 Potential Future Explorations (Beyond Phase 14)
AI Post-Session Integration Support: Offer clients an opt-in program via the bot for integration guidance post-session. Use LangGraph to manage daily journal prompts, retrieve relevant resources (RAG), and potentially offer AI-generated reflections based on journal entries. Requires careful design around privacy, scope, and avoiding therapeutic claims. (Formerly Phase 12)
Client "Kambo Journey" Visualization: Enhance the client-facing web app (requires Phase 10 profile/mini-app foundation) to display a timeline or dashboard of their session history. Could potentially include AI-summarized themes from journal entries (with consent) or intentions set. (Formerly Phase 13)
Advanced Personalization: Deeper analysis of client journey data to tailor suggestions, resources, or check-ins even further.
External Health Platform Integration: Allow clients (with explicit consent) to connect data from wearables or health apps for richer context (requires significant security/privacy work).
Multi-Practitioner Support: Adapt the system to handle multiple practitioners with separate schedules and client lists.
Automated A/B Testing: Experiment with different reminder messages, booking flow prompts, etc., and track conversion/effectiveness.
Sentiment Analysis: Analyze journal entries or feedback to gauge client well-being and potentially tailor integration support or flag concerns for the practitioner.
Community Features: Opt-in group chats, shared resource libraries within Telegram or the web app.

# Last updated : 2025-04-24 v5