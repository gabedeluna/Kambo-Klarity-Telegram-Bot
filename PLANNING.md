# PLANNING.md (Revised 2025-04-24 v2)

> **Prompt to AI (internal):** _“Use the structure and decisions outlined in `PLANNING.md`.”_ Every new conversation must load this file before proposing code.

---

## 1 Purpose & Vision

Build a **scalable, test-first, observable, feature-rich Telegram assistant** for **Kambo Klarity** that:

1.  Converses naturally with clients using LangChain + LangGraph (**including intelligent scheduling suggestions**).
2.  Finds free slots & books events in Google Calendar (**with flexible admin availability controls**).
3.  Collects registration (**including veteran/responder status**) / waiver forms via Telegram web-app.
4.  Notifies admins and lets them manage sessions, clients, offerings, **availability, packages, vouchers, referrals, and broadcasts** – all inside Telegram (commands + **mini-app**).
5.  Provides AI analysis (**contra-indication/anomaly checks**, FAQ, **trends**, **prep guidance**, **post-session support**).
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
├─ graph/ # LangGraph node/edge definitions (booking, analysis, support flows)
├─ commands/ # registry + individual Telegraf command handlers (client & admin)
├─ routes/ # Express routers (forms, admin mini-app, APIs)
├─ config/ # Static config (e.g., initial roles, prompt templates)
├─ errors/ # Custom error class definitions
├─ middleware/ # Custom Express middleware (auth, error handling)
├─ memory/ # LangChain memory management components
├─ automations/ # Scheduled jobs (reminders, analysis triggers, session end detection)
├─ views/ # (Optional) Templates for web-apps if not using static HTML/JS entirely
├─ app.js # Express + Telegraf wiring + global middleware
└─ tests/ # mirrors structure
bin/server.js
---

## 5 Phased Roadmap (**Revised & Expanded**)

| Phase                      | Deliverable                                                                                       | Key Milestones                                                                                                      |
| :------------------------- | :------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------ |
| **1 Skeleton & Tests**     | singletons, Express+Telegraf bootstrap, base CI                                                   | ✔ health + DB tests, base coverage, core structure                                                                  |
| **2 LangChain Tools**      | logging, error handling, state/telegram tools, GCal stubs, tool defs, **ask veteran/responder status** | ✔ logger/error middleware, tool unit tests, schema standard, **registration form updated**                              |
| **3 Agent & Memory**       | OpenAI Functions agent calling tools, LangSmith setup, memory impl., **basic intelligent suggestions** | ✔ booking via agent, traces visible, memory strategy tested, **agent suggests slots based on history/preference** |
| **4 LangGraph Flow**       | Model booking conversation as nodes/edges                                                         | ✔ node tests, graph execution tests for booking                                                                     |
| **5 Server Merge**         | Move form server routes into main app                                                             | ✔ integration tests for forms/APIs in main app                                                                    |
| **6 Admin Foundational**   | DB-based session types, `/admin` menu, **client/session list commands**, role middleware          | ✔ admin commands mutate `SessionTypes` DB, `/sessions`, `/clients` work                                             |
| **7 Google Calendar Live** | Replace GCal tool stubs with real API, **add Admin Availability Management (commands)**           | ✔ booking creates GCal event, **`/block_time`, `/unblock_time` commands modify GCal/availability**                |
| **8 Admin Mini-App v1**    | TG web-app: view clients, sessions, calendar view (**basic**), add session notes, **client lookup**     | ✔ role-based auth, basic dashboard loads data, **notes saved to session record**, search works                    |
| **9 AI Analysis & Prep**   | FAQ/Doc-QA, Contra-indication/Anomaly check, **Admin Trend Analysis**, **Pre-Session Prep Guidance** | ✔ RAG test, waiver analysis flags, `/analyze` command works, **reminders include personalized prep**                |
| **10 Client Features v1**  | **/profile command**, **/contact_admin command**, **Basic Referral Program (Vet Focus)**            | ✔ clients can view/update profile, get admin contact, referral codes generated/tracked, **vet referral noted**      |
| **11 Admin Features v2**   | **Broadcast command**, **Package/Bundle Management**, **Gift Voucher Management**                 | ✔ `/broadcast` sends to clients, admin commands for packages/vouchers, booking reflects discounts/redemption        |
| **12 Post-Session Support**| **AI Integration Support Program (Opt-in)**, journal prompts, resource links                      | ✔ `/integration_start` command, automated prompts, AI interaction flow via graph                                    |
| **13 Journey Visualization**| **Client Web-App "Kambo Journey" Dashboard**                                                      | ✔ Client web-app displays session timeline, AI-summarized themes (optional)                                         |
| **14+ AI Dynamic Scheduling** | **NL Admin Availability Control**, advanced scheduling logic                                      | ✔ Admin can set complex schedules via chat, AI optimizes slot suggestions                                           |

---

## 6 Key Modules & Responsibilities (**Revised**)

| Module                         | Responsibility                                                                                      |
| :----------------------------- | :-------------------------------------------------------------------------------------------------- |
| **core/env.js**                | load + validate `.env` vars                                                                         |
| **core/prisma.js**             | singleton Prisma client                                                                             |
| **core/bot.js**                | Telegraf instance                                                                                   |
| **core/logger.js**             | **singleton structured logger instance (e.g., Pino)**                                               |
| **core/sessionTypes.js**       | helper for session types CRUD from DB (Phase 6+)                                                    |
| **tools/stateManager.js**      | LangChain tools for managing persistent user state/profile in DB                                      |
| **tools/telegramNotifier.js**  | LangChain tools for sending messages/forms/broadcasts via Telegraf                                    |
| **tools/googleCalendar.js**    | LangChain tools for GCal interaction (stubs Phase 2, live Phase 7), **incl. availability blocking** |
| **tools/analysisReporter.js**  | **LangChain tools for querying DB/generating reports for admin (Phase 9+)**                         |
| **tools/waiverAnalyzer.js**    | **LangChain tools for contra-indication/anomaly checks (Phase 9+)**                                 |
| **tools/prepAdvisor.js**       | **LangChain tools for generating personalized prep guidance (Phase 9+)**                              |
| **tools/integrationHelper.js** | **LangChain tools for post-session support flow (Phase 12+)**                                       |
| **tools/availabilityManager.js** | **(Future Phase 14+) Tools for parsing NL schedule commands & managing complex availability rules** |
| **tools/packageVoucherMgr.js** | **Tools for managing packages/vouchers in DB (Phase 11+)**                                           |
| **tools/referralManager.js**   | **Tools for managing referral codes/tracking (Phase 10+)**                                          |
| **commands/registry.js**       | maps command → handler by role (**incl. new client/admin commands**)                                |
| **graph/\***                   | LangGraph definitions (**booking, analysis, integration flows**)                                     |
| **routes/adminDashboard.js**   | **Express router/handlers for the Admin Mini-App API (Phase 8+)**                                   |
| **routes/clientApi.js**        | **Express router/handlers for client profile/journey APIs (Phase 10/13+)**                            |
| **automations/\***             | **Scheduled jobs (reminders, analysis, session end detection)**                                     |
| **app.js**                     | Express app setup, core middleware (**incl. error handling**), webhook routing                      |
| **memory/\***                  | **LangChain conversation memory components/configuration**                                        |
| **middleware/errorHandler.js** | **Global Express error handler**                                                                    |
| **middleware/authHandler.js**  | **Middleware to check user roles for commands/routes (Phase 6+)**                                   |
| **config/\***                  | **Static config, prompt templates, etc.**                                                           |
| **errors/\***                  | **Custom error class definitions (optional)**                                                       |

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
Structured Logging (Phase 2): Implement Pino/Winston for filterable JSON logs via core/logger.js. Enhances debugging.

Centralized Error Handling (Phase 2): Global Express middleware in app.js (using middleware/errorHandler.js) to catch errors, log them via core/logger, and send standardized responses. Prevents crashes and sensitive data leaks. Define custom error classes in src/errors/ as needed.

Ask Veteran/Responder Status (Phase 2): Modify the registration form (public/registration-form.html) and the submission handling (formWorkflow.js or its replacement route handler) to include a checkbox or dropdown for this status. Update the Prisma users schema to store this boolean flag.

Basic Intelligent Scheduling Suggestions (Phase 3): Enhance the booking agent to query basic client history (last session date/type via tools/stateManager.js) or preferences (new field in users table, potentially asked during onboarding or via /profile) and slightly prioritize or suggest slots accordingly. Still relies on GCal free slots but adds a layer of context.

LangSmith Integration (Phase 3): Configure environment variables to enable tracing LLM calls within LangChain for easier debugging of the agent.

Conversation Memory Implementation (Phase 3): Choose and implement a LangChain memory strategy (e.g., BufferMemory stored in DB, ConversationSummaryBufferMemory) within src/memory/. Ensure the agent uses it.

DB-Based Session Types (Phase 6): Migrate sessionTypes.json data to a Prisma SessionTypes table. Update core/sessionTypes.js helper to use Prisma. Modify admin commands (/session_add, /session_del) to interact with the DB table.

Client/Session List Commands (Phase 6): Implement /sessions and /clients admin commands using Prisma to query and format data, sending it via tools/telegramNotifier.js. Implement role-checking middleware (middleware/authHandler.js) to protect admin commands.

Admin Availability Management (Phase 7): Implement /block_time and /unblock_time commands. These will use tools/googleCalendar.js (now live) to create/delete specific blocking events in the practitioner's Google Calendar, which the findFreeSlots tool will then respect.

Admin Mini-App v1 (Phase 8): Create Express routes (routes/adminDashboard.js) serving an HTML/JS mini-app via Telegram.WebApp. Implement API endpoints for the app to fetch client/session lists, view basic calendar data (read-only initially), look up clients, and submit session notes (saved via Prisma to the sessions table). Requires role-based authentication for the web app routes/API.

AI Analysis & Prep (Phase 9):
FAQ/Doc-QA: Implement RAG using a vector store of Kambo docs accessible via a LangChain tool.
Contra-indication/Anomaly Check: Enhance tools/waiverAnalyzer.js to use an LLM to review waiver form data (liability_form_data) for subtle issues beyond simple checks.
Admin Trend Analysis: Implement /analyze command triggering an agent that uses tools/analysisReporter.js to run Prisma aggregate queries based on NL input.
Pre-Session Prep: Create tools/prepAdvisor.js. Modify the reminder automation (automations/reminder.js) to call this tool, generating personalized advice based on session type/client data, and include it in the reminder message sent via tools/telegramNotifier.js.

Client Features v1 (Phase 10):
Profile Command: /profile triggers handler using tools/stateManager.js to display info and potentially offer edits (could open mini-app).
Contact Admin: /contact_admin handler retrieves practitioner contact info (from env/config) and displays it, possibly using Telegram's user mention feature if the admin's Telegram ID is known.
Referral Program: /referral command generates/displays code via tools/referralManager.js. Update registration to accept code. Add DB fields/tables for tracking. Focus on "Refer-a-Vet" messaging/tracking if desired.

Admin Features v2 (Phase 11):
Broadcast: /broadcast command handler gets list of client IDs from Prisma, iterates, and sends message via tools/telegramNotifier.js. Implement carefully to avoid rate limits.
Packages/Vouchers: Define Prisma schemas. Implement admin commands using tools/packageVoucherMgr.js. Update booking flow/tools to handle selection/redemption. Consider payment gateway integration if selling directly.

Post-Session Support (Phase 12): Implement /integration_start command. Create a LangGraph flow in graph/integrationGraph.js triggered by this or automatically post-session. Use tools/integrationHelper.js to manage prompts, store journal entries (securely in DB), retrieve resources, and potentially use LLM reasoning for reflective "insights". Requires clear opt-in and privacy controls.

Journey Visualization (Phase 13): Enhance the client-facing web app (requires Phase 10 profile command/mini-app first). Add routes/API endpoints (routes/clientApi.js) to fetch session history, journal summaries (if available via tools/journalSummarizer.js), etc. Frontend renders the timeline/dashboard.

AI Dynamic Scheduling (Phase 14+): Implement /set_schedule command. Create tools/availabilityManager.js to parse NL instructions and manage complex availability rules (stored in DB). Heavily modify tools/googleCalendar.js findFreeSlots to use these rules, buffer times, priorities, etc. Requires significant AI reasoning and careful testing.

# 12 Potential Future Explorations (Beyond Phase 14)
Advanced personalization based on deeper analysis of client journey data.
Integration with external health tracking platforms (with consent).
Multi-practitioner support.
Automated A/B testing of different bot messages or flows.
Sentiment analysis on journal entries to tailor integration support.
Community features (opt-in group chats, shared resources).

# Last updated : 2025-04-24 v2