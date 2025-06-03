# Kambo Klarity - Phase 6 Detailed Technical Specifications (Refactored)

This document provides a comprehensive, step-by-step technical specification for the refactored Phase 6 features of the Kambo Klarity project. It expands upon the tasks outlined in `Phase-6-Tasks.md` and integrates the detailed functional requirements from `Details_Phase_6_updated.md`. The core of this refactoring is the introduction of a `BookingFlowManager` to orchestrate dynamic booking and invitation sequences.

## File System

*   **Frontend (`public/` directory):**
    *   [`public/calendar-app.html`](public/calendar-app.html:0) (Existing, to be refactored)
        *   JavaScript: [`public/calendar-app.js`](public/calendar-app.js:0), [`public/calendar-api.js`](public/calendar-api.js:0) (Existing, to be refactored to interact with `BookingFlowManager` APIs)
        *   (Note: [`public/calendar-data.js`](public/calendar-data.js:0), [`public/calendar-ui.js`](public/calendar-ui.js:0) are existing helpers for `calendar-app.js`)
    *   `public/form-handler.html` (New - Generic form rendering and submission)
    *   `public/form-handler.js` (New - Logic for `form-handler.html`)
    *   `public/form-handler.css` (New - Styles for `form-handler.html`, potentially adapting from [`public/waiver-form.css`](public/waiver-form.css:0))
    *   `public/invite-friends.html` (New/Refactored - For primary booker to manage invites)
    *   `public/invite-friends.js` (New/Refactored - Logic for `invite-friends.html`)
    *   `public/invite-friends.css` (New or shared styles)
    *   `public/join-session.html` (New/Refactored - For invited friends to view invite details)
    *   `public/join-session.js` (New/Refactored - Logic for `join-session.html`)
    *   `public/join-session.css` (New or shared styles)
    *   Shared CSS/JS modules in `public/` as needed (e.g., `public/css/theme.css`, `public/js/utils.js`).
    *   *Deprecated/Refactored:*
        *   [`public/waiver-form.html`](public/waiver-form.html:0) (Its functionality will be absorbed by `public/form-handler.html`)
        *   [`public/waiver-form.css`](public/waiver-form.css:0) (Styles to be adapted for `public/form-handler.css`)

*   **Backend (`src/` directory):**
    *   `src/core/bookingFlowManager.js` (New - Central orchestrator for booking flows)
    *   [`src/core/sessionTypes.js`](src/core/sessionTypes.js:80) (Modified - To support dynamic flow fields)
    *   [`src/core/prisma.js`](src/core/prisma.js:0) (Existing - Prisma client instance)
    *   [`src/core/logger.js`](src/core/logger.js:0) (Existing - Logging utility)
    *   [`src/core/bot.js`](src/core/bot.js:0) (Existing - Telegraf bot instance)
    *   [`src/core/env.js`](src/core/env.js:0) (Existing - Environment variable management)
    *   `src/routes/api.js` (Modified - To include new booking flow API routes)
    *   `src/handlers/api/bookingFlowApiHandler.js` (New - Handles requests for the `BookingFlowManager`)
    *   `src/handlers/api/sessionInviteApiHandler.js` (Existing/Modified - Handles invite-specific API requests like context fetching and token generation, potentially called by `BookingFlowManager` or directly)
    *   `src/handlers/api/waiverApiHandler.js` (Refactored - Logic for waiver submission will be orchestrated by `BookingFlowManager`, so this handler might be simplified or its logic moved into `bookingFlowApiHandler.js` or `bookingFlowManager.js`)
    *   [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0) (Modified - e.g., for `POST /api/gcal-placeholder-bookings` if its logic isn't fully absorbed by the new flow handlers)
    *   [`src/handlers/callbackQueryHandler.js`](src/handlers/callbackQueryHandler.js:0) (Modified - To handle "Decline Invite" callbacks, potentially interacting with `BookingFlowManager`)
    *   [`src/handlers/commandHandler.js`](src/handlers/commandHandler.js:0) (Modified - To handle `/start invite_{token}` deep links and initiate friend flow via `BookingFlowManager`)
    *   [`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0) (Modified/Enhanced - For robust placeholder management, final slot checks, event creation/updates)
    *   [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) (Modified/Enhanced - For various notifications triggered by `BookingFlowManager`)
    *   [`src/tools/stateManager.js`](src/tools/stateManager.js:0) (Existing - May be used by `BookingFlowManager` for temporary flow state if not using tokens)
    *   `src/workers/placeholderCleanupCron.js` (New - For GCal placeholder cleanup)
    *   [`prisma/schema.prisma`](prisma/schema.prisma:0) (Modified - For `SessionType` enhancements, `SessionInvite` model, removal of fields from `AvailabilityRule`)
    *   `prisma/migrations/` (New migration files will be generated)

---

## Feature Specifications

---

### Feature 1 (Task 17): Design & Implement `BookingFlowManager` Core Module

**Goal:**
Create the central `BookingFlowManager` module (`src/core/bookingFlowManager.js`) responsible for orchestrating dynamic booking and invitation flows based on `SessionType` configurations. This module will act as the "brain" determining the sequence of user experiences.

**API Relationships:**
*   This module itself is not an API but will be called by API handlers, primarily `src/handlers/api/bookingFlowApiHandler.js`.
*   It will interact internally with:
    *   [`src/core/prisma.js`](src/core/prisma.js:0) (for DB access to `SessionType`, `Session`, `SessionInvite`, `User`, etc.)
    *   [`src/core/sessionTypes.js`](src/core/sessionTypes.js:80) (to fetch detailed session type configurations)
    *   [`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0) (for GCal operations)
    *   [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) (to trigger notifications)
    *   [`src/tools/stateManager.js`](src/tools/stateManager.js:0) (potentially for managing flow state if not using self-contained tokens)
    *   [`src/core/logger.js`](src/core/logger.js:0) (for logging)

**Detailed Requirements:**

*   **Requirement A (Module Creation & Structure):**
    *   Create the file `src/core/bookingFlowManager.js`.
    *   It should export functions to initiate, continue, and potentially cancel/query booking flows.
    *   Example exported functions: `startPrimaryBookingFlow()`, `startInviteAcceptanceFlow()`, `continueFlow()`, `processWaiverSubmission()`, `processFriendInviteAcceptance()`, `handleFriendDecline()`.
*   **Requirement B (Flow State Management):**
    *   Design a robust mechanism to manage the state of an ongoing booking flow. This state needs to be passed between client (mini-apps) and server across multiple HTTP requests.
    *   **Option 1 (Preferred for statelessness): JWT-based Flow Token.**
        *   Generate a secure JSON Web Token (JWT) (`flowToken`) when a flow starts.
        *   This token will encapsulate essential, non-sensitive flow context: `userId` (Telegram ID of the primary actor in the flow), `flowType` ("primary_booking", "friend_invite"), `currentStep` (e.g., "awaiting_waiver", "awaiting_friend_invites"), `sessionTypeId`, `appointmentDateTimeISO`, `placeholderId` (if applicable), `parentSessionId` (for friend flows), `inviteToken` (for friend flows).
        *   The token should have a short expiry (e.g., 1-2 hours) and be signed securely.
        *   Sensitive data (like full waiver form inputs before final submission) should NOT be stored in the token but passed directly in POST bodies when a step is submitted.
    *   **Option 2 (Server-side state): Temporary DB Record or Cache.**
        *   Generate a unique `flowInstanceId`.
        *   Store flow state in a temporary database table (e.g., `BookingFlowState`) or a Redis cache, keyed by `flowInstanceId`.
        *   This `flowInstanceId` acts as the `flowToken`.
        *   Requires a cleanup mechanism for abandoned/expired flow states.
    *   The `BookingFlowManager` will parse this `flowToken` (or retrieve state using it) to understand the context of any "continue flow" request.
*   **Requirement C (Core Flow Logic & Decision Making):**
    *   Implement functions to retrieve `SessionType` details (especially `waiverType`, `allowsGroupInvites`, `maxGroupSize`) using [`src/core/sessionTypes.js`](src/core/sessionTypes.js:80).
    *   Develop a central decision-making function (e.g., `determineNextStep(currentFlowState, sessionTypeConfig, submittedData?)`) that:
        *   Takes the current flow state and `SessionType` configuration.
        *   Based on rules (e.g., `sessionType.waiverType !== "NONE"`, `sessionType.allowsGroupInvites === true && currentFlowState.step === "primary_waiver_complete"`), determines the next logical step.
        *   Examples of next steps:
            *   Redirect to `form-handler.html` with a specific `formType` (e.g., "KAMBO_WAIVER_V1").
            *   Redirect to `invite-friends.html`.
            *   Indicate flow completion (e.g., booking confirmed).
            *   Indicate an error state.
    *   Initial flow logic will be based on `waiverType` and `allowsGroupInvites`. For example:
        *   If `waiverType` is "KAMBO_V1", next step is waiver form.
        *   If `waiverType` is "NONE" and `allowsGroupInvites` is true, next step (after initial booking for primary) could be `invite-friends.html`.
        *   If `waiverType` is "NONE" and `allowsGroupInvites` is false, next step (after initial booking for primary) is completion.
*   **Requirement D (Step Execution & Orchestration):**
    *   The manager's functions (e.g., `processWaiverSubmission`) will perform the actual backend operations for a given step:
        *   Validate input data.
        *   Interact with Prisma for DB operations (create/update `Session`, `SessionInvite`).
        *   Interact with `googleCalendarTool` (create/delete/update GCal events).
        *   Interact with `telegramNotifierTool` (send confirmations, notifications).
    *   After performing actions, it will call `determineNextStep()` to get the subsequent action for the client.
*   **Requirement E (Logging):**
    *   Integrate with [`src/core/logger.js`](src/core/logger.js:0).
    *   Log key events: flow initiation (with initial parameters), each step transition, data received, decisions made by `determineNextStep()`, actions performed (DB, GCal, notifications), errors encountered, flow completion.
    *   Logs should include `flowToken` or `flowInstanceId` for traceability.
*   **Requirement F (Extensibility):**
    *   Design internal functions to be modular (e.g., separate functions for `_handlePrimaryWaiver()`, `_handleFriendWaiver()`, `_createSessionRecord()`, `_generateGCalEvent()`).
    *   The `determineNextStep()` logic should be adaptable. (Future: `SessionType.customFormDefinitions` could provide a JSON/DSL defining a sequence of steps and conditions, making the flow manager data-driven rather than purely code-driven for complex custom flows).
*   **Requirement G (Error Handling):**
    *   Implement robust error handling for DB operations, GCal API calls, etc.
    *   Define how errors are propagated back to the calling API handler to be returned to the client (e.g., specific error codes/messages).
    *   For critical multi-step operations (e.g., creating Session, GCal event, then notifying), consider atomicity or compensation logic (though full 2PC is likely overkill, aim for idempotency where possible and clear logging of partial failures).

**Implementation Guide:**

*   **Architecture Overview:**
    *   The `BookingFlowManager` will be a Node.js module (CommonJS) within the `src/core/` directory. It will be stateless if using JWT flow tokens, or stateful if using server-side session storage for flows.
    *   **Diagram (Conceptual Flow):**
        ```mermaid
        sequenceDiagram
            participant Client as Mini-App/Bot
            participant API as API Endpoints (/api/booking-flow/*)
            participant BFM as BookingFlowManager
            participant DB as Prisma (Database)
            participant GCal as GoogleCalendarTool
            participant Notifier as TelegramNotifierTool
            participant STCore as SessionTypeCore

            Client->>+API: Initiate Flow (e.g., POST /start-primary with slot details)
            API->>+BFM: startPrimaryBookingFlow(data)
            BFM->>+STCore: getById(sessionTypeId)
            STCore-->>-BFM: sessionTypeDetails
            BFM->>BFM: determineNextStep(initialState, sessionTypeDetails)
            BFM-->>-API: { flowToken, nextStep: { type: "REDIRECT", url: "/form-handler.html?..." } }
            API-->>-Client: { flowToken, nextStep }

            Client->>Client: Redirect to form-handler.html?flowToken=...&formType=...
            Client->>+API: Submit Form (POST /continue with flowToken, formData)
            API->>+BFM: continueFlow({ flowToken, stepId:"waiver_submission", formData })
            BFM->>BFM: Parse flowToken, validate
            BFM->>+DB: Save waiver data, Create/Update Session/SessionInvite
            DB-->>-BFM: Success/Failure
            BFM->>+GCal: Create/Update GCal Event
            GCal-->>-BFM: Success/Failure
            BFM->>+Notifier: Send Notifications
            Notifier-->>-BFM: Success/Failure
            BFM->>BFM: determineNextStep(updatedState, sessionTypeDetails)
            BFM-->>-API: { nextStep: { type: "REDIRECT", url: "/invite-friends.html?..." } or { type: "COMPLETE" } }
            API-->>-Client: { nextStep }
        end
        ```
    *   **Tech Stack:** Node.js, JavaScript (CommonJS). Dependencies: `jsonwebtoken` (if using JWTs), existing core modules.
    *   **Deployment:** Deployed as part of the main Node.js application. No separate deployment process.

*   **DB Schema:**
    *   No new tables are strictly required by `BookingFlowManager` itself if JWTs are used for flow state.
    *   If server-side flow state is chosen (Option 2 for Req B):
        *   **New Table: `BookingFlowState`**
            *   `id`: String (UUID, Primary Key - this is the `flowInstanceId`/`flowToken`)
            *   `userId`: BigInt (Telegram ID of the user initiating/acting in the flow)
            *   `flowType`: String (e.g., "PRIMARY_BOOKING", "FRIEND_INVITE_ACCEPTANCE")
            *   `currentStep`: String (e.g., "AWAITING_WAIVER", "AWAITING_INVITES_MANAGEMENT", "COMPLETED")
            *   `sessionTypeId`: String (FK to `SessionType.id`)
            *   `appointmentDateTimeISO`: String
            *   `placeholderId`: String? (GCal event ID for placeholder)
            *   `parentSessionId`: Int? (FK to `Session.id`, for friend flows)
            *   `activeInviteToken`: String? (The specific `SessionInvite.inviteToken` being processed in a friend flow)
            *   `accumulatedData`: JSON? (For storing intermediate data if necessary, e.g., pre-fetched user details before waiver)
            *   `expiresAt`: DateTime (For automatic cleanup of stale flow states)
            *   `createdAt`: DateTime `@default(now())`
            *   `updatedAt`: DateTime `@updatedAt`
            *   **Indexes:** `userId`, `expiresAt`.
        *   **Migration:** If `BookingFlowState` table is added, a Prisma migration is needed.
    *   The manager will primarily read `SessionType`, `User` and create/update `Session`, `SessionInvite`.

*   **API Design:**
    *   The `BookingFlowManager` itself doesn't expose HTTP APIs directly. It's called by API handlers (defined in Task 18). The design of those API handlers will be crucial for how clients interact with the manager.

*   **Frontend Structure:**
    *   N/A for this backend core module. Frontend mini-apps will interact with its functionalities via the APIs defined in Task 18.

*   **CRUD Operations:**
    *   The `BookingFlowManager` will orchestrate CRUD operations on various models:
        *   **Create:** `Session`, `SessionInvite`, GCal Events. If using server-side state, `BookingFlowState`.
        *   **Read:** `SessionType`, `User`, `Session`, `SessionInvite`, GCal Events. If using server-side state, `BookingFlowState`.
        *   **Update:** `Session`, `SessionInvite` (e.g., status, friend details), `User` (e.g., `edit_msg_id`), GCal Events (description, title). If using server-side state, `BookingFlowState`.
        *   **Delete:** GCal Placeholder Events. If using server-side state, expired `BookingFlowState` records.
    *   **Validation:** Input validation will occur at the API handler level (Task 18) before calling `BookingFlowManager`, and potentially within `BookingFlowManager` for business logic validation (e.g., ensuring invite limits aren't exceeded).

*   **UX Flow:**
    *   The `BookingFlowManager` underpins the UX flow by determining the sequence of pages/actions.
    *   **Journey Maps (Conceptual):**
        *   **Primary Booker:** Calendar -> (Placeholder) -> BFM decides -> Waiver Form (via Form Handler) -> BFM decides -> Invite Friends Page OR Confirmation -> BFM decides -> Completion.
        *   **Invited Friend:** Bot Invite Link -> BFM decides -> Join Session Page -> BFM decides -> Waiver Form (via Form Handler) -> BFM decides -> Confirmation -> Completion.
    *   Loading/error states will be handled by the frontend mini-apps based on responses from APIs that call the `BookingFlowManager`.

*   **Security:**
    *   If using JWTs for `flowToken`:
        *   Use strong secret keys for signing (from env variables).
        *   Set appropriate short expiry times (e.g., `exp` claim).
        *   Do not include sensitive PII directly in the JWT payload; use IDs and fetch details server-side.
        *   Transmit JWTs over HTTPS.
    *   If using server-side `flowInstanceId`: Ensure IDs are unguessable (UUIDs).
    *   The manager itself relies on upstream API handlers for user authentication (e.g., validating `telegramId` against an authenticated session if applicable, or trusting `telegramId` from bot context for specific actions).
    *   Internal calls to tools like Prisma, GCal, Notifier should use secured configurations.

*   **Testing:**
    *   **Unit Tests (for `src/core/bookingFlowManager.js`):**
        *   Mock all external dependencies: `prismaClient`, `sessionTypesCore`, `googleCalendarTool`, `telegramNotifierTool`, `logger`.
        *   Test `startPrimaryBookingFlow()`:
            *   Scenario: SessionType requires waiver, allows invites. Expected: returns `flowToken` and `nextStep` pointing to waiver form.
            *   Scenario: SessionType no waiver, no invites. Expected: returns `flowToken` and `nextStep` for direct booking completion (or calls relevant functions).
        *   Test `startInviteAcceptanceFlow()`:
            *   Scenario: Valid invite token. Expected: `flowToken` and `nextStep` for friend (e.g., to `join-session.html` or `form-handler.html`).
            *   Scenario: Invalid/used invite token. Expected: Throws specific error.
        *   Test `continueFlow()` (or more specific `processWaiverSubmission()`):
            *   Mock input `flowToken` and `formData`.
            *   Scenario: Primary booker waiver, placeholder exists, slot free. Expected: Placeholder deleted, session created, GCal event created, notifications sent, `nextStep` to invite friends (if applicable) or completion.
            *   Scenario: Primary booker waiver, slot taken. Expected: Error returned, no DB/GCal changes.
            *   Scenario: Friend waiver. Expected: `SessionInvite` updated, GCal updated, notifications sent, `nextStep` to completion.
        *   Test `determineNextStep()` logic with various `currentFlowState` and `sessionTypeConfig` inputs.
    *   **Integration Tests:** Will be part of testing the API endpoints (Task 18) that use the `BookingFlowManager`.

*   **Data Management:**
    *   **Caching:** `SessionType` details fetched via [`src/core/sessionTypes.js`](src/core/sessionTypes.js:80) might have their own caching. `BookingFlowManager` itself likely won't implement caching beyond what its dependencies provide, unless performance analysis shows a bottleneck.
    *   **Lifecycle:**
        *   If JWT `flowToken` is used, its lifecycle is managed by its expiry.
        *   If server-side `BookingFlowState` table is used, a cron job or TTL mechanism in Redis would be needed to clean up expired/abandoned flow states.
    *   **Real-time Needs:** No direct real-time needs for this module itself, but it orchestrates actions that might have real-time implications for the user (e.g., seeing a GCal event appear).

*   **Logging & Error Handling:**
    *   **Structured Logs:** Use `pino` (via [`src/core/logger.js`](src/core/logger.js:0)). Include `flowToken` (or `flowInstanceId`), `userId`, `currentStep`, and relevant context in log messages.
        *   `logger.info({ flowToken, userId, step: 'startPrimary', sessionTypeId }, 'Primary booking flow started.')`
        *   `logger.warn({ flowToken, error: err.message }, 'Error processing waiver, GCal update failed.')`
    *   **Alerts:** Critical errors (e.g., consistent DB failure, GCal API auth failure during flow processing) should trigger alerts (e.g., via Sentry or a logging service that supports alerting).
    *   **Recovery:**
        *   For most operations, if a step fails (e.g., GCal booking after DB write), log the inconsistency and inform the user/admin. Full rollback across distributed services (DB, GCal) is complex.
        *   Aim for idempotency in retryable operations where possible.
        *   The `BookingFlowManager` should clearly signal success or failure of a step to the calling API handler.

**Key Edge Cases:**
*   `SessionType` configuration is missing or invalid (e.g., `waiverType` points to a non-existent form).
*   User attempts to continue a flow with an expired or invalid `flowToken`.
*   Concurrent modifications to related data (e.g., admin changes `SessionType` while a flow is in progress based on old config) – the flow should ideally use the config fetched at its initiation or at the start of the current step.
*   Failure in one of the orchestrated actions (DB write, GCal API call, Telegram notification): The manager must handle this gracefully, log appropriately, and decide if the flow can continue or must terminate with an error.
*   Network errors when `BookingFlowManager` calls external services or internal modules.
*   Race conditions if multiple users try to book the exact same final slot simultaneously (final GCal check before booking is crucial).

---

### Feature 2 (Task 18): API Endpoints for `BookingFlowManager`

**Goal:**
Expose secure API endpoints for client-side applications (mini-apps) and the Telegram bot to interact with the `BookingFlowManager` to initiate and progress through booking flows. These APIs will be the primary HTTP interface for the `BookingFlowManager`.

**API Relationships:**
*   These endpoints will be defined in `src/routes/api.js` and handled by `src/handlers/api/bookingFlowApiHandler.js`.
*   The handlers will call methods on the `BookingFlowManager` (Feature 1 / Task 17).
*   Clients (mini-apps like `calendar-app.js`, `form-handler.js`, `join-session.js`, `invite-friends.js`; and bot command handlers) will call these APIs.

**Detailed Requirements:**

*   **Requirement A (Endpoint: Start Primary Booking Flow):**
    *   **Endpoint:** `POST /api/booking-flow/start-primary`
    *   **Purpose:** Initiates a new booking flow for a primary user after they have selected a slot in the calendar.
    *   **Request Body (JSON):**
        ```json
        {
          "telegramId": "123456789", // User's Telegram ID
          "sessionTypeId": "session-type-uuid-1",
          "appointmentDateTimeISO": "2025-07-15T10:00:00.000Z",
          "placeholderId": "gcal-placeholder-event-id", // From POST /api/gcal-placeholder-bookings
          "initialSessionTypeDetails": { // Details fetched by client from /api/session-types or /api/gcal-placeholder-bookings
            "waiverType": "KAMBO_V1",
            "allowsGroupInvites": true,
            "maxGroupSize": 4
          }
        }
        ```
    *   **Action (Handler):**
        1.  Validate input: `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`, `placeholderId`, `initialSessionTypeDetails` must be present and correctly formatted.
        2.  Call `BookingFlowManager.startPrimaryBookingFlow(validatedData)`.
    *   **Response (Success 200 OK):**
        ```json
        {
          "success": true,
          "flowToken": "generated.jwt.flow.token", // JWT or opaque token
          "nextStep": {
            "type": "REDIRECT", // or "COMPLETE" if no further steps
            "url": "/form-handler.html?flowToken=generated.jwt.flow.token&formType=KAMBO_WAIVER_V1&telegramId=123456789&sessionTypeId=...&appointmentDateTimeISO=...&placeholderId=...", // Example
            // "message": "Booking confirmed directly!" // If type is "COMPLETE"
            // "closeWebApp": true // If type is "COMPLETE" and app should close
          }
        }
        ```
    *   **Response (Error 400 Bad Request):** If validation fails.
        ```json
        { "success": false, "message": "Invalid input: telegramId is required." }
        ```
    *   **Response (Error 500 Internal Server Error):** If `BookingFlowManager` encounters an unexpected error.
        ```json
        { "success": false, "message": "An internal error occurred while starting the booking flow." }
        ```

*   **Requirement B (Endpoint: Start Invite Acceptance Flow):**
    *   **Endpoint:** `GET /api/booking-flow/start-invite/:inviteToken`
    *   **Purpose:** Initiates a flow for an invited friend who has clicked a deep link.
    *   **Path Parameter:** `:inviteToken` - The unique token from `SessionInvite`.
    *   **Query Parameter:** `friend_tg_id` - The Telegram ID of the friend clicking the link.
    *   **Action (Handler):**
        1.  Validate `inviteToken` (format) and `friend_tg_id`.
        2.  Call `BookingFlowManager.startInviteAcceptanceFlow(inviteToken, friend_tg_id)`.
    *   **Response (Success 200 OK):**
        ```json
        {
          "success": true,
          "flowToken": "generated.jwt.flow.token.for.friend",
          "nextStep": {
            "type": "REDIRECT",
            "url": "/join-session.html?flowToken=...&inviteToken=...&friend_tg_id=...&primaryBookerName=...&sessionLabel=...&appointmentTimeFormatted=..."
            // Or directly to form-handler.html if join-session page is skipped:
            // "url": "/form-handler.html?flowToken=...&formType=KAMBO_WAIVER_V1&inviteToken=...&friend_tg_id=..."
          },
          "inviteDetails": { // Data to populate join-session.html or initial bot message
             "primaryBookerName": "John Doe",
             "sessionTypeLabel": "Standard Kambo Session",
             "appointmentTimeFormatted": "Monday, July 15, 2025 at 10:00 AM PDT",
             "parentSessionId": 123,
             "sessionTypeId": "session-type-uuid-1",
             "appointmentDateTimeISO": "2025-07-15T10:00:00.000Z"
          }
        }
        ```
    *   **Response (Error 404 Not Found):** If `inviteToken` is invalid or already used/expired (determined by `BookingFlowManager`).
        ```json
        { "success": false, "message": "Invite token is invalid or has expired." }
        ```
    *   **Response (Error 500 Internal Server Error):**
        ```json
        { "success": false, "message": "An internal error occurred while starting the invite flow." }
        ```

*   **Requirement C (Endpoint: Continue Flow / Submit Step Data):**
    *   **Endpoint:** `POST /api/booking-flow/continue`
    *   **Purpose:** Allows client to submit data for the current step of an active flow (e.g., waiver form submission, invite management completion).
    *   **Request Body (JSON):**
        ```json
        {
          "flowToken": "active.jwt.flow.token",
          "stepId": "waiver_submission", // Identifier for the step being completed
          "formData": {
            // Step-specific data, e.g., waiver answers
            "firstName": "Jane",
            "lastName": "Doe",
            // ... other waiver fields ...
            "liability_form_data": { /* structured waiver answers */ },
            // Crucial IDs that might have been part of the form or flow context
            "telegramId": "123456789", // Could be primary booker or friend
            "sessionTypeId": "session-type-uuid-1",
            "appointmentDateTimeISO": "2025-07-15T10:00:00.000Z",
            "placeholderId": "gcal-placeholder-event-id", // If primary booker's waiver
            "inviteToken": "friend-invite-token-xyz" // If friend's waiver
          }
        }
        ```
        *(Note: Some IDs like `telegramId`, `sessionTypeId` etc. might also be derivable from the `flowToken` itself, reducing what needs to be sent in `formData` if they are immutable for the flow instance. `formData` would then primarily contain user-entered data for the current step.)*
    *   **Action (Handler):**
        1.  Validate `flowToken` (e.g., JWT verification, check expiry).
        2.  Validate `stepId` and `formData` structure based on `stepId`.
        3.  Call `BookingFlowManager.continueFlow(parsedFlowTokenData, stepId, validatedFormData)`. This might internally route to specific methods like `processWaiverSubmission()`.
    *   **Response (Success 200 OK):**
        ```json
        {
          "success": true,
          "nextStep": {
            "type": "REDIRECT", // or "COMPLETE" or "ERROR"
            "url": "/invite-friends.html?flowToken=new.or.same.flow.token&sessionId=...", // Example
            // "message": "Your booking is confirmed! You will receive a message from the bot shortly.",
            // "closeWebApp": true // If type is "COMPLETE"
          }
        }
        ```
    *   **Response (Error 400 Bad Request):** Invalid input or `flowToken`.
        ```json
        { "success": false, "message": "Invalid flow token or form data." }
        ```
    *   **Response (Error 409 Conflict):** If a business rule is violated (e.g., slot taken, determined by `BookingFlowManager`).
        ```json
        { "success": false, "message": "Slot is no longer available." }
        ```
    *   **Response (Error 500 Internal Server Error):**
        ```json
        { "success": false, "message": "An internal error occurred while continuing the flow." }
        ```

*   **Requirement D (Security & Authorization):**
    *   All endpoints must be HTTPS.
    *   **`flowToken` Security:** If JWT, ensure it's signed with a strong secret, has an expiry, and doesn't contain overly sensitive data. Validate signature and expiry on every request using it.
    *   **Authorization:**
        *   For `POST /start-primary` and `POST /continue` (when initiated by primary booker): The `telegramId` in the request should ideally be validated against an authenticated user session if the mini-apps have a way to establish this (e.g., Telegram WebApp `initData`). If not, the `telegramId` is taken as provided, and subsequent actions are tied to this ID.
        *   For `GET /start-invite/:inviteToken`: The `inviteToken` itself is a form of authorization for that specific invite. The `friend_tg_id` is who is *claiming* to use it.
        *   `BookingFlowManager` should perform internal checks, e.g., ensuring the `telegramId` acting on a `flowToken` matches the `userId` embedded in the token or associated with the server-side flow state.
    *   Input sanitization and validation for all request parameters and body fields.

*   **Requirement E (API Handler Implementation):**
    *   Create `src/handlers/api/bookingFlowApiHandler.js`.
    *   Define functions for `handleStartPrimaryFlow`, `handleStartInviteFlow`, `handleContinueFlow`.
    *   These functions will perform request validation, call the appropriate `BookingFlowManager` methods, and format the HTTP response.
    *   Register these handlers in `src/routes/api.js` for the defined endpoints.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Standard Express.js route and handler pattern.
    *   `bookingFlowApiHandler.js` acts as a controller layer, delegating business logic to `BookingFlowManager.js`.
    *   **Diagram:**
        ```mermaid
        graph TD
            A[Client Mini-App/Bot] -- HTTP Request --> B(Express Router /src/routes/api.js)
            B -- /api/booking-flow/* --> C{bookingFlowApiHandler.js}
            C -- Calls method --> D[BookingFlowManager.js]
            D -- Interacts with --> E[Other Core Services: DB, GCal, Notifier]
            D -- Returns result --> C
            C -- Formats HTTP Response --> A
        end
        ```
    *   **Tech Stack:** Node.js, Express.js.
    *   **Deployment:** Part of the main application.

*   **DB Schema:**
    *   These API endpoints primarily interact with `BookingFlowManager`, which then interacts with the DB. No direct DB schema changes for the API handlers themselves, but they rely on schemas defined/modified in other tasks (e.g., `SessionType`, `SessionInvite`).

*   **API Design Details:**
    *   **Error Codes:**
        *   `400 Bad Request`: Invalid input, malformed JSON, missing required fields, invalid `flowToken` format/expiry.
        *   `401 Unauthorized`: If a stronger authentication mechanism is in place and fails (not primary for token-based flows initially).
        *   `403 Forbidden`: User associated with `flowToken` not allowed to perform action / `telegramId` mismatch.
        *   `404 Not Found`: Invalid `inviteToken`, or resource related to flow not found.
        *   `409 Conflict`: Business logic error, e.g., slot taken, invite limit reached.
        *   `500 Internal Server Error`: Unexpected server-side errors.
    *   **Rate Limiting:** Apply standard rate limiting (e.g., using `express-rate-limit`) to these endpoints, especially `POST` operations, to prevent abuse. Configuration in `src/middleware/rateLimiterMiddleware.js`.

*   **Frontend Structure:**
    *   N/A for backend API handlers. Frontend mini-apps will consume these APIs.

*   **CRUD Operations:**
    *   These API handlers orchestrate CRUD by calling `BookingFlowManager`. They don't perform direct CRUD themselves.

*   **UX Flow:**
    *   These APIs are backend components. The UX flow is experienced by users interacting with mini-apps that call these APIs. The `nextStep` object in API responses directly influences the frontend UX by dictating navigation or completion messages.

*   **Security (Handler-Specific):**
    *   Validate all incoming data types and formats.
    *   Ensure `flowToken` is handled securely (passed via HTTPS, validated correctly).
    *   Log API access with relevant details (excluding sensitive data like raw waiver answers in general logs, though `BookingFlowManager` might log them with more restricted access).

*   **Testing:**
    *   **Unit Tests (for `src/handlers/api/bookingFlowApiHandler.js`):**
        *   Mock `BookingFlowManager` methods.
        *   Test request validation logic (valid and invalid inputs for each endpoint).
        *   Test that correct `BookingFlowManager` methods are called with correct parameters.
        *   Test response formatting for success and various error scenarios (400, 404, 409, 500).
    *   **Integration Tests (API level using Supertest):**
        *   Test each endpoint against a running server instance with a test database.
        *   Mock external services like Google Calendar and Telegram Notifier at the `BookingFlowManager` level or tool level.
        *   Verify:
            *   `POST /start-primary`: Correct `flowToken` and `nextStep` for different `SessionType` configs.
            *   `GET /start-invite/:inviteToken`: Correct `flowToken`, `nextStep`, and `inviteDetails` for valid/invalid tokens.
            *   `POST /continue`: Correct processing of different `stepId`s (e.g., waiver submission for primary, waiver for friend), correct `nextStep` determination, and expected side effects (mocked DB changes, GCal calls, Notifier calls).

*   **Data Management:**
    *   These API handlers are stateless. State is managed by `BookingFlowManager` (via tokens or server-side state).

*   **Logging & Error Handling (Handler-Specific):**
    *   Use `src/middleware/loggingMiddleware.js` for request logging.
    *   In handler functions, log entry, key parameters (e.g., `flowToken`, `stepId`, `inviteToken`), and outcome (success/error).
    *   Use `src/middleware/errorHandlerMiddleware.js` for centralized error response formatting.
    *   Specific errors from `BookingFlowManager` should be mapped to appropriate HTTP status codes and user-friendly messages.
        *   `logger.info({ handler: 'handleContinueFlow', flowToken, stepId }, 'Processing continue flow request.');`
        *   `logger.error({ handler: 'handleStartPrimaryFlow', err: e.message }, 'Error in startPrimaryBookingFlow manager call.');`

**Key Edge Cases:**
*   Malformed `flowToken` or `inviteToken`.
*   `flowToken` expired or not found (if server-side state).
*   Unexpected `stepId` in `POST /continue`.
*   `formData` in `POST /continue` not matching expectations for the given `stepId`.
*   Network issues between client and API.
*   `BookingFlowManager` throws an unhandled exception.

---
### Feature 3 (Task 19): Enhance `SessionType` Model & Logic for Dynamic Flows
**(Consolidates and Refines Original: PH6-11.5)**

**Goal:**
Ensure the `SessionType` database model and related core logic in `src/core/sessionTypes.js` are augmented to fully support the dynamic flow decisions required by the `BookingFlowManager`. This makes `SessionType` the central configuration point for how a booking flow behaves.

**API Relationships:**
*   **Impacts existing APIs (as detailed in original PH6-11.5):**
    *   `GET /api/session-types/:id`: Will now return the new/enhanced fields (`waiverType`, `allowsGroupInvites`, `maxGroupSize`, potentially `customFormDefinitions`).
    *   `POST /api/gcal-placeholder-bookings`: This API (Task 29 / Original DF-1) will need to fetch these new `SessionType` fields and include them in its response to the client (calendar app) to enable the `BookingFlowManager` to make initial decisions.
*   **Consumed by:**
    *   `BookingFlowManager` (Feature 1 / Task 17): To retrieve `waiverType`, `allowsGroupInvites`, `maxGroupSize`, etc., for decision-making.
    *   Admin Interface (Future Task 31 / PH6-XX): For managing these `SessionType` properties.

**Detailed Requirements:**

*   **Requirement A (DB Schema Update - `SessionType`):**
    *   Modify the `SessionType` model in `prisma/schema.prisma`.
    *   **Field 1: `waiverType`**
        *   Type: `String`
        *   Purpose: Determines which waiver content/flow is used.
        *   Examples: "KAMBO_V1" (default Kambo waiver), "NONE" (no waiver required), "CUSTOM_FORM_XYZ" (identifier for a future custom form).
        *   Default: `"KAMBO_V1"`
        *   Database attribute: `@default("KAMBO_V1")`
    *   **Field 2: `allowsGroupInvites`**
        *   Type: `Boolean`
        *   Purpose: Globally enables or disables the "invite friends" feature for this session type.
        *   Default: `false`
        *   Database attribute: `@default(false)`
    *   **Field 3: `maxGroupSize`**
        *   Type: `Int`
        *   Purpose: Represents the total number of participants allowed for a session of this type, including the primary booker. If `allowsGroupInvites` is true, `maxGroupSize` must be > 1. The number of friends that can be invited is `maxGroupSize - 1`.
        *   Default: `1`
        *   Database attribute: `@default(1)`
        *   Validation: Must be >= 1. If `allowsGroupInvites` is true, ideally `maxGroupSize` > 1. This validation should be enforced at the application level (e.g., Admin UI, `BookingFlowManager` logic).
    *   **Field 4: `customFormDefinitions` (Future Enhancement)**
        *   Type: `Json?` (Optional JSON field)
        *   Purpose: To store definitions for fully custom forms or flow sequences beyond predefined `waiverType` values. This allows admins to create unique multi-step forms or information gathering processes for specific session types.
        *   Default: `null`
    *   **Field 5: `updatedAt` (Auditing)**
        *   Type: `DateTime`
        *   Purpose: Track when the session type was last updated.
        *   Database attribute: `@updatedAt`
*   **Requirement B (Database Migration):**
    *   Generate a new Prisma migration: `npx prisma migrate dev --name enhance_sessiontype_for_dynamic_flows_v2` (using a new name to avoid conflict if a similar migration was run from the original plan).
    *   Apply the migration.
*   **Requirement C (Seed Data Update):**
    *   If a `prisma/seed.js` script exists, update it to:
        *   Include appropriate default or example values for `waiverType`, `allowsGroupInvites`, and `maxGroupSize` for all existing and any new `SessionType` records.
        *   Ensure new `SessionType`s are seeded with sensible configurations for testing various flows.
*   **Requirement D (Core Logic Update - `src/core/sessionTypes.js`):**
    *   Modify functions within `src/core/sessionTypes.js` (e.g., `getById`, `getAllActive`, or any new functions used by `BookingFlowManager`) to select and return these new fields (`waiverType`, `allowsGroupInvites`, `maxGroupSize`, `customFormDefinitions`).
    *   Ensure that any caching mechanisms within this module are updated or invalidated appropriately when `SessionType` data changes.
    *   The `BookingFlowManager` and relevant API handlers (e.g., for `GET /api/session-types/:id`, `POST /api/gcal-placeholder-bookings`) will consume these updated functions.

**Implementation Guide:**

*   **Architecture Overview:**
    *   This feature primarily involves backend database schema modifications (PostgreSQL via Prisma ORM) and updates to the core data access logic for `SessionType` entities in Node.js.
    *   **Diagram (Data Flow for `SessionType` Config):**
        ```mermaid
        graph LR
            A[Admin UI (Future)] -- Manages --> B(SessionType Table in DB)
            B -- Prisma Schema Defines --> C{prisma/schema.prisma}
            D[src/core/sessionTypes.js] -- Reads via Prisma Client --> B
            E[BookingFlowManager] -- Uses --> D
            F[API Handlers (e.g., /api/session-types, /api/gcal-placeholder-bookings)] -- Uses --> D
            G[Client Mini-Apps] -- Call --> F
        end
        ```
    *   **Tech Stack:** PostgreSQL, Prisma ORM, Node.js.
    *   **Deployment:** Requires running the Prisma migration as part of the deployment process.

*   **DB Schema (`prisma/schema.prisma`):**
    *   Modify the `SessionType` model:
      ```prisma
      model SessionType {
        id                   String    @id @default(cuid())
        label                String    @unique
        description          String?
        durationMinutes      Int
        price                Float
        active               Boolean   @default(true)
        // ... other existing fields ...

        // New / Enhanced Fields for Dynamic Flows
        waiverType           String    @default("KAMBO_V1")
        allowsGroupInvites   Boolean   @default(false)
        maxGroupSize         Int       @default(1)
        customFormDefinitions Json?    // For future dynamic form sequences

        createdAt            DateTime  @default(now())
        updatedAt            DateTime  @updatedAt

        // ... existing relations ...
        availabilityRules    AvailabilityRule[]
        sessions             Session[]
      }
      ```
    *   Ensure relations to `AvailabilityRule` and `Session` are correctly defined if they interact with these new fields (though primary control for group size now shifts to `SessionType`).

*   **API Design (Impact on Existing APIs):**
    *   **`GET /api/session-types/:id` (Modification):**
        *   The response payload for this endpoint must now include `waiverType`, `allowsGroupInvites`, `maxGroupSize`, and `customFormDefinitions` (if populated).
        *   **Example Success Response (200 OK):**
          ```json
          {
            "success": true,
            "data": {
              "id": "clxkq00000000abcdef1234",
              "label": "Advanced Kambo Ceremony",
              "description": "A 3-hour advanced ceremony.",
              "durationMinutes": 180,
              "price": 250.00,
              "active": true,
              "waiverType": "KAMBO_ADVANCED_V1", // New
              "allowsGroupInvites": true,         // New
              "maxGroupSize": 3,                // New
              "customFormDefinitions": null,      // New
              "createdAt": "2025-01-10T10:00:00.000Z",
              "updatedAt": "2025-05-15T14:30:00.000Z"
            }
          }
          ```
    *   **`POST /api/gcal-placeholder-bookings` (Impact - detailed in Task 29):**
        *   This API handler (or the service it calls) must fetch the `SessionType` using the provided `sessionTypeId`.
        *   It must then include `waiverType`, `allowsGroupInvites`, and `maxGroupSize` in its JSON response to the client (`calendar-app.js`). This data is then passed by the client to `POST /api/booking-flow/start-primary`.

*   **Frontend Structure:**
    *   No direct frontend changes for this task itself, as it's backend-focused.
    *   However, downstream frontend components (`calendar-app.js`, `form-handler.js`, `invite-friends.js`) will consume these new fields from API responses to alter their behavior and display (orchestrated by `BookingFlowManager`).

*   **CRUD Operations (within `src/core/sessionTypes.js` and Admin UI - Future Task 31):**
    *   **Create/Update (Admin):** Future admin interface will allow setting/modifying `waiverType`, `allowsGroupInvites`, `maxGroupSize`, `customFormDefinitions`. Validation rules (e.g., `maxGroupSize >= 1`) should be applied here.
    *   **Read:** `BookingFlowManager` and various API handlers will read these properties using functions from `src/core/sessionTypes.js`.

*   **UX Flow:**
    *   **Admin (Future):** Will have an interface to configure these dynamic flow properties for each session type.
    *   **End User (Client):** Will experience different booking paths based on these settings. For example:
        *   If `SessionType.waiverType` is "NONE", the waiver step is skipped.
        *   If `SessionType.allowsGroupInvites` is `true` and `maxGroupSize` > 1, the option to invite friends appears after their own booking/waiver is complete.

*   **Security:**
    *   Access to modify `SessionType` records (via future Admin UI or direct DB access) must be strictly controlled (admin role only).
    *   Input validation for `maxGroupSize` (e.g., must be a positive integer).
    *   If `customFormDefinitions` is implemented, ensure proper sanitization and validation of the JSON structure to prevent injection or parsing issues.

*   **Testing:**
    *   **Unit Tests:**
        *   Test the Prisma migration: ensure it applies correctly, adds new fields with correct defaults, and doesn't break existing data.
        *   Test updated functions in `src/core/sessionTypes.js` (e.g., `getById`) to verify they correctly retrieve and return the new fields (`waiverType`, `allowsGroupInvites`, `maxGroupSize`, `customFormDefinitions`).
        *   Test any new validation logic added to `SessionType` creation/update (e.g., in seed scripts or future admin logic).
    *   **Integration Tests:**
        *   Verify that `GET /api/session-types/:id` returns the new fields in its response.
        *   Verify that `POST /api/gcal-placeholder-bookings` correctly fetches and includes these new `SessionType` fields in its response.
        *   Test seed data updates: ensure `SessionType` records are populated correctly with the new fields.
    *   **E2E Tests (as part of overall flow testing in Task 30):**
        *   Test full booking flows for `SessionType`s with different combinations of `waiverType`, `allowsGroupInvites`, and `maxGroupSize` to ensure the `BookingFlowManager` and frontend components react dynamically as expected.

*   **Data Management:**
    *   **Existing `SessionType` Records:** The Prisma migration with `@default` attributes will handle new fields for existing records. If more specific initial values are needed for existing records beyond the schema defaults, a custom data migration step within the Prisma migration file or an update to the seed script (if it's re-runnable and idempotent) would be necessary.
    *   **Caching:** If `src/core/sessionTypes.js` implements caching for `SessionType` data, ensure this cache is properly invalidated or updated when `SessionType` records are changed (relevant for future Admin UI).

*   **Logging & Error Handling:**
    *   Log any issues during the Prisma migration process.
    *   Log any errors encountered in `src/core/sessionTypes.js` when fetching or processing `SessionType` data.
    *   The `BookingFlowManager` should log the `SessionType` configuration it's using for a given flow to aid in debugging.
    *   Handle cases gracefully where these fields might be unexpectedly null or invalid if data integrity issues arise (though schema defaults and validation should minimize this).

**Data Flow Steps (Focus on `SessionType` data usage):**
1.  Admin (future) configures `waiverType`, `allowsGroupInvites`, `maxGroupSize` for a `SessionType` via an admin interface.
2.  Data is saved to the `SessionType` table in the database.
3.  User selects a session in `calendar-app.html`.
4.  `calendar-app.js` calls `POST /api/gcal-placeholder-bookings`.
5.  The handler for `/api/gcal-placeholder-bookings` calls `src/core/sessionTypes.js` to get the full `SessionType` details (including new fields) for the selected `sessionTypeId`.
6.  `/api/gcal-placeholder-bookings` returns these `SessionType` details (waiverType, allowsGroupInvites, maxGroupSize) along with `placeholderId` to `calendar-app.js`.
7.  `calendar-app.js` calls `POST /api/booking-flow/start-primary` with these `SessionType` details.
8.  `BookingFlowManager` (via `bookingFlowApiHandler.js`) uses these details (and potentially re-fetches from `src/core/sessionTypes.js` for canonical data) to determine the first step of the booking flow (e.g., redirect to waiver, invite friends, or complete).
9.  Throughout the flow, `BookingFlowManager` refers to these `SessionType` properties to make decisions.

**Key Edge Cases:**
*   A `SessionType` record is somehow missing values for the new fields (should be prevented by `@default` in schema or migration defaults). The application logic (e.g., in `BookingFlowManager`) should have safe fallbacks or throw clear errors.
*   `maxGroupSize` is set to a value like 0 or less than 1 (should be prevented by validation in admin UI/seed scripts).
*   `waiverType` refers to a form/type that doesn't exist or isn't implemented yet (relevant for future custom forms).

---
### Feature 4 (Task 20): Refactor Calendar App for Orchestrated Flow
**(Adapts Original: DF-2, parts of PH6-15 from `Details_Phase_6_updated.md`)**

**Goal:**
Modify the Calendar Mini-App ([`public/calendar-app.html`](public/calendar-app.html:0), [`public/calendar-app.js`](public/calendar-app.js:0)) so that upon slot submission, it first secures a GCal placeholder and then initiates the booking process via the `BookingFlowManager` API. The `BookingFlowManager` will then dictate the next step (e.g., redirect to a form or another page).

**API Relationships:**
*   **Calls (Client-side in `public/calendar-api.js`):**
    1.  `POST /api/gcal-placeholder-bookings` (Existing/Modified by Task 29 / Original DF-1):
        *   Input: `{ telegramId, sessionTypeId, appointmentDateTimeISO }`
        *   Expected Output: `{ success, placeholderId, expiresAt, sessionTypeDetails: { waiverType, allowsGroupInvites, maxGroupSize, sessionTypeId, appointmentDateTimeISO } }` (Note: `sessionTypeDetails` is crucial here).
    2.  `POST /api/booking-flow/start-primary` (New from Task 18):
        *   Input: `{ telegramId, sessionTypeId, appointmentDateTimeISO, placeholderId, initialSessionTypeDetails: { ... } }` (where `initialSessionTypeDetails` comes from the response of the placeholder API).
        *   Expected Output: `{ success, flowToken, nextStep: { type, url?, message?, closeWebApp? } }`

**Detailed Requirements:**

*   **Requirement A (GCal Placeholder API Call Enhancement):**
    *   In [`public/calendar-app.js`](public/calendar-app.js:0), when the user clicks the `submitBookingButton` (and after client-side validation like `isStillAvailable`):
        *   The first backend call will be to `POST /api/gcal-placeholder-bookings`.
        *   The JavaScript in [`public/calendar-api.js`](public/calendar-api.js:0) needs to correctly make this call and parse the response.
        *   **Crucially, the response from this API must now include the `sessionTypeDetails` (`waiverType`, `allowsGroupInvites`, `maxGroupSize`) in addition to `placeholderId` and `expiresAt`.** This is because these details are needed for the subsequent call to the `BookingFlowManager`.
    *   Display a loading state on the submit button (e.g., "Reserving slot...").
*   **Requirement B (Initiate Flow via `BookingFlowManager`):**
    *   Upon successful response from `POST /api/gcal-placeholder-bookings` (containing `placeholderId` and `sessionTypeDetails`):
        *   [`public/calendar-app.js`](public/calendar-app.js:0) (via [`public/calendar-api.js`](public/calendar-api.js:0)) must immediately call the new `POST /api/booking-flow/start-primary` endpoint.
        *   Pass `telegramId`, `sessionTypeId` (from initial selection), `appointmentDateTimeISO` (selected slot), the received `placeholderId`, and the `initialSessionTypeDetails` (received from the placeholder API response) to this `/start-primary` API.
    *   Update loading state (e.g., "Preparing your booking...").
*   **Requirement C (Handle `BookingFlowManager` Response & Redirect):**
    *   The JavaScript in [`public/calendar-app.js`](public/calendar-app.js:0) must handle the response from `POST /api/booking-flow/start-primary`.
    *   If `response.success` is true:
        *   If `response.nextStep.type === "REDIRECT"`:
            *   Construct the full redirect URL (e.g., `https://yourdomain.com` + `response.nextStep.url`). The `url` from the API will likely be a relative path like `/form-handler.html?flowToken=xxx...`.
            *   Perform `window.location.href = constructedUrl;`.
        *   If `response.nextStep.type === "COMPLETE"`:
            *   Display `response.nextStep.message` directly within [`public/calendar-app.html`](public/calendar-app.html:0).
            *   If `response.nextStep.closeWebApp` is true, call `window.Telegram.WebApp.close()` after a short delay.
*   **Requirement D (Error Handling):**
    *   If `POST /api/gcal-placeholder-bookings` fails: Display an error message (e.g., "Could not reserve the slot. The time may have just been taken. Please try again.") and re-enable the submit button.
    *   If `POST /api/booking-flow/start-primary` fails:
        *   Display an error message (e.g., "Could not initiate the booking process. Please try again.").
        *   Re-enable the submit button.
        *   **Important:** Consider automatically calling `DELETE /api/gcal-placeholder-bookings/{placeholderId}` to release the placeholder if the flow initiation fails immediately after creating it. This prevents orphaned placeholders.
*   **Requirement E (UI/UX):**
    *   Maintain clear loading indicators during the two-step API call process.
    *   Ensure error messages are user-friendly.
    *   The calendar app's primary responsibility becomes slot selection and handing off to the backend orchestrator.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Client-side modifications primarily in [`public/calendar-app.js`](public/calendar-app.js:0) and its API helper [`public/calendar-api.js`](public/calendar-api.js:0).
    *   The calendar app transitions from making a single decision (redirect to waiver) to a two-step backend interaction: 1. Secure placeholder & get config. 2. Start orchestrated flow.
    *   **Diagram (Client-Side Flow in Calendar App):**
        ```mermaid
        sequenceDiagram
            participant User
            participant CalendarAppJS as calendar-app.js
            participant CalendarApiJS as calendar-api.js
            participant PlaceholderAPI as POST /api/gcal-placeholder-bookings
            participant FlowStartAPI as POST /api/booking-flow/start-primary

            User->>CalendarAppJS: Selects slot & Clicks Submit
            CalendarAppJS->>CalendarAppJS: Show loading ("Reserving slot...")
            CalendarAppJS->>+CalendarApiJS: callCreatePlaceholder(data)
            CalendarApiJS->>+PlaceholderAPI: Request placeholder & sessionTypeDetails
            PlaceholderAPI-->>-CalendarApiJS: {placeholderId, sessionTypeDetails, ...}
            CalendarApiJS-->>-CalendarAppJS: Response from PlaceholderAPI
            
            alt Placeholder Success
                CalendarAppJS->>CalendarAppJS: Update loading ("Preparing booking...")
                CalendarAppJS->>+CalendarApiJS: callStartPrimaryFlow(placeholderData, sessionTypeDetails)
                CalendarApiJS->>+FlowStartAPI: Request to start flow
                FlowStartAPI-->>-CalendarApiJS: {flowToken, nextStep: {type, url}}
                CalendarApiJS-->>-CalendarAppJS: Response from FlowStartAPI
                
                alt FlowStart Success & Redirect
                    CalendarAppJS->>User: window.location.href = nextStep.url
                else FlowStart Success & Complete
                    CalendarAppJS->>User: Display completion message
                    CalendarAppJS->>User: Telegram.WebApp.close()
                else FlowStart Error
                    CalendarAppJS->>User: Display error message
                    CalendarAppJS->>CalendarApiJS: callDeletePlaceholder(placeholderId) // Attempt cleanup
                    CalendarApiJS->>PlaceholderAPI: DELETE /api/gcal-placeholder-bookings/{id}
                    CalendarAppJS->>CalendarAppJS: Re-enable submit button
                end
            else Placeholder Error
                CalendarAppJS->>User: Display error ("Slot taken?")
                CalendarAppJS->>CalendarAppJS: Re-enable submit button
            end
        end
        ```
    *   **Tech Stack:** Vanilla JavaScript, HTML, CSS.

*   **DB Schema:**
    *   N/A for client-side. Relies on `SessionType` data being correctly returned by `POST /api/gcal-placeholder-bookings`.

*   **API Design (Consumption):**
    *   [`public/calendar-api.js`](public/calendar-api.js:0) will need:
        *   An updated function for `POST /api/gcal-placeholder-bookings` that correctly parses the enhanced response including `sessionTypeDetails`.
        *   A new function for `POST /api/booking-flow/start-primary`.
        *   (Optional but recommended) A new function for `DELETE /api/gcal-placeholder-bookings/{placeholderId}` for cleanup on error.

*   **Frontend Structure (`public/calendar-app.js`):**
    *   The `submitBookingButton` event listener in `handleSubmitButtonClick` (or similar function) will be significantly refactored.
    *   Remove direct `window.location.href` to `waiver-form.html`.
    *   Implement the two-stage API call logic:
        1.  Call placeholder API.
        2.  On success, call flow start API.
        3.  Handle response from flow start API for redirection or completion.
    *   Store `placeholderId` and `sessionTypeDetails` from the first API call to pass to the second.
    *   **Pseudocode for `handleSubmitButtonClick` in `calendar-app.js`:**
        ```javascript
        // async function handleSubmitButtonClick() {
        //   // ... (existing validations, get selectedTimeSlotISO, telegramId, initialSessionTypeId) ...
        //   submitBookingButton.disabled = true;
        //   showLoadingIndicator("Reserving slot..."); // UI update

        //   try {
        //     const placeholderResponse = await calendarApi.createGCalPlaceholder({
        //       telegramId,
        //       sessionTypeId: initialSessionTypeId,
        //       appointmentDateTimeISO: selectedTimeSlotISO
        //     });

        //     if (!placeholderResponse.success || !placeholderResponse.placeholderId || !placeholderResponse.sessionTypeDetails) {
        //       throw new Error(placeholderResponse.message || "Failed to reserve slot.");
        //     }
            
        //     showLoadingIndicator("Preparing your booking..."); // UI update

        //     const flowStartResponse = await calendarApi.startPrimaryBookingFlow({
        //       telegramId,
        //       sessionTypeId: initialSessionTypeId, // or placeholderResponse.sessionTypeDetails.sessionTypeId
        //       appointmentDateTimeISO: selectedTimeSlotISO, // or placeholderResponse.sessionTypeDetails.appointmentDateTimeISO
        //       placeholderId: placeholderResponse.placeholderId,
        //       initialSessionTypeDetails: placeholderResponse.sessionTypeDetails
        //     });

        //     if (flowStartResponse.success && flowStartResponse.nextStep) {
        //       if (flowStartResponse.nextStep.type === "REDIRECT" && flowStartResponse.nextStep.url) {
        //         window.location.href = flowStartResponse.nextStep.url; // Ensure full URL construction if needed
        //       } else if (flowStartResponse.nextStep.type === "COMPLETE") {
        //         displayCompletionMessage(flowStartResponse.nextStep.message);
        //         if (flowStartResponse.nextStep.closeWebApp) {
        //           setTimeout(() => window.Telegram.WebApp.close(), 3000);
        //         }
        //       } else {
        //         throw new Error("Invalid next step from booking flow.");
        //       }
        //     } else {
        //       // Attempt to clean up placeholder if flow start failed
        //       if (placeholderResponse.placeholderId) {
        //         await calendarApi.deleteGCalPlaceholder(placeholderResponse.placeholderId);
        //       }
        //       throw new Error(flowStartResponse.message || "Failed to start booking process.");
        //     }

        //   } catch (error) {
        //     console.error("Booking submission error:", error);
        //     displayErrorMessage(error.message);
        //     submitBookingButton.disabled = false;
        //     hideLoadingIndicator();
        //   }
        // }
        ```

*   **CRUD Operations:** N/A for client-side.

*   **UX Flow:**
    1.  User selects a date, time, and session type in `calendar-app.html`.
    2.  User clicks "Submit Booking". Button disables, shows "Reserving slot...".
    3.  `calendar-app.js` calls `POST /api/gcal-placeholder-bookings`.
    4.  If successful, button text changes to "Preparing your booking...". `calendar-app.js` calls `POST /api/booking-flow/start-primary`.
    5.  If `BookingFlowManager` responds with a redirect: `calendar-app.js` navigates `window.location.href` to the provided URL (e.g., to `form-handler.html` with `flowToken`).
    6.  If `BookingFlowManager` responds with completion: `calendar-app.js` displays a success message and closes the WebApp.
    7.  If any API call fails: An error message is shown, submit button re-enabled.

*   **Security:**
    *   All API calls must be over HTTPS.
    *   `telegramId` is passed; its validation against an authenticated session is ideal if possible via Telegram WebApp `initData` (though often taken as trusted from client in simple WebApps). The backend `BookingFlowManager` will associate this ID with the `flowToken`.
    *   The `flowToken` received from `/api/booking-flow/start-primary` will be passed in subsequent URLs.

*   **Testing:**
    *   **Unit Tests (`public/calendar-app.js`, `public/calendar-api.js`):**
        *   Mock `fetch` or API call functions in `calendar-api.js`.
        *   Test `handleSubmitButtonClick` (or equivalent) in `calendar-app.js`:
            *   Verify correct parameters are passed to `calendarApi.createGCalPlaceholder`.
            *   Verify correct parameters (including `sessionTypeDetails` from placeholder response) are passed to `calendarApi.startPrimaryBookingFlow`.
            *   Test handling of successful response from `startPrimaryBookingFlow` (correct redirection or completion message).
            *   Test error handling for failures in either API call (error messages displayed, placeholder deletion attempted if flow start fails).
    *   **E2E Tests (as part of overall flow testing in Task 30):**
        *   Full user journey: Select slot in calendar -> verify placeholder created -> verify `BookingFlowManager` initiated -> verify redirection to the correct next step (e.g., waiver form via `form-handler.html`) based on `SessionType` config.
        *   Test scenarios where `POST /api/gcal-placeholder-bookings` fails (e.g., slot conflict).
        *   Test scenarios where `POST /api/booking-flow/start-primary` fails.

*   **Data Management (Client-Side):**
    *   `calendar-app.js` will temporarily hold `placeholderId` and `sessionTypeDetails` between the two API calls.
    *   It will receive and use the `flowToken` in the redirect URL provided by `BookingFlowManager`.

*   **Logging & Error Handling (Client-Side):**
    *   `console.log` API call initiations, parameters, and responses (or errors) during development.
    *   Display user-friendly error messages in a dedicated error area on `calendar-app.html`.
    *   Implement `showLoadingIndicator(message)`, `hideLoadingIndicator()`, `displayErrorMessage(message)`, `displayCompletionMessage(message)` helper functions in `public/calendar-ui.js` or `calendar-app.js`.

**Data Flow Steps (Client-Side Calendar App):**
1.  User submits selected slot in `calendar-app.html`.
2.  `calendar-app.js` gathers `telegramId`, `initialSessionTypeId`, `selectedTimeSlotISO`.
3.  `calendar-app.js` calls `calendarApi.createGCalPlaceholder(...)`.
4.  `calendarApi.js` makes `POST /api/gcal-placeholder-bookings` request.
5.  Backend responds with `{ success, placeholderId, expiresAt, sessionTypeDetails: { waiverType, allowsGroupInvites, maxGroupSize, ... } }`.
6.  `calendar-app.js` receives this response.
7.  If successful, `calendar-app.js` calls `calendarApi.startPrimaryBookingFlow(...)`, passing `telegramId`, `initialSessionTypeId`, `selectedTimeSlotISO`, `placeholderId`, and `sessionTypeDetails`.
8.  `calendarApi.js` makes `POST /api/booking-flow/start-primary` request.
9.  Backend (`BookingFlowManager`) responds with `{ success, flowToken, nextStep: { type, url, ... } }`.
10. `calendar-app.js` receives this response.
11. If `nextStep.type === "REDIRECT"`, `calendar-app.js` performs `window.location.href = nextStep.url`.
12. If `nextStep.type === "COMPLETE"`, `calendar-app.js` shows message and closes WebApp.
13. Error handling at each API call stage.

**Key Edge Cases:**
*   `POST /api/gcal-placeholder-bookings` fails (e.g., slot already taken, GCal API error): Calendar app must show error and allow retry.
*   `POST /api/gcal-placeholder-bookings` succeeds, but subsequent `POST /api/booking-flow/start-primary` fails: Calendar app should attempt to call `DELETE /api/gcal-placeholder-bookings/{placeholderId}` to clean up, then show error and allow retry.
*   Network error during either API call.
*   `BookingFlowManager` returns an unexpected `nextStep.type` or missing `url` for redirect.
*   User closes WebApp between the two API calls (placeholder might be orphaned until cron job cleanup).

---
### Feature 5 (Task 21): Generic Form Handler Mini-App & Service
**(New Task, Replaces specific waiver form logic with a generic handler. Adapts original PH6-16, DF-3 from `Details_Phase_6_updated.md`)**

**Goal:**
Create a new generic mini-app (`public/form-handler.html`) and corresponding JavaScript (`public/form-handler.js`) that can dynamically render and process different forms (initially the Kambo waiver, later potentially others like custom questionnaires) based on instructions and context provided by the `BookingFlowManager` via URL parameters. This makes the form display and submission process more flexible and centralized.

**API Relationships:**
*   **Loaded via redirect from `BookingFlowManager`:** The URL will contain `flowToken`, `formType`, and other necessary context.
*   **Calls (Client-side in `public/form-handler.js`):**
    1.  `GET /api/user-data?telegramId={telegramId}` (Existing, from original PH6-16): To fetch user's registration details for pre-filling.
    2.  `GET /api/session-types/{sessionTypeId}` (Existing, from original PH6-12): To fetch session label for display.
    3.  `GET /api/slot-check?appointmentDateTimeISO=...&sessionTypeId=...&placeholderId=...` (Existing, from Task 29 / Original DF-1): For primary bookers, before submitting the form, to ensure slot validity.
    4.  `DELETE /api/gcal-placeholder-bookings/{googleEventId}` (Existing, from Task 29 / Original DF-1): For primary bookers, if they use the Telegram Back Button before submitting, to release the placeholder.
    5.  `POST /api/booking-flow/continue` (New from Task 18): To submit form data and `flowToken` to the `BookingFlowManager` to process the current step and determine the next.
*   **(Future) `GET /api/forms/definition/:formTypeOrId`:** An optional future API to fetch dynamic form structures if forms become highly configurable beyond the initial hardcoded Kambo waiver.

**Detailed Requirements:**

*   **Requirement A (Mini-App Creation - `public/form-handler.html`, `public/form-handler.js`, `public/form-handler.css`):**
    *   Create the new HTML, JS, and CSS files.
    *   `form-handler.html` will contain the basic layout, including areas for dynamic form content, appointment/session info, user pre-fill sections, hidden fields, and error/loading messages.
    *   `form-handler.js` will contain all client-side logic for parameter parsing, dynamic rendering, API calls, form validation, and submission.
    *   `form-handler.css` will style the page, aiming for consistency with [`public/calendar-app.html`](public/calendar-app.html:0) (dark theme, video background, typography). It can adapt styles from the old [`public/waiver-form.css`](public/waiver-form.css:0).
*   **Requirement B (URL Parameter Parsing):**
    *   `form-handler.js` must parse the following from URL query parameters upon page load:
        *   `flowToken`: The active token for the current booking flow.
        *   `formType`: Identifier for the form to render (e.g., "KAMBO_WAIVER_V1", "KAMBO_WAIVER_FRIEND_V1", "CUSTOM_QUESTIONNAIRE_X").
        *   `telegramId`: Current user's Telegram ID (could be primary booker or friend).
        *   `sessionTypeId`: ID of the session type.
        *   `appointmentDateTimeISO`: ISO string of the appointment.
        *   `placeholderId` (Optional): GCal event ID for primary booker's temporary reservation.
        *   `inviteToken` (Optional): For an invited friend.
        *   `waiverType` (Redundant if `formType` is specific, but could be passed for consistency from `BookingFlowManager`).
        *   `allowsGroupInvites` (Boolean, from `SessionType`).
        *   `maxGroupSize` (Int, from `SessionType`).
        *   `primaryBookerName` (Optional, for friend's flow, to display "Invited by...").
        *   `expiresAt` (Optional, ISO timestamp for placeholder expiry, for primary booker).
*   **Requirement C (Dynamic Form Rendering based on `formType`):**
    *   Initially, for `formType` like "KAMBO_WAIVER_V1" (for primary booker) or "KAMBO_WAIVER_FRIEND_V1" (for friend, might be identical structure but handled differently by backend):
        *   The HTML structure for the Kambo waiver (questions, checkboxes, input fields) will be present in `form-handler.html` (possibly within a template or hidden div).
        *   `form-handler.js` will make this section visible.
        *   Populate hidden input fields: `flowToken`, `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`, `placeholderId` (if present), `inviteToken` (if present).
    *   (Future) If `formType` indicates a custom form, `form-handler.js` could fetch a JSON schema for the form from `GET /api/forms/definition/:formTypeOrId` and dynamically build the form elements. For MVP, focus on the Kambo waiver.
*   **Requirement D (Data Pre-fill & Context Display - Adapting PH6-16):**
    *   Display appointment context: Formatted `appointmentDateTimeISO` and session type label (fetched via `GET /api/session-types/:sessionTypeId`).
    *   Pre-fill user data: Call `GET /api/user-data?telegramId={telegramId}` to fetch and pre-fill `firstName`, `lastName`, `email`, `phone`, `dob`, and emergency contact fields.
    *   If it's a friend's flow (identified by `inviteToken` or specific `formType`), display "Invited by [Primary Booker Name]" if `primaryBookerName` is passed.
*   **Requirement E (Conditional Logic - Primary Booker vs. Friend - Adapting DF-3):**
    *   **If `inviteToken` IS present (Friend's Flow):**
        *   Telegram Back Button: `Telegram.WebApp.BackButton.show()`, `onClick(() => Telegram.WebApp.close())`.
        *   No 15-minute reservation countdown/timer.
        *   No pre-submission slot check (`GET /api/slot-check`).
    *   **If `inviteToken` IS NOT present (Primary Booker's Flow, likely with `placeholderId`):**
        *   Display reservation message: "Your slot is reserved for 15 minutes. Please complete by [expiry time from `expiresAt` param]." (Optional client-side countdown timer).
        *   Telegram Back Button: `Telegram.WebApp.BackButton.show()`. `onClick` should:
            *   Show loading indicator.
            *   If `placeholderId` exists, call `DELETE /api/gcal-placeholder-bookings/{placeholderId}`.
            *   Navigate back to `calendar-app.html` (e.g., `calendar-app.html?telegramId={tgId}&initialSessionTypeId={sId}`).
            *   Close WebApp as a final step or if navigation is problematic.
        *   **Pre-Submission Slot Check:** Before actual form submission, call `GET /api/slot-check` with `appointmentDateTimeISO`, `sessionTypeId`, and `placeholderId`. If slot is "TAKEN" or "UNAVAILABLE", display error and prevent submission.
*   **Requirement F (Client-Side Form Validation):**
    *   Implement robust client-side validation for all required fields, checkboxes, data formats (email, phone, DOB).
    *   Highlight invalid fields, show clear error messages near the fields, and focus on the first invalid field.
*   **Requirement G (Form Submission to `BookingFlowManager`):**
    *   On submit button click:
        1.  Perform client-side validation.
        2.  (If primary booker) Perform pre-submission slot check (Req E).
        3.  Disable submit button, show "Submitting..." spinner.
        4.  Collect all form data, including values from hidden fields (`flowToken`, `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`, `placeholderId?`, `inviteToken?`, and all waiver answers structured as `liability_form_data` JSON blob).
        5.  Submit this payload to `POST /api/booking-flow/continue` with `stepId: "waiver_submission"` (or a `formType`-specific stepId).
*   **Requirement H (Handle `BookingFlowManager` Response):**
    *   On response from `POST /api/booking-flow/continue`:
        *   If `response.success` is true:
            *   Hide Telegram Back Button: `Telegram.WebApp.BackButton.hide()`.
            *   If `response.nextStep.type === "REDIRECT"`: `window.location.href = response.nextStep.url;`.
            *   If `response.nextStep.type === "COMPLETE"`: Display `response.nextStep.message`. If `response.nextStep.closeWebApp` is true, call `Telegram.WebApp.close()` after a delay.
        *   If `response.success` is false: Display API error message (e.g., from `response.message`), re-enable submit button.
*   **Requirement I (Visual Consistency & Styling):**
    *   Adopt the dark theme, video background, Manrope/Noto Sans typography, and button styles from [`public/calendar-app.html`](public/calendar-app.html:0).
    *   Update/adapt [`public/waiver-form.css`](public/waiver-form.css:0) into `public/form-handler.css`.
*   **Requirement J (Refactor/Deprecate Old Waiver Form):**
    *   [`public/waiver-form.html`](public/waiver-form.html:0) and its specific JS (if any outside the HTML) will be deprecated. Its structure and logic are moved into `form-handler.html/js`.

**Implementation Guide:**

*   **Architecture Overview:**
    *   A new client-side mini-app (`form-handler.html` and `form-handler.js`) that acts as a generic container for various forms, initially the Kambo waiver.
    *   It's invoked by redirects from the `BookingFlowManager` and submits data back to the `BookingFlowManager` to continue the flow.
    *   **Diagram (Form Handler Interaction):**
        ```mermaid
        sequenceDiagram
            participant BFM_API as POST /api/booking-flow/start-primary or /start-invite
            participant ClientBrowser as Browser
            participant FormHandlerJS as form-handler.js
            participant UserDataAPI as GET /api/user-data
            participant SessionTypeAPI as GET /api/session-types/:id
            participant SlotCheckAPI as GET /api/slot-check (Primary Booker only)
            participant PlaceholderDelAPI as DELETE /api/gcal-placeholder-bookings/:id (Primary Booker only)
            participant BFM_ContinueAPI as POST /api/booking-flow/continue

            BFM_API-->>ClientBrowser: Redirect to /form-handler.html?flowToken=...&formType=...&context...
            ClientBrowser->>+FormHandlerJS: Loads page, parses URL params
            FormHandlerJS->>FormHandlerJS: Initialize UI (show Kambo waiver structure)
            FormHandlerJS->>+UserDataAPI: Fetch user data
            UserDataAPI-->>-FormHandlerJS: User details
            FormHandlerJS->>+SessionTypeAPI: Fetch session type label
            SessionTypeAPI-->>-FormHandlerJS: Session label
            FormHandlerJS->>FormHandlerJS: Pre-fill form, display context
            FormHandlerJS->>FormHandlerJS: Setup Telegram BackButton (conditional logic)
            FormHandlerJS->>FormHandlerJS: Setup reservation timer (Primary Booker only)
            
            alt Primary Booker clicks Back Button
                FormHandlerJS->>+PlaceholderDelAPI: Release placeholder
                PlaceholderDelAPI-->>-FormHandlerJS: Success/Failure
                FormHandlerJS->>ClientBrowser: Navigate to calendar
            end

            ClientBrowser->>FormHandlerJS: User fills form & Clicks Submit
            FormHandlerJS->>FormHandlerJS: Client-side validation
            alt Primary Booker Flow & Validation OK
                FormHandlerJS->>+SlotCheckAPI: Check slot availability
                SlotCheckAPI-->>-FormHandlerJS: Slot status
                alt Slot Not Available
                    FormHandlerJS->>ClientBrowser: Display error, re-enable submit
                else Slot Available
                    FormHandlerJS->>+BFM_ContinueAPI: Submit flowToken & formData (waiver)
                end
            else Friend Flow & Validation OK
                 FormHandlerJS->>+BFM_ContinueAPI: Submit flowToken & formData (waiver)
            end
            
            BFM_ContinueAPI-->>-FormHandlerJS: {success, nextStep: {type, url?, message?, closeWebApp?}}
            alt Submission Success
                FormHandlerJS->>FormHandlerJS: Hide BackButton
                alt Redirect
                    FormHandlerJS->>ClientBrowser: window.location.href = nextStep.url
                else Complete
                    FormHandlerJS->>ClientBrowser: Display message
                    FormHandlerJS->>ClientBrowser: Telegram.WebApp.close() (if applicable)
                end
            else Submission Error
                FormHandlerJS->>ClientBrowser: Display error, re-enable submit
            end
        end
        ```
    *   **Tech Stack:** HTML, CSS, Vanilla JavaScript.

*   **DB Schema:**
    *   N/A for this client-side feature. It prepares data for APIs that interact with the DB.

*   **API Design (Consumption):**
    *   Consumes APIs listed above. `form-handler.js` will need robust functions to call these APIs and handle their responses/errors.

*   **Frontend Structure (`public/form-handler.html` & `public/form-handler.js`):**
    *   **`form-handler.html`:**
        *   Main container div.
        *   Video background element.
        *   Div for `appointmentInfo` (session type, date/time).
        *   Div for `guestNotice` (e.g., "Invited by...").
        *   Div for `reservationTimer` (for primary booker).
        *   `<form id="genericForm">`
            *   Hidden fields: `flowToken`, `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`, `placeholderId`, `inviteToken`.
            *   Div for Kambo Waiver content (`id="kamboWaiverSection"`, initially hidden or templated). This will contain all input fields, checkboxes, textareas from the original [`public/waiver-form.html`](public/waiver-form.html:0).
            *   (Future) Placeholder div for other dynamically loaded forms.
            *   Submit button.
        *   Error message display area.
        *   Loading spinner element.
    *   **`form-handler.js`:**
        *   `onPageLoad()` or `DOMContentLoaded` listener:
            *   Call `parseUrlParameters()`.
            *   Call `initializeStaticContent()` (appointment info, session type label by fetching from APIs).
            *   Call `initializeDynamicForm(formType)`:
                *   If `formType` is "KAMBO_WAIVER_V1" or similar, show the Kambo waiver section.
                *   Call `prefillUserData(telegramIdFromUrl)`.
            *   Call `setupConditionalUI()` (Telegram Back Button, reservation timer based on primary/friend flow).
        *   `parseUrlParameters()`: Extracts all necessary params from `window.location.search`.
        *   `initializeStaticContent()`: Fetches session type label, formats date/time.
        *   `initializeDynamicForm(formType)`: Renders the specified form (for MVP, makes Kambo waiver visible).
        *   `prefillUserData(telegramId)`: Calls `GET /api/user-data` and populates form fields.
        *   `setupConditionalUI()`: Implements logic from Req E.
        *   `handleFormSubmit(event)`:
            *   Prevents default submission.
            *   Performs client-side validation.
            *   If primary booker, calls `checkSlotAvailability()`.
            *   If all checks pass, collects form data (including hidden fields and structuring waiver answers into `liability_form_data` JSON).
            *   Calls API `POST /api/booking-flow/continue`.
            *   Handles response (redirect, complete, error).
        *   `checkSlotAvailability()`: Calls `GET /api/slot-check`.
        *   `handleBackButtonPrimaryBooker()`: Calls `DELETE /api/gcal-placeholder-bookings` and navigates.
        *   Helper functions for DOM manipulation, showing/hiding loaders, displaying errors (similar to original `waiver-form.js` or `calendar-ui.js`).

*   **CRUD Operations:** N/A for client-side. Prepares data for backend CRUD.

*   **UX Flow:**
    *   User is redirected to `form-handler.html` by `BookingFlowManager`.
    *   Page loads, displays loading indicator.
    *   Relevant form (Kambo waiver) and context (session details, pre-filled user info) are rendered.
    *   Conditional UI elements (timer, back button behavior) are set up.
    *   User fills the form. Client-side validation provides immediate feedback.
    *   User clicks submit. Loading indicator on button.
        *   (Primary Booker) Pre-submission slot check occurs.
    *   Form data sent to `POST /api/booking-flow/continue`.
    *   Based on response, user is redirected, sees a completion message (and WebApp closes), or sees an error.

*   **Security:**
    *   All API calls over HTTPS.
    *   Input sanitization is primarily a backend concern, but client-side validation helps UX.
    *   `flowToken` is received from a trusted redirect (from `BookingFlowManager`) and passed back.
    *   Be mindful of not exposing sensitive data in URL parameters beyond necessary identifiers.

*   **Testing:**
    *   **Unit Tests (`public/form-handler.js`):**
        *   Test `parseUrlParameters()` with various URL inputs.
        *   Mock API calls (`/api/user-data`, `/api/session-types`, `/api/slot-check`, `/api/booking-flow/continue`).
        *   Test `initializeDynamicForm()` for rendering Kambo waiver.
        *   Test `prefillUserData()` DOM updates.
        *   Test `setupConditionalUI()` for correct Back Button and timer behavior based on params.
        *   Test `handleFormSubmit()`: client validation, conditional slot check, correct payload construction for `POST /api/booking-flow/continue`, response handling (redirect, complete, error).
    *   **E2E Tests (as part of overall flow testing in Task 30):**
        *   Scenario: Primary booker redirected to `form-handler.html` for waiver.
            *   Verify correct pre-fill, timer, back button behavior.
            *   Submit valid waiver -> verify flow continues (e.g., to invite-friends).
            *   Submit invalid waiver -> verify client-side errors.
            *   Test slot becoming unavailable before submission.
        *   Scenario: Invited friend redirected to `form-handler.html` for waiver.
            *   Verify correct pre-fill, no timer, specific back button behavior.
            *   Submit valid waiver -> verify flow completes for friend.

*   **Data Management (Client-Side):**
    *   State primarily managed by URL parameters and DOM values.
    *   No complex client-side storage beyond what's needed for form interaction.

*   **Logging & Error Handling (Client-Side):**
    *   `console.log` for debugging API calls, parameter parsing, form data.
    *   User-facing errors displayed in a dedicated error area or via alerts.
    *   Clear loading states during API calls and submissions.

**Data Flow Steps (Client-Side Form Handler):**
1.  `form-handler.html` loads with URL parameters (`flowToken`, `formType`, context IDs).
2.  `form-handler.js` parses params.
3.  JS fetches user data and session type label, pre-fills form, displays context.
4.  JS sets up conditional UI (Back button, timer for primary booker).
5.  User fills form.
6.  User clicks submit.
7.  JS validates form.
8.  (Primary Booker) JS calls `GET /api/slot-check`. If slot unavailable, shows error.
9.  JS collects all form data (including hidden `flowToken`) into a payload.
10. JS calls `POST /api/booking-flow/continue` with payload.
11. JS handles response: redirects to `nextStep.url`, shows `nextStep.message` and closes, or displays error.

**Key Edge Cases:**
*   Missing or invalid critical URL parameters (`flowToken`, `formType`, `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`): Page should show a clear error and not proceed.
*   API for user data or session type details fails: Allow manual entry if pre-fill fails, or show error if context display fails.
*   (Primary Booker) Slot check API fails or returns slot taken: Prevent submission, inform user.
*   (Primary Booker) Placeholder deletion API fails when back button used: Log error, but still navigate back.
*   `POST /api/booking-flow/continue` returns an error: Display message, re-enable form.
*   `formType` specifies a form not yet implemented in `form-handler.html` (for future).

---
### Feature 6 (Task 22): `BookingFlowManager` - Waiver Processing Logic
**(Adapts Original: PH6-17, PH6-30, DF-4 from `Details_Phase_6_updated.md`)**

**Goal:**
Implement the core logic within `BookingFlowManager` (specifically in a method like `processWaiverSubmission` called by `continueFlow` from Task 18) to handle submitted waiver data. This includes distinct paths for primary bookers and invited friends, session creation, Google Calendar event management, notifications, and determining the next step in the flow.

**API Relationships:**
*   This logic is internal to `BookingFlowManager` (`src/core/bookingFlowManager.js`).
*   It's triggered when `POST /api/booking-flow/continue` is called with a `stepId` indicating waiver submission (e.g., "waiver_submission").
*   **Interacts with:**
    *   [`src/core/prisma.js`](src/core/prisma.js:0): To create/update `Session`, `SessionInvite`, `User` records.
    *   [`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0): To create/delete GCal placeholder events, create confirmed GCal events, update event descriptions/titles for friends.
    *   [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0): To send various confirmation and notification messages.
    *   [`src/core/sessionTypes.js`](src/core/sessionTypes.js:80): To re-fetch `SessionType` details if needed (though ideally passed in `initialSessionTypeDetails` or stored in `flowToken` context).
    *   [`src/core/logger.js`](src/core/logger.js:0): For detailed logging.

**Detailed Requirements:**

*   **Requirement A (Data Reception & Flow Context):**
    *   The `processWaiverSubmission` method (or equivalent) within `BookingFlowManager` will receive:
        *   `flowContext`: Parsed data from the `flowToken` (e.g., `userId`, `flowType`, `sessionTypeId`, `appointmentDateTimeISO`, `placeholderId?`, `activeInviteToken?`, `parentSessionId?`).
        *   `formData`: The submitted form data, including `liability_form_data` (JSON blob of waiver answers), and potentially redundant identifiers like `telegramId` (of the submitter), `sessionTypeId`, `appointmentDateTimeISO`, `placeholderId`, `inviteToken`. The manager should prioritize context from `flowToken` but can use `formData` for submitted values.
*   **Requirement B (Conditional Logic - Friend vs. Primary Booker):**
    *   The primary branching logic will be based on `flowContext.flowType` or the presence of `flowContext.activeInviteToken`.
    *   **Path 1: Friend's Waiver Submission (if `flowContext.activeInviteToken` is present):**
        1.  **Validate `activeInviteToken`:** Fetch `SessionInvite` by `activeInviteToken` from DB, including `parentSession` (with its `user` (primary booker), `sessionType`, and `googleEventId`).
            *   If not found, or `SessionInvite.status` is not 'pending' or 'accepted_by_friend' (or other valid pre-waiver states like 'viewed_by_friend' from PH6-26), return an error state to the API handler (e.g., "Invite invalid or already processed").
        2.  **Update `SessionInvite` Record:**
            *   Set `status` to 'waiver_completed_by_friend'.
            *   Set `friendTelegramId` to `formData.telegramId` (the friend's ID from their submission).
            *   Set `friendNameOnWaiver` to `formData.firstName + " " + formData.lastName`.
            *   Store `formData.liability_form_data` into `SessionInvite.friendLiabilityFormData`.
        3.  **Google Calendar Event Update - Description (Original PH6-30):**
            *   If `parentSession.googleEventId` exists:
                *   Fetch the GCal event using `googleCalendarTool.getCalendarEvent()`.
                *   Append `friendNameOnWaiver` to the event's description under a "Guests:" section, ensuring no duplicates.
                *   Call `googleCalendarTool.updateCalendarEventDescription()`. Log errors but consider this non-critical for flow continuation.
        4.  **Google Calendar Event Update - Title (Original PH6-30.5):**
            *   If `parentSession.googleEventId` exists:
                *   Count `SessionInvite` records for `parentSessionId` with `status: 'waiver_completed_by_friend'`.
                *   If this count is 1 (i.e., this is the *first* friend to complete waiver for this session):
                    *   Fetch the GCal event (if not already fetched).
                    *   If its title does not already indicate a group (e.g., not starting with "GROUP - "), construct new title: "GROUP - {Primary Booker Name} & Friend(s) - {SessionType Label}".
                    *   Call `googleCalendarTool.updateCalendarEventSummary()`. Log errors but consider non-critical.
        5.  **Notify Primary Booker (Original PH6-33):**
            *   Use `telegramNotifierTool.sendUserNotification()`: "🎉 Good news! [Friend's Name] has completed their waiver and will be joining your [Session Type Label] session on [Date] at [Time]."
        6.  **Notify Admin (Original PH6-34):**
            *   Use `telegramNotifierTool.sendAdminNotification()`: "➕ INVITED GUEST CONFIRMED: [Friend's Name] (TGID: [Friend's TGID]) has completed waiver for [Primary Booker's Name]'s session on [Date] at [Time] (Invite Token: [Token])."
        7.  **Send Confirmation to Friend (Original PH6-31):**
            *   Use `telegramNotifierTool.sendUserNotification()` to `formData.telegramId`: "✅ Your spot for the Kambo session with [Primary Booker Name] on [Date] at [Time] is confirmed!"
        8.  **Determine Next Step:** Return `{ type: "COMPLETE", message: "Waiver submitted successfully! Your spot is confirmed.", closeWebApp: true }`.
    *   **Path 2: Primary Booker's Waiver Submission (if `flowContext.activeInviteToken` is NOT present):**
        1.  **Handle GCal Placeholder (Original DF-4, if `flowContext.placeholderId` is present):**
            *   Attempt to delete the placeholder GCal event: `googleCalendarTool.deleteCalendarEvent(flowContext.placeholderId)`. Log success or if already gone.
            *   **Final Slot Availability Check (Critical):** Call `googleCalendarTool.isSlotTrulyAvailable(flowContext.appointmentDateTimeISO, sessionType.durationMinutes)`.
            *   If slot is NOT free, return an error state: `{ type: "ERROR", message: "Sorry, the selected slot was taken while you were completing the waiver. Please return to the calendar and choose a new time." }`. Do NOT proceed.
        2.  **If no `placeholderId` (direct flow or placeholder already handled/checked by client - less ideal for atomicity but possible):** Still perform a final slot availability check before creating the confirmed event.
        3.  **Create `Session` Record (Original PH6-17, Req C):**
            *   `telegram_id`: `flowContext.userId` (primary booker's Telegram ID).
            *   `session_type_id_fk`: `flowContext.sessionTypeId`.
            *   `appointment_datetime`: `flowContext.appointmentDateTimeISO` (ensure UTC).
            *   `status`: 'CONFIRMED'.
            *   `liability_form_data`: `formData.liability_form_data`.
            *   Save to DB. Get the new `Session.id`.
        4.  **Create Confirmed Google Calendar Event (Original PH6-17, Req D):**
            *   Call `googleCalendarTool.createCalendarEvent()` with details: start/end times (derived from `appointmentDateTimeISO` and `sessionType.durationMinutes`), summary (e.g., `Client ${formData.firstName} ${formData.lastName} - ${sessionType.label}`), description.
            *   Store the returned `googleEventId` on the newly created `Session` record and save.
        5.  **Update Bot Message for Primary Booker (Original PH6-17, Req E & PH6-24):**
            *   Fetch `user.edit_msg_id` for `flowContext.userId`.
            *   Construct confirmation message: Frog picture, "✅ Your {SessionTypeLabel} session is confirmed for {Formatted Date & Time}!".
            *   Retrieve `SessionType.allowsGroupInvites` and `SessionType.maxGroupSize` (from `flowContext.initialSessionTypeDetails` or re-fetch).
            *   If `allowsGroupInvites` is true and `maxGroupSize > 1` (and global invite feature enabled):
                *   Construct WebApp URL for `invite-friends.html?sessionId={newSession.id}&telegramId={flowContext.userId}&maxGroupSize={maxGroupSize}`.
                *   Add "Invite Friends" inline button to the confirmation message.
            *   Use `telegramNotifierTool.editMessageText()` (or photo equivalent) to update the bot message.
        6.  **Clear `edit_msg_id` (Original PH6-17, Req F):** Update `User` record, set `edit_msg_id = null`.
        7.  **Notify Admin (Original PH6-17, Req G):**
            *   Use `telegramNotifierTool.sendAdminNotification()`: "CONFIRMED BOOKING: Client {Name} (TGID: {id}) for {Type} on {Date} at {Time}. Waiver submitted."
        8.  **Determine Next Step:**
            *   If invites are allowed (as per above check): Return `{ type: "REDIRECT", url: "/invite-friends.html?sessionId={newSession.id}&telegramId={flowContext.userId}&maxGroupSize={maxGroupSize}&flowToken={newOrSameFlowToken}" }`.
            *   Else: Return `{ type: "COMPLETE", message: "Booking Confirmed! You'll receive a message from the bot.", closeWebApp: true }`.
*   **Requirement C (Atomicity & Error Handling):**
    *   Log all significant operations and their outcomes.
    *   For primary booker flow: If `Session` creation succeeds but GCal event creation fails, log critical error, notify admin. The session is booked in DB but not on calendar. (Consider a retry mechanism or manual intervention process).
    *   For friend flow: If `SessionInvite` update succeeds but GCal/notifications fail, these are generally less critical but should be logged. The friend is confirmed in the system.
    *   Return clear error states/messages to the API handler if any unrecoverable part of the process fails.

**Implementation Guide:**

*   **Architecture Overview:**
    *   This logic resides within `src/core/bookingFlowManager.js`. It will likely be a complex method or set of private helper methods.
    *   It's crucial for this module to be well-tested due to its centrality and the number of integrations.
    *   **Diagram (Waiver Processing within BFM):**
        ```mermaid
        classDiagram
        BookingFlowManager --|> SessionTypeCore : Uses
        BookingFlowManager --|> PrismaClient : Uses
        BookingFlowManager --|> GoogleCalendarTool : Uses
        BookingFlowManager --|> TelegramNotifierTool : Uses
        
        class BookingFlowManager {
          +processWaiverSubmission(flowContext, formData) : NextStepResult
          - _processPrimaryBookerWaiver(flowContext, formData)
          - _processFriendWaiver(flowContext, formData)
          - _createSessionInDb(data)
          - _createGCalEventForSession(session, sessionType)
          - _updateGCalForFriend(parentSession, friendDetails)
          - _sendNotifications(type, context)
          - _determineNextStepForPrimary(session, sessionType)
          - _determineNextStepForFriend()
        }
        ```
    *   **Tech Stack:** Node.js, JavaScript.

*   **DB Schema:**
    *   Relies on `Session`, `SessionInvite`, `User`, `SessionType` models.
    *   Ensure `SessionInvite` has `friendLiabilityFormData: Json?` (Migration from Task 23).
    *   `Session` needs `googleEventId: String?`.

*   **API Design:**
    *   This module is called by `POST /api/booking-flow/continue`. The `NextStepResult` it returns dictates the API response.

*   **Frontend Structure:** N/A.

*   **CRUD Operations (Orchestrated by BFM):**
    *   **Primary Booker Path:**
        *   DELETE GCal placeholder (if `placeholderId` present).
        *   CREATE `Session` record.
        *   CREATE GCal confirmed event.
        *   UPDATE `Session` record with `googleEventId`.
        *   UPDATE `User` record to clear `edit_msg_id`.
    *   **Friend Path:**
        *   READ `SessionInvite` and `Session`.
        *   UPDATE `SessionInvite` (status, friend details, waiver data).
        *   UPDATE GCal event (description, potentially title).

*   **UX Flow (Backend perspective, post-form submission):**
    *   `BookingFlowManager` receives waiver data.
    *   **If Friend:** Validates invite, updates `SessionInvite`, updates GCal, sends 3 notifications (to friend, primary, admin), signals completion to friend's WebApp.
    *   **If Primary Booker:** Handles placeholder, checks slot, creates `Session` & GCal event, updates bot message (with conditional invite button), notifies admin, signals redirect to invites or completion to WebApp.

*   **Security:**
    *   Relies on `flowToken` validation performed by the calling API handler or at the beginning of `BookingFlowManager` methods.
    *   All data from `formData` should be treated as untrusted until validated/sanitized, especially `liability_form_data` before storing as JSON.
    *   Ensure GCal and Telegram API calls are made securely.

*   **Testing (Unit tests for `BookingFlowManager` methods):**
    *   **`_processPrimaryBookerWaiver` scenarios:**
        *   With valid placeholder, slot available: Test DB writes, GCal creation, notifications, correct `nextStep` (to invites or complete).
        *   With valid placeholder, slot becomes unavailable: Test error returned, no DB/GCal writes.
        *   Without placeholder, slot available.
        *   SessionType allows invites vs. does not.
    *   **`_processFriendWaiver` scenarios:**
        *   Valid invite token: Test `SessionInvite` update, GCal description/title updates, all 3 notifications.
        *   Invalid/used invite token: Test error returned.
        *   First friend vs. subsequent friend for GCal title update.
    *   Mock Prisma calls to simulate DB responses (success, failure, data found/not found).
    *   Mock `googleCalendarTool` methods to simulate GCal responses.
    *   Mock `telegramNotifierTool` methods to verify correct notifications are attempted.

*   **Data Management:**
    *   All critical state (Sessions, Invites) is persisted in PostgreSQL via Prisma.
    *   `liability_form_data` (JSON) stored on `Session` for primary booker, and `friendLiabilityFormData` (JSON) on `SessionInvite` for friends.

*   **Logging & Error Handling:**
    *   Log each major step within the processing logic (e.g., "Attempting to delete placeholder X", "Creating Session for user Y", "Updating GCal event Z for friend").
    *   Log contents of `flowContext` and key parts of `formData` (excluding full PII in general logs if possible).
    *   If a multi-step operation fails midway (e.g., DB write OK, GCal fails), log the inconsistency clearly and alert admin if necessary.
    *   Return specific error messages/codes that the API handler can translate for the client.

**Data Flow Steps (Simplified for `processWaiverSubmission`):**
1.  `BookingFlowManager` receives `flowContext` and `formData`.
2.  **If Friend Flow (based on `flowContext.activeInviteToken`):**
    a.  Validate `activeInviteToken` against `SessionInvite` DB.
    b.  Update `SessionInvite` with `formData` (status, name, waiver data).
    c.  Update GCal event description/title via `googleCalendarTool`.
    d.  Send notifications (friend, primary booker, admin) via `telegramNotifierTool`.
    e.  Return `nextStep` indicating completion.
3.  **If Primary Booker Flow:**
    a.  (If `flowContext.placeholderId`) Delete GCal placeholder via `googleCalendarTool`.
    b.  Perform final slot availability check via `googleCalendarTool`. If unavailable, return error `nextStep`.
    c.  Create `Session` record in DB.
    d.  Create confirmed GCal event via `googleCalendarTool`; update `Session` with `googleEventId`.
    e.  Update primary booker's bot message (confirmation, conditional invite button) via `telegramNotifierTool`.
    f.  Clear `User.edit_msg_id`.
    g.  Send admin notification via `telegramNotifierTool`.
    h.  Determine `nextStep` (redirect to invites or completion) based on `SessionType.allowsGroupInvites`.
4.  Return `nextStep` object.

**Key Edge Cases:**
*   `inviteToken` (for friend) is invalid, expired, or status is not 'pending'/'accepted_by_friend'.
*   `placeholderId` (for primary) is invalid, or event already deleted.
*   Final slot check fails for primary booker (slot taken after placeholder was set).
*   DB transaction failures during `Session` or `SessionInvite` creation/update.
*   GCal API errors during event creation, deletion, or update.
*   Telegram API errors during notification sending.
*   `SessionType` details in `flowContext` are stale or missing critical fields (e.g., `durationMinutes` for GCal).
*   Race condition if primary booker and a friend submit waivers for the "last spot" almost simultaneously (if `maxGroupSize` is tight and not solely managed by invite token availability). The GCal final slot check for primary, and invite token validation for friend, are key.

---
### Feature 7 (Task 23): DB Updates for Invites & Group Size Management
**(Consolidates Original: PH6-18 from `Details_Phase_6_updated.md`)**

**Goal:**
Modify the database schema (`prisma/schema.prisma`) to robustly support the "Invite Friends" functionality. This involves ensuring `SessionType` is the sole determinant for group invite capabilities and maximum group size, removing any conflicting fields from `AvailabilityRule`, and defining the `SessionInvite` table to track individual invitation details and statuses.

**API Relationships:**
*   This feature primarily involves database schema changes and migrations. It does not define new APIs itself.
*   It directly impacts and lays the groundwork for:
    *   `BookingFlowManager` (Feature 1 / Task 17): Which reads `SessionType.allowsGroupInvites` and `SessionType.maxGroupSize`.
    *   APIs that create, read, and update `SessionInvite` records (e.g., `POST /api/sessions/:sessionId/generate-invite-token` from Task 24 / Original PH6-22, and various steps within `BookingFlowManager` that update invite statuses).
    *   APIs that read session context for invites (e.g., `GET /api/sessions/:sessionId/invite-context` from Task 24 / Original PH6-20).

**Detailed Requirements:**

*   **Requirement A (`SessionType` Model Update - Reiterated from Task 19 / PH6-11.5):**
    *   Ensure the `SessionType` model in `prisma/schema.prisma` correctly includes:
        *   `allowsGroupInvites`: `Boolean @default(false)`
        *   `maxGroupSize`: `Int @default(1)` (Total participants including primary booker. Number of friends = `maxGroupSize - 1`).
    *   These fields are the single source of truth for group invite capabilities and size limits.
*   **Requirement B (`AvailabilityRule` Model Update - Removal of Conflicting Fields):**
    *   If fields like `max_group_invites` or `max_group_size_override` (or any similar fields intended to control group size/invites) exist on the `AvailabilityRule` model in `prisma/schema.prisma`, they **must be removed**.
    *   This centralizes group size control entirely within the `SessionType` model.
*   **Requirement C (`SessionInvite` Model Creation):**
    *   Define a new model `SessionInvite` in `prisma/schema.prisma`.
    *   **Fields:**
        *   `id`: `String @id @default(cuid())` (Primary Key)
        *   `parentSessionId`: `Int` (Foreign Key to `Session.id`)
        *   `parentSession`: `Session @relation(fields: [parentSessionId], references: [id], onDelete: Cascade)` (Relation to parent `Session`)
        *   `inviteToken`: `String @unique` (Secure, unique token for the invite link)
        *   `status`: `String @default("pending")` (Enum-like: "pending", "viewed_by_friend", "accepted_by_friend", "declined_by_friend", "waiver_completed_by_friend", "expired")
        *   `friendTelegramId`: `BigInt?` (Telegram ID of the friend who uses/accepts the invite, optional until claimed)
        *   `friendNameOnWaiver`: `String?` (Name of the friend as entered on their waiver)
        *   `friendLiabilityFormData`: `Json?` (Stores the friend's submitted waiver data, if different from primary or needs separate tracking)
        *   `createdAt`: `DateTime @default(now())`
        *   `updatedAt`: `DateTime @updatedAt`
    *   **Indexes & Constraints:**
        *   `@@index([parentSessionId])`
        *   `@@index([inviteToken])` (already unique by `@unique` on field)
        *   `@@unique([parentSessionId, friendTelegramId], name: "unique_friend_per_session")` (Ensures a friend (by TG ID) can only be linked to a specific parent session once via an invite, preventing multiple accepted invites for the same session by the same friend. Null `friendTelegramId`s are not part of this constraint initially).
*   **Requirement D (`Session` Model Update - Relation to `SessionInvite`):**
    *   Add a one-to-many relation from the `Session` model to `SessionInvite`:
        *   `invites`: `SessionInvite[]`
*   **Requirement E (Database Migration):**
    *   Generate a new Prisma migration: `npx prisma migrate dev --name update_invites_db_structure_final` (or a suitable unique name).
    *   This migration will:
        *   Create the `SessionInvite` table with all specified fields, indexes, and constraints.
        *   Remove the specified group size/invite fields from the `AvailabilityRule` table if they exist.
        *   Add the `invites` relation field to the `Session` table.
        *   (Verify changes to `SessionType` from Task 19 are included if this migration is combined or run sequentially).
*   **Requirement F (Seed Data Update):**
    *   Review and update `prisma/seed.js` (if it exists):
        *   Ensure `SessionType` records are seeded with appropriate `allowsGroupInvites` and `maxGroupSize` values.
        *   Remove any logic that attempts to seed data for the removed fields in `AvailabilityRule`.
        *   Optionally, seed some example `SessionInvite` records for testing purposes if linked to existing seeded `Session`s.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Purely database-centric changes, managed via Prisma ORM.
    *   These schema changes are fundamental for the entire "Invite Friends" feature set and dynamic flow management.
    *   **Diagram (ERD Snippet - Key Relationships):**
        ```mermaid
        erDiagram
            SessionType {
                String id PK
                Boolean allowsGroupInvites
                Int maxGroupSize
                // ... other fields
            }
            Session {
                Int id PK
                String sessionTypeId FK
                // ... other fields
            }
            SessionInvite {
                String id PK
                Int parentSessionId FK
                String inviteToken UK
                String status
                BigInt friendTelegramId "Nullable"
                String friendNameOnWaiver "Nullable"
                Json friendLiabilityFormData "Nullable"
                // ... other fields
            }
            AvailabilityRule {
                String id PK
                // ... other fields (NO group invite/size fields)
            }

            SessionType ||--o{ Session : "has"
            Session ||--o{ SessionInvite : "has"
            SessionType ||--o{ AvailabilityRule : "can have rules" // Existing relationship
        ```
    *   **Tech Stack:** PostgreSQL, Prisma ORM.
    *   **Deployment:** The generated Prisma migration file must be run as part of the deployment pipeline before the application code relying on the new schema is deployed.

*   **DB Schema (`prisma/schema.prisma` - Key Changes):**
    *   **`SessionType` model:** (As detailed in Task 19 and Req A above - ensure `allowsGroupInvites`, `maxGroupSize` are present).
    *   **`AvailabilityRule` model:**
      ```prisma
      model AvailabilityRule {
        // ... existing fields ...
        // REMOVE any fields like:
        // max_group_invites Int?
        // max_group_size_override Int?
      }
      ```
    *   **New `SessionInvite` model:**
      ```prisma
      model SessionInvite {
        id                        String    @id @default(cuid())
        parentSession             Session   @relation(fields: [parentSessionId], references: [id], onDelete: Cascade) // Cascade delete if parent session is deleted
        parentSessionId           Int
        inviteToken               String    @unique
        status                    String    @default("pending") // e.g., pending, viewed, accepted, declined, waiver_completed, expired
        friendTelegramId          BigInt?   // Telegram ID of the friend
        friendNameOnWaiver        String?   // Friend's name from their waiver
        friendLiabilityFormData   Json?     // Friend's waiver data
        createdAt                 DateTime  @default(now())
        updatedAt                 DateTime  @updatedAt

        @@index([parentSessionId])
        // inviteToken is already indexed due to @unique
        @@unique([parentSessionId, friendTelegramId], name: "unique_friend_per_session") // A friend can only accept one invite per session
      }
      ```
    *   **Update `Session` model for relation:**
      ```prisma
      model Session {
        // ... existing fields ...
        id                    Int       @id @default(autoincrement())
        // ...
        invites               SessionInvite[] // One-to-many relation
      }
      ```

*   **API Design:** N/A for this schema-focused task.

*   **Frontend Structure:** N/A for this schema-focused task.

*   **CRUD Operations (Implications for other modules):**
    *   **Create:** New `SessionInvite` records will be created when primary booker generates an invite link (Task 24 / PH6-22).
    *   **Read:** `SessionInvite` records will be read to validate tokens, display statuses, and get friend details. `SessionType.maxGroupSize` will be read to limit invite generation.
    *   **Update:** `SessionInvite.status`, `friendTelegramId`, `friendNameOnWaiver`, `friendLiabilityFormData` will be updated as friends interact with the invite and complete waivers.
    *   **Delete:** `SessionInvite` records are cascade deleted if the parent `Session` is deleted. Individual invite deletion might be a future admin feature.

*   **UX Flow:** N/A directly. These DB changes enable the UX flows defined in other tasks.

*   **Security:**
    *   `inviteToken` must be cryptographically strong and unique (Prisma `@unique` helps enforce DB uniqueness).
    *   `onDelete: Cascade` for `SessionInvite.parentSession` ensures that if a primary booking (`Session`) is deleted, all its associated invites are also cleaned up from the database, preventing orphaned invite records.

*   **Testing:**
    *   **Migration Test:**
        *   Apply the generated migration to a test database (empty and with existing data if applicable).
        *   Verify the `SessionInvite` table is created correctly with all columns, types, defaults, and indexes.
        *   Verify specified fields are removed from `AvailabilityRule`.
        *   Verify the relation is added to `Session`.
        *   Verify no data loss or corruption if migrating an existing database.
    *   **Seed Data Test:** If seed scripts are updated, run them and verify `SessionType` data is correct and no errors occur due to removed `AvailabilityRule` fields.
    *   **Downstream Logic Tests:** Unit and integration tests for modules that interact with these models (e.g., `BookingFlowManager`, API handlers for invites) will need to be updated/created to reflect the new schema (covered in their respective tasks, e.g., Task 30). For example, any code that previously read group size from `AvailabilityRule` must now read from `SessionType`.

*   **Data Management:**
    *   **Data Integrity:** The `@@unique` constraint on `[parentSessionId, friendTelegramId]` is important for preventing a single friend from consuming multiple invite "slots" for the same session.
    *   **Default Values:** `@default("pending")` for `status` and `@default(now())` for `createdAt` ensure these fields are populated correctly on new `SessionInvite` creation.

*   **Logging & Error Handling:**
    *   Prisma migration process itself has logging.
    *   Application-level logging for operations involving these tables will be handled by the modules performing those operations.

**Data Flow Steps (Schema Change Context):**
1.  Developer defines schema changes in `prisma/schema.prisma`.
2.  Developer runs `npx prisma migrate dev --name ...` to generate SQL migration file.
3.  Prisma CLI applies the migration to the development database.
4.  During deployment, the migration is applied to staging/production databases.
5.  Application code (e.g., `BookingFlowManager`, API handlers) interacts with the database using the new/updated schema via Prisma Client.

**Key Edge Cases:**
*   **Migration Failure:** Prisma's migration system typically handles rollbacks on failure during development. For production, careful review and backup strategies are essential.
*   **Existing Data in `AvailabilityRule`:** If `max_group_invites` fields in `AvailabilityRule` contained important data that needs to be preserved or migrated to `SessionType` (though the plan is to make `SessionType` the sole source), a custom data migration script might be needed *before* removing the fields. However, the current plan implies these fields are being deprecated in favor of `SessionType` controls.
*   **Impact on existing queries:** Any raw SQL queries or Prisma queries that specifically targeted the removed fields in `AvailabilityRule` will fail and need updating.

---
### Feature 8 (Task 24): Refactor `invite-friends.html` for Orchestrated Flow
**(Adapts Original: PH6-20, PH6-21, PH6-22, PH6-23, PH6-25, PH6-32 from `Details_Phase_6_updated.md`)**

**Goal:**
Modify the `public/invite-friends.html` Mini-App and its JavaScript (`public/invite-friends.js`). This page is typically reached after a primary booker completes their own booking/waiver process for a session type that allows group invites, often via a redirect from the `BookingFlowManager`. The page will allow the primary booker to view session details, see how many friends they can invite, generate unique invite links/tokens, copy/share these links, and see the status of already sent invites.

**API Relationships:**
*   **Loaded via redirect from `BookingFlowManager` or bot button:** URL will contain `sessionId` and `telegramId` (primary booker's). May also contain `flowToken` if this step is part of a larger managed flow that needs to be continued.
*   **Calls (Client-side in `public/invite-friends.js`):**
    1.  `GET /api/sessions/:sessionId/invite-context?telegramId={telegramId}` (Existing, Original PH6-20): To fetch initial data: `maxInvites` (derived from `SessionType.maxGroupSize`), session details (type label, formatted time), and `existingInvites` (list of tokens, statuses, friend names).
    2.  `POST /api/sessions/:sessionId/generate-invite-token` (Existing, Original PH6-22):
        *   Input: `{ "telegramId": "primaryBookerTelegramId" }`
        *   Output: `{ success: true, data: { newSessionInviteObject } }`
        *   Called when the primary booker clicks "Generate New Invite Link".

**Detailed Requirements:**

*   **Requirement A (Parameter Parsing):**
    *   `public/invite-friends.js` must parse `sessionId` and `telegramId` (primary booker's ID) from the URL query parameters.
    *   It should also parse an optional `flowToken` if present (for potential future "Done" button functionality to continue a flow).
*   **Requirement B (Initial Data Fetch & Display - Adapting PH6-21):**
    *   On page load, call `GET /api/sessions/:sessionId/invite-context` using the parsed `sessionId` and `telegramId`.
    *   Display a loading state while fetching.
    *   On successful response:
        *   Display session details: Session type label and formatted appointment time.
        *   Calculate and display the number of remaining invites: `maxInvitesFromApi - existingInvites.length`. (e.g., "You can invite X more friends."). `maxInvitesFromApi` is `SessionType.maxGroupSize - 1`.
        *   List existing invites (`existingInvites` array from API):
            *   For each invite, display its status (e.g., "Pending", "Waiver Completed by [Friend Name]", "Declined").
            *   Display the shareable invite link/token (e.g., `https://t.me/YOUR_BOT_USERNAME?start=invite_{token}`).
            *   Provide "Copy Link" and "Share on Telegram" buttons for each 'pending' or shareable invite (Req E).
        *   If `maxInvitesFromApi` is 0 or all allowed invites have been generated/used, the "Generate Invite Link" button should be disabled or hidden.
*   **Requirement C (Generate New Invite Link - Adapting PH6-22 & PH6-23):**
    *   Provide a "Generate New Invite Link" button (`#generateInviteButton`).
    *   This button should be enabled only if `remainingInvites > 0`.
    *   When clicked:
        1.  Disable the button, show a "Generating..." state.
        2.  Call `POST /api/sessions/:sessionId/generate-invite-token` with the primary booker's `telegramId`.
        3.  On successful API response (containing the new `SessionInvite` object):
            *   Dynamically add the new invite (with status "pending" and its token/link) to the list of existing invites in the DOM.
            *   Decrement the displayed "remaining invites" count.
            *   If the limit is now reached, disable the "Generate Invite Link" button.
            *   Re-enable button (if limit not reached) and reset its text.
        4.  On API failure (e.g., limit actually reached on backend, server error):
            *   Display an appropriate error message.
            *   Re-enable the button (unless the error confirms the limit is reached, in which case keep it disabled).
*   **Requirement D (Copy Link & Share on Telegram - Adapting PH6-25):**
    *   For each displayed invite (especially those with 'pending' status):
        *   **"Copy Link" Button:**
            *   Copies the full shareable invite link (e.g., `https://t.me/YOUR_BOT_USERNAME?start=invite_{token}`) to the clipboard using `navigator.clipboard.writeText()`.
            *   Provide visual feedback (e.g., button text changes to "Copied!" temporarily).
        *   **"Share on Telegram" Button (Optional, if feasible):**
            *   Constructs a Telegram share URL: `https://t.me/share/url?url={encoded_invite_link}&text={encoded_message}`.
            *   `url` is the invite link. `text` is a pre-filled message (e.g., "Join me for a Kambo session!").
            *   Opens in a new tab/Telegram app.
    *   The `BOT_USERNAME` (from `process.env.BOT_USERNAME`) needs to be available to the frontend JavaScript to construct these links. This can be embedded in the HTML via a server-side template, or fetched from a dedicated configuration API endpoint.
*   **Requirement E (Update UI for Friend's Status Change - Adapting PH6-32):**
    *   Implement a mechanism to refresh the displayed statuses of invites.
    *   **Option 1 (Page Focus - Recommended MVP):** When the browser tab/window for `invite-friends.html` regains focus (listen to `visibilitychange` or `focus` events), re-call `GET /api/sessions/:sessionId/invite-context` and re-render the invite list.
    *   **Option 2 (Manual Refresh Button - Good to have):** Add a "Refresh Statuses" button that triggers the API call and re-render.
    *   The re-rendering logic should update statuses (e.g., "Pending" to "Waiver Completed by Jane Doe" or "Declined") and potentially disable copy/share buttons for non-pending invites.
*   **Requirement F (Styling and UX):**
    *   Maintain aesthetic consistency with [`public/calendar-app.html`](public/calendar-app.html:0) (dark theme, video background, Tailwind CSS if used, typography).
    *   Clear visual distinction for different invite statuses.
    *   User-friendly messages for loading, success, errors, and limits.
*   **Requirement G (Error Handling):**
    *   If initial URL parameters (`sessionId`, `telegramId`) are missing, display "Invalid link."
    *   If `GET /api/sessions/:sessionId/invite-context` fails, display "Could not load invite details."
    *   If `POST /api/sessions/:sessionId/generate-invite-token` fails, display specific error (e.g., "Invite limit reached," or "Failed to generate link.").
*   **Requirement H (Closing the Loop - Optional for MVP):**
    *   Consider a "Done" or "Close" button.
    *   If a `flowToken` was passed to this page, clicking "Done" could call `POST /api/booking-flow/continue` with the `flowToken` and a `stepId` like "invite_management_complete". The `BookingFlowManager` could then decide the absolute final step (e.g., just a completion message and close).
    *   For MVP, simply allowing the user to close the WebApp via `Telegram.WebApp.close()` (perhaps after a short "Invites managed!" message) is sufficient if this page is the definitive end of the primary booker's active flow. The Telegram Back button should also just close the WebApp.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Frontend Mini-App: `public/invite-friends.html` with logic in `public/invite-friends.js`.
    *   Relies on backend APIs for data and actions.
    *   **Diagram (Invite Friends Page Flow):**
        ```mermaid
        sequenceDiagram
            participant User (Primary Booker)
            participant InviteFriendsJS as invite-friends.js
            participant InviteContextAPI as GET /api/sessions/:id/invite-context
            participant GenerateTokenAPI as POST /api/sessions/:id/generate-invite-token

            User->>InviteFriendsJS: Page loads (redirect from BFM or bot button)
            InviteFriendsJS->>InviteFriendsJS: Parse URL (sessionId, telegramId)
            InviteFriendsJS->>InviteFriendsJS: Show loading state
            InviteFriendsJS->>+InviteContextAPI: Fetch initial invite data
            InviteContextAPI-->>-InviteFriendsJS: {maxInvites, sessionDetails, existingInvites}
            InviteFriendsJS->>InviteFriendsJS: Hide loading, Render page (session info, remaining invites, existing invites list)
            InviteFriendsJS->>InviteFriendsJS: Enable/disable "Generate" button based on remaining

            alt User clicks "Generate New Invite Link" (if available)
                InviteFriendsJS->>InviteFriendsJS: Disable button, show "Generating..."
                InviteFriendsJS->>+GenerateTokenAPI: Request new token
                GenerateTokenAPI-->>-InviteFriendsJS: {success, data: newInvite} or {success:false, message}
                alt Token Generation Success
                    InviteFriendsJS->>InviteFriendsJS: Add newInvite to DOM list
                    InviteFriendsJS->>InviteFriendsJS: Update remaining invites count
                    InviteFriendsJS->>InviteFriendsJS: Update "Generate" button state
                else Token Generation Error
                    InviteFriendsJS->>User: Display error message
                    InviteFriendsJS->>InviteFriendsJS: Re-enable "Generate" button (if not limit error)
                end
            end

            alt User clicks "Copy Link" for an invite
                InviteFriendsJS->>User: Copy link to clipboard, show feedback
            end
            
            alt User clicks "Share on Telegram" for an invite
                InviteFriendsJS->>User: Open Telegram share URL
            end

            alt Page focus / Manual Refresh
                InviteFriendsJS->>+InviteContextAPI: Re-fetch invite data
                InviteContextAPI-->>-InviteFriendsJS: Updated data
                InviteFriendsJS->>InviteFriendsJS: Re-render invite list with new statuses
            end
        end
        ```
    *   **Tech Stack:** HTML, CSS, Vanilla JavaScript.

*   **DB Schema:** N/A for client-side. Relies on `Session`, `SessionInvite`, `SessionType` schemas being correctly implemented and populated.

*   **API Design (Consumption):**
    *   `public/invite-friends.js` will contain functions to call the two main APIs:
        *   `fetchInviteContext(sessionId, telegramId)`
        *   `generateNewInviteToken(sessionId, telegramId)`

*   **Frontend Structure (`public/invite-friends.html` and `public/invite-friends.js`):**
    *   **`invite-friends.html`:**
        *   Container for session information (`<div id="sessionInfoDisplay"></div>`).
        *   Paragraph for invite summary (`<p id="inviteSummaryText">You can invite <span id="remainingInvitesCount">X</span> more friends.</p>`).
        *   Button to generate new invite (`<button id="generateInviteButton">Generate New Invite Link</button>`).
        *   (Optional) Button to refresh statuses (`<button id="refreshStatusesButton">Refresh Statuses</button>`).
        *   Unordered list for existing invites (`<ul id="existingInvitesListContainer"></ul>`).
            *   Template for an invite list item (e.g., using `data-*` attributes for token, status):
                ```html
                <!-- Example Template (to be cloned by JS) -->
                <li class="invite-item" data-token="unique-token-here" data-status="pending">
                    <span class="invite-link">Link: https://t.me/YourBotName?start=invite_unique-token-here</span>
                    <span class="invite-status">Status: Pending</span>
                    <span class="friend-name"></span> <!-- Populated if friend accepts -->
                    <button class="copy-link-button">Copy Link</button>
                    <button class="share-telegram-button">Share on Telegram</button>
                </li>
                ```
        *   Loading indicator and error message display areas.
        *   Video background element.
        *   Script tag to embed `BOT_USERNAME` (e.g., `window.kamboKlarityConfig = { botUsername: "YourBotName" };`).
    *   **`invite-friends.js`:**
        *   Global variables for `currentSessionId`, `currentTelegramId`, `maxInvitesAllowed`, `botUsername`.
        *   `onPageLoad()`:
            *   Parse URL params. Store them.
            *   Fetch `botUsername` from `window.kamboKlarityConfig`.
            *   Call `loadInviteDataAndRenderPage()`.
            *   Setup event listeners for "Generate Invite", "Refresh Statuses", and event delegation for "Copy Link"/"Share" on `#existingInvitesListContainer`.
            *   Setup 'visibilitychange' or 'focus' event listener for auto-refresh.
        *   `loadInviteDataAndRenderPage()`:
            *   Show loading state.
            *   Calls `fetchInviteContext()`.
            *   On success: calls `renderInvitePage(responseData)`, stores `maxInvitesAllowed`.
            *   On error: calls `displayPageError()`.
            *   Hide loading state.
        *   `fetchInviteContext(sessionId, telegramId)`: Makes `GET` request, returns promise with parsed JSON.
        *   `renderInvitePage(apiData)`:
            *   Populates session info display.
            *   Calculates `remainingInvites = apiData.data.maxInvites - apiData.data.existingInvites.length`.
            *   Updates `#remainingInvitesCount` and summary text.
            *   Clears `#existingInvitesListContainer`.
            *   Iterates `apiData.data.existingInvites`, calling `createInviteListItemDOM(invite)` for each and appending to list.
            *   Calls `updateGenerateInviteButtonState()`.
        *   `createInviteListItemDOM(invite)`: Creates and returns an `<li>` DOM element based on the template, populating token, status, friend name, and share link. Formats status display (e.g., "Accepted by Jane" instead of "waiver_completed_by_friend"). Disables copy/share for non-pending invites if desired.
        *   `updateGenerateInviteButtonState()`: Enables/disables `#generateInviteButton` based on `remainingInvites`.
        *   `handleGenerateInviteClick()`:
            *   Calls `generateNewInviteToken()`.
            *   On success: appends new invite to DOM using `createInviteListItemDOM()`, updates remaining count, updates button state.
            *   On error: displays error.
        *   `generateNewInviteToken(sessionId, telegramId)`: Makes `POST` request, returns promise.
        *   `handleCopyLinkClick(event)`: Gets token from `event.target.closest('.invite-item').dataset.token`, constructs link, uses `navigator.clipboard.writeText()`, shows feedback.
        *   `handleShareTelegramClick(event)`: Similar to copy, constructs share URL, `window.open()`.
        *   `displayPageError(message)`, `displayInlineError(message, targetElement)` functions.

*   **CRUD Operations:** N/A for this client-side feature. It triggers Create (new invite token) and Read (invite context) on the backend.

*   **UX Flow:**
    1.  Primary booker lands on `invite-friends.html`. Page loads initial data.
    2.  Session details, max invites, and any existing invites (with statuses) are displayed.
    3.  If invites are available, "Generate New Invite Link" is enabled.
    4.  User clicks "Generate": new link appears in list, remaining count decrements.
    5.  User clicks "Copy Link": link copied, feedback shown.
    6.  User clicks "Share on Telegram": Telegram app/URL opens.
    7.  If user navigates away and back, or clicks "Refresh", invite statuses update.

*   **Security:**
    *   Relies on backend API authorization (`GET /api/sessions/:sessionId/invite-context` and `POST /api/sessions/:sessionId/generate-invite-token` must ensure requesting `telegramId` is the owner of `sessionId`).
    *   `BOT_USERNAME` exposure on frontend is generally acceptable for constructing `t.me` links.
    *   Clipboard API requires secure context (HTTPS).

*   **Testing:**
    *   **Unit Tests (`public/invite-friends.js`):**
        *   Test URL parsing.
        *   Mock API call functions (`fetchInviteContext`, `generateNewInviteToken`).
        *   Test `renderInvitePage` with various API responses (0 invites, N invites, max invites reached, different statuses).
        *   Test `createInviteListItemDOM` for correct HTML and data attributes.
        *   Test `updateGenerateInviteButtonState` logic.
        *   Test `handleGenerateInviteClick` success and error paths, including UI updates.
        *   Test `handleCopyLinkClick` and `handleShareTelegramClick` for correct link construction and feedback/action.
        *   Test auto-refresh logic (mock focus/visibility events).
    *   **E2E Tests (as part of overall flow testing in Task 30):**
        *   Primary booker completes booking for group-enabled session -> lands on `invite-friends.html`.
        *   Verify initial state (correct session details, max invites).
        *   Generate one or more invite links, verify UI updates.
        *   Generate invites until limit reached, verify button disables.
        *   Copy a link, verify clipboard.
        *   Simulate a friend accepting an invite (backend change), then refresh `invite-friends.html` and verify status update.

*   **Data Management (Client-Side):**
    *   Data primarily fetched on load and on refresh. `maxInvitesAllowed` stored in a JS variable.
    *   DOM is the main "view" of the current state of invites.

*   **Logging & Error Handling (Client-Side):**
    *   `console.log` for API interactions and key state changes during development.
    *   User-facing error messages for API failures or validation issues (e.g., trying to generate when limit reached, though button should be disabled).

**Data Flow Steps (Client-Side `invite-friends.html`):**
1.  Page loads, JS parses `sessionId`, `telegramId`.
2.  JS calls `GET /api/sessions/:sessionId/invite-context`.
3.  API returns `maxInvites`, `sessionDetails`, `existingInvites`.
4.  JS renders this initial state.
5.  User clicks "Generate Invite":
    a.  JS calls `POST /api/sessions/:sessionId/generate-invite-token`.
    b.  API returns new `SessionInvite` object.
    c.  JS updates DOM: adds new invite, decrements remaining count, updates button.
6.  User clicks "Copy Link": JS constructs link, copies to clipboard.
7.  Page focus/refresh: JS re-calls `GET /api/sessions/:sessionId/invite-context`, re-renders list.

**Key Edge Cases:**
*   `maxInvites` is 0: "Generate" button should be disabled from start.
*   API error on initial load: Page shows error, no functionality.
*   API error on token generation: Show error, button state managed correctly.
*   `BOT_USERNAME` not configured/available: Link construction fails.
*   Clipboard API permission issues.
*   Network errors during any API call.

---
### Feature 9 (Task 25): Bot - Handle `/start invite_{token}` Deep Link & Initiate Friend Flow
**(Adapts Original: PH6-26 from `Details_Phase_6_updated.md`)**

**Goal:**
Enable the Telegram bot's `/start` command handler to recognize and process deep links of the format `/start invite_{token}`. When an invited friend clicks such a link, the bot should validate the token by calling the `BookingFlowManager` API, and if valid, present the friend with initial invite details and an option to proceed with the acceptance flow (typically opening a WebApp).

**API Relationships:**
*   **This is a bot command handler, not an API endpoint itself.**
*   **Calls (Bot backend):**
    1.  `GET /api/booking-flow/start-invite/:inviteToken?friend_tg_id={friend_tg_id}` (New API from Task 18):
        *   The bot extracts `inviteToken` from the deep link payload and `friend_tg_id` from `ctx.from.id`.
        *   This API call validates the token and initializes the friend's acceptance flow within the `BookingFlowManager`.
        *   Expected Output: `{ success, flowToken, nextStep: { type, url, ... }, inviteDetails: { primaryBookerName, sessionTypeLabel, appointmentTimeFormatted, ... } }`
*   **Interacts with (Bot backend):**
    *   [`src/core/prisma.js`](src/core/prisma.js:0) (indirectly via `BookingFlowManager` API, or directly if pre-validating token status before calling the API, though API should handle primary validation).
    *   [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) or Telegraf `ctx.reply/editMessageText` directly: To send messages and inline keyboards to the friend.
    *   [`src/core/logger.js`](src/core/logger.js:0): For logging.

**Detailed Requirements:**

*   **Requirement A (Deep Link Parsing):**
    *   The bot's `/start` command handler (e.g., in `src/commands/handlers.js` or a dedicated `start.js` command file, routed via `src/handlers/commandHandler.js` or `src/middleware/updateRouter.js`) must check `ctx.startPayload`.
    *   If `ctx.startPayload` exists and matches the pattern `invite_{token}`, extract the `inviteToken`.
*   **Requirement B (Initiate Friend Flow via `BookingFlowManager` API):**
    *   If an `inviteToken` is parsed:
        1.  Get the friend's Telegram ID: `friendTelegramId = ctx.from.id`.
        2.  Make an API call to `GET /api/booking-flow/start-invite/{inviteToken}?friend_tg_id={friendTelegramId}`.
*   **Requirement C (Handle API Response & Friend Interaction):**
    *   **If API call is successful (`response.success === true`):**
        1.  Extract `nextStep.url` (e.g., to `join-session.html` or `form-handler.html`) and `inviteDetails` from the API response. The `nextStep.url` will already include the `flowToken`.
        2.  Construct a message for the friend using `inviteDetails`:
            *   Text: "👋 You've been invited by [Primary Booker Name] to a [Session Type Label] session!\n\n✨ **Session Type:** [Session Type Label]\n🗓️ **Date:** [Formatted Date]\n⏰ **Time:** [Formatted Time]\n\nWould you like to join?"
        3.  Present an inline keyboard with:
            *   A "View Invite & Accept ✨" button configured as a WebApp button opening `nextStep.url`.
            *   A "Decline Invite 😔" button with callback data `decline_invite_{inviteToken}` (to be handled by Task 27).
        4.  Send this message with the keyboard to the friend (`ctx.reply()`).
    *   **If API call fails (e.g., `response.success === false` due to invalid token, expired invite, or server error):**
        1.  Extract the error `response.message`.
        2.  Send a message to the friend informing them the invite is invalid/expired or an error occurred (e.g., "This invitation link is invalid or has expired. Please ask your friend for a new one." or "Sorry, there was an error processing your invite.").
*   **Requirement D (Prevent Primary Booker Self-Invite Click Confusion):**
    *   The `GET /api/booking-flow/start-invite/...` API (or `BookingFlowManager`) should ideally check if `friend_tg_id` matches the `parentSession.user.telegram_id` for the invite.
    *   If it's the primary booker clicking their own invite link, the API should respond accordingly (e.g., a specific error or a different `nextStep.type`).
    *   The bot handler, upon receiving such a specific response, should inform the primary booker: "This is an invite link for a session you booked. You can manage your invites from the 'Invite Friends' page if available." (Optionally, provide a WebApp button to their `invite-friends.html` page).
*   **Requirement E (Handling Existing Invite Statuses):**
    *   The `BookingFlowManager` API (`/api/booking-flow/start-invite`) should handle cases where the invite is not in a 'pending' state (e.g., already 'waiver_completed_by_friend', 'declined_by_friend').
    *   The API response should guide the bot on what message to display:
        *   If 'waiver_completed_by_friend': "You have already accepted and completed the waiver for this session..."
        *   If 'accepted_by_friend' (but waiver not done): "You've already indicated interest. Please complete the waiver..." (with button to `form-handler.html` with `flowToken`).
        *   If 'declined_by_friend': "You have previously declined this invite."
*   **Requirement F (Standard `/start` Behavior):** If `ctx.startPayload` is empty or doesn't match the invite pattern, the standard `/start` command behavior should execute (e.g., welcome message).

**Implementation Guide:**

*   **Architecture Overview:**
    *   Modifications to the bot's `/start` command processing logic.
    *   This handler becomes an API client to the `BookingFlowManager` service.
    *   **Diagram (Bot /start Invite Flow):**
        ```mermaid
        sequenceDiagram
            participant Friend
            participant TelegramBot as Bot (/start handler)
            participant StartInviteAPI as GET /api/booking-flow/start-invite/:token
            participant BFM as BookingFlowManager
            
            Friend->>TelegramBot: Clicks /start invite_{token} link
            TelegramBot->>TelegramBot: Parse inviteToken, friend_tg_id
            TelegramBot->>+StartInviteAPI: Call with inviteToken, friend_tg_id
            StartInviteAPI->>+BFM: startInviteAcceptanceFlow(token, friend_tg_id)
            BFM-->>-StartInviteAPI: {success, flowToken, nextStep, inviteDetails} or error
            StartInviteAPI-->>-TelegramBot: API Response
            
            alt API Success
                TelegramBot->>TelegramBot: Construct message & WebApp button URL from response
                TelegramBot->>Friend: Send message with "View & Accept" (WebApp) & "Decline" buttons
            else API Error (Invalid Token, etc.)
                TelegramBot->>Friend: Send error message (e.g., "Invite invalid")
            end
        end
        ```
    *   **Tech Stack:** Node.js, Telegraf library.

*   **DB Schema:**
    *   Relies on `SessionInvite` (for token validation, status checks) and its relations, primarily accessed via the `BookingFlowManager` API.

*   **API Design (Consumption):**
    *   The bot handler consumes `GET /api/booking-flow/start-invite/:inviteToken`.

*   **Frontend Structure (Telegram Messages):**
    *   **Initial Invite Message to Friend (on valid token):**
        *   Text: Dynamic based on `inviteDetails` (Booker name, Session Type, Date, Time).
        *   Inline Keyboard:
            *   Button 1: `Markup.button.webApp('Accept & View Details ✨', webAppUrlFromApiResponse)`
            *   Button 2: `Markup.button.callback('Decline Invite 😔', 'decline_invite_{inviteToken}')`
    *   **Error/Status Messages:** Plain text messages for invalid token, already processed, self-click by booker, etc.

*   **CRUD Operations (Bot Handler):**
    *   Primarily Read operations via the API call. The `BookingFlowManager` handles any state updates (e.g., marking invite as 'viewed' if desired, though this might be better done when the WebApp loads).

*   **UX Flow (Friend's Perspective):**
    1.  Friend receives an invite link (e.g., `https://t.me/YourBotName?start=invite_UNIQUE_TOKEN`).
    2.  Friend clicks the link. Telegram opens a chat with the bot and sends the `/start invite_UNIQUE_TOKEN` command.
    3.  Bot's `/start` handler parses the token.
    4.  Bot calls `GET /api/booking-flow/start-invite/...`.
    5.  If API call successful & token valid:
        *   Bot sends a message to the friend with session details (from `inviteDetails`) and two buttons: "Accept & View Details" (WebApp) and "Decline Invite" (callback).
    6.  If API call fails or token invalid:
        *   Bot sends an appropriate error/informational message to the friend.

*   **Security:**
    *   `inviteToken` is the key. The `BookingFlowManager` API is responsible for its secure validation.
    *   The bot handler should ensure it's using HTTPS for API calls.
    *   Callback data for "Decline Invite" should also use the `inviteToken` to identify the correct invite.

*   **Testing:**
    *   **Unit Tests (for `/start` handler logic):**
        *   Mock `ctx` (Telegraf context), `axios` or `fetch` (for API calls).
        *   Test payload parsing: `invite_{token}` vs. no payload vs. other payloads.
        *   Test API call construction to `/api/booking-flow/start-invite`.
        *   Test handling of successful API response: verify `ctx.reply` is called with correct message text and inline keyboard structure (WebApp URL, callback data).
        *   Test handling of various error API responses (404, 500, specific business errors like "token already used"): verify correct error message sent to friend.
        *   Test self-invite click scenario if API supports distinguishing it.
    *   **Integration Tests:**
        *   Requires a running bot instance and a running API server (with `BookingFlowManager` and its dependencies mocked or using a test DB).
        *   Send `/start invite_{valid_token}` to the bot via a test client or manually. Verify the bot's response message and button functionality (WebApp button opens correct URL, decline button sends correct callback).
        *   Test with invalid tokens, used tokens.
    *   **E2E Tests (as part of overall flow testing in Task 30):**
        *   Primary booker generates an invite.
        *   A different test Telegram user clicks the invite link.
        *   Verify the entire sequence: bot message, clicking "Accept & View Details" opens the correct WebApp (`join-session.html` or `form-handler.html`).

*   **Data Management:**
    *   The bot handler itself is largely stateless for this interaction, relying on the `inviteToken` and `BookingFlowManager` API.
    *   Optional: Could use `ctx.session` or `stateManager.js` to store `inviteToken` or `flowToken` if the friend's interaction with the bot becomes more conversational before they click a WebApp button, but for MVP, direct hand-off to WebApp is simpler.

*   **Logging & Error Handling (Bot Handler):**
    *   Log receipt of `/start` command with payload.
    *   Log `inviteToken` being processed, `friendTelegramId`.
    *   Log API call to `BookingFlowManager` and its outcome (success/failure, key parts of response).
    *   Log messages sent to the user.
    *   Handle API call errors gracefully, informing the user appropriately.
        *   `logger.info({ telegramId: ctx.from.id, payload: ctx.startPayload }, 'Processing /start command.');`
        *   `logger.info({ inviteToken, friendTelegramId }, 'Invite deep link detected. Calling BookingFlowManager API.');`
        *   `logger.error({ inviteToken, friendTelegramId, error: apiError.message }, 'API error starting invite flow.');`

**Data Flow Steps (Bot Handler for Invite Deep Link):**
1.  User clicks `t.me/YourBotName?start=invite_{token}`.
2.  Telegram client sends `/start invite_{token}` command to the bot.
3.  Bot's `/start` handler (e.g., in `src/commands/handlers.js`) receives the command.
4.  Handler extracts `inviteToken` from `ctx.startPayload` and `friendTelegramId` from `ctx.from.id`.
5.  Handler makes a `GET` request to `/api/booking-flow/start-invite/{inviteToken}?friend_tg_id={friendTelegramId}`.
6.  The API (backed by `BookingFlowManager`) validates the token, checks status, and if valid, prepares flow context.
7.  API responds with `{ success, flowToken, nextStep: { type, url, ... }, inviteDetails: { ... } }` or an error.
8.  Bot handler processes the API response:
    *   If success: Constructs a message using `inviteDetails` and an inline keyboard with a WebApp button pointing to `nextStep.url` (which includes `flowToken`) and a "Decline" callback button. Sends to friend.
    *   If error: Sends an appropriate error message to the friend.

**Key Edge Cases:**
*   Malformed `invite_{token}` payload.
*   `inviteToken` is for an invite that's already used, declined, or expired (handled by `BookingFlowManager` API).
*   Primary booker clicks their own invite link (should be handled gracefully by API/bot).
*   Network error when bot calls the `BookingFlowManager` API.
*   `BASE_URL` for constructing WebApp URLs is not configured in bot's environment.
*   Friend has blocked the bot (bot won't receive the `/start` command, or `ctx.reply` will fail).

---
### Feature 10 (Task 26): `join-session.html` Mini-App for Friend's Initial View
**(Adapts Original: PH6-27 from `Details_Phase_6_updated.md`)**

**Goal:**
Create or refactor the `public/join-session.html` Mini-App and its JavaScript (`public/join-session.js`). This page is opened when an invited friend clicks the "View Invite & Accept" WebApp button from the bot message (generated in Task 25). It will display key invitation details (passed via URL parameters from the `BookingFlowManager`'s `start-invite` API response) and provide a button for the friend to confirm their interest and proceed to the next step in their acceptance flow (typically the waiver form via `form-handler.html`).

**API Relationships:**
*   **Loaded via redirect from Bot (originating from `BookingFlowManager`):** The URL to `join-session.html` will contain parameters like `flowToken`, `inviteToken`, `friend_tg_id`, and pre-fetched `primaryBookerName`, `sessionTypeLabel`, `appointmentTimeFormatted`, `sessionTypeId`, `appointmentDateTimeISO`. These details are sourced from the response of `GET /api/booking-flow/start-invite/:inviteToken` (Task 18).
*   **Calls (Client-side in `public/join-session.js`):**
    1.  `POST /api/booking-flow/continue` (New from Task 18):
        *   Input: `{ flowToken, stepId: "friend_confirmed_invite_details", formData: { inviteToken, friend_tg_id, sessionTypeId, appointmentDateTimeISO } }`
        *   Called when the friend clicks "Accept & Continue" (or similar).
        *   Output: `{ success, nextStep: { type, url, ... } }` (typically redirecting to `form-handler.html` for waiver).

**Detailed Requirements:**

*   **Requirement A (Mini-App Creation/Refactoring):**
    *   Ensure `public/join-session.html`, `public/join-session.js`, and `public/join-session.css` (or leverage shared styles) exist or are created/refactored.
    *   The page serves as an informational and confirmation step before the friend proceeds.
*   **Requirement B (URL Parameter Parsing):**
    *   `public/join-session.js` must parse the following essential parameters from URL query string upon page load:
        *   `flowToken`: The active token for the current booking flow.
        *   `inviteToken`: The unique token identifying this specific invitation.
        *   `friend_tg_id`: The friend's Telegram ID.
        *   `primaryBookerName`: Name of the person who invited them.
        *   `sessionTypeLabel`: Label of the session (e.g., "Standard Kambo Session").
        *   `appointmentTimeFormatted`: User-friendly date and time of the session.
        *   `sessionTypeId`: The ID of the session type (needed for the next step, e.g., waiver).
        *   `appointmentDateTimeISO`: The ISO string of the appointment (needed for the next step).
    *   If `flowToken`, `inviteToken`, or `friend_tg_id` are missing, the page should display a clear error message (e.g., "Invalid or incomplete invite link.") and disable the proceed button. Other display details might show as "N/A" if missing but are less critical for proceeding.
*   **Requirement C (Dynamic Content Display):**
    *   Display a welcoming message: "👋 You're invited by **[Primary Booker Name]** to join a session!"
    *   Clearly display the session details:
        *   "**Session Type:** [Session Type Label]"
        *   "**Date & Time:** [Appointment Time Formatted]"
    *   (Optional) A brief message like "Please review the details above. If you'd like to join, click the button below."
    *   Provide a clear call-to-action button: e.g., "Accept & Continue to Waiver" or "Confirm & Proceed".
*   **Requirement D (Proceed Button Functionality):**
    *   The "Accept & Continue" button (e.g., `#proceedButton`):
        1.  When clicked, it should immediately disable itself and show a loading indicator (e.g., "Processing...").
        2.  It triggers a client-side JavaScript function (`handleProceedClick`).
        3.  This function constructs the payload for and calls `POST /api/booking-flow/continue`.
        4.  The payload must include:
            *   `flowToken` (parsed from URL).
            *   `stepId`: A specific identifier for this action, e.g., `"friend_confirmed_invite_details"` or `"friend_proceed_to_waiver"`.
            *   `formData`: An object containing at least `{ inviteToken, friend_tg_id, sessionTypeId, appointmentDateTimeISO }`. These are passed to ensure `BookingFlowManager` has all necessary context for the *next* step (e.g., loading the correct waiver form).
*   **Requirement E (Handle `BookingFlowManager` Response):**
    *   Upon receiving a response from `POST /api/booking-flow/continue`:
        *   If `response.success === true` and `response.nextStep.type === "REDIRECT"` and `response.nextStep.url` is provided:
            *   Perform `window.location.href = response.nextStep.url;`. This URL will typically point to `public/form-handler.html` for the waiver, including the same `flowToken` and other necessary context parameters for that form.
        *   If `response.success === true` and `response.nextStep.type === "COMPLETE"` (less likely here, but possible if no waiver is needed for the friend for some reason):
            *   Display `response.nextStep.message`.
            *   If `response.nextStep.closeWebApp` is true, call `window.Telegram.WebApp.close()` after a short delay.
        *   If `response.success === false` or an error occurs:
            *   Display an appropriate error message from `response.message` or a generic one.
            *   Re-enable the proceed button to allow the user to retry.
*   **Requirement F (Telegram Back Button):**
    *   On page load, show the Telegram Back Button: `window.Telegram.WebApp.BackButton.show()`.
    *   Configure its `onClick` handler to simply close the WebApp: `window.Telegram.WebApp.BackButton.onClick(() => window.Telegram.WebApp.close());`.
    *   Reasoning: If the friend navigates back from this informational page, they are abandoning this specific attempt to accept via the WebApp. The original bot message (from Task 25) with the "Accept & View Details" button would still be in their chat if they wish to re-initiate the WebApp flow.
*   **Requirement G (Styling and UX):**
    *   Maintain visual consistency with other project mini-apps (dark theme, video background, typography as per [`public/calendar-app.html`](public/calendar-app.html:0)).
    *   Information should be clear, concise, and easy to understand.
    *   The call-to-action button should be prominent.
    *   Implement loading states for the proceed button during the API call.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Client-side Mini-App (`public/join-session.html`, `public/join-session.js`).
    *   Serves as an interstitial page for invited friends, confirming details before they proceed.
    *   Receives its initial state/context via URL parameters.
    *   Communicates with `BookingFlowManager` via the `/api/booking-flow/continue` endpoint.
    *   **Diagram (Join Session Page - Client-Side Logic):**
        ```mermaid
        sequenceDiagram
            participant User as Friend
            participant JoinSessionJS as join-session.js
            participant FlowContinueAPI as POST /api/booking-flow/continue
            
            activate User
            User->>JoinSessionJS: Opens join-session.html (URL has flowToken, inviteToken, friend_tg_id, displayDetails)
            activate JoinSessionJS
            JoinSessionJS->>JoinSessionJS: Parse URL Parameters
            alt Essential Params Missing
                JoinSessionJS->>User: Display Error ("Invalid Link"), Disable Proceed Button
            else Essential Params Present
                JoinSessionJS->>JoinSessionJS: Display Invite Details (Booker, Session Type, Time)
                JoinSessionJS->>JoinSessionJS: Setup Telegram Back Button (to close WebApp)
            end
            
            User->>JoinSessionJS: Clicks "Accept & Continue" Button
            JoinSessionJS->>JoinSessionJS: Disable Button, Show Loading State
            JoinSessionJS->>+FlowContinueAPI: Call with {flowToken, stepId, formData: {inviteToken, friend_tg_id, ...}}
            FlowContinueAPI-->>-JoinSessionJS: API Response {success, nextStep: {type, url}} or Error
            
            alt API Call Successful
                JoinSessionJS->>JoinSessionJS: Hide Loading State
                alt nextStep is REDIRECT
                    JoinSessionJS->>User: window.location.href = nextStep.url (e.g., to form-handler.html)
                else nextStep is COMPLETE
                    JoinSessionJS->>User: Display nextStep.message
                    opt closeWebApp is true
                        JoinSessionJS->>User: Telegram.WebApp.close()
                    end
                end
            else API Call Failed
                JoinSessionJS->>User: Display Error Message
                JoinSessionJS->>JoinSessionJS: Re-enable "Accept & Continue" Button, Hide Loading
            end
            deactivate JoinSessionJS
            deactivate User
        end
        ```
    *   **Tech Stack:** HTML, CSS, Vanilla JavaScript.

*   **DB Schema:** N/A for this client-side feature.

*   **API Design (Consumption):**
    *   Consumes parameters passed in its URL.
    *   Calls `POST /api/booking-flow/continue`. A helper function (e.g., in a shared `public/js/flowApi.js` or directly in `join-session.js`) should be created to make this API call.

*   **Frontend Structure (`public/join-session.html` & `public/join-session.js`):**
    *   **`join-session.html`:**
        *   Basic HTML structure with a main container.
        *   Video background element.
        *   Elements to display:
            *   Welcome message: `<p>You're invited by <strong id="primaryBookerNameDisplay"></strong>!</p>`
            *   Session Type: `<p><strong>Session Type:</strong> <span id="sessionTypeLabelDisplay"></span></p>`
            *   Date & Time: `<p><strong>Date & Time:</strong> <span id="appointmentTimeDisplay"></span></p>`
        *   Proceed button: `<button id="proceedButton">Accept & Continue to Waiver</button>`
        *   Area for error messages: `<div id="errorMessageArea" class="error-message" style="display:none;"></div>`
        *   Loading indicator (could be part of the button text or a separate spinner).
    *   **`join-session.js`:**
        *   Global or module-scoped variables to store parsed URL parameters (`flowToken`, `inviteToken`, `friendTelegramId`, `sessionTypeId`, `appointmentDateTimeISO`).
        *   `initJoinSessionPage()` or `DOMContentLoaded` listener:
            *   Calls `parseUrlParameters()`.
            *   If critical parameters (like `flowToken`, `inviteToken`, `friend_tg_id`) are missing, calls `showFatalError("Invalid invite link.")` and returns.
            *   Calls `displayInviteInformation()` using parsed parameters.
            *   Sets up Telegram Back Button: `Telegram.WebApp.BackButton.show(); Telegram.WebApp.BackButton.onClick(() => Telegram.WebApp.close());`.
            *   Adds event listener to `#proceedButton` to call `handleProceedButtonClick()`.
        *   `parseUrlParameters()`: Function to extract all required parameters from `window.location.search`.
        *   `displayInviteInformation()`: Populates `#primaryBookerNameDisplay`, `#sessionTypeLabelDisplay`, `#appointmentTimeDisplay` with data from parsed URL parameters.
        *   `handleProceedButtonClick()`:
            *   Disables `#proceedButton` and updates its text/shows a spinner.
            *   Constructs the `payload` for `POST /api/booking-flow/continue`:
                ```javascript
                // const payload = {
                //   flowToken: parsedFlowToken,
                //   stepId: "friend_confirmed_invite_details", // Or a more generic "friend_accepted_info"
                //   formData: {
                //     inviteToken: parsedInviteToken,
                //     friend_tg_id: parsedFriendTelegramId,
                //     sessionTypeId: parsedSessionTypeId, // Pass along for next step context
                //     appointmentDateTimeISO: parsedAppointmentDateTimeISO // Pass along
                //   }
                // };
                ```
            *   Makes the API call (e.g., `await flowApi.continueFlow(payload)`).
            *   Handles success: if `nextStep.type === "REDIRECT"`, then `window.location.href = response.nextStep.url;`.
            *   Handles error: calls `showErrorMessage(apiResponse.message)`, re-enables `#proceedButton`.
        *   `showFatalError(message)`: Displays a prominent error and disables the proceed button permanently for this page load.
        *   `showErrorMessage(message)`: Displays a temporary error.
        *   Functions to manage loading state of the button.

*   **CRUD Operations:** N/A for client-side. This page triggers backend processing via `BookingFlowManager`.

*   **UX Flow:**
    1.  Friend clicks "Accept & View Details" WebApp button in their Telegram chat (from Task 25).
    2.  `public/join-session.html` loads.
    3.  Page displays information: "You're invited by [Booker's Name] for [Session Type] on [Date/Time]."
    4.  Friend reviews the details.
    5.  Friend clicks "Accept & Continue to Waiver" (or similar) button. Button shows a loading state.
    6.  `join-session.js` calls `POST /api/booking-flow/continue`.
    7.  `BookingFlowManager` processes this "confirmation of details" step.
    8.  `BookingFlowManager` responds with `nextStep` (typically a redirect to `public/form-handler.html` for the waiver, including the `flowToken`).
    9.  The browser navigates to the waiver form page.

*   **Security:**
    *   Relies on the unguessability and secure handling of `flowToken` and `inviteToken` passed in the URL.
    *   All API calls must be over HTTPS.
    *   The `friend_tg_id` from the URL is used to identify the user in the context of this flow.

*   **Testing:**
    *   **Unit Tests (`public/join-session.js`):**
        *   Test `parseUrlParameters()` with various valid and invalid URL inputs (missing params, malformed params).
        *   Test `displayInviteInformation()` for correct DOM updates based on mock input data.
        *   Mock the API call to `POST /api/booking-flow/continue`.
        *   Test `handleProceedButtonClick()`:
            *   Verify correct payload construction for the API call.
            *   Test handling of successful API response (verifying `window.location.href` is set correctly).
            *   Test handling of error API response (error message displayed, button re-enabled).
        *   Verify Telegram Back Button setup.
    *   **E2E Tests (as part of overall flow testing in Task 30):**
        *   Full sequence: Friend clicks invite link in bot -> Bot sends message with "Accept & View Details" button -> Friend clicks button -> `join-session.html` loads.
        *   Verify correct invite details are displayed on `join-session.html`.
        *   Friend clicks "Accept & Continue" -> Verify redirection to `form-handler.html` (for waiver) with correct parameters (including `flowToken`).
        *   Test scenario where essential URL parameters are missing when `join-session.html` loads (expect error display).

*   **Data Management (Client-Side):**
    *   Data is primarily passed via URL parameters.
    *   No significant client-side storage beyond these parameters for the page's lifecycle.

*   **Logging & Error Handling (Client-Side):**
    *   Use `console.log` for debugging: parsed URL parameters, constructed API payloads, API responses.
    *   Display user-friendly error messages in a dedicated `#errorMessageArea` if URL params are invalid or API calls fail.
    *   Manage loading state of the proceed button.

**Data Flow Steps (Client-Side `join-session.html`):**
1.  Page loads. URL contains `flowToken`, `inviteToken`, `friend_tg_id`, and display details like `primaryBookerName`, `sessionTypeLabel`, `appointmentTimeFormatted`, `sessionTypeId`, `appointmentDateTimeISO`.
2.  `join-session.js` parses these parameters from the URL.
3.  JS populates the respective DOM elements to display the invitation details.
4.  User clicks the "Accept & Continue to Waiver" button.
5.  JS constructs a payload: `{ flowToken, stepId: "friend_confirmed_invite_details", formData: { inviteToken, friend_tg_id, sessionTypeId, appointmentDateTimeISO } }`.
6.  JS makes a `POST` request to `/api/booking-flow/continue` with this payload.
7.  The backend (`BookingFlowManager`) processes this step. If successful, it responds with `nextStep` containing a URL (e.g., to `form-handler.html` for the waiver, including the `flowToken`).
8.  `join-session.js` receives the API response and, if successful and a redirect URL is provided, sets `window.location.href` to this new URL.

**Key Edge Cases:**
*   Critical URL parameters (`flowToken`, `inviteToken`, `friend_tg_id`) are missing or malformed: Page should display a clear error and prevent proceeding.
*   API call to `/api/booking-flow/continue` fails (e.g., network error, server error, `BookingFlowManager` determines an issue like invite no longer valid): Page should display an error message and allow the user to retry by clicking the button again.
*   User clicks the Telegram Back button: WebApp closes. They can re-initiate from the bot message if they choose.

---
### Feature 11 (Task 27): Bot - Handle "Decline Invite" Callback
**(Adapts Original: PH6-28 from `Details_Phase_6_updated.md`)**

**Goal:**
When an invited friend clicks the "Decline Invite 😔" button in the Telegram message (sent by the bot in Task 25 / PH6-26), the bot's callback query handler must process this action. This involves updating the `SessionInvite` status to 'declined_by_friend', informing the friend their decline has been noted, and notifying the primary booker.

**API Relationships:**
*   **This is a bot callback query handler, not an API endpoint itself.**
*   **Optionally Calls (Bot backend, if not handling directly):**
    *   `POST /api/booking-flow/decline-invite` (Hypothetical new endpoint if decline logic is centralized in `BookingFlowManager`):
        *   Input: `{ inviteToken, friend_tg_id }`
        *   Action: `BookingFlowManager` updates `SessionInvite` status and triggers notifications.
        *   Output: `{ success: true, message: "Decline processed." }`
    *   For MVP, direct DB update and notification calls from the callback handler might be simpler than introducing a new API endpoint solely for declines, unless `BookingFlowManager` needs to perform other complex logic upon decline. The approach below assumes direct handling in the callback handler for now, but can be refactored to use an API if desired.
*   **Interacts with (Bot backend):**
    *   [`src/core/prisma.js`](src/core/prisma.js:0): To read `SessionInvite` (and related `parentSession.user` for primary booker ID) and update `SessionInvite.status` and `SessionInvite.friendTelegramId`.
    *   [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0): To answer the callback query, edit the friend's original message, and send a notification to the primary booker.
    *   [`src/core/logger.js`](src/core/logger.js:0): For logging.

**Detailed Requirements:**

*   **Requirement A (Callback Parsing):**
    *   The callback query handler (in `src/handlers/callbackQueryHandler.js`) must recognize and parse callback data with the prefix `decline_invite_`.
    *   Example callback data: `decline_invite_{inviteToken}`.
    *   Extract the `inviteToken` from the callback data.
*   **Requirement B (Token Validation & Invite Update):**
    *   Get the `friendTelegramId` from `ctx.from.id`.
    *   Fetch the `SessionInvite` from the database using the `inviteToken`. Include `parentSession.user` to get the primary booker's details for notification.
    *   **Validation:**
        *   If `SessionInvite` is not found, answer callback with an error, edit message to "This invitation is no longer valid.", and log.
        *   If `SessionInvite.status` is NOT 'pending' (or another acceptable initial state like 'viewed_by_friend'), it means the invite was already actioned (e.g., accepted, already declined, or waiver completed). Answer callback, edit message to "This invitation has already been processed.", and log.
    *   **Update Database:** If valid and pending:
        *   Update `SessionInvite.status` to `'declined_by_friend'`.
        *   Update `SessionInvite.friendTelegramId` with the `friendTelegramId` who clicked decline.
*   **Requirement C (Feedback to Declining Friend):**
    *   Immediately answer the callback query to Telegram to stop the loading spinner on the button: `ctx.answerCbQuery("Your decline has been recorded. Thank you.")`.
    *   Edit the original message (the one that had the Accept/Decline buttons) sent to the friend:
        *   New text: "You have declined the invitation to the [Session Type Label] session with [Primary Booker Name]. Thanks for letting us know!"
        *   Remove the inline keyboard: `Markup.inlineKeyboard([])`.
*   **Requirement D (Notify Primary Booker):**
    *   Fetch the primary booker's Telegram ID from `sessionInvite.parentSession.user.telegram_id`.
    *   Fetch the friend's first name from `ctx.from.first_name` (or use a generic "A friend").
    *   Construct notification message for the primary booker: "😔 [Friend's First Name] has declined your invitation to the [Session Type Label] session on [Formatted Date] at [Formatted Time]."
    *   Use `telegramNotifier.sendUserNotification(primaryBookerTelegramId, message)` to send it.
    *   This allows the primary booker to potentially invite someone else if a slot opens up and they wish to, using their `invite-friends.html` page.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Logic implemented within the main callback query handler in `src/handlers/callbackQueryHandler.js`.
    *   Direct interaction with Prisma for DB updates and `TelegramNotifier` for messaging.
    *   **Diagram (Decline Invite Callback Flow):**
        ```mermaid
        sequenceDiagram
            participant Friend
            participant TelegramBot as Bot (Callback Handler)
            participant DB as Prisma
            participant Notifier as TelegramNotifierTool
            
            Friend->>TelegramBot: Clicks "Decline Invite" button (callback_data: decline_invite_{token})
            activate TelegramBot
            TelegramBot->>TelegramBot: Parse inviteToken, friend_tg_id
            TelegramBot->>Notifier: ctx.answerCbQuery("Processing...")
            
            TelegramBot->>+DB: Find SessionInvite by token (include parentSession.user, parentSession.sessionType)
            DB-->>-TelegramBot: sessionInvite object or null
            
            alt Invite Valid & Pending
                TelegramBot->>+DB: Update SessionInvite status to 'declined_by_friend', set friendTelegramId
                DB-->>-TelegramBot: Update success
                TelegramBot->>Notifier: ctx.editMessageText("You have declined...", no keyboard)
                
                TelegramBot->>TelegramBot: Construct notification for Primary Booker
                TelegramBot->>+Notifier: sendUserNotification(primaryBookerId, decline_message)
                Notifier-->>-TelegramBot: Notification sent (or error)
            else Invite Invalid or Already Processed
                TelegramBot->>Notifier: ctx.editMessageText("Invite no longer valid / already processed.")
            end
            deactivate TelegramBot
        end
        ```
    *   **Tech Stack:** Node.js, Telegraf.

*   **DB Schema:**
    *   Relies on the `SessionInvite` model, specifically updating `status` and `friendTelegramId`.
    *   Reads `Session.user.telegram_id` (for primary booker) and `Session.sessionType.label`, `Session.appointment_datetime` for message content.

*   **API Design:** N/A (Bot callback handling).

*   **Frontend Structure (Telegram Messages):**
    *   **Friend's Message (After Decline):**
        *   Text: "You have declined the invitation to the [Session Type Label] session with [Primary Booker Name]. Thanks for letting us know!"
        *   Keyboard: None (buttons removed).
    *   **Primary Booker's Notification Message:**
        *   Text: "😔 [Friend's First Name] has declined your invitation to the [Session Type Label] session on [Formatted Date] at [Formatted Time]."
        *   Keyboard: None.

*   **CRUD Operations (within Callback Handler):**
    *   **Read:** `SessionInvite` (including related `Session`, `User`, `SessionType`).
    *   **Update:** `SessionInvite.status` to `'declined_by_friend'`, `SessionInvite.friendTelegramId`.

*   **UX Flow:**
    1.  Invited friend receives bot message with "Accept & View Details" / "Decline Invite" buttons.
    2.  Friend clicks "Decline Invite 😔".
    3.  The button's loading spinner briefly appears then disappears (due to `ctx.answerCbQuery`).
    4.  The bot edits the message in the friend's chat to confirm their decline and removes the buttons.
    5.  The primary booker receives a new message from the bot informing them that their friend has declined.

*   **Security:**
    *   Callback data is initiated by the bot's own inline keyboard, making it relatively secure.
    *   The `inviteToken` is used to ensure the correct `SessionInvite` record is updated.
    *   The `ctx.from.id` reliably identifies the user who clicked the decline button.

*   **Testing:**
    *   **Unit Tests (for `callbackQueryHandler.js` logic for `decline_invite_`):**
        *   Mock `ctx` (Telegraf context), `prismaClient`, and `telegramNotifierTool`.
        *   Test with a valid, pending `inviteToken`:
            *   Verify `prisma.sessionInvite.findUnique` is called.
            *   Verify `prisma.sessionInvite.update` is called with correct data (`status: 'declined_by_friend'`, `friendTelegramId`).
            *   Verify `ctx.answerCbQuery` is called.
            *   Verify `ctx.editMessageText` is called with correct parameters (updated text, no keyboard).
            *   Verify `telegramNotifier.sendUserNotification` is called for the primary booker with the correct message.
        *   Test with an invalid `inviteToken` (not found in DB): Verify appropriate error message edited into chat.
        *   Test with an `inviteToken` for an already processed invite (e.g., status is 'waiver_completed_by_friend' or 'declined_by_friend'): Verify message indicating it's already processed.
    *   **Integration/E2E Tests (as part of overall flow testing in Task 30):**
        *   Generate an invite. As the invited friend, receive the bot message.
        *   Click the "Decline Invite" button.
        *   Verify the friend's message in Telegram updates correctly.
        *   Verify the `SessionInvite` record in the database is updated (status, `friendTelegramId`).
        *   Verify the primary booker receives the correct notification message.
        *   Attempt to click "Decline Invite" again on the (now ideally non-existent or already processed) button/invite; verify graceful handling.

*   **Data Management:**
    *   The `SessionInvite` record is updated to reflect the 'declined_by_friend' status. This is important for the primary booker viewing invite statuses on `invite-friends.html` (Task 24 / PH6-32).

*   **Logging & Error Handling (Callback Handler):**
    *   Log receipt of `decline_invite_` callback with `inviteToken` and `friendTelegramId`.
    *   Log DB lookup and update operations (success/failure).
    *   Log attempts to send notifications to friend and primary booker.
    *   If any step fails (e.g., DB update), try to `answerCbQuery` and inform the user of an error if possible, and log the server-side error thoroughly.
        *   `logger.info({ callbackData: ctx.callbackQuery.data, userId: ctx.from.id }, 'Processing decline_invite callback.');`
        *   `logger.info({ inviteToken, friendTelegramId }, 'SessionInvite status updated to declined_by_friend.');`
        *   `logger.error({ inviteToken, error: dbError.message }, 'DB error updating SessionInvite for decline.');`

**Data Flow Steps (Bot Callback Handler for Decline):**
1.  Friend clicks "Decline Invite" button in their Telegram chat.
2.  Telegram sends a `callback_query` to the bot with `data: "decline_invite_{inviteToken}"`.
3.  `src/handlers/callbackQueryHandler.js` receives the query.
4.  Handler parses `inviteToken` from `callback_query.data` and gets `friendTelegramId` from `callback_query.from.id`.
5.  Handler calls `ctx.answerCbQuery()` to acknowledge the button press.
6.  Handler queries the database for the `SessionInvite` using `inviteToken`, including related `Session` and `User` (primary booker) data.
7.  If invite is valid and pending:
    a.  Updates the `SessionInvite` record in the DB: sets `status` to `'declined_by_friend'` and `friendTelegramId` to the ID of the user who clicked.
    b.  Calls `ctx.editMessageText()` to change the friend's original message to a decline confirmation and removes the buttons.
    c.  Constructs and sends a notification message to the primary booker via `telegramNotifier.sendUserNotification()`.
8.  If invite is invalid or already processed: Edits the friend's message to reflect this.

**Key Edge Cases:**
*   User clicks "Decline Invite" multiple times quickly: The first successful update to 'declined_by_friend' should prevent subsequent updates due to status check. `ctx.answerCbQuery` should still be called for subsequent clicks, perhaps with a "Already processed" message.
*   `inviteToken` in callback data is somehow malformed or doesn't exist: DB lookup will fail; inform user invite is invalid.
*   Primary booker's Telegram ID cannot be found (data integrity issue): Log error, friend's decline is still processed.
*   Failure to edit the friend's message or send notification to primary booker: Log error. The core decline action (DB update) is the most critical part.

---
---

### Feature 12 (Task 32 - New): Final Booking Confirmation Page & Process

**Goal:**
Implement a dedicated final HTML page (`public/booking-confirmed.html`) that serves as the universal concluding step for all successful booking flows. This page will inform the user their booking is being finalized, trigger the actual booking operations (database session creation, Google Calendar event creation, and relevant notifications) via a new API call to the `BookingFlowManager`, and then allow the user to close the WebApp. This defers the core booking commitment to the very end of the user's interaction.

**File System Impact:**
*   **New Frontend Files:**
    *   `public/booking-confirmed.html` (New - Final confirmation page)
    *   `public/booking-confirmed.js` (New - Logic for `booking-confirmed.html`)
    *   `public/booking-confirmed.css` (New - Styles for `booking-confirmed.html`, or adapt shared styles)

**API Relationships:**
*   **Loaded via redirect from `BookingFlowManager`:**
    *   The URL to `public/booking-confirmed.html` will contain the `flowToken`. Example: `/booking-confirmed.html?flowToken=generated.jwt.flow.token`.
*   **Calls (Client-side in `public/booking-confirmed.js`):**
    *   `POST /api/booking-flow/complete-booking` (New Endpoint)
        *   **Input:** `{ "flowToken": "active.jwt.flow.token" }`
        *   **Action:** This endpoint triggers the `BookingFlowManager.finalizeBookingAndNotify(flowToken)` method to perform all final booking actions.
        *   **Output (Success 200 OK):** `{ "success": true, "message": "Booking finalized and notifications sent." }`
        *   **Output (Error):** `{ "success": false, "message": "Error finalizing booking: [details]" }` (e.g., slot taken, DB error).

**Detailed Requirements:**

*   **Requirement A (New Mini-App: `public/booking-confirmed.html`, `.js`, `.css`):**
    *   Create the new HTML, JS, and CSS files.
    *   `booking-confirmed.html`: Will contain a simple layout to display finalization messages and a "Close" button.
    *   `booking-confirmed.js`: Logic for parsing `flowToken`, automatically calling the `/api/booking-flow/complete-booking` API on load, handling API response, updating UI, and managing the "Close" button.
    *   `booking-confirmed.css`: Basic styling, consistent with other mini-apps.
*   **Requirement B (`BookingFlowManager` - Data Accumulation & Deferred Booking):**
    *   The `BookingFlowManager`'s flow state (associated with `flowToken`, potentially using temporary server-side storage for sensitive/large data like waiver forms, as JWTs should not store them directly) must accumulate all necessary information from previous steps:
        *   `userId` (primary booker).
        *   `sessionTypeId`, `appointmentDateTimeISO`, `placeholderId` (if used).
        *   Primary booker's `liability_form_data` (if a waiver step occurred).
        *   Details of any invited friends who have completed their waivers (e.g., `friendTelegramId`, `friendNameOnWaiver`, `friendLiabilityFormData`).
    *   Core booking actions (Session creation, GCal event creation for primary, primary notifications) previously in `processWaiverSubmission` (Task 22) are **moved** to the new `finalizeBookingAndNotify` method.
*   **Requirement C (`BookingFlowManager` - `determineNextStep` Modification):**
    *   When any booking flow path (e.g., after primary's waiver if no invites, after "invite friends" page if invites used, or directly from `startPrimaryBookingFlow` if no waiver/invites) reaches the point of final confirmation, `determineNextStep()` must return:
        `{ type: "REDIRECT", url: "/booking-confirmed.html?flowToken=active.jwt.flow.token" }`
*   **Requirement D (New `BookingFlowManager` Method: `finalizeBookingAndNotify(flowToken)`):**
    *   This new method is called by `POST /api/booking-flow/complete-booking`.
    *   **Actions:**
        1.  Parse `flowToken` and retrieve all accumulated flow data (primary booker info, session details, waiver data, confirmed friend data).
        2.  **GCal Placeholder Handling:** If `placeholderId` exists in flow context, delete the placeholder GCal event (`googleCalendarTool.deleteCalendarEvent()`).
        3.  **Final Slot Availability Check (CRITICAL):** Call `googleCalendarTool.isSlotTrulyAvailable()`. If slot is taken, return an error immediately (this booking cannot proceed).
        4.  **Create `Session` Record:** Create the primary `Session` record in the database, including `liability_form_data` if applicable. Get the `newSession.id`.
        5.  **Create Confirmed GCal Event:** Create the main GCal event for the primary booker (`googleCalendarTool.createConfirmedEvent()`). Update the `Session` record with the `googleEventId`.
        6.  **Process Confirmed Friends (if any):**
            *   For each confirmed friend in the flow state:
                *   Ensure their `SessionInvite` status is updated (e.g., to 'waiver_completed_by_friend' or a final 'confirmed_and_attending' status).
                *   Update the main GCal event description and title for these friends (`googleCalendarTool.updateEventDescription()`, `googleCalendarTool.updateEventSummary()`).
        7.  **Trigger All Notifications (Centralized Here):**
            *   Primary Booker Confirmation (Task 28, Req A - without "Invite Friends" button as that step is passed).
            *   Admin Notification - Primary Booker's Session Confirmed (Task 28, Req B).
            *   For each confirmed friend:
                *   Friend's Confirmation Message (Task 28, Req C).
                *   Primary Booker Notification - Friend Waiver Completed (Task 28, Req D).
                *   Admin Notification - Friend Joins Session (Task 28, Req E).
        8.  **Flow State Cleanup:** Invalidate or delete any temporary server-side state associated with the `flowToken`.
        9.  Return success.
*   **Requirement E (New API Endpoint: `POST /api/booking-flow/complete-booking`):**
    *   To be handled by `src/handlers/api/bookingFlowApiHandler.js`.
    *   Receives `{ flowToken }`. Validates it.
    *   Calls `BookingFlowManager.finalizeBookingAndNotify(flowToken)`.
    *   Returns `{ success: true, message: "..." }` or `{ success: false, message: "..." }`.
*   **Requirement F (`public/booking-confirmed.js` Logic):**
    *   On page load (`DOMContentLoaded`):
        1.  Parse `flowToken` from `window.location.search`. If missing, show error and stop.
        2.  Display an initial message: "Finalizing your booking, please wait..."
        3.  Disable the "Close" button.
        4.  Immediately call `POST /api/booking-flow/complete-booking` with the `flowToken`.
        5.  **On API Success:**
            *   Update page content: "Booking Confirmed! Details: [Session Type] at [Time]. You will receive a confirmation from the bot shortly. You may now close this window." (Fetch minimal details for display if needed, or keep generic).
            *   Enable the "Close" button.
        6.  **On API Error:**
            *   Update page content with the error message from the API (e.g., "Failed to confirm booking: Slot is no longer available. Please try again from the calendar.").
            *   Enable the "Close" button (allowing user to dismiss the error).
    *   **"Close" Button (`#closeBookingConfirmedButton`):**
        *   When clicked, calls `window.Telegram.WebApp.close()`.
    *   **Telegram Back Button:**
        *   `Telegram.WebApp.BackButton.show()`.
        *   `onClick` handler should ideally perform the same action as the "Close" button (i.e., ensure the API call has been attempted and then close). For simplicity, it can just call `window.Telegram.WebApp.close()`, assuming the on-load API call handles the finalization.
*   **Requirement G (Impact on Previous Steps):**
    *   Steps like waiver submission (`BookingFlowManager.processWaiverSubmission`) or invite friend completion will no longer finalize the booking themselves. They will:
        1.  Validate input.
        2.  Store submitted data (e.g., waiver form, friend list) in the flow state associated with `flowToken`.
        3.  Call `determineNextStep()`, which will eventually lead to `booking-confirmed.html`.

**Implementation Guide:**

*   **Architecture Overview:**
    *   This feature introduces a final, mandatory step in all booking flows, centralizing the actual booking commitment and primary notifications.
    *   `BookingFlowManager` becomes more of a state accumulator until this final trigger.
    *   **Diagram (Final Confirmation Flow):**
        ```mermaid
        sequenceDiagram
            participant PrevMiniApp as e.g., form-handler.js / invite-friends.js
            participant BFM_API_Continue as POST /api/booking-flow/continue
            participant BFM as BookingFlowManager
            participant ConfirmedPageJS as booking-confirmed.js
            participant BFM_API_Complete as POST /api/booking-flow/complete-booking
            participant GCal as GoogleCalendarTool
            participant DB as Prisma
            participant Notifier as TelegramNotifierTool

            PrevMiniApp->>+BFM_API_Continue: Submit flowToken, stepData (e.g., waiver)
            BFM_API_Continue->>+BFM: processStep(flowToken, stepData)
            BFM->>BFM: Store stepData in flowState
            BFM->>BFM: determineNextStep() -> redirect to booking-confirmed.html
            BFM-->>-BFM_API_Continue: {nextStep: {type:"REDIRECT", url:"/booking-confirmed.html?flowToken=..."}}
            BFM_API_Continue-->>-PrevMiniApp: Response
            PrevMiniApp->>User: window.location.href to booking-confirmed.html

            User->>+ConfirmedPageJS: Page loads (booking-confirmed.html)
            ConfirmedPageJS->>ConfirmedPageJS: Parse flowToken, Show "Finalizing..."
            ConfirmedPageJS->>+BFM_API_Complete: Call with {flowToken}
            BFM_API_Complete->>+BFM: finalizeBookingAndNotify(flowToken)
            BFM->>+GCal: Delete Placeholder, Check Slot, Create Event
            GCal-->>-BFM: Success/Failure
            BFM->>+DB: Create Session, Update Invites
            DB-->>-BFM: Success/Failure
            BFM->>+Notifier: Send All Confirmations
            Notifier-->>-BFM: Success/Failure
            BFM->>BFM: Cleanup flowState
            BFM-->>-BFM_API_Complete: {success: true/false, message: ...}
            BFM_API_Complete-->>-ConfirmedPageJS: Response
            alt Booking Finalized Successfully
                ConfirmedPageJS->>User: Show "Booking Confirmed!", Enable Close button
            else Finalization Failed
                ConfirmedPageJS->>User: Show Error Message, Enable Close button
            end
            deactivate BFM
            deactivate BFM_API_Complete
            deactivate ConfirmedPageJS
        end
        ```
*   **DB Schema:**
    *   No direct new tables for this page, but `BookingFlowManager`'s temporary state storage mechanism (if server-side beyond JWT) might be more heavily used to hold accumulated data like waiver forms before final `Session` creation.
*   **API Design:**
    *   New endpoint `POST /api/booking-flow/complete-booking` is critical.
*   **Frontend Structure (`public/booking-confirmed.html`):**
    *   Simple page:
        *   `<div id="confirmationMessage">Finalizing your booking, please wait...</div>`
        *   `<button id="closeBookingConfirmedButton" style="display:none;">Close</button>`
*   **UX Flow:**
    1.  User completes the last interactive step (e.g., waiver, invite management).
    2.  They are redirected to `booking-confirmed.html`.
    3.  Page shows "Finalizing..." message. API call to finalize is made automatically.
    4.  Message updates to "Booking Confirmed!" or an error. "Close" button appears/enables.
    5.  User clicks "Close" (or Telegram Back Button) to dismiss the WebApp.
*   **Security:**
    *   `flowToken` security is paramount.
    *   The `POST /api/booking-flow/complete-booking` endpoint must validate the `flowToken` thoroughly.
*   **Testing:**
    *   **Unit Tests:**
        *   `BookingFlowManager.finalizeBookingAndNotify()`: Mock dependencies (GCal, Prisma, Notifier). Test various scenarios: successful booking, slot taken error, DB error during session creation, notification failures. Test data accumulation and retrieval from flow state.
        *   `bookingFlowApiHandler` for the new endpoint.
        *   `booking-confirmed.js`: Mock API call. Test UI updates on load, success, and error. Test "Close" button.
    *   **Integration Tests:** Test the `POST /api/booking-flow/complete-booking` endpoint with a real (but test) `BookingFlowManager` instance, mocking GCal/Notifier.
    *   **E2E Tests:** All existing E2E journeys (Task 30) will now culminate in reaching `booking-confirmed.html`. Verify:
        *   Correct redirection to this page.
        *   Successful finalization (DB records, GCal event, notifications).
        *   Correct error handling if finalization fails (e.g., slot conflict detected at the last moment).
*   **Data Management:**
    *   Focus on how `BookingFlowManager` accumulates data from previous steps (waivers, invitee details) and makes it available to `finalizeBookingAndNotify`. If using server-side temporary storage, ensure it's robust and cleaned up.
*   **Logging & Error Handling:**
    *   `BookingFlowManager.finalizeBookingAndNotify` needs extensive logging for each step (GCal interactions, DB writes, notifications).
    *   `booking-confirmed.js` should log its API call and outcome.
    *   Clear user-facing errors on `booking-confirmed.html` if finalization fails.
*   **Key Edge Cases:**
    *   User closes `booking-confirmed.html` before the automatic API call completes or if it fails: The booking might not be finalized. The auto-call on load mitigates this for users who wait. If they close prematurely, the placeholder might expire via cron, and temporary flow data should also have an expiry.
    *   `flowToken` is invalid/expired when `booking-confirmed.html` loads or calls the API.
    *   Final slot check in `finalizeBookingAndNotify` fails (slot taken): This is a critical failure point; user must be clearly informed.
    *   Partial failure during `finalizeBookingAndNotify` (e.g., DB write OK, GCal fails): Requires robust error logging and potentially admin alerts. The system should aim for atomicity or clear compensation/retry paths if possible, though this is complex.

This new feature significantly alters the point of commitment in the booking flow, aligning with the described need for a final confirmation page that triggers the actual booking.
### Feature 12 (Task 28): Notifications Refactor for `BookingFlowManager`
**(Consolidates Original: PH6-31, PH6-33, PH6-34 and parts of PH6-17, PH6-24 from `Details_Phase_6_updated.md`)**

**Goal:**
Ensure all Telegram notifications (to the primary booker, invited friends, and admin) related to booking steps, invitation status changes, and confirmations are triggered reliably and with correct content by the `BookingFlowManager` (or by services it calls, like `telegramNotifier.js`) at the appropriate points in the dynamic flows.

**API Relationships:**
*   This feature describes side effects of various `BookingFlowManager` operations, primarily those triggered via `POST /api/booking-flow/continue` (Task 18) and bot command/callback handlers that interact with the `BookingFlowManager` (Tasks 25, 27).
*   **Utilizes:** [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) for actual message sending. This tool might need enhancements for message formatting flexibility.

**Detailed Requirements:**
The `BookingFlowManager` (or methods it invokes within `telegramNotifier.js`) will be responsible for triggering the following notifications:

*   **Requirement A (Primary Booker Confirmation - Post Waiver/Direct Booking):**
    *   **Trigger:** After `BookingFlowManager` successfully processes the primary booker's waiver (Task 22) or completes a direct booking (if `waiverType` is "NONE" and no invites).
    *   **Recipient:** Primary Booker (`Session.telegram_id`).
    *   **Action:** Edit the existing bot message (identified by `User.edit_msg_id`) or send a new message if `edit_msg_id` is not available/applicable.
    *   **Content:**
        *   Frog picture (as per original PH6-17).
        *   Text: "✅ Your [SessionType Label] session is confirmed for [Formatted Date & Time in Practitioner's TZ]!"
        *   **Conditional "Invite Friends" Button (Original PH6-24):**
            *   If `SessionType.allowsGroupInvites` is `true`, `SessionType.maxGroupSize > 1`, and the global invite feature is enabled:
                *   Add an inline keyboard button: `Markup.button.webApp('Invite Friends 🧑‍🤝‍🧑', webAppUrl)`
                *   `webAppUrl` should point to `public/invite-friends.html?sessionId={newSession.id}&telegramId={primaryBooker.telegram_id}&maxGroupSize={SessionType.maxGroupSize}`.
    *   **Post-Action:** Clear `User.edit_msg_id` for the primary booker.
*   **Requirement B (Admin Notification - Primary Booker's Session Confirmed):**
    *   **Trigger:** Same as Req A (after primary booker's session is confirmed).
    *   **Recipient:** Configured Admin Telegram ID(s).
    *   **Content:** "CONFIRMED BOOKING: Client [Primary Booker First Name] [Primary Booker Last Name] (TGID: [ID]) for [SessionType Label] on [Date] at [Time]. Waiver submitted." (or "Booking confirmed directly" if no waiver).
*   **Requirement C (Friend's Confirmation Message - After Friend's Waiver - Original PH6-31):**
    *   **Trigger:** After `BookingFlowManager` successfully processes an invited friend's waiver (Task 22).
    *   **Recipient:** Invited Friend (`SessionInvite.friendTelegramId`).
    *   **Action:** Send a new message.
    *   **Content:** "✅ Your spot for the [SessionType Label] session with [Primary Booker Name] on [Date] at [Time] is confirmed!\n\nYou're joining [Primary Booker Name]'s group. We look forward to seeing you!"
*   **Requirement D (Primary Booker Notification - Friend Waiver Completed - Original PH6-33):**
    *   **Trigger:** Same as Req C (after friend's waiver is processed).
    *   **Recipient:** Primary Booker (`parentSession.user.telegram_id` from the `SessionInvite`).
    *   **Action:** Send a new message.
    *   **Content:** "🎉 Good news! [Friend's Name on Waiver] has completed their waiver and will be joining your [SessionType Label] session on [Date] at [Time]."
*   **Requirement E (Admin Notification - Friend Joins Session - Original PH6-34):**
    *   **Trigger:** Same as Req C (after friend's waiver is processed).
    *   **Recipient:** Configured Admin Telegram ID(s).
    *   **Action:** Send a new message.
    *   **Content:** "➕ INVITED GUEST CONFIRMED: [Friend's Name on Waiver] (TGID: [Friend's TGID]) has completed their waiver and will join [Primary Booker's First Name] [Primary Booker's Last Name]'s session.\n\nSession: [SessionType Label] on [Date] at [Time].\nPrimary Booker TGID: [Primary Booker's TGID].\nInvite Token: [InviteToken]."
*   **Requirement F (Primary Booker Notification - Friend Declined Invite):**
    *   **Trigger:** After a friend declines an invite (Task 27, via callback handler which might call `BookingFlowManager` or handle directly).
    *   **Recipient:** Primary Booker (`parentSession.user.telegram_id` from the `SessionInvite`).
    *   **Action:** Send a new message.
    *   **Content:** "😔 [Friend's First Name / "A friend"] has declined your invitation to the [SessionType Label] session on [Formatted Date] at [Formatted Time]."
*   **Requirement G ([`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) Review & Enhancement):**
    *   Ensure `telegramNotifier.js` has flexible and robust functions:
        *   `sendUserNotification(telegramId, message, inlineKeyboard?)`: For sending messages to specific users.
        *   `sendAdminNotification(message)`: For sending to admins.
        *   `editUserMessage(chatId, messageId, text, inlineKeyboard?)`: For editing existing messages. Consider variants for editing messages with photos/captions if the "frog picture" confirmation involves media.
    *   Functions should handle formatting (MarkdownV2 or HTML) gracefully.
    *   Error handling for Telegraf API calls within the notifier.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Notification logic will be invoked at various points within `BookingFlowManager` methods (e.g., after successful session creation, after friend waiver processing, after friend decline).
    *   `BookingFlowManager` will gather the necessary data (user IDs, names, session details) and call the appropriate functions in `src/tools/telegramNotifier.js`.
    *   **Diagram (Notification Triggering):**
        ```mermaid
        graph TD
            BFM[BookingFlowManager] -- Gathers Data & Decides --> TN[TelegramNotifierTool]
            subgraph BookingFlowManager Operations
                direction LR
                A[Process Primary Waiver]
                B[Process Friend Waiver]
                C[Process Friend Decline]
            end
            A --> BFM
            B --> BFM
            C --> BFM
            
            TN -- Sends Message via Telegraf --> User[End User/Admin]

        classDef bfm fill:#lightgrey,stroke:#333,stroke-width:2px;
        classDef tn fill:#lightblue,stroke:#333,stroke-width:2px;
        class BFM,A,B,C bfm;
        class TN tn;
        ```
    *   **Tech Stack:** Node.js, Telegraf (within `telegramNotifier.js`).

*   **DB Schema:**
    *   Relies on data from `Session`, `SessionInvite`, `User`, `SessionType` to construct notification content. No schema changes for this task itself, but assumes schemas from previous tasks are in place.

*   **API Design:** N/A (Internal logic and side effects).

*   **Frontend Structure:** N/A (Backend Telegram messages).

*   **CRUD Operations:** Primarily Read operations to fetch data for message content. `User.edit_msg_id` is updated (set to null).

*   **UX Flow (Notifications):**
    *   Users (primary booker, friend, admin) receive timely and informative messages in their Telegram chats at key points of the booking/invite lifecycle.
    *   Primary booker's confirmation message might include an actionable "Invite Friends" button.

*   **Security:**
    *   Ensure `telegramId`s used for sending notifications are correct and sourced reliably.
    *   Avoid including overly sensitive PII in notifications beyond what's necessary for context (e.g., names, session times are generally fine).

*   **Testing:**
    *   **Unit Tests (for `BookingFlowManager` aspects and `telegramNotifier.js`):**
        *   In `BookingFlowManager` tests, mock `telegramNotifierTool` and verify it's called with the correct parameters (recipient ID, message content, keyboard structure) for each notification scenario (Req A-F).
        *   Test message construction logic within `BookingFlowManager` or `telegramNotifier.js` to ensure correct formatting and inclusion of dynamic data.
        *   Test `telegramNotifier.js` functions individually, mocking Telegraf's `bot.telegram.sendMessage/editMessageText/sendPhoto` calls.
    *   **Integration Tests:**
        *   During integration tests of `BookingFlowManager` API endpoints (Task 18), verify that the appropriate mock `telegramNotifierTool` functions are called as side effects of successful flow operations.
    *   **E2E Tests (as part of overall flow testing in Task 30):**
        *   Manually verify (or use a Telegram test client if possible) that all specified notifications are received by the correct users with the correct content and buttons at each stage of the various booking and invite flows.

*   **Data Management:** N/A for this task beyond fetching data for messages.

*   **Logging & Error Handling:**
    *   `BookingFlowManager` should log attempts to send notifications and their success/failure.
        *   `logger.info({ flowToken, notificationType: 'primary_confirmation', userId }, 'Attempting to send primary confirmation.');`
    *   `telegramNotifier.js` should log actual Telegraf API calls and handle/log any errors from Telegram (e.g., user blocked bot, chat not found).
    *   Notification failures are generally non-critical to the core booking/invite DB state but should be logged for monitoring.

**Data Flow Steps (Example: Friend Waiver Completion Notifications):**
1.  `BookingFlowManager.processWaiverSubmission()` successfully updates `SessionInvite` for a friend.
2.  BFM retrieves `friendTelegramId`, `primaryBooker.telegram_id`, `friendNameOnWaiver`, `primaryBooker.firstName`, `sessionType.label`, `session.appointment_datetime`.
3.  **Notification to Friend (Req C):**
    a.  BFM constructs message: "✅ Your spot for the [SessionType Label] session with [Primary Booker Name] on [Date] at [Time] is confirmed!..."
    b.  BFM calls `telegramNotifier.sendUserNotification(friendTelegramId, friendMessage)`.
4.  **Notification to Primary Booker (Req D):**
    a.  BFM constructs message: "🎉 Good news! [Friend's Name] has completed their waiver..."
    b.  BFM calls `telegramNotifier.sendUserNotification(primaryBooker.telegram_id, bookerMessage)`.
5.  **Notification to Admin (Req E):**
    a.  BFM constructs message: "➕ INVITED GUEST CONFIRMED: [Friend's Name] (TGID: [TGID])..."
    b.  BFM calls `telegramNotifier.sendAdminNotification(adminMessage)`.
6.  `telegramNotifier.js` uses Telegraf to send these messages.

**Key Edge Cases:**
*   `telegramId` for a recipient is missing or invalid (should be caught by earlier data validation).
*   User has blocked the bot (Telegram API will likely return an error, which `telegramNotifier.js` should catch and log).
*   Telegram API rate limits or temporary unavailability.
*   Data for message construction is partially missing (e.g., `friendNameOnWaiver` is null): Messages should gracefully handle this (e.g., use "Your friend" instead of a blank name).
*   Complexity in editing messages with media vs. text-only messages (for primary booker's confirmation). The logic in `telegramNotifier.js` needs to handle this robustly, potentially by deleting an old message and sending a new one if the media type needs to change.

---
### Feature 13 (Task 29): Google Calendar Integration Refinements for Orchestrated Flow
**(Adapts Original: DF-1, PH6-15 (GCal API parts), PH6-17 (GCal event creation), PH6-30 (GCal description update), PH6-30.5 (GCal title update) from `Details_Phase_6_updated.md`)**

**Goal:**
Refine and enhance the Google Calendar integration tool ([`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0)) and related APIs to work seamlessly with the `BookingFlowManager`. This includes robust placeholder event management (creation, deletion, expiry), accurate final slot availability checks, creation of confirmed session events, and updating event details (description, title) for group bookings. The `POST /api/gcal-placeholder-bookings` API will be a key entry point, returning necessary `SessionType` details for flow initiation.

**API Relationships:**

*   **Modified Existing/Key API for Flow Initiation:**
    *   `POST /api/gcal-placeholder-bookings` (Handler in [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0) or similar)
        *   **Input:** `{ telegramId: string, sessionTypeId: string, appointmentDateTimeISO: string }`
        *   **Action:** Fetches `SessionType` details (label, duration, waiverType, allowsGroupInvites, maxGroupSize). Calls `googleCalendarTool.createPlaceholderEvent()`.
        *   **Output (Enhanced):** `{ success: true, placeholderId: string, expiresAt: string, sessionTypeDetails: { waiverType: string, allowsGroupInvites: boolean, maxGroupSize: number, sessionTypeId: string, appointmentDateTimeISO: string, durationMinutes: number, label: string } }`
*   **Supporting APIs:**
    *   `DELETE /api/gcal-placeholder-bookings/{googleEventId}` (Handler in [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0) or similar)
        *   **Input:** Path parameter `googleEventId`.
        *   **Action:** Calls `googleCalendarTool.deleteCalendarEvent()`.
        *   **Output:** `{ success: true }` or error.
    *   `GET /api/slot-check` (Handler in [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0) or similar)
        *   **Input:** Query params `appointmentDateTimeISO`, `sessionTypeId`, optional `placeholderId`.
        *   **Action:** Fetches `SessionType.durationMinutes`. Checks GCal for overlaps using `googleCalendarTool` methods. Validates placeholder if `placeholderId` is provided.
        *   **Output:** `{ status: "RESERVED" | "AVAILABLE" | "TAKEN" | "UNAVAILABLE", placeholderValid?: boolean }`
*   **Internal Usage by `BookingFlowManager` (Tasks 17, 22):**
    *   The `BookingFlowManager` will use methods from `googleCalendarTool.js` such as:
        *   `deleteCalendarEvent(placeholderId)`
        *   `isSlotTrulyAvailable(appointmentDateTimeISO, durationMinutes)`
        *   `createConfirmedEvent(details)`
        *   `updateEventDescription(eventId, currentDescription, friendName)`
        *   `updateEventSummary(eventId, currentSummary, primaryBookerName, sessionTypeLabel, isFirstFriend)`
        *   `getEvent(eventId)`

**Detailed Requirements:**

*   **Requirement A (API Handler for `POST /api/gcal-placeholder-bookings` - Adapting DF-1):**
    *   The API handler (e.g., in [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0)) for `POST /api/gcal-placeholder-bookings` must:
        1.  Receive `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`.
        2.  Call `src/core/sessionTypes.js` to fetch the full `SessionType` record (including `label`, `durationMinutes`, `waiverType`, `allowsGroupInvites`, `maxGroupSize`). If not found, return an error.
        3.  Call `googleCalendarTool.createPlaceholderEvent(sessionTypeId, appointmentDateTimeISO, telegramId, sessionTypeDetails.label, sessionTypeDetails.durationMinutes)`.
        4.  If successful, return a JSON response: `{ success: true, placeholderId, expiresAt, sessionTypeDetails: { waiverType, allowsGroupInvites, maxGroupSize, sessionTypeId, appointmentDateTimeISO, durationMinutes, label } }`.
*   **Requirement B (`googleCalendarTool.js` - Placeholder Creation - Adapting DF-1):**
    *   `createPlaceholderEvent(sessionTypeId, appointmentDateTimeISO, telegramId, sessionLabel, durationMinutes)`:
        *   Creates a GCal event. Title: `"[PLACEHOLDER 15min] - Kambo Klarity - ${sessionLabel} for User ${telegramId}"`.
        *   Start time: `appointmentDateTimeISO`. End time: `appointmentDateTimeISO + durationMinutes` (Note: Original DF-1 said 15min duration for placeholder itself, but using actual session duration for the placeholder makes more sense for conflict checking, with a 15-min *booking window*). The *hold* is for 15 mins, but the placeholder should block the *actual session duration*. Let's clarify: the placeholder event itself should block the full `durationMinutes` on the calendar, but the *offer* to book it expires in 15 minutes. The `expiresAt` in API response refers to the 15-min booking window.
        *   Description: "Temporary hold for Kambo Klarity booking. User must complete booking by [CurrentTime + 15 minutes]. Session Type ID: ${sessionTypeId}, User TGID: ${telegramId}, Placeholder Creation: ${new Date().toISOString()}".
        *   Use `extendedProperties.private` to store `placeholderType: "KAMBO_KLARITY_15_MIN_HOLD"`, `creationTimestamp: new Date().toISOString()`, `telegramId`, `sessionTypeId`.
        *   Returns `{ placeholderId: event.id, expiresAt: new Date(Date.now() + 15 * 60000).toISOString() }`.
*   **Requirement C (`googleCalendarTool.js` - Placeholder/Event Deletion - Adapting DF-1, PH6-17/DF-4):**
    *   `deleteCalendarEvent(eventId)`: Standard GCal API call to delete an event by its ID. Handles "not found" errors gracefully (e.g., if already deleted).
*   **Requirement D (`googleCalendarTool.js` - Final Slot Availability Check - Adapting PH6-17/DF-4):**
    *   `isSlotTrulyAvailable(appointmentDateTimeISO, durationMinutes)`:
        *   Queries GCal for any *confirmed* (non-placeholder) Kambo Klarity bookings or other blocking events (e.g., practitioner's personal events if on same calendar) that overlap the proposed `appointmentDateTimeISO` and `durationMinutes`.
        *   Returns `true` if slot is free of such confirmed/blocking events, `false` otherwise.
*   **Requirement E (`googleCalendarTool.js` - Confirmed Event Creation - Adapting PH6-17):**
    *   `createConfirmedEvent(sessionData, sessionTypeData, primaryBookerData)`:
        *   `sessionData`: `{ appointment_datetime, telegram_id }`
        *   `sessionTypeData`: `{ durationMinutes, label }`
        *   `primaryBookerData`: `{ firstName, lastName }`
        *   Creates a GCal event. Title: `"${primaryBookerData.firstName} ${primaryBookerData.lastName} - ${sessionTypeData.label}"`.
        *   Start/End: Based on `sessionData.appointment_datetime` and `sessionTypeData.durationMinutes`.
        *   Description: "Kambo Klarity Session. Client: ${primaryBookerData.firstName} ${primaryBookerData.lastName}. Type: ${sessionTypeData.label}. Waiver Completed. TGID: ${sessionData.telegram_id}".
        *   Returns the `googleEventId` of the created event.
*   **Requirement F (`googleCalendarTool.js` - Update Event Description for Friend - Adapting PH6-30):**
    *   `updateEventDescription(eventId, currentDescription, friendNameOnWaiver)`:
        *   Appends `friendNameOnWaiver` to the GCal event's description under a "Guests:" section, avoiding duplicates.
*   **Requirement G (`googleCalendarTool.js` - Update Event Title for Group - Adapting PH6-30.5):**
    *   `updateEventSummary(eventId, currentSummary, primaryBookerName, sessionTypeLabel, isFirstFriend)`:
        *   If `isFirstFriend` and `currentSummary` doesn't already indicate a group, constructs new title: `"GROUP - ${primaryBookerName} & Friend(s) - ${sessionTypeLabel}"`.
*   **Requirement H (`googleCalendarTool.js` - Get Event Details):**
    *   `getEvent(eventId)`: Fetches event details by ID. Returns event object or null/throws error if not found.
*   **Requirement I (API Handler for `GET /api/slot-check` - Adapting DF-1):**
    *   The API handler for `GET /api/slot-check` must:
        1.  Receive `appointmentDateTimeISO`, `sessionTypeId`, optional `placeholderId`.
        2.  Fetch `SessionType.durationMinutes` using `sessionTypeId`.
        3.  `placeholderValid = false`. If `placeholderId` is provided:
            *   Call `googleCalendarTool.getEvent(placeholderId)`.
            *   If event exists and `isKamboPlaceholderEvent(event)` (checks title/custom property) and not expired (check `creationTimestamp` from custom property + 15 mins), set `placeholderValid = true`.
        4.  Call `googleCalendarTool.isSlotTrulyAvailable(appointmentDateTimeISO, durationMinutes)`.
        5.  Determine `status`:
            *   If `placeholderValid` is true: `status = "RESERVED"`.
            *   Else if `isSlotTrulyAvailable` is true: `status = "AVAILABLE"`.
            *   Else (slot not truly available): `status = "TAKEN"` (or "UNAVAILABLE" if more granularity is possible).
        6.  Return `{ status, placeholderValid }`.
*   **Requirement J (Placeholder Cleanup Cron Job - Adapting DF-1/DF-5):**
    *   Create `src/workers/placeholderCleanupCron.js`.
    *   Scheduled to run e.g., every 5 minutes.
    *   Uses `googleCalendarTool` to:
        1.  `listPotentialPlaceholderEvents()`: Fetches events that might be placeholders (e.g., with specific title prefix or custom property `placeholderType: "KAMBO_KLARITY_15_MIN_HOLD"`).
        2.  For each, `getPlaceholderCreationTime(event)` (from custom property `creationTimestamp`).
        3.  If `currentTime > (creationTime + 15 minutes + buffer e.g. 5 min)`: Call `deleteCalendarEvent(eventId)`.
        4.  Log actions.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Primary changes in `src/tools/googleCalendar.js`, API handlers for `/gcal-placeholder-bookings` and `/slot-check`, and the new `placeholderCleanupCron.js`.
    *   `BookingFlowManager` consumes the tool.
*   **Tech Stack:** Node.js, `googleapis` library, `node-cron`.
*   **DB Schema:** No direct changes, but relies on `SessionType` fields. `Session` stores `googleEventId`.
*   **Security:** Secure Google API auth.
*   **Testing:**
    *   **`googleCalendar.js` Unit Tests:** Mock `googleapis`. Test each method for correct GCal API calls and logic.
    *   **API Handler Unit Tests:** Mock `sessionTypes.js` and `googleCalendar.js`. Test request handling, response construction.
    *   **Cron Job Unit Tests:** Mock `googleCalendar.js`. Test placeholder identification and expiry logic.
    *   **Integration Tests:** Test APIs against a live test GCal. Manually run cron job against test GCal.
*   **Logging:** Detailed logging in `googleCalendar.js` for all GCal API calls. API handlers and cron job should also log their operations.

**Data Flow Example (Placeholder Creation via API):**
1.  Client (`calendar-app.js`) calls `POST /api/gcal-placeholder-bookings` with `{ telegramId, sessionTypeId, appointmentDateTimeISO }`.
2.  API Handler fetches `SessionType` details (label, duration, flow config) using `sessionTypeId`.
3.  API Handler calls `googleCalendarTool.createPlaceholderEvent(...)` with all necessary details.
4.  `googleCalendarTool` creates a GCal event blocking the full session duration, with a 15-min expiry concept for booking, embedding creation time and type in custom properties. Returns `{ placeholderId, expiresAt (15 min from now) }`.
5.  API Handler responds to client with `{ success, placeholderId, expiresAt, sessionTypeDetails (full object) }`.

**Key Edge Cases:**
*   GCal API errors (rate limits, auth failures, calendar not found).
*   Timezone issues in date/time handling for GCal events. Ensure all times are consistently UTC or include timezone info for GCal.
*   Placeholder identification in cron job needs to be precise to avoid deleting wrong events. Custom properties are best.
*   Concurrency: Multiple users trying for the same slot. The `isSlotTrulyAvailable` check before final booking is critical.

---
### Feature 14 (Task 30): Testing Strategy for Dynamic Flows
**(New Task - Consolidates testing considerations from all previous refactored tasks)**

**Goal:**
Define and outline a comprehensive testing strategy for the new `BookingFlowManager` architecture and all associated dynamic booking and invitation flows. This includes unit tests for individual modules, integration tests for API endpoints and service interactions, and end-to-end (E2E) tests covering complete user journeys.

**API Relationships:** N/A (This is a planning/strategy task).

**Detailed Requirements:**

*   **Requirement A (Unit Testing Strategy):**
    *   **`BookingFlowManager` ([`src/core/bookingFlowManager.js`](src/core/bookingFlowManager.js:0) - Task 17):**
        *   Mock all external dependencies (`prismaClient`, `sessionTypesCore`, `googleCalendarTool`, `telegramNotifierTool`, `logger`).
        *   Test each public method (`startPrimaryBookingFlow`, `startInviteAcceptanceFlow`, `continueFlow`/`processWaiverSubmission`, etc.) with various input scenarios:
            *   Different `SessionType` configurations (`waiverType`, `allowsGroupInvites`, `maxGroupSize`).
            *   Primary booker vs. friend flows.
            *   Valid and invalid `flowToken` / `inviteToken`.
            *   Successful and failing external service calls (e.g., GCal slot taken, DB error).
        *   Verify correct `nextStep` determination, calls to mocked services with correct parameters, and error handling.
    *   **API Handlers (`src/handlers/api/bookingFlowApiHandler.js`, etc. - Task 18):**
        *   Mock the `BookingFlowManager` methods they call.
        *   Test request validation (valid/invalid inputs for each endpoint).
        *   Verify correct `BookingFlowManager` methods are called.
        *   Test response formatting for success and various HTTP error codes (400, 403, 404, 409, 500).
    *   **Core Logic/Tools (`src/core/sessionTypes.js`, [`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0), [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) - Tasks 19, 28, 29):**
        *   Test individual functions with mocked dependencies (e.g., mock Prisma for `sessionTypes.js`, mock `googleapis` for `googleCalendar.js`, mock Telegraf for `telegramNotifier.js`).
        *   Verify correct data transformation, external API call parameters, and error handling.
    *   **Bot Command/Callback Handlers (`src/commands/...`, [`src/handlers/callbackQueryHandler.js`](src/handlers/callbackQueryHandler.js:0) - Tasks 25, 27):**
        *   Mock `ctx` (Telegraf context), API calls to `BookingFlowManager` or direct Prisma/Notifier calls.
        *   Test payload/callback data parsing.
        *   Verify correct API calls or service interactions.
        *   Verify correct Telegraf responses (`ctx.reply`, `ctx.editMessageText`, `ctx.answerCbQuery`).
    *   **Frontend Mini-Apps (`public/*.js` - Tasks 20, 21, 24, 26):**
        *   Use a testing framework like Jest with JSDOM for DOM manipulation.
        *   Mock `fetch` or API call helper functions.
        *   Test URL parameter parsing, dynamic content rendering, form validation, event handlers, and correct API payload construction.
        *   Test UI updates based on API responses (success, error, redirects).
    *   **Framework:** Jest.
    *   **Coverage:** Aim for high unit test coverage for critical logic in `BookingFlowManager` and other core modules.

*   **Requirement B (Integration Testing Strategy):**
    *   **API Endpoint Tests (using Supertest or similar):**
        *   Test each API endpoint defined in Task 18 (`/api/booking-flow/*`), Task 24 (`/api/sessions/:sessionId/invite-context`, `/api/sessions/:sessionId/generate-invite-token`), and Task 29 (`/api/gcal-placeholder-bookings`, `/api/slot-check`).
        *   Run against a server instance with a test database.
        *   Mock external third-party services at the tool level (e.g., mock Google Calendar API calls within `googleCalendarTool.js`, mock Telegram API calls within `telegramNotifier.js`).
        *   Verify:
            *   Correct HTTP status codes and response bodies for valid and invalid requests.
            *   Expected side effects (DB changes, calls to mocked external services).
            *   Authentication/authorization logic.
    *   **Service Integration Tests:**
        *   Test interactions between `BookingFlowManager` and its direct dependencies (`sessionTypesCore`, `googleCalendarTool`, `telegramNotifierTool`, `prismaClient`) without mocking the dependencies themselves, but mocking their deeper external calls (e.g., actual GCal/Telegram APIs). This verifies the contract between BFM and its tools.
    *   **Bot Handler Integration Tests:**
        *   Test bot command and callback handlers by sending simulated Telegraf updates to a running bot instance (with services like `BookingFlowManager` API available but external APIs like actual Telegram sending mocked).
        *   Verify DB state changes and calls to mocked external services.

*   **Requirement C (End-to-End (E2E) Testing Strategy):**
    *   **Manual E2E Testing (Primary Focus for Complex Flows):**
        *   Define key user journeys covering various `SessionType` configurations:
            1.  **Primary Booker - No Waiver, No Invites:** Calendar -> Placeholder -> Direct Booking -> Confirmation.
            2.  **Primary Booker - Waiver, No Invites:** Calendar -> Placeholder -> Waiver Form -> Confirmation.
            3.  **Primary Booker - No Waiver, Invites Allowed:** Calendar -> Placeholder -> Direct Booking -> Invite Friends Page -> Generate Invites.
            4.  **Primary Booker - Waiver, Invites Allowed:** Calendar -> Placeholder -> Waiver Form -> Invite Friends Page -> Generate Invites.
            5.  **Invited Friend - Accepts & Completes Waiver:** Receives invite link -> Bot interaction -> Join Session Page -> Waiver Form -> Confirmation.
            6.  **Invited Friend - Declines Invite:** Receives invite link -> Bot interaction -> Declines.
        *   For each journey, manually perform all steps using the Telegram bot and WebApps in a staging/test environment connected to a test Google Calendar and test database.
        *   Verify:
            *   Correct UI display and behavior in all mini-apps.
            *   Correct bot messages and button functionality.
            *   Expected GCal event creation/updates.
            *   Correct notifications to all parties (primary booker, friend, admin).
            *   Correct data persistence in the database (`Session`, `SessionInvite`, `User`).
            *   Correct handling of error conditions (e.g., slot taken, invalid form input).
    *   **Automated E2E Testing (Consider for simpler, critical paths if time allows):**
        *   Tools like Puppeteer (for WebApps) and a Telegram client library (for bot interactions) could be used.
        *   Focus on very high-level flows, like a simple booking confirmation. Full automation of complex multi-user invite flows is challenging.
    *   **Test Data Management:** Prepare a set of `SessionType` configurations in the test database to cover different flow paths. Have test Telegram user accounts for primary booker and friend roles.

*   **Requirement D (Test Environment & Data):**
    *   Maintain a dedicated staging/test environment that mirrors production as closely as possible.
    *   Use a separate test database, seeded with diverse `SessionType` configurations.
    *   Use a dedicated test Google Calendar account.
    *   Configure bot and application with test API keys and environment variables.

*   **Requirement E (Tooling):**
    *   **Unit Tests:** Jest.
    *   **API Integration Tests:** Supertest, Jest.
    *   **E2E Tests:** Manual test plans. (Optional: Puppeteer, Telegram client library).
    *   **CI/CD:** Integrate unit and API integration tests into the CI/CD pipeline to run automatically on commits/PRs.

**Implementation Guide:**

*   **Test Plan Document:** Create a formal test plan document outlining:
    *   Scope of testing for each feature/task.
    *   Specific test cases for unit, integration, and E2E levels.
    *   Test data requirements.
    *   Environment setup.
    *   Roles and responsibilities for testing.
*   **Writing Tests:**
    *   Unit tests should be written alongside feature development.
    *   Integration tests for APIs should be written as APIs are completed.
    *   E2E test cases should be designed based on the defined user journeys.
*   **Execution:**
    *   Unit and integration tests run frequently (CI).
    *   Manual E2E testing performed before major releases or after significant changes to critical flows.

**Key User Journeys for E2E Testing:**

1.  **Journey 1: Primary Booker - Simple Booking (Waiver, No Invites)**
    *   `SessionType` config: `waiverType: "KAMBO_V1"`, `allowsGroupInvites: false`.
    *   Steps: Calendar selection -> Placeholder API -> `BookingFlowManager` redirects to `form-handler.html` -> User submits waiver -> `BookingFlowManager` processes waiver, creates `Session`, creates GCal event, sends confirmations (user, admin).
    *   Verify: Correct redirection, waiver pre-fill, GCal event, DB records, notifications.
2.  **Journey 2: Primary Booker - Group Booking (Waiver, Invites Allowed)**
    *   `SessionType` config: `waiverType: "KAMBO_V1"`, `allowsGroupInvites: true`, `maxGroupSize: 3`.
    *   Steps: Calendar -> Placeholder -> Waiver -> `BookingFlowManager` redirects to `invite-friends.html` -> User generates 2 invite links.
    *   Verify: Redirection to invites page, correct `maxInvites` display, token generation, DB `SessionInvite` records.
3.  **Journey 3: Invited Friend - Full Acceptance**
    *   Prerequisite: Journey 2 completed, invite link generated.
    *   Steps: Friend clicks invite link -> Bot shows details & buttons -> Friend clicks "Accept & View Details" -> `join-session.html` loads -> Friend clicks "Proceed" -> `form-handler.html` (friend waiver) loads -> Friend submits waiver.
    *   Verify: Bot interaction, `join-session.html` display, redirection to waiver, `SessionInvite` status updates, GCal event description/title updates, notifications (friend, primary booker, admin).
4.  **Journey 4: Invited Friend - Declines**
    *   Prerequisite: Journey 2 completed, invite link generated.
    *   Steps: Friend clicks invite link -> Bot shows details & buttons -> Friend clicks "Decline Invite".
    *   Verify: Bot message updates for friend, `SessionInvite` status updated to 'declined_by_friend', primary booker notified of decline.
5.  **Journey 5: Primary Booker - Direct Booking (No Waiver, No Invites)**
    *   `SessionType` config: `waiverType: "NONE"`, `allowsGroupInvites: false`.
    *   Steps: Calendar -> Placeholder API -> `BookingFlowManager` completes booking directly (no redirect to form).
    *   Verify: Direct GCal event creation, DB `Session` record, confirmations.
6.  **Journey 6: Error Handling - Slot Taken**
    *   Simulate slot becoming unavailable after placeholder creation but before primary booker waiver submission.
    *   Verify: `BookingFlowManager` (via `isSlotTrulyAvailable`) detects conflict, waiver submission fails with appropriate error, placeholder potentially cleaned up.

**Logging & Debugging:**
*   Ensure comprehensive logging (as defined in individual tasks) is in place to aid debugging during testing.
*   Use structured logging to easily filter and trace flow execution.

---
### Feature 15 (Task 31): Admin Interface for `SessionType` Management (Placeholder)
**(Placeholder for Original: PH6-XX from `Details_Phase_6_updated.md`)**

**Goal:**
(Future Feature) Provide an administrative interface (details TBD - could be bot commands or a separate web UI) for managing `SessionType` properties, including the new dynamic flow fields: `waiverType`, `allowsGroupInvites`, `maxGroupSize`, and potentially `customFormDefinitions`.

**API Relationships:**
*   This feature would likely involve new API endpoints for CRUD operations on `SessionType` records, secured for admin access.
*   It would interact with `src/core/sessionTypes.js` and `prismaClient` for database operations.

**Detailed Requirements:**
*   **Requirement A (Interface Choice):** To be determined (e.g., dedicated admin web panel, set of secure bot commands).
*   **Requirement B (CRUD Operations):**
    *   **Create:** Allow admins to define new session types with all properties.
    *   **Read:** List all session types and view details of a specific one.
    *   **Update:** Modify existing session type properties, including `waiverType`, `allowsGroupInvites`, `maxGroupSize`, `active` status, `price`, `durationMinutes`, etc.
    *   **Delete:** Allow deactivation or soft deletion of session types (hard deletion might be risky if sessions are linked).
*   **Requirement C (Validation):** Implement input validation for all fields (e.g., `maxGroupSize >= 1`, valid `waiverType` options).
*   **Requirement D (Security):** Ensure the interface and its backing APIs are accessible only to authorized administrators.

**Implementation Guide:**
*   To be detailed when this feature is prioritized for development.
*   Considerations will include:
    *   Choice of technology for the interface (if web-based).
    *   Authentication and authorization mechanisms for admin access.
    *   User experience for managing potentially complex `SessionType` configurations.

**Note:** This is a placeholder specification. The actual implementation will require further detailed planning. The introduction of dynamic flow fields in `SessionType` (Task 19) makes a robust admin interface for managing these settings increasingly important for the long-term maintainability and flexibility of the system.

---
*(End of Phase 6 Detailed Specifications - Refactored)*