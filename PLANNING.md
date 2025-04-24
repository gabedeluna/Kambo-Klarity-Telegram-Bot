# PLANNING.md

> **Prompt to AI (internal):** *“Use the structure and decisions outlined in `PLANNING.md`.”*   Every new conversation must load this file before proposing code.

---

## 1  Purpose & Vision
Build a **scalable, test‑first Telegram assistant** for **Kambo Klarity** that:

1. Converses naturally with clients using LangChain + LangGraph.
2. Finds free slots & books events in Google Calendar.
3. Collects registration / waiver forms through a Telegram web‑app flow.
4. Notifies admins and lets them manage sessions, clients, and **session‑type offerings** – all inside Telegram.
5. Provides future AI analysis (contra‑indication checks, FAQ from docs) without re‑architecting.

The system must automate as much as possible while still giving admins point‑and‑click control.

---

## 2  Guiding Principles
| ID | Principle | Why it matters |
|----|-----------|----------------|
| P‑1 | Single Source of Truth – one Prisma client & one Express server | prevents duplicated state / ports |
| P‑2 | Files ≤ 500 lines | keeps review manageable; forces modularity |
| P‑3 | Test Early, Test Often | every function/class has Mocha unit tests |
| P‑4 | LangChain‑first orchestration | agent logic expressed declaratively in LangGraph |
| P‑5 | Consult Context7 MCP before new deps | ensures best‑practice integrations |
| P‑6 | Admin can configure data from Telegram | no external dashboard required |

---

## 3  Tech Stack
* **Runtime:** Node 18+, ES2020 (CommonJS)
* **Bot:** Telegraf (Telegram)
* **Web:** Express 4 – serves mini‑apps and API routes
* **DB:** PostgreSQL via Prisma singleton `core/prisma.js`
* **AI:** LangChain JS + LangGraph, default LLM = OpenAI GPT‑4
* **Testing:** Mocha + Chai + Sinon + Supertest + NYC (≥ 90 % coverage)
* **Lint/Format:** ESLint (`recommended`) + Prettier, husky pre‑commit

---

## 4  Folder Layout (target)
```
src/
 ├─ core/       # env, prisma, bot singletons
 ├─ tools/      # LangChain tools (DB, Calendar, Telegram)
 ├─ graph/      # LangGraph node/edge definitions
 ├─ commands/   # registry + individual Telegraf command handlers
 ├─ routes/     # Express routers (forms, admin mini‑app)
 ├─ config/     # sessionTypes.json, etc.
 ├─ app.js      # Express + Telegraf wiring
 └─ tests/      # mirrors structure
bin/server.js
```

---

## 5  Phased Roadmap
| Phase | Deliverable | Key Milestones |
|-------|-------------|----------------|
| **1 Skeleton & Tests** | singletons, Express+Telegraf bootstrap, base CI | ✔ health + DB tests |
| **2 LangChain Tools** | wrap `resetState`, `sendWaiverLink`, `storeSlot`, **Google Calendar tool stubs** | ✔ contract tests |
| **3 Functions Agent** | replace JSON‑parsing agent with OpenAI Functions agent calling tools | ✔ old booking tests pass |
| **4 LangGraph Flow** | model booking conversation as nodes/edges | ✔ node tests |
| **5 Server Merge** | move form server routes into main app, remove duplicate Prisma | ✔ integration tests |
| **6 Admin Features v1** | command registry + `/admin` menu, list sessions/clients, **dynamic session‑type management** (add/remove) | ✔ commands mutate `config/sessionTypes.json`; unit‑tests |
| **7 Google Calendar Live Hook** | replace stub with real API; integration tests with test calendar | ✔ booking creates calendar event |
| **8 Mini Dashboard Web‑App** | Telegram web‑app showing clients & sessions, inline buttons open waiver | ✔ role‑based auth |
| **9 AI Analysis Add‑ons** | ingest Kambo docs → vector store; contra‑indication & FAQ tools | ✔ RAG accuracy tests |

*Phases 6‑9 can be reprioritised, but Phase 6 **must** include admin‑side commands for session‑type CRUD so future features rely on config based session‑types.*

---

## 6  Key Modules & Responsibilities
| Module | Responsibility |
|--------|----------------|
| **core/env.js** | load + validate `.env` vars |
| **core/prisma.js** | singleton Prisma client |
| **core/bot.js** | Telegraf instance |
| **tools/googleCalendar.js** | `findFreeSlot`, `createEvent` (stub until Phase 7) |
| **tools/telegram.js** | send/edit/track Telegram messages |
| **config/sessionTypes.json** | list of session offerings (editable by admin) |
| **commands/registry.js** | maps command → handler by role |
| **graph/bookingGraph.js** | nodes: chooseType ▶ suggestSlot ▶ confirmSlot ▶ sendWaiver |

---

## 7  Bot Commands & Configurable Entities
### 7.1 Command Registry Pattern
```js
module.exports = {
  client: {
    help:   { descr: 'Show help',       handler: handleHelp },
    book:   { descr: 'Start booking',   handler: startBooking },
    cancel: { descr: 'Cancel booking',  handler: cancelBooking }
  },
  admin: {
    sessions:    { descr: 'List sessions', handler: listSessions },
    clients:     { descr: 'List clients',  handler: listClients  },
    session_add: { descr: 'Add session‑type', handler: addSessionType },
    session_del: { descr: 'Remove session‑type', handler: removeSessionType }
  }
};
```
Middleware routes `/command` to the correct handler based on Telegram user role.

### 7.2 Session‑Type Config
*JSON file at* `config/sessionTypes.json`:
```json
[
  { "id": "1hr-kambo", "label": "1 hr Kambo",  "duration": 60 },
  { "id": "3hr-kambo", "label": "3×3 Kambo",  "duration": 180 }
]
```
*Helper* `core/sessionTypes.js` with `getAll()`, `add()`, `remove()` reading & writing the JSON (file‑lock to avoid race conditions). Phase 6 command handlers call these helpers.

### 7.3 Tests
* Registry tests: every command has `descr` + `handler` + handler is function.
* Session‑type tests: JSON validates against schema, no duplicate IDs, CRUD works.

---

## 8  External Integrations
| Service | Purpose | Notes |
|---------|---------|-------|
| Google Calendar | availability + event creation | Phase 2 stubs → Phase 7 live via service‑account |
| Context7 MCP | knowledge‑base for best‑practice | must query before new deps |
| Telegram | chat & web‑app | Telegraf handles webhook |

---

## 9  Testing & CI
* **Unit:** Mocha for functions + command handlers
* **Integration:** Supertest spins up `app` on random port
* **Coverage:** NYC gate ≥ 90 %
* **Lint/Format:** ESLint + Prettier, enforced in husky pre‑commit

---

## 10  Constraints & Conventions
* CommonJS, no TypeScript
* JSDoc for every exported symbol
* No file > 500 lines – split into helpers when near 450
* Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`…)

---

## 11  Future AI Features
Phase 9 and beyond leverages the same LangChain tool/graph pattern so that *new reasoning blocks* can be dropped in with minimal risk:

| Idea | Brief | Tool / Node sketch |
|------|-------|-------------------|
| **Contra‑indication checker** | Parse waiver answers, cross‑check with Kambo medical docs, raise yellow/red flags for admin. | `tools/contraChecker.js` → LangGraph side‑branch that runs after waiver submission and posts a summary to the admin. |
| **FAQ / Doc‑QA** | Clients can ask "What is rapé?" etc. Bot answers from curated docs. | Vector store (HNSW in Pinecone or local) + LC `retrievalQA` node reachable via `/ask`. |
| **Auto‑reminders** | 48 h / 12 h before session, DM client with prep info. | `automations/reminder.js` cron job reading sessions table. |
| **Admin daily digest** | Each morning send practitioner a list of today’s sessions with status. | Graph node triggered by cron. |
| **Analytics export** | CSV of sessions per month, average time‑to‑book, etc. | Express route `/admin/export` protected by admin role. |

_All new features must respect principles P‑1 … P‑6 and include unit + integration tests._

---

### Last updated : 2025‑04‑24



