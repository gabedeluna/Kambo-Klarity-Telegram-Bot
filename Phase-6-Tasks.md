# Kambo Klarity - Phase 6 Tasks (Re-architected for Dynamic Flow Management)

This document outlines the refactored tasks for Phase 6, building upon the features detailed in `Details_Phase_6_updated.md`. The primary architectural change is the introduction of a **`BookingFlowManager`**. This central orchestrator will manage the dynamic sequences of user interactions (e.g., calendar selection, waiver forms, friend invites) based on `SessionType` configurations. This approach aims to make individual components (like forms and mini-apps) more lightweight and the overall system more flexible and extensible to handle various booking flows.

Tasks are numbered starting from 17.

---

### Task 17: Design & Implement `BookingFlowManager` Core Module
**(New Task, Foundational for Dynamic Flows)**

**Goal:**
Create the central `BookingFlowManager` module responsible for orchestrating dynamic booking and invitation flows based on `SessionType` configurations.

**Key Changes / Logic:**
*   Introduces a new core module to manage multi-step booking processes.
*   This module will be the "brain" determining the sequence of user experiences (e.g., which form to show, when to allow friend invites).

**Detailed Requirements:**
*   **Req A (Module Creation):** Create `src/core/bookingFlowManager.js`.
*   **Req B (State Management):** Design a mechanism to manage the state of an ongoing booking flow (e.g., current step, `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`, `placeholderId`, `inviteToken`, accumulated data, `flowToken` to identify the specific flow instance). This might involve temporary storage or encoding state in tokens.
*   **Req C (Flow Logic):** Implement core logic within `BookingFlowManager` to:
    *   Retrieve `SessionType` details (especially `waiverType`, `allowsGroupInvites`, `maxGroupSize`).
    *   Determine the next step in a flow based on `SessionType` rules and current flow state. Examples:
        *   After calendar selection: Is a waiver needed? Which one? Are invites allowed?
        *   After waiver submission: Proceed to invite friends? Or to confirmation?
        *   For an invited friend: Which waiver (if any) should they see?
    *   Initially, flow logic can be hardcoded based on `waiverType` and `allowsGroupInvites`. (Future: Could be driven by a `flowDefinition` JSON in `SessionType`).
*   **Req D (Step Execution):** The manager should be able to instruct the calling API/client on the next action, e.g., by returning a redirect URL to a specific mini-app (`form-handler.html`, `invite-friends.html`) with necessary context parameters, or by indicating a backend process to run.
*   **Req E (Logging):** Implement comprehensive logging for flow initiation, step transitions, decisions made, and errors encountered.
*   **Req F (Extensibility):** Design with future custom forms and more complex flows in mind.

**Files to Create/Modify:**
*   `src/core/bookingFlowManager.js` (New)
*   Potentially new DB table for flow state if not using tokens/temporary storage.

---

### Task 18: API Endpoints for `BookingFlowManager`
**(New Task, Interface for Orchestrator)**

**Goal:**
Expose secure API endpoints for client-side applications (mini-apps) and the Telegram bot to interact with the `BookingFlowManager` to initiate and progress through booking flows.

**Key Changes / Logic:**
*   Provides the primary HTTP interface for the `BookingFlowManager`.
*   Mini-apps will call these endpoints instead of directly managing complex multi-step logic or redirects.

**Detailed Requirements:**
*   **Req A (Endpoint: Start Primary Booking Flow):**
    *   `POST /api/booking-flow/start-primary`
    *   **Input:** `{ telegramId, sessionTypeId, appointmentDateTimeISO, placeholderId, initialSessionTypeDetails: { waiverType, allowsGroupInvites, maxGroupSize } }` (Client fetches `SessionType` details first, or API can do it).
    *   **Action:** `BookingFlowManager` initializes a new flow for the primary booker, determines the first step.
    *   **Output:** `{ success: true, flowToken: "unique_flow_token", nextStep: { type: "REDIRECT" | "COMPLETE", url?: "path/to/mini-app?params...", message?: "Success message" } }`
*   **Req B (Endpoint: Start Invite Acceptance Flow):**
    *   `GET /api/booking-flow/start-invite/:inviteToken`
    *   **Input:** Path param `inviteToken`, Query param `friend_tg_id`.
    *   **Action:** `BookingFlowManager` validates `inviteToken`, initializes a flow for the invited friend.
    *   **Output:** `{ success: true, flowToken: "unique_flow_token", nextStep: { type: "REDIRECT", url: "path/to/form-handler.html?params...", inviteDetails: { ... } } }` (Includes details for `join-session.html` or initial form).
*   **Req C (Endpoint: Continue Flow / Submit Step Data):**
    *   `POST /api/booking-flow/continue`
    *   **Input:** `{ flowToken: "unique_flow_token", stepId: "current_step_identifier", formData: { ... } }` (e.g., waiver data).
    *   **Action:** `BookingFlowManager` processes submitted data for the current step, performs associated actions (e.g., save waiver, create session), and determines the next step.
    *   **Output:** `{ success: true, nextStep: { type: "REDIRECT" | "COMPLETE", url?: "path/to/mini-app?params...", message?: "Success message", closeWebApp?: true } }`
*   **Req D (Security):** Ensure `flowToken` is secure and cannot be easily guessed or tampered with. Validate `telegramId` against authenticated user where applicable.
*   **Req E (API Handler):** Create a new API handler, e.g., `src/handlers/api/bookingFlowApiHandler.js`, and update `src/routes/api.js`.

**Files to Create/Modify:**
*   `src/routes/api.js` (Modify)
*   `src/handlers/api/bookingFlowApiHandler.js` (New)
*   `src/core/bookingFlowManager.js` (Modify to be called by handlers)

---

### Task 19: Enhance `SessionType` Model & Logic for Dynamic Flows
**(Consolidates and Refines Original: PH6-11.5)**

**Goal:**
Ensure the `SessionType` model in Prisma and its related core logic fully support the dynamic flow decisions required by the `BookingFlowManager`.

**Key Changes / Logic:**
*   `SessionType` becomes the central configuration point for how a booking flow behaves for a particular type of session.
*   This task ensures all necessary fields are present and accessible.

**Detailed Requirements:**
*   **Req A (DB Schema Update - `SessionType`):** Verify/add the following fields to the `SessionType` model in [`prisma/schema.prisma`](prisma/schema.prisma:74):
    *   `waiverType`: String (e.g., "KAMBO_V1", "NONE", "CUSTOM_FORM_ID_XYZ"). Default: "KAMBO_V1". Determines which waiver content/flow is used. If "NONE", waiver step is skipped.
    *   `allowsGroupInvites`: Boolean. Default: `false`. Globally enables/disables the "invite friends" feature for this session type.
    *   `maxGroupSize`: Integer. Default: `1`. Total participants allowed (primary booker + friends).
    *   `customFormDefinitions`: JSON? (Optional, for future use if admins can create fully custom forms and sequences beyond predefined waiver types).
*   **Req B (Migration):** Generate and apply a Prisma migration for any schema changes.
    *   Command: `npx prisma migrate dev --name enhance_sessiontype_for_flows` (or similar).
*   **Req C (Seed Data Update):** Update seed data scripts (e.g., `prisma/seed.js`) for `SessionType` records to include appropriate values for these new/updated fields.
*   **Req D (Core Logic Update):** Modify [`src/core/sessionTypes.js`](src/core/sessionTypes.js:80) (functions like `getById`, `getAllActive`) to retrieve and return these fields. Ensure `BookingFlowManager` and related APIs can easily access this data.

**Files to Create/Modify:**
*   [`prisma/schema.prisma`](prisma/schema.prisma:0) (Modify)
*   `prisma/migrations/` (New migration file)
*   `prisma/seed.js` (Modify, if it exists)
*   [`src/core/sessionTypes.js`](src/core/sessionTypes.js:80) (Modify)

---

### Task 20: Refactor Calendar App for Orchestrated Flow
**(Adapts Original: DF-2, parts of PH6-15)**

**Goal:**
Modify the Calendar Mini-App ([`public/calendar-app.html`](public/calendar-app.html:252)) so that upon slot submission, it initiates the booking process via the `BookingFlowManager` instead of directly redirecting to a hardcoded waiver form.

**Key Changes / Logic:**
*   The calendar app becomes a simpler "slot selector" that hands off to the `BookingFlowManager` to determine the actual next step.
*   Removes hardcoded redirection logic from the calendar app.

**Detailed Requirements:**
*   **Req A (GCal Placeholder Call):**
    *   In [`public/calendar-app.js`](public/calendar-app.js:0), on `submitBookingButton` click, continue to call `POST /api/gcal-placeholder-bookings` (from Task 31, original DF-1) first. This API should return `placeholderId`, `expiresAt`, and crucial `SessionType` details (`waiverType`, `allowsGroupInvites`, `maxGroupSize`).
*   **Req B (Initiate Flow via `BookingFlowManager`):**
    *   After successfully obtaining `placeholderId` and `SessionType` details, [`public/calendar-app.js`](public/calendar-app.js:0) must call the new `POST /api/booking-flow/start-primary` endpoint (from Task 18).
    *   Pass `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`, `placeholderId`, and the fetched `SessionType` details to this API.
*   **Req C (Handle Orchestrator Response):**
    *   The JavaScript in [`public/calendar-app.js`](public/calendar-app.js:0) must handle the response from `/api/booking-flow/start-primary`.
    *   If `response.nextStep.type === "REDIRECT"`, redirect the user to `response.nextStep.url`. This URL will point to the appropriate mini-app (e.g., `form-handler.html` for a waiver) with necessary parameters, including the `flowToken`.
*   **Req D (UI/UX):** Maintain loading states (e.g., "Reserving slot...", "Preparing your booking...") during these API calls.

**Files to Create/Modify:**
*   [`public/calendar-app.js`](public/calendar-app.js:0) (Modify)
*   [`public/calendar-api.js`](public/calendar-api.js:0) (Modify to include call to `/api/booking-flow/start-primary`)

---

### Task 21: Generic Form Handler Mini-App & Service
**(New Task, Replaces specific waiver form logic with a generic handler)**

**Goal:**
Create a new generic mini-app (`public/form-handler.html`) and corresponding JavaScript (`public/form-handler.js`) that can dynamically render and process different forms (initially the Kambo waiver, later potentially others) based on instructions from the `BookingFlowManager`.

**Key Changes / Logic:**
*   Decouples form presentation and submission from specific form types.
*   The `BookingFlowManager` dictates which form to show and provides its definition/content.
*   The existing [`public/waiver-form.html`](public/waiver-form.html:0) will be refactored/replaced by this generic handler for waiver display.

**Detailed Requirements:**
*   **Req A (Mini-App Creation):** Create `public/form-handler.html` and `public/form-handler.js`.
*   **Req B (Parameter Parsing):** `form-handler.js` must parse `flowToken` and `formType` (e.g., "KAMBO_WAIVER_V1", "CUSTOM_FORM_XYZ") from URL parameters.
*   **Req C (Fetch Form Definition - Optional for V1):**
    *   Initially, for the Kambo waiver, the form structure can be hardcoded within `form-handler.html` and shown/hidden based on `formType`.
    *   Future: Could fetch form structure/schema from an API endpoint like `GET /api/forms/:formTypeOrId` if forms become highly dynamic.
*   **Req D (Dynamic Rendering):**
    *   Based on `formType`, render the appropriate form fields. For the Kambo waiver, this means rendering the fields currently in [`public/waiver-form.html`](public/waiver-form.html:0).
    *   Pre-fill data: Parse `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`, `placeholderId`, `inviteToken` from URL (passed by `BookingFlowManager`). Fetch user data (`GET /api/user-data`) and session type details (`GET /api/session-types/:id`) for pre-filling, similar to original PH6-16.
*   **Req E (Form Submission):**
    *   On submission, collect all form data, including hidden fields (`flowToken`, `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`, `placeholderId`, `inviteToken`).
    *   Submit data to `POST /api/booking-flow/continue` (from Task 18), passing the `flowToken`, a `stepId` (e.g., "waiver_submission"), and the `formData`.
*   **Req F (Handle Orchestrator Response):**
    *   Handle the response from `/api/booking-flow/continue`.
    *   If `response.nextStep.type === "REDIRECT"`, redirect to `response.nextStep.url`.
    *   If `response.nextStep.type === "COMPLETE"`, display `response.nextStep.message` and potentially call `Telegram.WebApp.close()` if `response.nextStep.closeWebApp` is true.
*   **Req G (Visual Consistency & Conditional Logic):**
    *   Adopt dark theme, video background, typography from [`public/calendar-app.html`](public/calendar-app.html:0).
    *   Implement conditional logic for primary booker vs. invited friend (reservation countdown, Telegram Back Button behavior, pre-submission slot checks for primary booker) as detailed in original DF-3, but driven by parameters passed by `BookingFlowManager` via URL.
*   **Req H (Refactor Existing Waiver):** The content and client-side logic of [`public/waiver-form.html`](public/waiver-form.html:0) and its CSS/JS will be largely moved into or adapted for this new `form-handler.html`. The old `waiver-form.html` might be deprecated or become a template.

**Files to Create/Modify:**
*   `public/form-handler.html` (New)
*   `public/form-handler.js` (New)
*   `public/form-handler.css` (New, or adapt [`public/waiver-form.css`](public/waiver-form.css:0))
*   [`public/waiver-form.html`](public/waiver-form.html:0) (Refactor/Deprecate)
*   [`public/waiver-form.css`](public/waiver-form.css:0) (Refactor/Deprecate)
*   `src/routes/api.js` (Modify for potential form definition API)
*   `src/handlers/apiHandler.js` (Modify for potential form definition API)

---

### Task 22: `BookingFlowManager` - Waiver Processing Logic
**(Adapts Original: PH6-17, PH6-30, DF-4)**

**Goal:**
Implement logic within `BookingFlowManager` (called via `POST /api/booking-flow/continue` when `stepId` is "waiver_submission") to handle submitted waiver data for both primary bookers and invited friends.

**Key Changes / Logic:**
*   Centralizes the complex backend processing that occurs after a waiver is submitted.
*   This includes session creation, GCal event management, notifications, and determining the next flow step.

**Detailed Requirements:**
*   **Req A (Data Reception):** `BookingFlowManager` receives `flowToken`, `formData` (including waiver answers, `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`, `placeholderId?`, `inviteToken?`).
*   **Req B (Conditional Logic - Primary Booker vs. Friend):**
    *   **If `inviteToken` is present (Friend's Waiver):**
        1.  Validate `inviteToken`, fetch `SessionInvite` and `parentSession`.
        2.  Update `SessionInvite` status to 'waiver_completed_by_friend', store `friendTelegramId`, `friendNameOnWaiver`, and `friendLiabilityFormData`.
        3.  Notify primary booker (Original PH6-33).
        4.  Notify admin (Original PH6-34).
        5.  Update GCal event description and title (Original PH6-30, PH6-30.5).
        6.  Send confirmation to friend (Original PH6-31).
        7.  Determine next step: Usually "COMPLETE" with a success message for the friend.
    *   **If `placeholderId` is present (Primary Booker with GCal Placeholder):**
        1.  Attempt to delete placeholder GCal event. Log if already gone.
        2.  **Final Slot Availability Check:** Query GCal to ensure slot is still free. If not, return error ("Slot was taken..."), next step is "ERROR".
        3.  Proceed to create *actual* GCal event and `Session` record.
        4.  Fetch `SessionType` details (if not already in flow state) to get `allowsGroupInvites`, `maxGroupSize`.
        5.  Determine next step: If `allowsGroupInvites`, redirect to `invite-friends.html`. Otherwise, "COMPLETE".
    *   **If no `inviteToken` and no `placeholderId` (Original Primary Booker Flow):**
        1.  Proceed to create GCal event and `Session` record.
        2.  Fetch `SessionType` details for `allowsGroupInvites`, `maxGroupSize`.
        3.  Determine next step as above.
*   **Req C (Session Creation - Primary Booker):** Create `Session` record: `telegram_id`, `session_type_id_fk`, `appointment_datetime` (UTC), `status: 'CONFIRMED'`, `liability_form_data`.
*   **Req D (Google Calendar Event - Primary Booker):** Call [`googleCalendarTool.createCalendarEvent`](src/tools/googleCalendar.js:0). Store `googleEventId` on `Session`.
*   **Req E (Bot Message Update - Primary Booker):**
    *   Fetch `user.edit_msg_id`. Use [`telegramNotifier.editMessageText`](src/tools/telegramNotifier.js:0) (or photo equivalent).
    *   Content: Frog picture, confirmation text. Conditionally add "Invite Friends" button if `allowsGroupInvites` (Original PH6-24).
*   **Req F (Clear `edit_msg_id` - Primary Booker):** Set `user.edit_msg_id = null`.
*   **Req G (Admin Notification - Primary Booker):** Use [`telegramNotifier.sendAdminNotification`](src/tools/telegramNotifier.js:0).
*   **Req H (Atomicity/Error Handling):** Log detailed errors. Attempt compensation if critical step fails. Notify admin of critical failures.
*   **Req I (Return Next Step):** The `BookingFlowManager` must return the `nextStep` object to the `/api/booking-flow/continue` API handler.

**Files to Create/Modify:**
*   `src/core/bookingFlowManager.js` (Modify)
*   [`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0) (Ensure functions for placeholder deletion, final slot check, event creation/update are robust)
*   [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) (Ensure functions for various notifications and message edits are robust)
*   [`prisma/schema.prisma`](prisma/schema.prisma:0) (Ensure `SessionInvite` has `friendLiabilityFormData` Json field, add migration if needed).

---

### Task 23: DB Updates for Invites & Group Size Management
**(Consolidates Original: PH6-18)**

**Goal:**
Modify the database schema to robustly support the "Invite Friends" functionality, ensuring `SessionType` is the sole determinant for group invite capabilities and size. Create the `SessionInvite` table.

**Key Changes / Logic:**
*   Centralizes group invite configuration on `SessionType`.
*   Removes any conflicting group size logic from `AvailabilityRule`.

**Detailed Requirements:**
*   **Req A (`SessionType` Model Update - from Task 19, reiterated for context):**
    *   Ensure `SessionType` in [`prisma/schema.prisma`](prisma/schema.prisma:457) includes `allowsGroupInvites` (Boolean) and `maxGroupSize` (Integer).
*   **Req B (`AvailabilityRule` Model Update - Removal):**
    *   If `max_group_invites` or `max_group_size_override` exists on `AvailabilityRule` in [`prisma/schema.prisma`](prisma/schema.prisma:463), it must be **removed**.
*   **Req C (`SessionInvite` Model Creation):**
    *   Define `SessionInvite` in [`prisma/schema.prisma`](prisma/schema.prisma:466) with fields: `id`, `parentSessionId` (FK to `Session`), `inviteToken` (Unique), `status` (String, e.g., 'pending', 'accepted_by_friend', 'declined_by_friend', 'waiver_completed_by_friend', 'expired'), `friendTelegramId` (BigInt?), `friendNameOnWaiver` (String?), `friendLiabilityFormData` (Json?), `createdAt`, `updatedAt`.
    *   Add relation from `Session` to `SessionInvite[]`.
*   **Req D (Database Migration):** Generate and apply a Prisma migration: `npx prisma migrate dev --name update_invites_db_structure_v2`.
*   **Req E (Seed Data Update):** Update seed scripts for `SessionType` and remove any seeding for removed `AvailabilityRule` fields.

**Files to Create/Modify:**
*   [`prisma/schema.prisma`](prisma/schema.prisma:0) (Modify)
*   `prisma/migrations/` (New migration file)
*   `prisma/seed.js` (Modify, if it exists)

---

### Task 24: Refactor `invite-friends.html` for Orchestrated Flow
**(Adapts Original: PH6-21, PH6-23, PH6-25)**

**Goal:**
Modify the `invite-friends.html` Mini-App. It will be loaded based on a redirect from the `BookingFlowManager`. It will fetch its context, allow generation of invite tokens, and display invite statuses, all by interacting with new or existing APIs that might be fronted or informed by the `BookingFlowManager`.

**Key Changes / Logic:**
*   `invite-friends.html` is now a step in a larger flow, invoked by `BookingFlowManager`.
*   It receives `flowToken` (optional, if state needs to be passed back), `sessionId`, and `telegramId` via URL.

**Detailed Requirements:**
*   **Req A (Parameter Parsing):** `public/invite-friends.js` parses `sessionId`, `telegramId`, and potentially `flowToken` from URL.
*   **Req B (API Call for Context - `GET /api/sessions/:sessionId/invite-context`):**
    *   On page load, call `GET /api/sessions/:sessionId/invite-context` (Original PH6-20) using `sessionId` and `telegramId`. This API provides `maxInvites` (derived from `SessionType.maxGroupSize`), session details, and `existingInvites`.
*   **Req C (Dynamic Content Display):** Display session info, remaining invites, list of existing invites with status and shareable link/token (e.g., `https://t.me/YourBotName?start=invite_{token}`).
*   **Req D (UI for Generating Invites - `POST /api/sessions/:sessionId/generate-invite-token`):**
    *   Button to trigger `POST /api/sessions/:sessionId/generate-invite-token` (Original PH6-22).
    *   On success, dynamically add new invite to list, update remaining count, disable button if limit reached.
*   **Req E (Copy Link & Share):** Implement "Copy Link" for each invite. "Share on Telegram" button (Original PH6-25).
*   **Req F (Status Updates):** Implement re-fetch of invite context on page focus or manual refresh to update statuses (Original PH6-32).
*   **Req G (Styling & UX):** Dark theme, video background.
*   **Req H (Error Handling):** For missing params or API failures.
*   **Req I (Closing the Loop - Optional):** Consider if a "Done" button is needed to signal completion of this step to `BookingFlowManager` via `POST /api/booking-flow/continue` with the `flowToken`. For MVP, it might just close (`Telegram.WebApp.close()`).

**Files to Create/Modify:**
*   `public/invite-friends.html` (Modify)
*   `public/invite-friends.js` (Modify)
*   `public/invite-friends.css` (Modify or use shared)
*   `src/routes/api.js` (Ensure APIs PH6-20, PH6-22 exist and are robust)
*   `src/handlers/api/sessionInviteApiHandler.js` (Ensure handlers for PH6-20, PH6-22 exist)

---

### Task 25: Bot - Handle `/start invite_{token}` Deep Link & Initiate Friend Flow
**(Adapts Original: PH6-26)**

**Goal:**
Enable the bot's `/start` command to recognize `invite_{token}` deep links. When a friend clicks, the bot validates the token and initiates the friend's acceptance flow via the `BookingFlowManager`.

**Key Changes / Logic:**
*   Bot hands off to `BookingFlowManager` instead of managing the friend's UI directly.

**Detailed Requirements:**
*   **Req A (Deep Link Parsing):** `/start` command handler parses `invite_{token}`.
*   **Req B (Initiate Friend Flow via `BookingFlowManager`):**
    *   Call `GET /api/booking-flow/start-invite/:inviteToken?friend_tg_id={friend_tg_id}` (from Task 18).
*   **Req C (Handle Orchestrator Response):**
    *   The response from `/api/booking-flow/start-invite` will contain `nextStep.url` (pointing to `join-session.html` or `form-handler.html` with `flowToken`) and `inviteDetails`.
    *   Send a message to the friend: "You've been invited by [Primary Booker Name] to [Session Type] on [Date/Time]. Click below to see details and accept."
    *   Button: "View Invite & Accept" opening the `nextStep.url` as a WebApp.
*   **Req D (Decline Option):** Include a "Decline Invite" callback button (`decline_invite_{token}`).
*   **Req E (Error Handling):** If token invalid (checked by `BookingFlowManager` API), inform friend.

**Files to Create/Modify:**
*   [`src/commands/handlers.js`](src/commands/handlers.js:0) or `/start` command file (Modify)
*   [`src/handlers/commandHandler.js`](src/handlers/commandHandler.js:0) or [`src/middleware/updateRouter.js`](src/middleware/updateRouter.js:0) (Modify)

---

### Task 26: `join-session.html` Mini-App for Friend's Initial View
**(Adapts Original: PH6-27)**

**Goal:**
Create/Refactor `public/join-session.html`. This page is opened when a friend clicks "View Invite & Accept" from the bot. It displays invite details (fetched via an API that could be a direct call or part of the `BookingFlowManager`'s initial response for the friend flow) and provides a button to proceed, which then continues the flow via `BookingFlowManager`.

**Key Changes / Logic:**
*   This page acts as an interstitial/confirmation before the friend proceeds to a form (if any).
*   It receives `flowToken` and initial invite details via URL parameters from the `BookingFlowManager`'s redirect.

**Detailed Requirements:**
*   **Req A (Parameter Parsing):** `public/join-session.js` parses `flowToken`, `inviteToken`, `friend_tg_id`, and pre-fetched invite details (primary booker name, session type, date/time) from URL.
*   **Req B (Content Display):** Display welcome message, primary booker name, session details.
*   **Req C (Proceed Button):**
    *   Button: "Accept & Continue" or "Proceed to Waiver".
    *   On click, calls `POST /api/booking-flow/continue` with `flowToken` and a `stepId` (e.g., "friend_accepted_invite_details").
*   **Req D (Handle Orchestrator Response):** Redirect to next step (likely `form-handler.html` for waiver) based on `BookingFlowManager`'s response.
*   **Req E (Styling & UX):** Dark theme, video background.
*   **Req F (Error Handling):** For missing params.

**Files to Create/Modify:**
*   `public/join-session.html` (New or Modify)
*   `public/join-session.js` (New or Modify)
*   `public/join-session.css` (New or use shared)

---

### Task 27: Bot - Handle "Decline Invite" Callback via `BookingFlowManager`
**(Adapts Original: PH6-28)**

**Goal:**
When a friend clicks "Decline Invite" (from Task 25), the bot's callback handler updates the `SessionInvite` status to 'declined_by_friend' and notifies the primary booker. This might involve a specific call to `BookingFlowManager` or direct DB update + notification.

**Key Changes / Logic:**
*   Ensures declines are centrally recorded and communicated.

**Detailed Requirements:**
*   **Req A (Callback Parsing):** Handler for `decline_invite_{token}`.
*   **Req B (Update Invite Status):**
    *   Option 1 (Via `BookingFlowManager`): Call a new endpoint like `POST /api/booking-flow/decline-invite` with `inviteToken` and `friend_tg_id`. `BookingFlowManager` updates DB and triggers notifications.
    *   Option 2 (Direct): Callback handler updates `SessionInvite` status to 'declined_by_friend', stores `friendTelegramId`.
*   **Req C (Feedback to Friend):** Answer callback, edit original message to confirm decline.
*   **Req D (Notify Primary Booker):** Inform primary booker about the decline. (This logic could be in `BookingFlowManager` if Option 1 is chosen).

**Files to Create/Modify:**
*   [`src/handlers/callbackQueryHandler.js`](src/handlers/callbackQueryHandler.js:0) (Modify)
*   `src/core/bookingFlowManager.js` (Modify, if handling decline logic)
*   `src/routes/api.js` (Modify, if new endpoint for decline)
*   `src/handlers/api/bookingFlowApiHandler.js` (Modify, if new endpoint for decline)
*   [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) (For notifications)

---

### Task 28: Notifications Refactor for `BookingFlowManager`
**(Consolidates Original: PH6-31, PH6-33, PH6-34 and parts of PH6-17, PH6-24)**

**Goal:**
Ensure all Telegram notifications (to user, friend, admin) related to booking steps, invite status changes, and confirmations are triggered appropriately by the `BookingFlowManager` or its associated API handlers at the correct points in the flow.

**Key Changes / Logic:**
*   Centralizes notification triggering logic or ensures `BookingFlowManager` calls appropriate notifier functions.

**Detailed Requirements:**
*   **Req A (Primary Booker Confirmation - Post Waiver/Direct Booking):**
    *   Triggered by `BookingFlowManager` after successful session creation for primary booker.
    *   Includes frog pic, confirmation text.
    *   Conditionally includes "Invite Friends" button (WebApp link to `invite-friends.html`) if `SessionType.allowsGroupInvites` is true and `BookingFlowManager` determines this is the next step.
*   **Req B (Admin Notification - Primary Booker's Session):**
    *   Triggered by `BookingFlowManager` after successful session creation for primary booker.
*   **Req C (Friend's Confirmation - Post Waiver):**
    *   Triggered by `BookingFlowManager` after friend successfully submits waiver.
    *   Sent to `friendTelegramId`. Confirms their spot.
*   **Req D (Primary Booker Notification - Friend Waiver Completed):**
    *   Triggered by `BookingFlowManager` after friend successfully submits waiver.
    *   Informs primary booker that their friend has confirmed.
*   **Req E (Admin Notification - Friend Joins Session):**
    *   Triggered by `BookingFlowManager` after friend successfully submits waiver.
    *   Informs admin a guest has confirmed for a session.
*   **Req F (Primary Booker Notification - Friend Declined):**
    *   Triggered by `BookingFlowManager` (or callback handler if direct) when friend declines.
*   **Req G ([`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) Review):** Ensure `telegramNotifier.js` has flexible functions to send these varied notifications with appropriate content and inline keyboards where needed.

**Files to Create/Modify:**
*   `src/core/bookingFlowManager.js` (Modify to trigger notifications)
*   [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) (Modify/Enhance)

---

### Task 29: Google Calendar Integration Refinements for Orchestrated Flow
**(Consolidates Original: Parts of PH6-17, PH6-30, PH6-30.5, DF-1, DF-4, DF-5)**

**Goal:**
Ensure all Google Calendar interactions (placeholder creation, final event creation, updates for friend invites, placeholder cleanup) are correctly managed within the new `BookingFlowManager` architecture.

**Key Changes / Logic:**
*   GCal operations are now primarily invoked by `BookingFlowManager` at appropriate flow stages.

**Detailed Requirements:**
*   **Req A (Enhanced GCal Placeholder API - `POST /api/gcal-placeholder-bookings`):**
    *   (Original DF-1) This API is called by `calendar-app.js` *before* initiating the flow with `BookingFlowManager`.
    *   It creates the GCal placeholder.
    *   **Crucially, it must return `placeholderId`, `expiresAt`, AND the relevant `SessionType` details (`waiverType`, `allowsGroupInvites`, `maxGroupSize`, `sessionTypeId`, `appointmentDateTimeISO`) to the calendar app.** These details are then passed to `POST /api/booking-flow/start-primary`.
*   **Req B (`BookingFlowManager` - Placeholder Deletion & Final Slot Check):**
    *   (Original DF-4) When processing primary booker's waiver via `BookingFlowManager`, it must:
        1.  Attempt to delete the GCal placeholder (using `placeholderId` from flow state).
        2.  Perform a final GCal slot availability check *before* creating the confirmed event. If slot taken, flow returns error.
*   **Req C (`BookingFlowManager` - Confirmed Event Creation):**
    *   (Original PH6-17) After successful waiver processing (and slot check) for primary booker, `BookingFlowManager` creates the confirmed GCal event.
*   **Req D (`BookingFlowManager` - GCal Updates for Friends):**
    *   (Original PH6-30, PH6-30.5) When a friend completes their waiver, `BookingFlowManager` updates the primary booker's GCal event:
        *   Append friend's name to description.
        *   If first friend, update event title to "GROUP - ...".
*   **Req E (Cron Job for Placeholder Cleanup):**
    *   (Original DF-5) Implement server-side cron job (`src/workers/placeholderCleanupCron.js`) to delete expired 15-min GCal placeholders. This runs independently but complements the flow.
*   **Req F ([`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0) Robustness):** Ensure all GCal tool functions are robust, handle errors, and provide clear logging.

**Files to Create/Modify:**
*   `src/routes/api.js` (Modify `POST /api/gcal-placeholder-bookings` handler)
*   `src/handlers/apiHandler.js` (Modify `POST /api/gcal-placeholder-bookings` handler)
*   `src/core/bookingFlowManager.js` (Modify for GCal operations)
*   [`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0) (Enhance/Verify)
*   `src/workers/placeholderCleanupCron.js` (New, or integrate scheduling into `bin/server.js`)
*   `bin/server.js` (Modify to schedule cron job if applicable)

---

### Task 30: Testing Strategy for Dynamic Flows
**(New Task, Essential for Complex Logic)**

**Goal:**
Define and implement a testing strategy covering unit, integration, and E2E tests for the new `BookingFlowManager` and the refactored booking/invite flows.

**Key Changes / Logic:**
*   Focus testing on the `BookingFlowManager`'s decision logic and its interactions with other services (APIs, DB, GCal, Notifier).
*   Test various `SessionType` configurations to ensure dynamic behavior.

**Detailed Requirements:**
*   **Req A (Unit Tests - `BookingFlowManager`):**
    *   Mock dependencies (Prisma, GCal tool, Notifier).
    *   Test flow initiation for primary bookers and friends.
    *   Test step progression logic with different `SessionType` settings (waiver vs. no waiver, invites vs. no invites).
    *   Test waiver processing logic (primary vs. friend, placeholder vs. no placeholder).
    *   Test GCal update logic for friend invites.
    *   Test notification triggering logic.
*   **Req B (Unit Tests - API Handlers):** Test API handlers for `BookingFlowManager` endpoints, mocking the `BookingFlowManager` itself.
*   **Req C (Unit Tests - Mini-Apps):** Test client-side JavaScript in `calendar-app.js`, `form-handler.js`, `invite-friends.js`, `join-session.js` for:
    *   Parameter parsing.
    *   API calls to `BookingFlowManager` endpoints.
    *   Response handling and redirection.
    *   DOM updates.
*   **Req D (Integration Tests - API Endpoints):**
    *   Test `BookingFlowManager` API endpoints (`/api/booking-flow/...`) with a test DB and mocked external services (GCal, Telegram).
    *   Verify correct flow progression, data storage, and `nextStep` responses for various scenarios.
*   **Req E (E2E Tests):**
    *   Simulate full user journeys using a tool like Puppeteer or Playwright if possible, or conduct thorough manual E2E testing.
    *   Test scenarios:
        *   Primary booker, session type with waiver & invites.
        *   Primary booker, session type with no waiver & invites.
        *   Primary booker, session type with waiver & no invites.
        *   Primary booker, session type with no waiver & no invites (direct booking).
        *   Friend invite flow: invite generation, friend accepts via deep link, views details, completes waiver.
        *   Friend declines invite.
        *   Placeholder expiry and slot conflict scenarios.
*   **Req F (Test Data):** Prepare diverse seed data for `SessionType` to cover different flow configurations.

**Files to Create/Modify:**
*   New test files in `tests/core/`, `tests/handlers/api/`, `tests/public/` (or similar structure).
*   Update `prisma/seed.js` for test `SessionType` data.

---

### Task 31: Admin Interface for `SessionType` Management (Placeholder)
**(Original: PH6-XX)**

**Goal:**
Provide an administrative interface for managing `SessionType` properties, including `waiverType`, `allowsGroupInvites`, `maxGroupSize`, and potentially `customFormDefinitions`.

**Note:** This remains a placeholder. Implementation details (bot commands vs. web UI) TBD. Its existence is critical for realizing the full flexibility of the dynamic flow system.

---

This re-architected task list should provide a more robust and maintainable foundation for the complex booking and invitation flows.