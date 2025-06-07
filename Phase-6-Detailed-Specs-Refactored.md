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
    *   ~~`public/join-session.html`~~ **[DEPRECATED]** - Replaced by direct startapp links to form-handler.html
    *   ~~`public/join-session.js`~~ **[DEPRECATED]** - Functionality integrated into form-handler.js startapp detection
    *   ~~`public/join-session.css`~~ **[DEPRECATED]** - Styles no longer needed
    *   `public/booking-confirmed.html` (New - Final confirmation and booking trigger page)
    *   `public/booking-confirmed.js` (New - Logic for the final confirmation page)
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
            *   Display the shareable invite link/token using the new startapp format for one-click WebApp experience: `https://t.me/YOUR_BOT_USERNAME/YourWebAppName?startapp=invite_{token}` (primary method) and legacy format: `https://t.me/YOUR_BOT_USERNAME?start=invite_{token}` (fallback).
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
            *   Copies the full shareable invite link using the new startapp format: `https://t.me/YOUR_BOT_USERNAME/YourWebAppName?startapp=invite_{token}` to the clipboard using `navigator.clipboard.writeText()`. This enables one-click-to-WebApp experience for friends.
            *   Provide visual feedback (e.g., button text changes to "Copied!" temporarily).
        *   **"Share on Telegram" Button (Optional, if feasible):**
            *   Constructs a Telegram share URL: `https://t.me/share/url?url={encoded_invite_link}&text={encoded_message}`.
            *   `url` is the invite link. `text` is a pre-filled message (e.g., "Join me for a Kambo session!").
            *   Opens in a new tab/Telegram app.
    *   The `BOT_USERNAME` and `WEBAPP_NAME` (from `process.env.BOT_USERNAME` and webapp short name) need to be available to the frontend JavaScript to construct startapp links. These can be embedded in the HTML via a server-side template, or fetched from a dedicated configuration API endpoint. Format: `https://t.me/{BOT_USERNAME}/{WEBAPP_NAME}?startapp=invite_{token}`
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

**Requirement I (Enhanced Sharing Options - PH6-26):**
*   **"Share via Other" Button (Native Sharing):**
    *   Implement `navigator.share` API integration for each invite link
    *   Construct share data: `{ title: "Kambo Session Invite", text: "Join my Kambo session!", url: shareUrl }`
    *   Call `navigator.share()` and handle success/error states
    *   Graceful degradation to "Copy Link" if `navigator.share` is undefined
    *   Update UI to "Shared ✔️" state and move to top of list on successful share

*   **Enhanced "Copy Link" Experience:**
    *   Update UI to "Link Copied ✔️" state after copying
    *   Disable share buttons and move shared invites to top of list
    *   Add brief visual feedback animation/toast notification

#### **Requirement J (Advanced Invite Management UI - PH6-21, PH6-23):**
*   **Stepper UI Implementation:**
    *   Add visual stepper/progress indicator at top of page:
        1. "Your Booking Confirmed" ✅
        2. "Invite Friends" (current step, highlighted)
        3. "Session Complete" (future step, grayed out)
    *   Use CSS flexbox and step indicators with connecting lines

*   **Dynamic Invite Generation via Stepper:**
    *   Replace simple "Generate New Invite Link" button with stepper controls
    *   Add "+" button (active if `current_shown_invites < maxInvites`)
    *   Add "-" button (active if `current_shown_invites > count_of_actually_shared_invites`)
    *   Clicking "+" calls `POST /api/sessions/:sessionId/generate-invite-token`
    *   Clicking "-" removes last added, unshared invite UI section
    *   Shared/used links cannot be removed by stepper

*   **Enhanced Invite Status Tracking:**
    *   Real-time status updates with auto-refresh every 30 seconds
    *   Enhanced status indicators with timestamps and progress icons
    *   Visual distinction between pending, shared, accepted, declined, and completed invites
    *   Bulk operations UI (select multiple, resend, cancel)

#### **Requirement K (Inline Query & Rich Telegram Sharing - PH6-25):**
*   **"Share on Telegram" Button Enhancement (Rich Sharing Mode):**
    *   Implement `window.Telegram.WebApp.switchInlineQuery()` integration
    *   Button text: "Share on Telegram (Rich)" next to each generated invite link
    *   On click: `window.Telegram.WebApp.switchInlineQuery('@YOUR_BOT_USERNAME', 'kbinvite_' + invite_token)`
    *   This opens Telegram's chat selection interface automatically
    *   Friend receives rich invite message with Accept/Decline buttons directly in chat
    *   **BYPASSES intermediate steps** - friend goes directly to form-handler.html on Accept
    *   Update UI to "Shared via Telegram ✔️" on successful switch
    *   Disable share buttons and move to top of invite list

*   **Two-Path Sharing Strategy:**
    *   **Rich Sharing Path**: "Share on Telegram (Rich)" → inline query → direct bot interaction → edit-in-place WebApp button
    *   **Link Sharing Path**: "Copy Link" & "Share via Other" → startapp URL → direct form-handler.html WebApp (ONE-CLICK EXPERIENCE)
    *   Both paths lead to same final destination but Link Sharing now achieves true one-click-to-WebApp vision

#### **Requirement L (StartApp Integration - One-Click WebApp Vision):**
*   **StartApp URL Generation:**
    *   Primary sharing method now uses `https://t.me/{BOT_USERNAME}/{WEBAPP_NAME}?startapp=invite_{token}` format
    *   This bypasses traditional bot chat interaction and opens WebApp directly
    *   Legacy format `https://t.me/{BOT_USERNAME}?start=invite_{token}` maintained as fallback for compatibility

*   **Integration with form-handler.html (Detailed Implementation):**
    *   **StartApp Flow Detection:**
        ```javascript
        // On form-handler.js page load
        const startParam = window.Telegram.WebApp.initDataUnsafe.start_param;
        if (startParam && startParam.startsWith('invite_')) {
          const inviteToken = startParam.replace('invite_', '');
          await handleStartAppInviteFlow(inviteToken);
        }
        ```
    *   **API Integration Logic:**
        ```javascript
        async function handleStartAppInviteFlow(inviteToken) {
          showLoadingSpinner('Loading invitation details...');
          try {
            const response = await fetch(`/api/invite-context/${inviteToken}`);
            const data = await response.json();
            if (data.success) {
              initializeInviteFriendForm(data.data);
            } else {
              showError(data.message);
            }
          } catch (error) {
            showError('Failed to load invitation. Please try again.');
          }
          hideLoadingSpinner();
        }
        ```
    *   **Form Rendering:**
        *   Pre-populate session details in form header
        *   Set form type based on `flowConfiguration.formType`
        *   Configure submission endpoint with invite token
        *   Enable friend-specific UI elements and validation
    *   **No intermediate bot messages or additional clicks required - true one-click experience**

*   **Backend API Requirements:**
    *   New endpoint: `GET /api/invite-context/{inviteToken}` must be implemented
    *   Returns session details, SessionType configuration, and friend invitation context
    *   Enables form-handler.html to self-initialize when opened via startapp link
    *   Must validate token and return appropriate error if token invalid/expired

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
                    <span class="invite-link">Link: https://t.me/YourBotName/KamboKlarity?startapp=invite_unique-token-here</span>
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
        *   `handleCopyLinkClick(event)`: Gets token from `event.target.closest('.invite-item').dataset.token`, constructs startapp link (`https://t.me/{botUsername}/KamboKlarity?startapp=invite_{token}`), uses `navigator.clipboard.writeText()`, shows feedback.
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
        1.  Extract `nextStep.url` (to `form-handler.html` with appropriate parameters) and `inviteDetails` from the API response. The `nextStep.url` will already include the `flowToken`.
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
**Requirement G (Enhanced Friend Response API - PH6-29):**
*   **New API Endpoint: `POST /api/session-invites/:token/respond`**
    *   Input: `invite_token` (URL param), JSON body `{ response: 'accepted' | 'declined' }`
    *   Handler logic:
        1. Find `SessionInvite` by token, validate it's 'pending'
        2. Update `SessionInvite.status` to response value
        3. If response === 'accepted':
            - Notify original inviter: "{Friend's placeholder name/ID} is considering your invite!"
            - Notify admin
            - Respond with: `{ success: true, action: 'proceedToBot', deepLink: 'https://t.me/YOUR_BOT_NAME?start=reg_or_waiver_for_invite_' + invite_token }`
        4. If response === 'declined':
            - Notify original inviter: "{Friend's placeholder name/ID} declined your invite."
            - Notify admin
            - Respond with: `{ success: true, action: 'invite_declined', message: "Thank you for responding." }`

#### **Requirement H (Enhanced Deep Link Processing - PH6-30):**
*   **Extended `/start` Command Handler:**
    *   Handle new pattern: `reg_or_waiver_for_invite_TOKEN`
    *   Parse TOKEN (the invite_token)
    *   Find `SessionInvite` by token, verify status is 'accepted_by_friend'
    *   Store `ctx.from.id` (friend's Telegram ID) and `ctx.from.first_name` on SessionInvite record
    *   Check if `friendTelegramId` exists in Users table:
        - If new user: Send registration form link with invite context
        - If existing user: Send waiver form link directly
    *   Set appropriate user state for friend registration/waiver flow

#### **Requirement I (Inline Query Handler Implementation - PH6-25):**
*   **Bot Inline Query Handler:**
    *   Implement `bot.on('inline_query', async (ctx) => { ... })`
    *   If `ctx.inlineQuery.query` starts with `kbinvite_`, parse the invite_token
    *   Fetch `SessionInvite` by invite_token with parent Session details
    *   Construct `InlineQueryResultArticle`:
        - title: "{InviterFirstName} has invited you to a Kambo session!"
        - description: "{SessionTypeLabel} on {FormattedDate} at {FormattedTime}."
        - thumb_url: Optional KamboFrog.png URL
        - input_message_content with rich invite message
        - reply_markup with Accept/Decline inline keyboard buttons
    *   Call `ctx.answerInlineQuery([resultArticle])`

*   **Bot Callback Query Handler for Rich Invites (Edit-in-Place Logic):**
    *   **CRITICAL: Use Edit-in-Place Pattern** - Never send new messages, always edit existing message
    *   Handle `accept_invite_{token}` callback queries from rich sharing:
        1. Validate invite token and update SessionInvite status
        2. Check if friend is registered user
        3. **Immediately edit the original message** to replace Accept/Decline buttons with "Proceed to Waiver" WebApp button
        4. New message text: "✅ Invite accepted! Tap below to complete your waiver."
        5. Single WebApp button: "Complete Waiver" → opens form-handler.html directly
        6. Send notifications to primary booker and admin
    *   Handle `decline_invite_{token}` callback queries:
        1. Update SessionInvite status to declined
        2. **Edit the original message** to remove buttons and show "❌ Invite declined. Thank you for responding."
        3. Notify primary booker and admin
    *   **No separate messages sent** - maintains clean chat experience with instant visual feedback

## New Frontend Components Required

### **Enhanced Friend Registration Flow**
*   **registration-form.html Parameter Support:**
    *   Support `inviteToken` and `friendTelegramId` URL parameters
    *   Modified registration flow for invited friends
    *   Post-registration redirect to waiver form with invite context

*   **form-handler.html Friend Flow Integration (StartApp Support):**
    *   **StartApp Parameter Detection:**
        *   On page load, check `window.Telegram.WebApp.initDataUnsafe.start_param` for `invite_{token}` pattern
        *   If detected, extract token and call `GET /api/invite-context/{inviteToken}` immediately
        *   Show loading spinner with "Loading invitation details..." message during API call
    *   **Self-Initialization Logic:**
        *   Parse API response to determine form type (KAMBO_WAIVER_FRIEND_V1, etc.)
        *   Pre-populate session details in form header (session type, date, time, primary booker name)
        *   Render appropriate waiver form based on `sessionType.waiverType` configuration
        *   Set form submission endpoint to include invite token context
    *   **Enhanced Friend Waiver Flow:**
        *   Streamlined UI specifically designed for invited friends
        *   Automatic session association via invite token (no manual session selection)
        *   Custom completion flow that notifies primary booker and admin
        *   Error handling for expired/invalid invite tokens with helpful messaging
    *   **Fallback Support:**
        *   Maintain existing URL parameter support for backward compatibility
        *   Graceful degradation if startapp parameter detection fails
        *   Support both flow token and invite token initialization paths

## API Endpoints to Add/Modify

### New Endpoints
```javascript
POST /api/session-invites/:token/respond     // Friend accepts/declines invite
GET /api/sessions/:sessionId/invite-context  // Enhanced with stepper data
POST /api/sessions/:sessionId/generate-invite-token // Enhanced with stepper logic
GET /api/invite-context/:inviteToken         // NEW: StartApp integration endpoint
```

### Enhanced Endpoints
```javascript
GET /api/booking-flow/start-invite/:inviteToken // Enhanced for friend registration flow
POST /api/booking-flow/continue                 // Enhanced friend waiver processing
```

### Detailed API Specification: GET /api/invite-context/:inviteToken

**Purpose:** Enable form-handler.html to self-initialize when opened via startapp link, supporting the one-click WebApp vision.

**Parameters:**
- `inviteToken` (URL parameter): The unique invite token from the startapp URL

**Authentication:** None required (token-based validation)

**Response Schema:**
```javascript
// Success Response (200)
{
  "success": true,
  "data": {
    "sessionDetails": {
      "sessionTypeLabel": "Kambo Healing Session", 
      "appointmentDateTime": "2024-06-15T10:00:00Z",
      "appointmentDateTimeFormatted": "June 15, 2024 at 10:00 AM"
    },
    "sessionType": {
      "waiverType": "KAMBO_V1",
      "allowsGroupInvites": true,
      "maxGroupSize": 4
    },
    "inviteContext": {
      "primaryBookerName": "John Doe",
      "friendTelegramId": null,  // To be filled when friend completes waiver
      "status": "pending"
    },
    "flowConfiguration": {
      "formType": "KAMBO_WAIVER_FRIEND_V1", // Specific friend version
      "redirectAfterCompletion": "/booking-success-friend.html",
      "requiresRegistration": true // If friend is not a registered user
    }
  }
}

// Error Response (404/400)
{
  "success": false,
  "error": "INVALID_INVITE_TOKEN",
  "message": "This invitation link is invalid or has expired."
}
```

**Validation Logic:**
1. Validate `inviteToken` exists and is associated with a valid `SessionInvite`
2. Check invite status is 'pending' or 'accepted_by_friend' 
3. Verify parent session is valid and future-dated
4. Return appropriate error messages for expired/invalid tokens

**Integration with form-handler.html:**
- Called when `window.Telegram.WebApp.initDataUnsafe.start_param` contains `invite_{token}`
- Enables form-handler.js to show loading spinner → fetch context → render form
- Supports seamless one-click experience from startapp links

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
### Inline Query Handler
```javascript
bot.on('inline_query', async (ctx) => {
  if (ctx.inlineQuery.query.startsWith('kbinvite_')) {
    const inviteToken = ctx.inlineQuery.query.substring(9);
    // Fetch invite details and create rich sharing result
    // Return formatted InlineQueryResultArticle
  }
});
```

### Enhanced Callback Query Handler (Edit-in-Place Implementation)
```javascript
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  
  if (data.startsWith('accept_invite_')) {
    const inviteToken = data.replace('accept_invite_', '');
    // Validate token and process acceptance
    
    // CRITICAL: Edit the existing message, don't send new one
    await ctx.editMessageText(
      '✅ Invite accepted! Tap below to complete your waiver.',
      {
        reply_markup: {
          inline_keyboard: [[
            { text: 'Complete Waiver', web_app: { url: webAppUrl } }
          ]]
        }
      }
    );
    
    // Send notifications to other parties
  } else if (data.startsWith('decline_invite_')) {
    // Edit message to show declined state with no buttons
    await ctx.editMessageText('❌ Invite declined. Thank you for responding.');
  }
});
```    

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

*   **UX Flow (Friend's Perspective) - Updated for Edit-in-Place:**
    1.  **Rich Invite Path**: Friend receives rich invite in Telegram chat with Accept/Decline buttons
    2.  Friend clicks "Accept" → **Same message instantly transforms** to show "✅ Invite accepted!" with "Complete Waiver" WebApp button
    3.  Friend clicks "Complete Waiver" → form-handler.html opens directly (ONE additional tap, same message location)
    4.  **Link Invite Path**: Friend clicks startapp link → form-handler.html opens immediately (ZERO additional taps)
    5.  **Legacy Link Path**: Friend clicks t.me/?start=invite_ link → bot sends message with session details and buttons
    6.  **Result**: Rich invites achieve 2-tap experience (accept + proceed), Link invites achieve 1-tap experience

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
    ## Testing Strategy Enhancements

### Integration Tests
*   Friend invitation end-to-end flow testing
*   Inline query handler testing with rich sharing
*   Native sharing API testing with fallbacks
*   Stepper UI functionality testing

### Performance Tests
*   Concurrent friend invitation acceptance
*   Real-time status update performance
*   Notification queue performance under load

## Security Considerations

*   Rate limiting on friend response endpoints
*   Invite token validation and expiry
*   Secure inline query result generation
*   Protected friend registration flow


    *   **Integration Tests:**
        *   Requires a running bot instance and a running API server (with `BookingFlowManager` and its dependencies mocked or using a test DB).
        *   Send `/start invite_{valid_token}` to the bot via a test client or manually. Verify the bot's response message and button functionality (WebApp button opens correct URL, decline button sends correct callback).
        *   Test with invalid tokens, used tokens.
    *   **E2E Tests (as part of overall flow testing in Task 30):**
        *   Primary booker generates an invite.
        *   A different test Telegram user clicks the invite link.
        *   Verify the entire sequence: bot message, clicking "Accept & View Details" opens form-handler.html with correct parameters.

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
### ~~Feature 10 (Task 26): `join-session.html` Mini-App for Friend's Initial View~~ **[DEPRECATED]**
**(Adapts Original: PH6-27 from `Details_Phase_6_updated.md`)**

**❌ DEPRECATED:** This feature is no longer needed due to the implementation of startapp URLs that provide direct one-click access to form-handler.html.

**Deprecation Rationale:**
- **StartApp Integration:** Friends now access form-handler.html directly via `https://t.me/{BOT_USERNAME}/{WEBAPP_NAME}?startapp=invite_{token}` 
- **One-Click Experience:** Eliminates intermediate confirmation step, achieving true one-click-to-WebApp vision
- **Rich Invite Edit-in-Place:** Rich invites use edit-in-place pattern to transform Accept button into "Complete Waiver" WebApp button
- **Simplified Flow:** Both link and rich invite paths now lead directly to form-handler.html with appropriate context

**Migration Path:**
- **Link Invites:** StartApp URL → form-handler.html (with startapp parameter detection)
- **Rich Invites:** Accept callback → edit message with "Complete Waiver" WebApp button → form-handler.html
- **Legacy Support:** Existing `/start invite_{token}` links can redirect to startapp URL or show deprecation notice

**Files to Remove/Archive:**
- `public/join-session.html` (redundant)
- `public/join-session.js` (redundant) 
- `public/join-session.css` (redundant)
- Related test files in `tests/public/`

---

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
    *   **Updated Steps:** 
        *   **Rich Invite Path:** Friend receives rich invite -> clicks "Accept" -> message transforms to "Complete Waiver" button -> clicks button -> `form-handler.html` loads -> Friend submits waiver
        *   **Link Invite Path:** Friend clicks startapp link -> `form-handler.html` opens directly -> Friend submits waiver  
        *   **Legacy Path:** Friend clicks `/start invite_` link -> Bot shows details -> Friend clicks "Accept & View Details" -> `form-handler.html` loads -> Friend submits waiver
    *   Verify: Bot interaction, direct form-handler.html access, `SessionInvite` status updates, GCal event description/title updates, notifications (friend, primary booker, admin).
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