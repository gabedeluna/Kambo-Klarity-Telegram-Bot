# Architecture Overview

## Folder Layout (End of Phase 1)

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
│   │   └── sessionTypes.json
│   ├── core/           # Core singletons
│   │   ├── bot.js
│   │   ├── env.js
│   │   ├── prisma.js
│   │   └── sessionTypes.js
│   └── tests/          # Unit & Integration tests
│       ├── commands/
│       │   └── registry.test.js
│       ├── core/
│       │   ├── bot.test.js
│       │   ├── env.test.js
│       │   ├── prisma.test.js
│       │   └── sessionTypes.test.js
│       ├── app.test.js
│       ├── health.test.js
│       └── placeholder.test.js # Placeholder if still present
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
*   **Phase 2: LangChain Tools** - Pending
