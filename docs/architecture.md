# Architecture Overview

## Folder Layout (End of Phase 2)

```
.
├── .husky/             # Git hooks managed by Husky
├── bin/                # Executable scripts
│   └── server.js       # Starts the Express server
├── docs/               # Project documentation
│   └── architecture.md # This file
├── legacy/             # Original codebase (for reference)
│   └── ...
├── node_modules/       # Project dependencies
├── src/                # Source code for the application
│   ├── app.js          # Express app configuration + Telegraf webhook
│   ├── commands/       # Telegraf command handlers & registry
│   │   └── registry.js
│   ├── config/         # Configuration files
│   │   └── sessionTypes.json # (Will be replaced by DB in Phase 6)
│   ├── core/           # Core singletons
│   │   ├── bot.js
│   │   ├── env.js
│   │   ├── logger.js     # NEW (PH2)
│   │   ├── prisma.js
│   │   └── sessionTypes.js
│   ├── errors/         # NEW (PH2) Custom error classes
│   │   ├── AppError.js
│   │   └── NotFoundError.js
│   ├── middleware/     # NEW (PH2) Custom Express middleware
│   │   └── errorHandler.js
│   ├── tools/          # NEW (PH2) LangChain tools
│   │   ├── googleCalendar.js # (Stubs)
│   │   ├── stateManager.js
│   │   ├── telegramNotifier.js
│   │   └── toolSchemas.js
│   └── tests/          # Unit & Integration tests
│       ├── commands/
│       │   └── registry.test.js
│       ├── core/
│       │   ├── bot.test.js
│       │   ├── env.test.js
│       │   ├── logger.test.js    # NEW (PH2)
│       │   ├── prisma.test.js
│       │   └── sessionTypes.test.js
│       ├── errors/           # NEW (PH2)
│       │   └── ... (error tests if any) # Placeholder for potential error tests
│       ├── middleware/       # NEW (PH2)
│       │   └── errorHandler.test.js
│       ├── tools/            # NEW (PH2)
│       │   ├── googleCalendar.test.js
│       │   ├── stateManager.test.js
│       │   ├── telegramNotifier.test.js
│       │   └── toolSchemas.test.js
│       ├── app.test.js
│       ├── health.test.js
│       └── placeholder.test.js # If still present
├── .env                # Environment variables (ignored by Git)
├── .gitignore          # Files ignored by Git
├── eslint.config.js    # ESLint configuration
├── package-lock.json   # Dependency lock file
├── package.json        # Project manifest & dependencies
├── PLANNING.md         # Project planning document
└── TASK.md             # Sprint task checklist
```

## Project Status

*   **Phase 1: Skeleton & Tests** - ✅ Completed (Date: 2025-04-24)
    *   Established core folder structure (`src/`).
    *   Implemented singletons for Env, Prisma, Bot, and Express App.
    *   Set up testing (Mocha, Chai, Sinon, Supertest, NYC) and linting/formatting (ESLint, Prettier).
    *   Achieved >90% test coverage on core modules.
    *   Configured Husky pre-commit hooks.
    *   Scaffolded command registry and session type configuration.
**Phase 2: LangChain Tools & Core Enhancements** - ✅ Completed (Date: 2025-04-25)
    *   Implemented structured logging (Pino) and centralized error handling.
    *   Created core tool modules (`stateManager`, `telegramNotifier`) with DI.
    *   Created Google Calendar tool stubs (`findFreeSlots`, `createCalendarEvent`).
    *   Defined standard tool input schemas using Zod (`toolSchemas.js`).
    *   Added Veteran/Responder status field to DB schema and registration form.
    *   Achieved >90% test coverage on new Phase 2 modules.
*   **Phase 3: Agent & Memory** - Pending

