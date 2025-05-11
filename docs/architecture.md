# Architecture Overview

Revised 2025-05-09 v9

## Folder Layout (as of 2025-05-09)

```
.
├── .env
├── .eslintignore
├── .eslintrc.json
├── .gitignore
├── .husky/             # Git hooks managed by Husky
├── .mocharc.js
├── .nycrc
├── .prettierrc.json
├── .windsurfrules
├── PLANNING.md
├── README.md
├── TASK.md
├── TaskContent&DefinitionsLog.md
├── bin/
│   └── server.js       # Starts the Express server & Telegraf bot
├── docs/
│   └── architecture.md # This file
├── eslint.config.js
├── package-lock.json
├── package.json
├── prisma/
│   └── schema.prisma   # Database schema
│   └── migrations/     # Database migration files
├── public/             # Static assets for webhooks/UI (if any)
├── set_all_commands.js # Script to register bot commands with Telegram
├── src/
│   ├── agents/
│   │   └── bookingAgent.js
│   ├── app.js            # Main application setup
│   ├── commands/
│   │   ├── registry.js
│   │   └── (other command files ...)
│   ├── config/
│   │   ├── agentPrompts.js
│   │   └── sessionTypes.js
│   ├── core/
│   │   ├── bot.js
│   │   ├── env.js
│   │   ├── logger.js
│   │   ├── prisma.js
│   │   └── sessionTypes.js # (Likely deprecated by config/sessionTypes.js)
│   ├── errors/
│   │   └── (custom error classes ...)
│   ├── graph/
│   │   ├── bookingGraph.js
│   │   ├── edges.js
│   │   ├── nodes.js
│   │   └── state.js
│   ├── handlers/         # Telegraf command/event handlers
│   │   └── (handler files ...)
│   ├── memory/
│   │   └── sessionMemory.js
│   ├── middleware/
│   │   ├── attachUser.js
│   │   ├── errorHandler.js
│   │   ├── rateLimiter.js
│   │   ├── session.js
│   │   ├── unknownUpdate.js
│   │   └── updateRouter.js
│   ├── routes/           # Express API routes
│   │   └── (route files ...)
│   ├── tools/
│   │   ├── googleCalendar.js
│   │   ├── stateManager.js
│   │   ├── telegramNotifier.js
│   │   └── toolSchemas.js
├── tests/
│   ├── agents/
│   │   └── bookingAgent.test.js
│   ├── app.test.js
│   ├── bin/
│   │   └── server.test.js
│   ├── commands/
│   │   └── registry.test.js
│   ├── core/
│   │   └── (core module tests ...)
│   ├── graph/
│   │   ├── bookingGraph.test.js
│   │   ├── edges.test.js
│   │   ├── nodes.test.js
│   │   └── state.test.js
│   ├── health.test.js
│   ├── helpers/
│   │   └── (test helper files ...)
│   ├── memory/
│   │   └── sessionMemory.test.js
│   ├── middleware/
│   │   └── (middleware tests ...)
│   ├── mocks/
│   │   └── (mock files ...)
│   ├── placeholder.test.js
│   ├── routes/
│   │   └── (route tests ...)
│   ├── setup.js          # Global test setup (e.g., Sinon sandbox)
│   └── tools/
│       └── (tool tests ...)
```

## 6. Key Modules & Workflows

### Booking Conversation Graph (`src/graph/bookingGraph.js`)

The primary user interaction for booking sessions is managed by a stateful graph implemented using LangGraph.

- **Purpose:** Orchestrates the back-and-forth conversation between the user and the AI booking agent.
- **State (`state.js`):** Tracks key information like user input, agent decisions (`agentOutcome`), fetched availability (`availableSlots`), confirmed slot details (`confirmedSlot`), session context (`telegramId`, `sessionId`), potential errors, etc.
- **Nodes (`nodes.js`):** Represent actions within the flow, including:
  - `agentNode`: Invokes the main LangChain agent (from `src/agents/`) to process user input and decide the next step.
  - Tool Nodes: Dedicated nodes call specific functions from `src/tools/` (e.g., `findSlotsNode`, `storeBookingNode`, `createCalendarEventNode`, `sendWaiverNode`, `resetStateNode`, `deleteCalendarEventNode`).
  - `handleErrorNode`: Logs errors that occur during graph execution.
- **Edges (`edges.js`):** Conditional functions route the flow based on the current state. For instance, after `agentNode`, an edge function inspects `state.agentOutcome` to determine whether to call a tool node or end the turn. After `findSlotsNode`, an edge routes back to the `agentNode` to present results or handle errors.
- **Assembly (`bookingGraph.js`):** Defines the graph structure using `StateGraph`, registers nodes, connects them with conditional edges, sets the entry point (`agentNode`), and compiles the final runnable graph instance.

## Project Status

- **Phase 1: Skeleton & Tests** - ✅ Completed (Date: 2025-04-24)
  - Established core folder structure (`src/`).
  - Implemented singletons for Env, Prisma, Bot, and Express App.
  - Set up testing (Mocha, Chai, Sinon, Supertest, NYC) and linting/formatting (ESLint, Prettier).
  - Achieved >90% test coverage on core modules.
  - Configured Husky pre-commit hooks.
  - Scaffolded command registry and session type configuration.
- **Phase 2: LangChain Tools & Core Enhancements** - ✅ Completed (Date: 2025-04-25)
  - Implemented structured logging (Pino) and centralized error handling.
  - Created core tool modules (`stateManager`, `telegramNotifier`) with DI.
  - Created Google Calendar tool stubs (`findFreeSlots`, `createCalendarEvent`).
  - Defined standard tool input schemas using Zod (`toolSchemas.js`).
  - Added Veteran/Responder status field to DB schema and registration form.
  - Achieved >90% test coverage on new Phase 2 modules.
- **Phase 3: Agent & Memory (Multi-Provider Capable)** - ✅ Completed (Date: 2025-04-28)
  - Enabled LangSmith tracing. Implemented session-based in-memory BufferMemory.
  - Added tools for fetching user profile/history (`stateManager`).
  - Defined agent system prompt (`agentPrompts.js`).
  - Refactored agent (`agents/bookingAgent.js`) for multi-provider support (OpenAI/Gemini) using `createToolCallingAgent`.
  - Ensured tool descriptions/schemas compatible with standard tool-calling.
  - Implemented basic agent tests and achieved ≥ 90% coverage for Phase 3 modules.
- **Phase 4: LangGraph Flow** - ✅ Completed (Date: 2025-04-30)
  - Defined the state schema for the booking graph (`graph/state.js`).
  - Implemented core graph nodes for agent/tool calls (`graph/nodes.js`).
  - Implemented conditional edge functions for routing (`graph/edges.js`).
  - Assembled and compiled the booking graph using LangGraph (`graph/bookingGraph.js`).
  - Implemented graph execution tests covering key flows (`tests/graph/bookingGraph.test.js`).
  - Achieved >90% test coverage for Phase 4 modules.
- **Phase 5: Core Routing & Server Merge** - Completed (Date: 2025-05-09)
- **Phase 6: Pending**

**AI:** LangChain JS + LangGraph. LLM selected via `AI_PROVIDER` env var ('openai' for GPT-4 Turbo, 'gemini' for Gemini 1.5 Flash). Agent via `createToolCallingAgent`.

| **4 LangGraph Flow** | Model booking conversation as nodes/edges (**Hybrid Approach**: Potentially use LangGraph Studio for initial design, then integrate/refine code in `src/graph/`) | ✔ node tests, graph execution tests for booking |
