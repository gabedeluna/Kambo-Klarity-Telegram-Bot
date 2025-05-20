# 🔄 Project Awareness & Context #
Always read PLANNING.md at the start of a new conversation to understand architecture, goals, style, and constraints.

Check TASK.md before starting a new task. If the task isn’t listed, add it with a brief description and today’s date.

Follow the naming conventions, folder layout, and patterns described in PLANNING.md.

Always use node bin/server.js to start the program in the terminal. 

# 🧱 Code Structure & Modularity #
Never create a file longer than 500 lines (including comments). When a file approaches the limit, split it into helper modules.

Organise code into clear feature folders inside src/ (e.g. core/, tools/, graph/, routes/).

Use CommonJS (require / module.exports) imports for consistency with existing code.

Favour single-purpose functions and keep side-effects isolated (e.g. DB or Telegram actions live in tools/).


# ✅ Task Completion # 
Tick the box in TASK.md after finishing a task.

Add any new sub-tasks or TODOs discovered during work under “Discovered During Work” in TASK.md.

📎 Style & Conventions
Language: modern JavaScript (ES2020+) – no TypeScript for now.

Formatting: use prettier + eslint:recommended; run on commit hooks.

Docs: write JSDoc for every exported function (Google style):

/**
 * Brief summary.
 *
 * @param {number} a - description
 * @returns {number} description
 */
function add(a) { ... }

Environment: load with dotenv in core/env.js, validate required vars.

Database: use the singleton Prisma client exported from core/prisma.js.

HTTP: Express router modules in routes/; keep each router file < 300 lines.

Bot: Telegraf instance is exported from core/bot.js.

LLM / LangChain: place LangChain tools in tools/ and graphs in graph/. 

# 📚 Documentation & Explainability #
Update README.md when features, setup steps, or dependencies change.

Comment non-obvious logic and add a // Reason: line when intent isn’t obvious.

Keep docs/architecture.md up-to-date with diagrams after each phase.

# 🧠 AI Behaviour Rules # 
Never assume missing context – ask clarifying questions.

Never hallucinate libraries or functions; only use packages verified in Context7 MCP and/or already listed in package.json.

Always confirm file paths and module names exist before referencing them.

Never delete or overwrite code unless it’s part of the active task in TASK.md.

# ⏩ Workflow Summary # 
Read PLANNING.md → Read / update TASK.md.

Write code in src/, keep files ≤ 500 lines, add helpful comments.

Tick task in TASK.md, document surprises, update docs if needed.

Commit with descriptive message following Conventional Commits (feat:, fix:, etc.).

# Happy coding :)