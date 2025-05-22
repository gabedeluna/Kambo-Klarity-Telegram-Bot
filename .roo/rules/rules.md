
Always use node bin/server.js to start the program in the terminal. 

# 🧱 Code Structure & Modularity #
Never create a file longer than 500 lines (including comments). When a file approaches the limit, split it into helper modules.

Organise code into clear feature folders inside src/ (e.g. core/, tools/, graph/, routes/).

Use CommonJS (require / module.exports) imports for consistency with existing code.

Favour single-purpose functions and keep side-effects isolated (e.g. DB or Telegram actions live in tools/).

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

# 🧠 AI Behaviour Rules # 
Never assume missing context – ask clarifying questions.

Never hallucinate libraries or functions; 

Always confirm file paths and module names exist before referencing them.

# ⏩ Workflow Summary # 

Write code in src/, keep files ≤ 500 lines, add helpful comments.

Commit with descriptive message following Conventional Commits (feat:, fix:, etc.).

# Using Jest for Writing Tests #
Remember to use the pattern of jest.resetModules() and requiring the module under test within beforeEach for Jest tests, especially when dealing with mocks that need to be active before module instantiation.

Pattern for Suppressing Expected console.error in Jest Tests:

beforeEach (or before the specific test):
let consoleErrorSpy;
// ...
consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

afterEach (or after the specific test):
if (consoleErrorSpy) {
  consoleErrorSpy.mockRestore();
}

In the test: You can optionally assert that consoleErrorSpy was called if that's part of the expected behavior:
expect(consoleErrorSpy).toHaveBeenCalled();
// or
expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Expected error message part"));

# Happy coding :)