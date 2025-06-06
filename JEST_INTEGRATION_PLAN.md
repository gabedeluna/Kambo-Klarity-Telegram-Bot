# Finalized Plan: Integrate Jest for Unit and Integration Testing

**Phase 1: Setup and Configuration**

1.  **Create New Branch:**
    *   Action: Checkout a new Git branch named `Jest_Tests_Refactor`.
    *   Responsibility: User.

2.  **Update `TASK.MD`:**
    *   Action: Add a new task to `TASK.MD` for this Jest integration.
    *   Proposed Entry:
        ```markdown
        | [ ]**PH_TEST-01** | **Integrate Jest Testing Framework** | Replace Mocha with Jest. Configure Jest for the project. Define unit and integration testing strategy. Install dependencies, update package.json scripts. Create initial test structure. |
        ```

3.  **Dependency Management (`package.json`):**
    *   Action:
        *   Remove existing (unused) testing libraries: `mocha`, `chai`, `chai-as-promised`, `sinon`, `sinon-chai`, `nyc`, `mockery`, `proxyquire`.
        *   Add Jest: `jest`.

4.  **Jest Configuration:**
    *   Action: Create a Jest configuration file, `jest.config.js`, in the project root.
    *   Initial Configuration Points:
        *   `testEnvironment`: 'node'
        *   `collectCoverage`: true
        *   `coverageDirectory`: "coverage"
        *   `testMatch`: `["<rootDir>/tests/**/*.test.js"]` (as we're using a root `tests/` directory)
        *   `transform`: Default should work for CommonJS.
        *   `setupFilesAfterEnv`: For any global setup (e.g., `tests/setupTests.js`).
        *   `rootDir`: '.'

5.  **Update `package.json` Scripts:**
    *   Action: Modify the `test` script in `package.json` to use Jest.
    *   Example: `"test": "cross-env NODE_ENV=test GOOGLE_API_KEY=test-key jest --coverage --runInBand"`

**Phase 2: Test Structure and Strategy**

6.  **Test Directory Structure:**
    *   Decision: A root `tests/` directory will be used. Subdirectories within `tests/` can mirror the `src/` structure (e.g., `tests/core/`, `tests/tools/`, `tests/routes/`). Test files will be named like `*.test.js` (e.g., `tests/core/bot.test.js`).

7.  **Unit Testing Strategy:**
    *   Focus: Test individual modules and functions in isolation.
    *   Key Areas:
        *   Core utilities (`src/core/`): `env.js`, `logger.js`, `prisma.js` (mocking Prisma client), `sessionTypes.js`.
        *   Tools (`src/tools/`): `stateManager.js`, `telegramNotifier.js` (mocking Telegraf/API calls), `googleCalendar.js` (mocking Google API calls).
        *   Command Handlers (`src/commands/`): Individual command logic.
        *   Route Handlers (`src/routes/`): Logic within API route handlers (mocking `req`/`res`).
        *   Middleware (`src/middleware/`): Individual middleware functions.

8.  **Integration Testing Strategy:**
    *   Focus: Test interactions between different modules.
    *   Key Areas:
        *   Booking flow (simulating user interactions and checking state changes/DB).
        *   API endpoints: Test request/response cycles for critical APIs using `supertest`.
        *   Database interactions: Ensure modules correctly interact with Prisma for CRUD operations (can use a separate test database or transaction-based cleanup, possibly managed in `setupFilesAfterEnv`).

**Phase 3: Initial Implementation & Verification**

9.  **Create Initial Sample Tests:**
    *   Action: Write a few simple unit tests (e.g., for a utility in `core`) and a basic integration test for an API endpoint using `supertest`.
    *   Goal: Verify Jest setup, configuration, and test execution are working correctly.

10. **Documentation Updates:**
    *   Action:
        *   Update `PLANNING.MD` (Section 7.4 Tests) to reflect the move to Jest and the new testing strategies.
        *   Consider creating a `TESTING_GUIDE.md` if detailed conventions for writing tests are needed.
        *   Update `README.md` with instructions on how to run tests using Jest.

---

**Mermaid Diagram: Proposed Test Workflow**

```mermaid
graph TD
    A[Developer Writes Code] --> B{Run Jest Tests};
    B -- Pass --> C[Commit Code];
    B -- Fail --> D[Debug & Fix Code];
    D --> A;
    C --> E[CI Pipeline Runs Tests];
    E -- Pass --> F[Deploy];
    E -- Fail --> G[Notify & Revert/Fix];