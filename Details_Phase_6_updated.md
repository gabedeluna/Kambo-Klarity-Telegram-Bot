# Kambo Klarity - Phase 6 (A, B, C) Detailed Technical Specifications

This document provides detailed technical specifications for the features in Phase 6A, 6B, and 6C of the Kambo Klarity project. It builds upon the design brief outlined in `Features_Phase_6.md`.

## Overall File System Considerations

*   **Frontend (Mini-Apps in `public/` directory):**
    *   [`public/calendar-app.html`](public/calendar-app.html:0) (Existing)
        *   JavaScript: [`public/calendar-app.js`](public/calendar-app.js:0), [`public/calendar-api.js`](public/calendar-api.js:0), [`public/calendar-data.js`](public/calendar-data.js:0), [`public/calendar-ui.js`](public/calendar-ui.js:0) (Existing)
    *   [`public/waiver-form.html`](public/waiver-form.html:0) (Existing)
        *   JavaScript: (Assumed to be within `<script>` tags in the HTML or a new `public/waiver-form.js`)
        *   CSS: [`public/waiver-form.css`](public/waiver-form.css:0) (Existing)
    *   `public/invite-friends.html` (New HTML page for primary booker to manage and generate invite links)
    *   `public/invite-friends.js` (New JavaScript for `invite-friends.html` logic)
    *   `public/invite-friends.css` (New CSS, or leverage shared styles)
    *   `public/join-session.html` (New HTML page for invited friends to view invite details and respond)
    *   `public/join-session.js` (New JavaScript for `join-session.html` logic)
    *   `public/join-session.css` (New CSS, or leverage shared styles)
    *   Shared CSS/JS modules in `public/` as needed (e.g., for consistent styling, utility functions).
*   **Backend (in `src/` directory):**
    *   [`src/routes/api.js`](src/routes/api.js:0): Will be updated to include new API endpoints for session invites and potentially waiver submission enhancements.
    *   [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0): Will be updated, or new specific API handlers will be created (e.g., `src/handlers/api/sessionInviteApiHandler.js`, `src/handlers/api/waiverApiHandler.js`) to manage logic for new API endpoints.
    *   [`src/handlers/callbackQueryHandler.js`](src/handlers/callbackQueryHandler.js:0): Will be updated to handle invite acceptance/declines if these actions are triggered via inline query buttons from the bot.
    *   [`src/handlers/commandHandler.js`](src/handlers/commandHandler.js:0) (or [`src/middleware/updateRouter.js`](src/middleware/updateRouter.js:0)): Will be updated to handle `/start` deep links for friend invite acceptance and potentially inline queries for sharing invites.
    *   [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0): May be updated for new notification types related to invites (e.g., notifying inviter about friend's status).
    *   [`prisma/schema.prisma`](prisma/schema.prisma:0): Will be updated with the `SessionInvite` model and modifications to `AvailabilityRule` (addition of `max_group_invites`).
    *   New migration files will be generated in `prisma/migrations/` reflecting schema changes.
    *   Existing tools like [`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0), [`src/tools/stateManager.js`](src/tools/stateManager.js:0), [`src/core/prisma.js`](src/core/prisma.js:0), [`src/core/sessionTypes.js`](src/core/sessionTypes.js:0) will be utilized.

---

## Feature Specifications

---
### Enhance `SessionType` Model for Dynamic Flows

**Goal:**
Augment the `SessionType` database model and related logic to support dynamic waiver requirements and group invite capabilities per session type.

**API Relationships:**
*   Impacts `GET /api/session-types/:id` (PH6-12) - it will now return these new fields.
*   Impacts `POST /api/gcal-placeholder-bookings` (DF-1) - this API will fetch these new fields to return to the client.
*   Impacts any Admin API used to manage Session Types (future feature - PH6-XX).

**Detailed Requirements:**
*   **Req A (DB Schema Update - `SessionType`):** Add the following fields to the `SessionType` model in [`prisma/schema.prisma`](prisma/schema.prisma:74):
    *   `waiverType`: String (e.g., "KAMBO_V1", "NONE", "ALT_MODALITY_V1"). Default: "KAMBO_V1". This field will determine which waiver content/flow is used.
    *   `allowsGroupInvites`: Boolean. Default: `false`. This field globally enables or disables the "invite friends" feature for this session type.
    *   `maxGroupSize`: Integer. Default: `1`. Represents the total number of participants allowed for a session of this type, including the primary booker. If `allowsGroupInvites` is true, `maxGroupSize` must be > 1. The number of friends that can be invited is `maxGroupSize - 1`.
*   **Req B (Migration):** Generate and apply a Prisma migration for the schema changes.
    *   Command: `npx prisma migrate dev --name enhance_sessiontype_for_dynamic_flows`
*   **Req C (Seed Data Update):** Update seed data scripts (e.g., `prisma/seed.js`) for existing and new `SessionType` records to include appropriate values for `waiverType`, `allowsGroupInvites`, and `maxGroupSize`.
*   **Req D (Core Logic Update):** Modify [`src/core/sessionTypes.js`](src/core/sessionTypes.js:80) (functions like `getById`, `getAllActive`) to retrieve and return these new fields. Ensure any services or API handlers consuming session type data (e.g., [`src/handlers/api/sessionTypesApiHandler.js`](src/handlers/api/sessionTypesApiHandler.js:0)) are updated to handle and potentially utilize these new fields.

**Implementation Guide:**

*   **Architecture Overview:**
    *   This feature primarily involves backend database schema modifications and updates to core data access logic.
    *   Tech Stack: PostgreSQL, Prisma ORM, Node.js.
    *   Deployment: Requires running Prisma migrations as part of the deployment process.
*   **DB Schema (`prisma/schema.prisma`):**
    *   Modify the `SessionType` model:
      ```prisma
      model SessionType {
        // ... existing fields ...
        waiverType          String   @default("KAMBO_V1")
        allowsGroupInvites  Boolean  @default(false)
        maxGroupSize        Int      @default(1)
        // ... existing relations ...
      }
      ```
    *   Consider adding an `@updatedAt` field if not already present for auditing changes to session types.
*   **API Design:**
    *   **`GET /api/session-types/:id` (Modification):**
        *   **Response (Success 200 - Example with new fields):**
          ```json
          {
            "success": true,
            "data": {
              "id": "some-uuid-or-id",
              "label": "Standard Kambo Session",
              "durationMinutes": 90,
              "description": "A standard 90-minute Kambo session.",
              "price": 150.00,
              "active": true,
              "waiverType": "KAMBO_V1", // New
              "allowsGroupInvites": true, // New
              "maxGroupSize": 4         // New
            }
          }
          ```
    *   **`POST /api/gcal-placeholder-bookings` (DF-1) (Impact):** This API will need to fetch these new `SessionType` fields (`waiverType`, `allowsGroupInvites`, `maxGroupSize`) after retrieving the `SessionType` by `sessionTypeId` from the request, and include them in its response to the client (calendar app) to enable dynamic redirection logic.
*   **Frontend Structure:**
    *   No direct frontend changes for PH6-11.5 itself, but subsequent features (e.g., calendar app, waiver form, invite friends flow) will consume these new fields via API responses to alter their behavior.
*   **CRUD Operations:**
    *   **Update:** `SessionType` records via seed scripts or future admin interface (PH6-XX).
    *   **Read:** Core logic in [`src/core/sessionTypes.js`](src/core/sessionTypes.js:80) and API endpoints like `GET /api/session-types/:id` will read these new fields.
*   **UX Flow:**
    *   Admin (future): Will manage these new properties per session type.
    *   Client: Will experience different booking flows (e.g., different waivers, option to invite friends) based on these settings for the chosen session type.
*   **Security:**
    *   Ensure that only authorized administrators (future PH6-XX) can modify `SessionType` properties.
    *   Validate `maxGroupSize` (e.g., must be >= 1). If `allowsGroupInvites` is true, `maxGroupSize` should ideally be > 1.
*   **Testing:**
    *   **Unit Tests:**
        *   Test Prisma schema changes (migration applies correctly).
        *   Test updated functions in [`src/core/sessionTypes.js`](src/core/sessionTypes.js:80) to ensure they return the new fields.
        *   Test any logic that consumes these fields (e.g., in API handlers) with mock data.
    *   **Integration Tests:**
        *   Verify `GET /api/session-types/:id` returns the new fields.
        *   Verify seed data updates correctly populate the new fields.
    *   **E2E (Future):** Test full booking flows for session types with different `waiverType`, `allowsGroupInvites`, and `maxGroupSize` settings to ensure dynamic behavior works as expected.
*   **Data Management:**
    *   Existing `SessionType` records will need default values for the new fields upon migration, or the migration script should handle this. Prisma's `@default` handles new records. For existing records, a custom migration step or seeding update is needed if defaults are not suitable.
*   **Logging & Error Handling:**
    *   Log any issues during migration or seed data updates.
    *   Core logic should handle cases where these fields might be unexpectedly null if defaults aren't properly applied during migration to existing records (though `@default` in Prisma helps for new records and schema-level defaults).

---

### Waiver Form: Adapt to Receive & Use Calendar Data

**Goal:**
Enable [`public/waiver-form.html`](public/waiver-form.html:185) to parse context (Telegram ID, Session Type ID, Appointment DateTime ISO) from URL parameters passed by the Calendar Mini-App. Use this data to pre-fill relevant user information (fetched via API) and display appointment context, streamlining the waiver completion process. The form should also adopt a consistent visual style. (As per [`PLANNING.md`](PLANNING.md:286))

**API Relationships:**
*   Consumes URL parameters: `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`.
*   Calls `GET /api/user-data?telegramId={telegramId}` to fetch user's registration details (name, email, phone, DOB, emergency contact) for pre-filling.
    *   Backend: [`src/routes/api.js`](src/routes/api.js:0), handler likely in [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0) or a dedicated user API handler.
*   Calls `GET /api/session-types/{sessionTypeId}` (API from PH6-12) to fetch session `label`.
    *   Backend: [`src/routes/api.js`](src/routes/api.js:0), handler likely in [`src/handlers/api/sessionTypesApiHandler.js`](src/handlers/api/sessionTypesApiHandler.js:0).

**Detailed Requirements:**
*   **Req A (Parameter Parsing):** JavaScript within [`public/waiver-form.html`](public/waiver-form.html:1088) (or an associated `waiver-form.js`) must correctly parse `telegramId`, `sessionTypeId`, and `appointmentDateTimeISO` from the URL query parameters upon page load.
*   **Req B (Data Fetching - Concurrent):**
    *   Initiate API call to `GET /api/user-data?telegramId={telegramId}`.
    *   Initiate API call to `GET /api/session-types/{sessionTypeId}`.
    *   Display subtle loading indicators for sections that will be populated by this data (e.g., appointment details, personal info fields).
*   **Req C (UI Update - Appointment Context):**
    *   Populate the `appointmentInfo` div ([`public/waiver-form.html`](public/waiver-form.html:17)) with:
        *   `appointmentDateTime`: Display `appointmentDateTimeISO` formatted into a user-friendly string (e.g., "Monday, June 10, 2025 at 10:00 AM PST"). Formatting should ideally occur client-side to reflect the user's local timezone.
        *   `sessionType`: Display "Session Type: {Session Label}" using the fetched label.
*   **Req D (UI Update - Pre-fill Form Fields):**
    *   Pre-fill `firstName`, `lastName`, `email`, `phone`, `dob` input fields ([`public/waiver-form.html`](public/waiver-form.html:910)) with data from `GET /api/user-data`.
    *   Pre-fill emergency contact fields (`emergencyFirstName`, `emergencyLastName`, `emergencyPhone`) if available from user data.
*   **Req E (Hidden Fields Population):**
    *   Populate hidden input field `telegramId` with the parsed `telegramId`.
    *   Populate hidden input field `appointmentDateTimeValue` with the raw `appointmentDateTimeISO`.
    *   Populate hidden input field `sessionTypeValue` with the parsed `sessionTypeId`.
*   **Req F (Visual Consistency):**
    *   Ensure [`public/waiver-form.html`](public/waiver-form.html:185) adopts the same aesthetic as [`public/calendar-app.html`](public/calendar-app.html:0): dark theme, video background (as requested: "I want to use the moving background in the waiver form"), similar typography (Manrope, Noto Sans from [`public/calendar-app.html`](public/calendar-app.html:11)), and button styles.
    *   Review and update [`public/waiver-form.css`](public/waiver-form.css:0) for consistency.
*   **Req G (Error Handling):**
    *   If essential URL parameters (`telegramId`, `sessionTypeId`, `appointmentDateTimeISO`) are missing: Display a clear error "Invalid link. Please return to Telegram and try booking again." and potentially disable the form.
    *   If API calls fail: Display an error "Could not load your details. Please try refreshing or contact support." Allow manual entry if pre-fill fails.
*   **Req H (Animations):**
    *   Subtle fade-in for fetched content (appointment details, pre-filled fields).
    *   Video background provides ambient motion.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Client-side logic within the [`public/waiver-form.html`](public/waiver-form.html:185) Mini-App.
    *   Interacts with backend APIs for data enrichment.
    *   Tech Stack: HTML, CSS ([`public/waiver-form.css`](public/waiver-form.css:0)), Vanilla JavaScript (likely embedded in `<script>` tags within [`public/waiver-form.html`](public/waiver-form.html:1088) or a dedicated `public/waiver-form.js`).
*   **DB Schema:** Relies on existing `User` (for `firstName`, `lastName`, `email`, `phoneNumber`, `dateOfBirth`, emergency contacts) and `SessionType` (for `label`) table structures.
*   **API Design:**
    *   **`GET /api/user-data?telegramId={telegramId}`:** (As defined in existing `Details_Phase_6.md` for PH6-16, ensure it returns all necessary fields including emergency contacts).
    *   **`GET /api/session-types/{sessionTypeId}`:** (Existing API from PH6-12, ensure it returns `label`).
*   **Frontend Structure (`waiver-form.html` JavaScript):**
    *   **On Page Load (`DOMContentLoaded`):**
        1.  Parse URL parameters (`telegramId`, `sessionTypeId`, `appointmentDateTimeISO`). Validate presence.
        2.  Show loading state for relevant UI sections.
        3.  Populate hidden input fields (`telegramId`, `appointmentDateTimeValue`, `sessionTypeValue`).
        4.  Concurrently call `fetchUserData(telegramId)` and `fetchSessionTypeDetails(sessionTypeId)`.
        5.  `fetchUserData`: Calls `GET /api/user-data`. On success, pre-fills form fields. Handles API errors.
        6.  `fetchSessionTypeDetails`: Calls `GET /api/session-types/:id`. On success, updates session type display. Handles API errors.
        7.  Format and display `appointmentDateTimeISO` in the `appointmentInfo` div.
        8.  Hide loading state once data is populated or errors are shown.
    *   **Helper functions:** `formatDateForDisplay(isoString)`, `showLoadingState()`, `hideLoadingState()`, `displayWaiverError(message)`.
    *   **Visual Styling:** Ensure CSS rules in [`public/waiver-form.css`](public/waiver-form.css:0) are updated/augmented to match the dark theme, video background setup, typography, and button styles of [`public/calendar-app.html`](public/calendar-app.html:0). This might involve reusing Tailwind CSS classes if a CDN link is added to `waiver-form.html` or defining similar custom styles.
*   **CRUD Operations:** Primarily Read operations via APIs.
*   **UX Flow:**
    1.  [`public/waiver-form.html`](public/waiver-form.html:185) loads after redirect from calendar.
    2.  URL parameters are parsed. Loading indicators appear for dynamic sections.
    3.  API calls initiated to fetch user data and session type details.
    4.  `appointmentInfo` div is populated with formatted date/time and session type.
    5.  Personal information fields (`firstName`, `lastName`, etc.) are pre-filled from fetched user data.
    6.  User reviews pre-filled information and completes the remaining waiver sections.
    *   **Loading States:** Subtle placeholders or spinners for `appointmentInfo` and pre-fillable fields.
    *   **Error States:** Clear messages for missing URL params or API failures. Form should remain usable for manual entry if pre-fill fails.
*   **Security:**
    *   Fetched data for pre-filling should be treated as text content.
    *   The `telegramId` from the URL is used to fetch user data; the `/api/user-data` endpoint should be secure.
*   **Testing:**
    *   **Unit:** Test URL parsing, API call functions (mocked), data formatting, DOM update logic.
    *   **Integration:** Test `waiver-form.html`'s interaction with backend APIs (mocked) and correct population of fields.
    *   **E2E:** Full flow: Calendar submit -> `waiver-form.html` loads -> correct data pre-filled and displayed. Test cases:
        *   User with complete data.
        *   User with partial/missing data (fields remain blank for manual fill).
        *   Invalid/missing URL parameters.
        *   API errors during data fetch.
        *   Visual consistency with `calendar-app.html`.
*   **Data Management:** Fetched data is for one-time pre-fill/display.
*   **Logging & Error Handling:**
    *   Client-side: Log URL parsing, API calls, success/failure, pre-fill actions.
    *   User-facing errors via a dedicated error display area or non-modal notifications.

**Data Flow Steps:**
1.  [`public/waiver-form.html`](public/waiver-form.html:185) loads. JS parses `telegramId`, `sessionTypeId`, `appointmentDateTimeISO` from URL.
2.  JS populates hidden fields.
3.  JS concurrently calls `GET /api/user-data` and `GET /api/session-types/:id`.
4.  On API success:
    *   User data pre-fills form inputs.
    *   Session label and formatted appointment date/time are displayed in `appointmentInfo`.
5.  User proceeds to complete the waiver.

**Key Edge Cases:**
*   Missing URL parameters: Display error, potentially disable form.
*   API for user data fails: Allow manual entry of personal info.
*   API for session type fails: Display placeholder for session name, but allow form use if appointment time is available.
*   Invalid `appointmentDateTimeISO`: Date formatting may fail; display error for date.
*   Video background fails to load: Ensure graceful fallback (e.g., static background color/image).

---
### API & Waiver Submit: Create Session, GCal Event, Edit Bot Msg to Final Confirmation

**Goal:**
Securely process the submitted waiver form data from [`public/waiver-form.html`](public/waiver-form.html:374). This involves: creating a `Session` record, booking in Google Calendar, editing the original bot message to a final confirmation (with frog picture), notifying admin, and responding to the waiver form. This specification also incorporates logic from DF-4 regarding placeholder handling and conditional redirects based on `allowsGroupInvites`. (As per [`PLANNING.md`](PLANNING.md:296))

**API Relationships:**
*   **Endpoint:** `POST /api/submit-waiver`
    *   Called by: [`public/waiver-form.html`](public/waiver-form.html:374) upon submission.
    *   Request Body may include: `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`, `waiverData` (JSON blob), `placeholderId` (optional, from DF-2/DF-3), `allowsGroupInvites` (optional, from DF-3), `maxGroupSize` (optional, from DF-3), `inviteToken` (optional, from PH6-29/DF-3).
*   **Internal Backend Integrations:**
    *   Database ([`src/core/prisma.js`](src/core/prisma.js:0)): To create/update `Session`, `SessionInvite`, `User.edit_msg_id`.
    *   Google Calendar Tool ([`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0)): To call `createCalendarEvent`, `deleteCalendarEvent`.
    *   Telegram Notifier Tool ([`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0)): To edit client's message, send admin/primary booker notifications.
    *   Session Types Core ([`src/core/sessionTypes.js`](src/core/sessionTypes.js:0)): To fetch `SessionType` details.
    *   Logger ([`src/core/logger.js`](src/core/logger.js:0)).

**Detailed Requirements:**
*   **Req A (Data Reception & Validation):** API must receive all form data. Server-side validation on key fields.
*   **Req B (Conditional Logic - Primary Booker vs. Friend):**
    *   **If `inviteToken` is present (Friend's Waiver - PH6-30 logic):**
        1.  Validate `inviteToken`, fetch `SessionInvite` and `parentSession`.
        2.  Update `SessionInvite` status to 'waiver_completed_by_friend', store `friendTelegramId`, `friendNameOnWaiver`, and `friendLiabilityFormData`.
        3.  Notify primary booker (PH6-33).
        4.  Notify admin (PH6-34).
        5.  Update GCal event description and title (PH6-30, PH6-30.5).
        6.  Send confirmation to friend (PH6-31).
        7.  Return success to waiver form.
    *   **If `placeholderId` is present (Primary Booker with GCal Placeholder - DF-4 logic):**
        1.  Attempt to delete placeholder GCal event ([`googleCalendarTool.deleteCalendarEvent(placeholderId)`](src/tools/googleCalendar.js:0)). Log if already gone.
        2.  **Final Slot Availability Check:** Query GCal to ensure slot is still free. If not, return error ("Slot was taken...").
        3.  Proceed to create *actual* GCal event and `Session` record (as below).
        4.  Determine `allowsGroupInvites` (from request or re-fetched `SessionType`).
        5.  Conditional API Response: If `allowsGroupInvites` is true, include `redirectTo: '/invite-friends.html?sessionId={...}&maxGroupSize={...}'`. Otherwise, standard success.
    *   **If no `inviteToken` and no `placeholderId` (Original Primary Booker Flow - PH6-17 base):**
        1.  Proceed to create GCal event and `Session` record.
        2.  Determine `allowsGroupInvites` (from `SessionType`).
        3.  Conditional API Response as above.
*   **Req C (Session Creation - Primary Booker):** Create `Session` record: `telegram_id`, `session_type_id_fk`, `appointment_datetime` (UTC), `status: 'CONFIRMED'`, `liability_form_data`.
*   **Req D (Google Calendar Event - Primary Booker):** Call [`googleCalendarTool.createCalendarEvent`](src/tools/googleCalendar.js:0) with `start`, `end` (calculated from `SessionType.durationMinutes`), `summary` (client name, session label), `description`. Store `googleEventId` on `Session`.
*   **Req E (Bot Message Update - Primary Booker):**
    *   Fetch `user.edit_msg_id`.
    *   Use [`telegramNotifier.editMessageText`](src/tools/telegramNotifier.js:0) (or photo equivalent) for the message at `edit_msg_id`.
    *   Content: Frog picture, "✅ Your {SessionTypeLabel} session is confirmed for {Formatted Date & Time in Practitioner's TZ}!".
    *   Conditionally add "Invite Friends" button if `allowsGroupInvites` is true (PH6-24).
*   **Req F (Clear `edit_msg_id` - Primary Booker):** Set `user.edit_msg_id = null`.
*   **Req G (Admin Notification - Primary Booker):** Use [`telegramNotifier.sendAdminNotification`](src/tools/telegramNotifier.js:0): "CONFIRMED BOOKING: Client {Name} (TGID: {id}) for {Type} on {Date} at {Time}. Waiver submitted."
*   **Req H (Client Feedback & UI - Waiver Form):**
    *   **Client-Side Validation ([`public/waiver-form.html`](public/waiver-form.html:1246)):** Robust validation for required fields, checkboxes. Highlight invalid fields, show errors, focus first invalid.
    *   **Submission Feedback:** Disable submit button, change text to "Submitting...", show spinner ([`public/waiver-form.html`](public/waiver-form.html:1059)).
    *   **API Response Handling ([`public/waiver-form.html`](public/waiver-form.html:1423)):**
        *   On `{ success: true, redirectTo: url }`: `window.location.href = url;` (for primary booker if invites allowed).
        *   On `{ success: true }` (no redirect): Display "Booking Confirmed! ...", then `Telegram.WebApp.close()` after delay.
        *   On `{ success: false }`: Display API error message, re-enable submit button ([`public/waiver-form.html`](public/waiver-form.html:1445)).
*   **Req I (Atomicity/Error Handling):** Log detailed errors. Attempt compensation if critical step fails (e.g., delete GCal if DB fails). Notify admin of critical failures.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Backend API endpoint: `POST /api/submit-waiver`.
    *   Handler: Likely in [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0) or a dedicated `src/handlers/api/waiverApiHandler.js`.
    *   Utilizes: Prisma, Google Calendar Tool, Telegram Notifier, Session Types Core, Logger.
    *   Tech Stack: Node.js, Express.js.
*   **DB Schema:**
    *   `Session`: Utilized for creating new session records. Key fields: `telegram_id`, `session_type_id_fk`, `appointment_datetime`, `status`, `liability_form_data`, `google_event_id`.
    *   `User`: Utilized for `edit_msg_id` (fetching and clearing).
    *   `SessionType`: Utilized for `label`, `durationMinutes`, `allowsGroupInvites`, `waiverType`, `maxGroupSize`.
    *   `SessionInvite`: Utilized for friend's waiver path - updating `status`, `friendTelegramId`, `friendNameOnWaiver`, `friendLiabilityFormData`.
*   **API Design (`POST /api/submit-waiver`):**
    *   **Request Body (Example - Primary Booker, can include `placeholderId`):**
      ```json
      {
        "telegramId": "123456789",
        "sessionTypeId": "session-type-uuid-1",
        "appointmentDateTimeISO": "2025-07-15T10:00:00.000Z",
        "firstName": "John",
        "lastName": "Doe",
        // ... other waiver fields ...
        "liability_form_data": { /* ... structured waiver answers ... */ },
        "placeholderId": "optionalGoogleEventIdForPlaceholder" // Optional
      }
      ```
    *   **Request Body (Example - Invited Friend):**
      ```json
      {
        "telegramId": "friendTelegramId_112233", // Friend's TG ID
        "sessionTypeId": "session-type-uuid-1", // From parent session
        "appointmentDateTimeISO": "2025-07-15T10:00:00.000Z", // From parent session
        "inviteToken": "invite-token-for-friend-abc", // Crucial for friend path
        "firstName": "Alice", // Friend's name
        "lastName": "Smith",
        // ... other waiver fields ...
        "liability_form_data": { /* ... structured waiver answers ... */ }
      }
      ```
    *   **Response (Success 200 - Primary Booker, invites allowed):**
      ```json
      {
        "success": true,
        "message": "Booking Confirmed!",
        "redirectTo": "/invite-friends.html?sessionId=new-session-db-id&maxGroupSize=4"
      }
      ```
    *   **Response (Success 200 - Primary Booker, no invites OR Friend):**
      ```json
      { "success": true, "message": "Booking Confirmed!" }
      ```
    *   **Response (Error 400/403/404/500):**
      ```json
      { "success": false, "message": "Specific error message here." }
      ```
*   **Frontend Structure ([`public/waiver-form.html`](public/waiver-form.html:0) JavaScript):**
    *   Client-side validation before submission ([`public/waiver-form.html`](public/waiver-form.html:1246)).
    *   Disable button, show spinner on submit ([`public/waiver-form.html`](public/waiver-form.html:1059)).
    *   Collect all form data, including hidden fields (`telegramId`, `sessionTypeId`, `appointmentDateTimeISO`, `placeholderId`, `inviteToken`).
    *   Handle API response:
        *   If `redirectTo` present, navigate: `window.location.href = data.redirectTo;`.
        *   If success without redirect, show confirmation, then `Telegram.WebApp.close()`.
        *   If error, show message, re-enable submit button.
*   **CRUD Operations (Backend):**
    *   **Primary Booker Path:** Create `Session`; Create GCal Event; Update `User` (`edit_msg_id`); Update `Session` (`googleEventId`).
    *   **Friend Path:** Update `SessionInvite`; Read `Session` & related data for notifications & GCal update.
*   **UX Flow (Combined):**
    *   **Waiver Form UI:** User fills form. Client-side validation. On submit, button disabled, spinner shown.
    *   **Backend Processing:** API receives data. Validates.
        *   **Friend Path:** If `inviteToken`, updates `SessionInvite`, notifies primary booker/admin, updates GCal, confirms to friend.
        *   **Primary Booker Path:** If `placeholderId`, deletes placeholder, checks slot. Creates `Session`, GCal event, edits bot message (with conditional "Invite Friends" button), notifies admin.
    *   **Waiver Form UI Response:**
        *   Success + Redirect: Navigates to `invite-friends.html`.
        *   Success (no redirect): Shows "Booking Confirmed!", closes WebApp.
        *   Error: Shows error message, re-enables submit.
    *   **Telegram Chat (Primary Booker):** Original message edited to final confirmation (frog pic, text, optional "Invite Friends" button).
    *   **Telegram Chat (Friend):** Receives new confirmation message.
    *   **Telegram Chat (Admin/Primary Booker):** Receives relevant notifications.
*   **Security:**
    *   Server-side validation of all inputs.
    *   Authorization: Ensure `telegramId` matches session owner or `inviteToken` is valid for friend.
    *   Secure GCal API access.
*   **Testing:**
    *   **Unit Tests:** Test API handler branches (primary booker, placeholder, friend). Test GCal/Telegram interactions (mocked). Test data validation.
    *   **Integration Tests:** Test `POST /api/submit-waiver` with different payloads for each path. Verify DB state changes and mock external calls.
    *   **E2E:**
        *   Full primary booker flow (no invites, with invites).
        *   Full primary booker flow (with GCal placeholder).
        *   Full invited friend flow.
        *   Verify all notifications, GCal event changes, bot message edits, and WebApp responses/redirects.
*   **Data Management:**
    *   Persist `Session`, `SessionInvite` data.
    *   Store `liability_form_data` (JSON) appropriately (on `Session` for primary, potentially on `SessionInvite` for friend).
*   **Logging & Error Handling:**
    *   Structured logs for each step and decision path.
    *   Critical error logging and admin alerts for inconsistencies (e.g., DB write ok, GCal fails).

---

---
This completes the detailed specifications for Phase 6A (PH6-15 to PH6-17).

---
## Feature Specifications (Phase 6B: "Invite Friends" - Initial Setup & Invite Generation)

---
###  DB Updates for Invites & Group Size Management

**Goal:**
Modify the database schema to support the "Invite Friends" functionality. This involves ensuring `SessionType` controls group invite capabilities (`allowsGroupInvites`, `maxGroupSize`) and creating the `SessionInvite` table to track individual invitation details and statuses. The concept of `max_group_invites` on `AvailabilityRule` will be removed, making `SessionType.maxGroupSize` the sole determinant.

**API Relationships:**
*   This feature primarily involves database schema changes and migrations.
*   It lays the groundwork for APIs that will:
    *   Read `SessionType.allowsGroupInvites` and `SessionType.maxGroupSize` to control invite UI and logic (e.g., in `POST /api/submit-waiver`, `GET /api/sessions/:sessionId/invite-context`).
    *   Create, read, and update `SessionInvite` records (e.g., `POST /api/sessions/:sessionId/generate-invite-token`, and APIs in Phase 6C).

**Detailed Requirements:**
*   **Requirement A (`SessionType` Model Update - from PH6-11.5, reiterated for context):**
    *   Ensure `SessionType` in [`prisma/schema.prisma`](prisma/schema.prisma:457) includes:
        *   `allowsGroupInvites`: Boolean (Default: `false`).
        *   `maxGroupSize`: Integer (Default: `1`). (Total participants including primary booker). The number of friends that can be invited is `maxGroupSize - 1`.
*   **Requirement B (`AvailabilityRule` Model Update - Removal of `max_group_invites`):**
    *   If `max_group_invites` or `max_group_size_override` exists on the `AvailabilityRule` model in [`prisma/schema.prisma`](prisma/schema.prisma:463), it should be **removed**. Control for group size now resides entirely within `SessionType`.
*   **Requirement C (`SessionInvite` Model Creation):**
    *   Define a new model `SessionInvite` in [`prisma/schema.prisma`](prisma/schema.prisma:466) with fields:
        *   `id`: String, CUID or UUID, Primary Key.
        *   `parentSessionId`: Int, Foreign Key to `Session.id`. Indexed.
        *   `parentSession`: Relation to `Session`.
        *   `inviteToken`: String, Unique. Indexed. (e.g., generated using `crypto.randomBytes`).
        *   `status`: String, Default: "pending". (Enum-like: 'pending', 'accepted_by_friend', 'declined_by_friend', 'waiver_completed_by_friend', 'expired').
        *   `friendTelegramId`: BigInt, Optional. Unique in combination with `parentSessionId`.
        *   `friendNameOnWaiver`: String, Optional.
        *   `friendLiabilityFormData`: Json, Optional (to store friend's waiver if it differs or needs separate tracking).
        *   `createdAt`: DateTime, Default: `now()`.
        *   `updatedAt`: DateTime, `@updatedAt`.
*   **Requirement D (Database Migration):**
    *   Generate and apply a Prisma migration: `npx prisma migrate dev --name update_invites_db_structure`. This migration will handle the creation of `SessionInvite` and the removal of any group size fields from `AvailabilityRule`.
*   **Requirement E (Seed Data Update):**
    *   Ensure seed scripts for `SessionType` correctly populate `allowsGroupInvites` and `maxGroupSize`.
    *   Remove any seeding related to `max_group_invites` or `max_group_size_override` on `AvailabilityRule`.

**Implementation Guide:**

*   **Architecture Overview:** Database-centric changes using Prisma ORM.
*   **DB Schema (`prisma/schema.prisma` changes):**
    *   **`SessionType` (ensure fields from PH6-11.5 are present and are the source of truth for group size):**
      ```prisma
      model SessionType {
        // ... existing fields ...
        waiverType          String   @default("KAMBO_V1")
        allowsGroupInvites  Boolean  @default(false)
        maxGroupSize        Int      @default(1) // Total participants, source of truth
        // ... existing relations ...
      }
      ```
    *   **`AvailabilityRule` (ensure no group size override fields):**
      ```prisma
      model AvailabilityRule {
        // ... existing fields ...
        // REMOVE max_group_invites or max_group_size_override if they exist
      }
      ```
    *   **New `SessionInvite` model:**
      ```prisma
      model SessionInvite {
        id                        String    @id @default(cuid())
        parentSession             Session   @relation(fields: [parentSessionId], references: [id], onDelete: Cascade)
        parentSessionId           Int
        inviteToken               String    @unique
        status                    String    @default("pending")
        friendTelegramId          BigInt?
        friendNameOnWaiver        String?
        friendLiabilityFormData   Json?
        createdAt                 DateTime  @default(now())
        updatedAt                 DateTime  @updatedAt

        @@index([parentSessionId])
        @@index([inviteToken])
        @@unique([parentSessionId, friendTelegramId], name: "unique_friend_per_session")
      }
      ```
    *   **Update `Session` model for relation:**
      ```prisma
      model Session {
        // ... existing fields ...
        invites SessionInvite[]
      }
      ```
*   **API Design:** N/A for this feature directly. Subsequent API logic will rely on `SessionType.maxGroupSize`.
*   **Frontend Structure:** N/A for this feature directly.
*   **CRUD Operations:** Schema changes for `SessionType` (confirmation of fields), `AvailabilityRule` (removal of fields), and creation of `SessionInvite`.
*   **Security:** `inviteToken` should be cryptographically strong.
*   **Testing:**
    *   Verify migration applies cleanly and removes fields from `AvailabilityRule` if they existed.
    *   Verify seed data updates for `SessionType`.
    *   Unit tests for any logic that previously read group size from `AvailabilityRule` should be updated or removed.
*   **Logging & Error Handling:** Migration process logging.
*   **Key Edge Cases:**
    *   Migration failure: Prisma handles rollback or provides error messages.
    *   Existing `SessionType` records: Will need values for `allowsGroupInvites` and `maxGroupSize` (handled by `@default` or manual update post-migration if defaults are not suitable).
    *   Ensure all downstream logic now correctly refers to `SessionType.maxGroupSize` instead of any `AvailabilityRule` field for group size limits.

---
###  `/api/submit-waiver` Redirects to `invite-friends.html` (Conditional)

**Goal:**
Modify the `POST /api/submit-waiver` endpoint to conditionally redirect the primary booker to the `public/invite-friends.html` page after their successful waiver submission, if the `SessionType` they booked allows for group invites and has capacity. (Adapted from [`Features_Phase_6.md`](Features_Phase_6.md:0) and [`PLANNING.md`](PLANNING.md:320))

**API Relationships:**
*   Modifies existing endpoint: `POST /api/submit-waiver`.
*   Internally, after successful core booking logic (DB write, GCal event, as per PH6-17):
    *   Retrieves the `SessionType` associated with the newly created `Session`.
    *   Checks `SessionType.allowsGroupInvites` and `SessionType.maxGroupSize`.

**Detailed Requirements:**
*   **Requirement A (Determine Invite Eligibility):**
    *   After successfully creating the `Session` and GCal event, the API must fetch the associated `SessionType` for the booked session.
    *   It then checks if `SessionType.allowsGroupInvites` is `true` AND `SessionType.maxGroupSize > 1`.
*   **Requirement B (Conditional API Response):**
    *   If invite eligibility is met (as per Req A) AND the "Invite Friends" feature is globally enabled (e.g., via an environment variable like `INVITE_FRIENDS_ENABLED='true'`):
        *   The API response to `public/waiver-form.html` must include a `redirectTo` field in the JSON payload.
        *   The value will be `/invite-friends.html?sessionId={newSession.id}&telegramId={telegramId}`.
        *   `{newSession.id}` is the ID of the `Session` record just created for the primary booker.
        *   `{telegramId}` is the Telegram ID of the primary booker.
    *   Else (if invite eligibility is NOT met or the feature is disabled):
        *   The API response remains as in Phase 6A MVP: `{ success: true, message: "Booking Confirmed!" }` (no `redirectTo` field).
*   **Requirement C (Client-Side Handling in `public/waiver-form.html`):**
    *   JavaScript in `public/waiver-form.html` must be updated to check for the `redirectTo` field in the API response.
    *   If `data.success` is true and `data.redirectTo` exists:
        *   Perform `window.location.href = data.redirectTo;`.
    *   Else (no `redirectTo` or `data.success` is false):
        *   Follow existing behavior (e.g., show confirmation message and close, or show error).

**Implementation Guide:**

*   **Architecture Overview:**
    *   Backend modification to an existing Express API endpoint handler (`src/routes/api.js` or similar).
    *   Frontend modification to JavaScript in `public/waiver-form.html`.
*   **DB Schema:**
    *   Relies on `SessionType.allowsGroupInvites` and `SessionType.maxGroupSize` (as established in PH6-11.5 and PH6-18).
*   **API Design (`POST /api/submit-waiver` - Modification):**
    *   **Handler Logic (Pseudocode):**
      ```javascript
      // Inside POST /api/submit-waiver handler, after successful session creation...
      const session = // ... newly created session object
      const sessionType = await prisma.sessionType.findUnique({ where: { id: session.sessionTypeId } });

      let redirectTo = null;
      if (process.env.INVITE_FRIENDS_ENABLED === 'true' &&
          sessionType &&
          sessionType.allowsGroupInvites &&
          sessionType.maxGroupSize > 1) {
        redirectTo = `/invite-friends.html?sessionId=${session.id}&telegramId=${req.body.telegramId}`;
      }

      if (redirectTo) {
        return res.json({ success: true, message: "Booking Confirmed!", redirectTo });
      } else {
        return res.json({ success: true, message: "Booking Confirmed!" });
      }
      ```
    *   **Response (Success 200 - Conditional):**
        *   If invites allowed:
          ```json
          {
            "success": true,
            "message": "Booking Confirmed!",
            "redirectTo": "/invite-friends.html?sessionId={newSession.id}&telegramId={telegramId}"
          }
          ```
        *   If invites NOT allowed:
          ```json
          { "success": true, "message": "Booking Confirmed!" }
          ```
*   **Frontend Structure (`public/waiver-form.html` JavaScript update):**
    *   **Pseudocode for submission success handler:**
      ```javascript
      // Inside waiverForm submit's .then(data => { ... }) block
      if (data.success) {
        if (data.redirectTo) {
          // Optional: show a brief message before redirecting
          // showTemporaryMessage("Booking confirmed! Taking you to invite friends...");
          window.location.href = data.redirectTo;
        } else {
          // Original Phase 6A behavior
          showTemporaryMessage("Booking Confirmed! Thank you.");
          setTimeout(() => window.Telegram.WebApp.close(), 3000);
        }
      } else {
        // ... existing error handling ...
        showErrorMessage(data.message || "An error occurred.");
      }
      ```
*   **UX Flow:**
    1.  User submits waiver on `public/waiver-form.html`.
    2.  Backend processes (PH6-17 logic, then PH6-19 logic).
    3.  If eligible for invites, API returns `redirectTo`.
    4.  `public/waiver-form.html` JavaScript navigates to `public/invite-friends.html`.
    5.  If not eligible, `public/waiver-form.html` shows confirmation and closes.
*   **Security:** Ensure `sessionId` and `telegramId` in `redirectTo` are properly handled and validated on the `invite-friends.html` page.
*   **Testing:**
    *   Test with `SessionType` that allows invites (`allowsGroupInvites: true, maxGroupSize > 1`).
    *   Test with `SessionType` that does NOT allow invites (`allowsGroupInvites: false` or `maxGroupSize <= 1`).
    *   Test with `INVITE_FRIENDS_ENABLED` environment variable set to `true` and `false`.
*   **Key Edge Cases:**
    *   `SessionType` not found for the session (should be prevented by earlier logic).
    *   Environment variable `INVITE_FRIENDS_ENABLED` not set (treat as `false`).

---
### Detour Functionality: Enhanced GCal Placeholder Bookings & Dynamic Flow

This set of features refines temporary slot reservations using Google Calendar events, manages their lifecycle (including a 15-minute expiry), and introduces dynamic routing after calendar selection based on `SessionType` properties.

---
####  Backend - Enhanced GCal Placeholder Event Management

**Goal:**
Robustly create, manage, and automatically expire 15-minute placeholder bookings in Google Calendar. This API will also return dynamic routing information based on `SessionType` properties.

**API Relationships:**
*   **Modifies/Replaces:** `POST /api/gcal-placeholder-bookings` (from previous DF-1 if any, or new if this is the first definition).
    *   **Input:** `{ telegramId: string, sessionTypeId: string, appointmentDateTimeISO: string }`
    *   **Output (Success):**
        ```json
        {
          "success": true,
          "placeholderId": "googleEventIdGeneratedByGCal",
          "expiresAt": "isoTimestamp_15_mins_from_now",
          "waiverType": "KAMBO_V1", // From SessionType
          "allowsGroupInvites": true, // From SessionType
          "maxGroupSize": 4, // From SessionType
          "sessionTypeId": "session-type-uuid-1", // Echoed back
          "appointmentDateTimeISO": "2025-07-15T10:00:00.000Z" // Echoed back
        }
        ```
    *   **Output (Error):** `{ success: false, message: "Error description" }`
*   **Modifies/Replaces:** `DELETE /api/gcal-placeholder-bookings/{googleEventId}`.
    *   **Input:** Path parameter `googleEventId`.
    *   **Output:** `{ success: true }` or `{ success: false, message: "Error description" }`.
*   **New Endpoint:** `GET /api/slot-check?appointmentDateTimeISO=YYYY-MM-DDTHH:mm:ss.sssZ&sessionTypeId=string&placeholderId=OPTIONAL_googleEventId`
    *   **Output:** `{ status: "RESERVED" | "AVAILABLE" | "TAKEN" | "UNAVAILABLE", placeholderValid?: boolean }`
        *   `RESERVED`: Placeholder exists and is valid.
        *   `AVAILABLE`: Slot is free (placeholder might be gone/invalid but main slot is clear).
        *   `TAKEN`: Slot is booked by a confirmed session.
        *   `UNAVAILABLE`: Slot is blocked by a non-placeholder, non-KamboKlarity event, or practitioner is unavailable.
        *   `placeholderValid`: Boolean indicating if the provided `placeholderId` corresponds to an active placeholder.
*   Internal: Server-side Cron Job for 15-minute expiry management (detailed in DF-5).
*   Utilizes: [`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0) for GCal interactions, [`src/core/sessionTypes.js`](src/core/sessionTypes.js:0) to fetch `SessionType` details.

**Detailed Requirements:**
*   **Req A (Placeholder Creation & Dynamic Info - `POST /api/gcal-placeholder-bookings`):**
    1.  Receive `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`.
    2.  Fetch `SessionType` details (including `label`, `durationMinutes`, `waiverType`, `allowsGroupInvites`, `maxGroupSize`) using `sessionTypeId`. If not found, return error.
    3.  Construct GCal event:
        *   Title: `"[PLACEHOLDER 15min] - Kambo Klarity - {SessionType.label} for User {telegramId}"`.
        *   Start/End: Based on `appointmentDateTimeISO` and `SessionType.durationMinutes`.
        *   Description: "Temporary hold for Kambo Klarity booking. Expires in 15 minutes."
        *   Set a custom property on the GCal event if possible (e.g., `extendedProperties.private.placeholderType = "KAMBO_KLARITY_15_MIN_HOLD"`) for easier identification by the cron job.
    4.  Call [`googleCalendarTool.createCalendarEvent`](src/tools/googleCalendar.js:0).
    5.  If successful, return the GCal `eventId` as `placeholderId`, calculate `expiresAt` (current time + 15 minutes in ISO format), and the fetched `SessionType` properties (`waiverType`, `allowsGroupInvites`, `maxGroupSize`), along with echoed `sessionTypeId` and `appointmentDateTimeISO`.
    6.  Handle GCal API errors gracefully.
*   **Req B (Placeholder Cancellation - `DELETE /api/gcal-placeholder-bookings/{googleEventId}`):**
    1.  Receive `googleEventId`.
    2.  Call [`googleCalendarTool.deleteCalendarEvent(googleEventId)`](src/tools/googleCalendar.js:0).
    3.  Return success or error. Handle cases where event might already be deleted.
*   **Req C (Slot Status Check API - `GET /api/slot-check`):**
    1.  Receive `appointmentDateTimeISO`, `sessionTypeId`. `placeholderId` is optional.
    2.  Fetch `SessionType.durationMinutes` for `sessionTypeId`.
    3.  **If `placeholderId` is provided:**
        *   Attempt to fetch the GCal event by `placeholderId`.
        *   If found and it's a valid placeholder (check title/custom property): `placeholderValid = true`.
        *   If not found or not a valid placeholder: `placeholderValid = false`.
    4.  **Regardless of placeholder, check actual slot availability in GCal:**
        *   Query GCal for any *confirmed* (non-placeholder) Kambo Klarity bookings that overlap the `appointmentDateTimeISO` and duration.
        *   Query GCal for any other events (e.g., personal practitioner events) that block this time.
    5.  Determine `status`:
        *   If `placeholderValid` is true: Return `status: "RESERVED"`.
        *   Else if slot is completely free: Return `status: "AVAILABLE"`.
---
####  Calendar App - Integrate Enhanced GCal Placeholder & Dynamic Redirect

**Goal:**
Modify the Calendar Mini-App ([`public/calendar-app.html`](public/calendar-app.html:252)) to call the enhanced `POST /api/gcal-placeholder-bookings` API upon slot submission. Based on the API's response (which includes `waiverType`, `allowsGroupInvites`, `maxGroupSize`, `placeholderId`), dynamically redirect the user to the appropriate next step: waiver form, invite friends page, or a direct booking finalization flow.

**API Relationships:**
*   Calls `POST /api/gcal-placeholder-bookings` (defined in DF-1).
    *   Input: `{ telegramId, sessionTypeId, appointmentDateTimeISO }`.
    *   Expected Output: `{ success, placeholderId, expiresAt, waiverType, allowsGroupInvites, maxGroupSize, ... }`.
*   Calls new `POST /api/finalize-direct-booking` if applicable.
    *   Input: `{ placeholderId, telegramId, sessionTypeId, appointmentDateTimeISO }`.
    *   Output: `{ success: true, confirmationMessage: "Booking confirmed!" }` or error.

**Detailed Requirements:**
*   **Req A (API Call on Submit):**
    *   In [`public/calendar-app.js`](public/calendar-app.js:0), when the user clicks the `submitBookingButton` and after the `isStillAvailable` check (or similar final client-side validation) passes:
        *   Instead of directly redirecting to `waiver-form.html` (as in PH6-15), first call `POST /api/gcal-placeholder-bookings` with `telegramId`, `initialSessionTypeId` (as `sessionTypeId`), and `selectedTimeSlotISO`.
        *   Display a loading state on the submit button (e.g., "Reserving slot...").
*   **Req B (Dynamic Redirect Logic):**
    *   Upon successful response from `POST /api/gcal-placeholder-bookings`:
        1.  Parse `waiverType`, `allowsGroupInvites`, `maxGroupSize`, `placeholderId`, `sessionTypeId`, `appointmentDateTimeISO` from the response.
        2.  **Path 1 (Waiver Needed):** If `waiverType !== "NONE"`:
            *   Redirect to: `waiver-form.html?telegramId={tgId}&sessionTypeId={sId}&appointmentDateTimeISO={dtISO}&placeholderId={pId}&waiverType={wType}&allowsGroupInvites={allowsInv}&maxGroupSize={mSize}`.
        3.  **Path 2 (No Waiver, Invites Allowed):** If `waiverType === "NONE"` AND `allowsGroupInvites === true`:
            *   Redirect to: `invite-friends.html?telegramId={tgId}&sessionTypeId={sId}&appointmentDateTimeISO={dtISO}&placeholderId={pId}&maxGroupSize={mSize}`.
        4.  **Path 3 (No Waiver, No Invites - Direct Finalization):** If `waiverType === "NONE"` AND `allowsGroupInvites === false`:
            *   Call a new backend endpoint `POST /api/finalize-direct-booking` with `placeholderId`, `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`.
            *   On successful response from `finalize-direct-booking`: Display a confirmation message directly within `calendar-app.html` (e.g., "Booking Confirmed! Your session is set.") and then call `Telegram.WebApp.close()` after a short delay.
            *   If `finalize-direct-booking` fails, show an error message in `calendar-app.html`.
*   **Req C (Error Handling):**
    *   If `POST /api/gcal-placeholder-bookings` fails: Display an error message (e.g., "Could not reserve the slot. Please try again.") and re-enable the submit button.
    *   If `POST /api/finalize-direct-booking` fails (for Path 3): Display an error message in `calendar-app.html`. The placeholder might still exist or have expired; user might need to retry.
*   **Req D (New API - `POST /api/finalize-direct-booking`):**
    *   **Input:** `{ placeholderId: string, telegramId: string, sessionTypeId: string, appointmentDateTimeISO: string }`.
    *   **Process:**
        1.  Validate `placeholderId` by checking the GCal event (e.g., using a simplified version of `GET /api/slot-check` logic or by fetching the event directly). If invalid/expired, return error.
        2.  Convert the GCal placeholder event to a *confirmed* GCal event (update title, remove expiry indicators, potentially add guest if `telegramId` is for a user). This might involve deleting the placeholder and creating a new confirmed event to ensure atomicity if GCal API doesn't support easy "conversion".
        3.  Create a `Session` record in the database (similar to PH6-17, but without waiver data initially). Store `googleEventId`.
        4.  Send confirmation message to the user via Telegram bot (similar to PH6-17 final confirmation, but simpler as no waiver).
        5.  Notify admin (similar to PH6-17).
        6.  Clear `edit_msg_id` for the user.
    *   **Output (Success):** `{ success: true, message: "Booking directly confirmed!" }`.
    *   **Output (Error):** `{ success: false, message: "Failed to finalize booking." }`.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Modifications to client-side JavaScript in [`public/calendar-app.js`](public/calendar-app.js:0) and [`public/calendar-api.js`](public/calendar-api.js:0) (for the new API call).
    *   New backend API endpoint (`POST /api/finalize-direct-booking`) and modification to existing `POST /api/gcal-placeholder-bookings`.
*   **DB Schema:** `Session` table will be used by `POST /api/finalize-direct-booking`.
*   **API Design:** As detailed above.
*   **Frontend Structure (`public/calendar-app.js`):**
    *   Update `submitBookingButton` handler:
        *   Call `api.createGCalPlaceholderBooking(data)`.
        *   Implement dynamic redirect logic based on response.
        *   Handle new direct finalization path (call `api.finalizeDirectBooking(data)`, show confirmation/error, close WebApp).
    *   Add new functions in [`public/calendar-api.js`](public/calendar-api.js:0) for `createGCalPlaceholderBooking` and `finalizeDirectBooking`.
*   **Backend Structure:**
    *   Update handler for `POST /api/gcal-placeholder-bookings` (DF-1) to fetch and return `SessionType` fields.
    *   Create new route and handler for `POST /api/finalize-direct-booking`. This handler will orchestrate GCal event conversion, DB `Session` creation, and Telegram notifications.
*   **Testing:**
    *   **Frontend:** Test API calls, dynamic redirect logic for all three paths, UI updates for loading/confirmation/error states.
    *   **Backend:** Test `POST /api/finalize-direct-booking` thoroughly (GCal update, DB write, notifications). Test updated `POST /api/gcal-placeholder-bookings` response.
    *   **E2E:** Test full booking flows for session types that trigger each of the three dynamic redirect paths.

---
        *   Else if slot is taken by another confirmed Kambo Klarity booking or other blocking event: Return `status: "TAKEN"` (if Kambo) or `status: "UNAVAILABLE"` (if other/general).
    6.  Return `{ status, placeholderValid }`.

**Implementation Guide:**

*   **Architecture Overview:** Backend API endpoints in Express.js, utilizing Google Calendar tools and Prisma for `SessionType` data.
*   **DB Schema:** No direct DB writes in this feature, but reads `SessionType`.
*   **API Design:** As detailed above. Ensure robust error handling and clear response structures.
*   **Backend Structure:**
    *   Update [`src/routes/api.js`](src/routes/api.js:0) to include/modify these endpoints.
    *   Handlers likely in [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0) or a new `src/handlers/api/calendarBookingApiHandler.js`.
    *   Logic in [`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0) will need to support creating events with specific titles/properties and robustly checking slot availability considering different event types.
*   **Security:**
---
####  Waiver Form - Conditional Logic for Primary Booker vs. Invited Friend

**Goal:**
Implement distinct behaviors in [`public/waiver-form.html`](public/waiver-form.html:270) based on whether the user is a primary booker (identified by a `placeholderId` in the URL) or an invited friend (identified by an `inviteToken` in the URL). This includes managing a 15-minute reservation countdown for primary bookers, handling the Telegram Back Button differently for each user type, and performing pre-submission slot checks for primary bookers.

**API Relationships:**
*   (Primary Booker Flow) Calls `GET /api/slot-check?appointmentDateTimeISO=...&sessionTypeId=...&placeholderId=...` (defined in DF-1) before submitting the waiver.
*   (Primary Booker Flow) Calls `DELETE /api/gcal-placeholder-bookings/{googleEventId}` (defined in DF-1) if the primary booker uses the Telegram Back Button before submitting.
*   Utilizes `window.Telegram.WebApp.BackButton` for custom back navigation behavior.

**Detailed Requirements:**
*   **Req A (Parse All Relevant URL Params):**
    *   JavaScript in [`public/waiver-form.html`](public/waiver-form.html:270) (or `waiver-form.js`) must parse all potential context parameters from the URL:
        *   `placeholderId` (GCal `eventId` for primary booker's temporary reservation).
        *   `inviteToken` (for an invited friend).
        *   `telegramId` (current user's Telegram ID).
        *   `sessionTypeId`.
        *   `appointmentDateTimeISO`.
        *   `waiverType` (from `SessionType`, passed through from calendar via placeholder API response).
        *   `allowsGroupInvites` (from `SessionType`).
        *   `maxGroupSize` (from `SessionType`).
*   **Req B (Conditional Logic on Page Load):**
    *   **If `inviteToken` IS present (Friend's Flow):**
        1.  Show the Telegram Back Button: `Telegram.WebApp.BackButton.show()`.
        2.  Configure Back Button behavior: `Telegram.WebApp.BackButton.onClick(() => Telegram.WebApp.close());`. (Simply closes the waiver form WebApp).
        3.  Do NOT display any 15-minute reservation limit or countdown timer.
        4.  Pre-submission slot check (`GET /api/slot-check`) is NOT needed for the friend (their slot is considered secured by the primary booker's confirmed session).
    *   **If `inviteToken` IS NOT present (Assumed Primary Booker's Flow, likely with `placeholderId`):**
        1.  Display a message: "Your selected slot is reserved for 15 minutes. Please complete and submit this form by [calculated expiry time based on `placeholderId` creation or a passed `expiresAt` param]." (Optional: Implement a client-side countdown timer).
        2.  Show the Telegram Back Button: `Telegram.WebApp.BackButton.show()`.
        3.  Configure Back Button behavior: `Telegram.WebApp.BackButton.onClick(async () => { ... })` to perform the following:
            *   Immediately disable the back button to prevent multiple clicks: `Telegram.WebApp.BackButton.offClick(...)` or set a flag.
            *   Show a loading/processing indicator (e.g., change button text or show a small spinner).
            *   If `placeholderId` exists, call `DELETE /api/gcal-placeholder-bookings/{placeholderId}` to release the temporary hold.
            *   After successful (or failed but non-critical) deletion, navigate the user back to `calendar-app.html`. This requires constructing the URL with `telegramId` and `initialSessionTypeId` (which should be `sessionTypeId` in this context). Example: `calendar-app.html?telegramId={tgId}&initialSessionTypeId={sId}`.
            *   Handle API errors during deletion gracefully (log, but still attempt to navigate back).
            *   Close the WebApp using `Telegram.WebApp.close()` if navigation to calendar is problematic or as a final step.
        4.  **Pre-Submission Slot Check (Primary Booker):** Before the waiver form's actual `submit` event is processed:
            *   Call `GET /api/slot-check` with `appointmentDateTimeISO`, `sessionTypeId`, and the `placeholderId`.
            *   If `status` is "TAKEN" or "UNAVAILABLE":
                *   Display an error: "Sorry, this slot is no longer available. Please return to the calendar to select a new time."
                *   Prevent waiver submission.
                *   Optionally, automatically trigger the placeholder cancellation logic (as if Back Button was clicked) or guide user to use Back Button.
            *   If `status` is "RESERVED" (placeholder still valid) or "AVAILABLE" (placeholder might have just expired but slot is still free): Proceed with waiver submission.
*   **Req C (Data Included in Waiver Submission):**
    *   **If Primary Booker (with `placeholderId`):** The `POST /api/submit-waiver` request must include `placeholderId`, `allowsGroupInvites`, and `maxGroupSize` along with other waiver data.
    *   **If Invited Friend (with `inviteToken`):** The `POST /api/submit-waiver` request must include `inviteToken`. The main `telegramId` in the submission will be the friend's `telegramId`. `allowsGroupInvites` and `maxGroupSize` might also be passed if relevant for friend-specific server-side logic, though primary control is via `SessionType`.
*   **Req D (Hide Back Button on Successful Submission):**
    *   After the waiver is successfully submitted (i.e., `POST /api/submit-waiver` returns success) for EITHER a primary booker or a friend:
        *   Call `Telegram.WebApp.BackButton.hide()` to remove it before the WebApp closes or redirects.

**Implementation Guide:**

*   **Architecture Overview:** Client-side JavaScript logic in [`public/waiver-form.html`](public/waiver-form.html:270) (or `waiver-form.js`).
*   **DB Schema:** N/A for frontend logic. Backend APIs interact with DB.
*   **API Design:** Consumes `GET /api/slot-check` and `DELETE /api/gcal-placeholder-bookings/{googleEventId}`. Prepares data for `POST /api/submit-waiver`.
*   **Frontend Structure (`waiver-form.html` JavaScript):**
    *   Extend `onPageLoad` logic:
        *   Parse all new URL parameters (`placeholderId`, `inviteToken`, `waiverType`, etc.).
        *   Store them in module-scoped variables.
        *   Implement the conditional logic (Friend vs. Primary Booker) for Back Button setup and reservation message/timer.
    *   Modify form submission handler:
        *   If primary booker, perform pre-submission `GET /api/slot-check`.
        *   Include `placeholderId` or `inviteToken` and other relevant params in the submission payload.
    *   Implement `handleBackButtonForPrimaryBooker()` and `handleBackButtonForFriend()` functions.
    *   Ensure `Telegram.WebApp.BackButton.hide()` is called on successful submission before `Telegram.WebApp.close()` or `window.location.href` redirect.
*   **Testing:**
    *   **Unit Tests:** Test URL parsing, conditional logic for Back Button and reservation display, pre-submission check logic, data payload construction for submission.
    *   **E2E:**
        *   **Primary Booker Flow:**
            *   Load waiver with `placeholderId`. Verify reservation message/timer.
            *   Test Back Button: verify `DELETE` API call and redirect to calendar.
            *   Test submission with valid placeholder: verify `GET /api/slot-check` call, then successful submission.
            *   Test submission if slot becomes "TAKEN": verify error and no submission.
        *   **Friend's Flow:**
            *   Load waiver with `inviteToken`. Verify no reservation message.
            *   Test Back Button: verify it just closes the WebApp.
            *   Test successful submission.
        *   Verify Back Button is hidden after successful submission in both flows.

---
    *   Standard API authentication/authorization if applicable (e.g., ensuring `telegramId` in POST is valid).
    *   Protect GCal API credentials.
*   **Testing:**
    *   **Unit Tests:** Test API handlers with mocked GCal and `SessionType` calls. Test logic for title construction, expiry calculation, status determination in `slot-check`.
    *   **Integration Tests:** Test endpoints against a live (test) Google Calendar to verify event creation, deletion, and accurate slot checking under various conditions (empty calendar, existing placeholders, existing confirmed bookings, external blockers).
*   **Logging & Error Handling:** Log all GCal interactions, API requests/responses, and errors.

---
    3.  Backend checks `max_group_invites` for the session.
---
#### Backend - Adapt Waiver Submission for Enhanced GCal Placeholders & Expiry

**Goal:**
Modify the `POST /api/submit-waiver` backend endpoint to robustly handle primary booker submissions that used a GCal placeholder. This involves attempting to delete the placeholder, re-verifying final slot availability *before* creating the confirmed GCal event and `Session` record, and using `allowsGroupInvites` (from the request or re-fetched `SessionType`) to determine if a redirect to the invite friends page is necessary in the response.

**API Relationships:**
*   Modifies existing endpoint: `POST /api/submit-waiver`.
    *   Request body may now include `placeholderId`, `allowsGroupInvites`, `maxGroupSize` when submitted by a primary booker who went through the placeholder flow (DF-2, DF-3).
*   Utilizes [`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0) for `deleteCalendarEvent` and querying GCal for final slot availability.
*   Utilizes [`src/core/prisma.js`](src/core/prisma.js:0) to create `Session` record.
*   Utilizes [`src/core/sessionTypes.js`](src/core/sessionTypes.js:0) if `allowsGroupInvites` needs to be re-fetched.

**Detailed Requirements:**
*   **Req A (Receive Optional Params):** The `POST /api/submit-waiver` handler must be updated to receive optional `placeholderId`, `allowsGroupInvites`, and `maxGroupSize` in the request body.
*   **Req B (Placeholder Path Logic - if `placeholderId` is present):**
    1.  **Attempt to Delete Placeholder GCal Event:** Call [`googleCalendarTool.deleteCalendarEvent(placeholderId)`](src/tools/googleCalendar.js:0).
        *   Log whether deletion was successful or if the event was already gone. This step is best-effort to clean up; the cron job (DF-5) is the ultimate cleanup mechanism.
    2.  **Final Slot Availability Check (Critical):**
        *   Before creating the new *confirmed* GCal event and `Session` record, query Google Calendar directly (e.g., using a refined version of the logic in `GET /api/slot-check` or a dedicated function in `googleCalendarTool`) to ensure the specific time slot for the given `appointmentDateTimeISO` and `SessionType.durationMinutes` is still truly free of any other *confirmed* bookings or blocking events.
    3.  **If Slot NOT Free:**
        *   Return an error response to the client (e.g., `{ success: false, message: "Sorry, the selected slot was taken while you were completing the waiver. Please return to the calendar and choose a new time." }`).
        *   Do NOT proceed to create the `Session` or the new GCal event.
    4.  **If Slot IS Free:**
        *   Proceed with the standard logic for creating the *actual* confirmed GCal event (as in PH6-17).
        *   Proceed with creating the `Session` record in the database (as in PH6-17).
        *   Continue with other primary booker post-booking actions (bot message update, admin notification, etc. from PH6-17).
    5.  **Conditional Redirect in Response:**
        *   Determine `allowsGroupInvites`: Use the value passed in the request. If not present, re-fetch the `SessionType` using `sessionTypeId` from the request and use `SessionType.allowsGroupInvites`.
        *   If this effective `allowsGroupInvites` is `true` (and the invite feature is enabled globally):
            *   Include `redirectTo: '/invite-friends.html?sessionId={newSession.id}&maxGroupSize={maxGroupSizeFromSessionTypeOrRequest}'` in the successful API response to the waiver form.
        *   Else (if invites not allowed): Standard success response without `redirectTo`.
*   **Req C (No Placeholder Path - if `placeholderId` is NOT present):**
    *   This path typically applies to invited friends (who use `inviteToken`, handled by PH6-30 logic within the same API) or potentially a direct booking flow that didn't use placeholders.
    *   If it's a primary booker flow that somehow skipped placeholder creation (less likely with DF-2), it would proceed like the original PH6-17 but should still perform a final slot availability check before GCal event creation.
    *   The logic for handling `inviteToken` (friend's submission) remains separate and takes precedence if `inviteToken` is present.

**Implementation Guide:**

*   **Architecture Overview:** Modifications within the existing `POST /api/submit-waiver` handler.
*   **DB Schema:** No new schema changes specifically for DF-4, but interacts with `Session` and `SessionType`.
*   **API Design (`POST /api/submit-waiver`):**
    *   The handler needs a clear conditional branch: if `inviteToken` is present, execute friend logic (PH6-30). Else if `placeholderId` is present, execute this DF-4 logic. Else, execute original primary booker logic (PH6-17 base, which should also now include a final slot check).
*   **Backend Structure (Modified `handleSubmitWaiver`):**
    *   The main `handleSubmitWaiver` function will need to be refactored to accommodate these different paths.
    *   **Pseudocode Snippet (Illustrating Placeholder Path within `handleSubmitWaiver`):**
      ```javascript
      // Inside handleSubmitWaiver, after checking for inviteToken and finding none:
      // const { placeholderId, allowsGroupInvites: allowsInvitesFromReq, maxGroupSize: mSizeFromReq, ... } = req.body;

      if (placeholderId) {
        logger.info(`Submit Waiver: Processing with placeholderId: ${placeholderId}`);
        try {
          await googleCalendarTool.deleteCalendarEvent(placeholderId);
          logger.info(`Submit Waiver: Attempted deletion of placeholder GCal event ${placeholderId}.`);
        } catch (delError) {
          logger.warn(`Submit Waiver: Failed to delete placeholder ${placeholderId} (may have already expired or been deleted): ${delError.message}`);
        }

        // CRITICAL: Final Slot Availability Check
        const sessionTypeDetails = await coreSessionTypes.getById(sessionTypeId); // Ensure sessionTypeId is available
        const isSlotStillTrulyFree = await googleCalendarTool.isSlotTrulyAvailable(
          appointmentDateTimeISO,
          sessionTypeDetails.durationMinutes
          // This function needs to check against *confirmed* GCal events
        );

        if (!isSlotStillTrulyFree) {
          logger.warn(`Submit Waiver: Slot ${appointmentDateTimeISO} for sessionType ${sessionTypeId} taken after placeholder for ${placeholderId}.`);
          return res.status(409).json({ // 409 Conflict
            success: false,
            message: "Sorry, the selected slot was taken while you were completing the waiver. Please rebook."
          });
        }
        
        // If slot is free, proceed with PH6-17 logic (create Session, GCal event, notify, etc.)
        // ...
        // At the end of successful PH6-17 logic for primary booker:
        let effectiveAllowsInvites = allowsInvitesFromReq;
        if (typeof effectiveAllowsInvites !== 'boolean') {
            effectiveAllowsInvites = sessionTypeDetails.allowsGroupInvites;
        }
        let effectiveMaxGroupSize = mSizeFromReq || sessionTypeDetails.maxGroupSize;

        if (effectiveAllowsInvites && process.env.INVITE_FRIENDS_ENABLED === 'true') {
          responsePayload.redirectTo = `/invite-friends.html?sessionId=${newSession.id}&maxGroupSize=${effectiveMaxGroupSize}&telegramId=${telegramId}`;
        }
        return res.status(200).json(responsePayload);

      } else {
        // Path for primary booker without placeholderId (original PH6-17, but should also add final slot check)
        // or other flows.
      }
      ```
*   **Testing:**
    *   **Unit/Integration:** Test the `POST /api/submit-waiver` handler with `placeholderId`.
        *   Scenario 1: Placeholder exists, slot is free -> booking succeeds, placeholder deleted.
        *   Scenario 2: Placeholder exists, but slot becomes taken by another event -> booking fails, user informed.
        *   Scenario 3: Placeholder expired/deleted, slot is free -> booking succeeds.
---
####  System - Cron Job for 15-min GCal Placeholders

**Goal:**
Implement a robust server-side cron job that runs periodically (e.g., every 1-5 minutes) to automatically identify and delete expired 15-minute Google Calendar placeholder events created by the Kambo Klarity system.

**API Relationships:**
*   Internal: This is a background system process, not a user-facing API.
*   Utilizes [`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0) to:
    *   List calendar events within a relevant time window (e.g., past hour up to next few hours).
    *   Identify placeholder events (e.g., by title prefix `"[PLACEHOLDER 15min]"` or a custom GCal event property).
    *   Check their creation time (potentially from event description or a custom property if GCal API doesn't easily provide creation time for filtering).
    *   Delete expired placeholder events.
*   Utilizes [`src/core/logger.js`](src/core/logger.js:0) for logging its activity.

**Detailed Requirements:**
*   **Req A (Cron Job Setup - e.g., every 1-5 minutes):**
    *   Use a Node.js cron library (e.g., `node-cron`) or a system-level cron if preferred.
    *   Schedule the job to run frequently enough to catch expirations promptly but not so frequently as to overload the GCal API. Every 1 to 5 minutes is a reasonable starting point.
*   **Req B (Identifying Placeholder Events):**
    *   The job needs to fetch events from the Google Calendar.
    *   It must reliably identify Kambo Klarity placeholder events. This can be done by:
        *   Specific title prefix: e.g., `"[PLACEHOLDER 15min] - Kambo Klarity"`.
        *   Custom Google Calendar event property: e.g., `extendedProperties.private.placeholderType === "KAMBO_KLARITY_15_MIN_HOLD"`. (This is more robust than title matching).
*   **Req C (Determining Expiry - 15 minutes):**
    *   For each identified placeholder event, determine its effective creation time.
        *   If GCal API allows filtering by creation time or provides it directly in a usable way, use that.
        *   Alternatively, the placeholder creation timestamp could be embedded in the event's description or a custom property when the placeholder is created (by DF-1).
    *   An event is considered expired if `currentTime > (placeholderCreationTime + 15 minutes)`.
*   **Req D (Deleting Expired Placeholders):**
    *   For each expired placeholder event, call [`googleCalendarTool.deleteCalendarEvent(eventId)`](src/tools/googleCalendar.js:0).
*   **Req E (Logging):**
    *   Log the start and end of each cron job run.
    *   Log the number of placeholder events checked.
    *   Log the `eventId` of each placeholder event that is deleted.
    *   Log any errors encountered during GCal API interactions or other processing.
*   **Req F (Error Handling & Resilience):**
    *   The cron job should handle GCal API errors gracefully (e.g., rate limits, temporary unavailability) and log them, but continue to run on its next scheduled interval.
    *   Prevent multiple instances of the job from running concurrently if a previous run is long-running (though this job should be quick).

**Implementation Guide:**

*   **Architecture Overview:**
    *   A scheduled background task running on the server.
    *   Likely initiated as part of the main application startup process in `bin/server.js` or a dedicated worker process if the application scales.
*   **DB Schema:** No direct DB interaction.
*   **API Design:** N/A (background job).
*   **Backend Structure:**
    *   **Cron Job Script (e.g., `src/workers/placeholderCleanupCron.js`):**
        ```javascript
        // src/workers/placeholderCleanupCron.js
        // const cron = require('node-cron');
        // const googleCalendarTool = require('../tools/googleCalendar');
        // const logger = require('../core/logger').child({ context: 'PlaceholderCleanupCron' });
        // const PLACEHOLDER_EXPIRY_MINUTES = 15;

        // async function cleanupExpiredPlaceholders() {
        //   logger.info('Starting placeholder cleanup job...');
        //   try {
        //     const now = new Date();
        //     // Fetch recent/upcoming events that could be placeholders
        //     // This might involve listing events and then filtering client-side
        //     const potentialPlaceholders = await googleCalendarTool.listPotentialPlaceholderEvents(); 
        //     
        //     let checkedCount = 0;
        //     let deletedCount = 0;

        //     for (const event of potentialPlaceholders) {
        //       checkedCount++;
        //       if (googleCalendarTool.isKamboPlaceholderEvent(event)) { // Checks title or custom property
        //         const creationTime = googleCalendarTool.getPlaceholderCreationTime(event); // From description or property
        //         if (creationTime) {
        //           const expiryTime = new Date(creationTime.getTime() + PLACEHOLDER_EXPIRY_MINUTES * 60000);
        //           if (now > expiryTime) {
        //             logger.info(`Deleting expired placeholder event: ${event.id} (created: ${creationTime.toISOString()})`);
        //             await googleCalendarTool.deleteCalendarEvent(event.id);
        //             deletedCount++;
        //           }
        //         } else {
        //           logger.warn(`Could not determine creation time for potential placeholder: ${event.id}`);
        //         }
        //       }
        //     }
        //     logger.info(`Placeholder cleanup job finished. Checked: ${checkedCount}, Deleted: ${deletedCount}.`);
        //   } catch (error) {
        //     logger.error(`Error during placeholder cleanup job: ${error.message}`, { stack: error.stack });
        //   }
        // }

        // // Schedule to run every 2 minutes, for example
        // function schedulePlaceholderCleanup() {
        //   cron.schedule('*/2 * * * *', cleanupExpiredPlaceholders); 
        //   logger.info('Placeholder cleanup cron job scheduled.');
        // }
        
        // module.exports = { schedulePlaceholderCleanup, cleanupExpiredPlaceholders };
        ```
    *   **Integration with `googleCalendarTool.js`:**
        *   `listPotentialPlaceholderEvents()`: Fetches events (e.g., for today, or a relevant window).
        *   `isKamboPlaceholderEvent(event)`: Returns true if event matches criteria (title/property).
        *   `getPlaceholderCreationTime(event)`: Parses creation time from event data.
    *   **Initiation:** Call `schedulePlaceholderCleanup()` from `bin/server.js` after app initialization.
*   **Security:** GCal API credentials must be secure. The job itself doesn't expose new vulnerabilities if GCal access is already secured.
*   **Testing:**
    *   **Unit Tests:** Test individual functions in the cron script (e.g., logic for identifying placeholders, checking expiry) with mock event data.
    *   **Integration Tests:**
        *   Manually create placeholder events in a test GCal.
        *   Run the `cleanupExpiredPlaceholders` function directly (not as a cron schedule for testing).
        *   Verify that only expired Kambo Klarity placeholders are deleted.
        *   Verify logging output.
    *   Test with various scenarios: no placeholders, some expired, some not expired, non-placeholder events.
*   **Logging & Error Handling:** As per Req E and F. Robust logging is key for monitoring.

---
        *   Verify conditional `redirectTo` logic based on `allowsGroupInvites`.
    *   Ensure the `isSlotTrulyAvailable` logic in `googleCalendarTool` is robust.

---
    4.  If invites allowed, API responds with `success: true` and `redirectTo` URL.
    5.  `waiver-form.html` JS receives response, sees `redirectTo`, and navigates browser to `invite-friends.html`.
    6.  If invites NOT allowed, API responds with `success: true` (no `redirectTo`).
    7.  `waiver-form.html` JS shows success message and closes via `tg.close()`.
*   **Security:** `sessionId` and `telegramId` in `redirectTo` URL are used by `invite-friends.html` for context and authorization.
*   **Testing:**
    *   **Backend:**
        *   Unit test the logic for checking `max_group_invites` and conditionally adding `redirectTo`.
        *   Integration test `POST /api/submit-waiver` to verify correct response with and without `redirectTo` based on `AvailabilityRule` data.
    *   **Frontend:**
        *   Unit test the JS logic in `waiver-form.html` that handles the `redirectTo` field.
    *   **E2E:**
        *   Scenario 1: Book a session type that allows invites -> verify redirect to `invite-friends.html`.
        *   Scenario 2: Book a session type that does NOT allow invites -> verify waiver form shows success and closes.
*   **Data Management:** N/A for this specific modification beyond reading existing data.
*   **Logging & Error Handling:**
    *   Backend: Log decision to redirect or not. Log the constructed `redirectTo` URL.
    *   Frontend: Log if `redirectTo` is found and navigation is attempted.

**Data Flow Steps (Focus on redirect logic):**
1.  `waiver-form.html` submits data to `POST /api/submit-waiver`.
2.  Backend API handler successfully completes all PH6-17 operations.
3.  Backend: Fetches `AvailabilityRule` associated with the booked `Session` (via `SessionType`).
4.  Backend: Checks `availabilityRule.max_group_invites` and `process.env.INVITE_FRIENDS_ENABLED`.
5.  Backend: If invites are applicable, constructs `redirectToUrl = "/invite-friends.html?sessionId={newSession.id}&telegramId={telegramId}"`.
6.  Backend: Responds to `waiver-form.html` with `{ success: true, ..., redirectTo: redirectToUrl }` or just `{ success: true, ... }`.
7.  Frontend (`waiver-form.html` JS): If `response.data.redirectTo` exists, sets `window.location.href = response.data.redirectTo`. Otherwise, shows success and closes.

**Key Edge Cases:**
*   `AvailabilityRule` not found or `max_group_invites` is null/undefined (schema should prevent null with default): Treat as invites not allowed.
*   `process.env.FORM_URL` (if used for absolute redirect URLs) is not set: Backend should handle gracefully, potentially logging an error and not providing `redirectTo`. Relative URLs are simpler if hosted on same domain.

---
###  API: GET `/api/sessions/:sessionId/invite-context` for Invite Page

**Goal:**
Provide `invite-friends.html` with the necessary data to render its initial state. This includes the maximum number of invites allowed for the session, details about the session itself (type, time), and information about any invites already generated or accepted for this parent session.

**API Relationships:**
*   **Endpoint:** `GET /api/sessions/:sessionId/invite-context`
    *   Called by: `invite-friends.html` JavaScript on page load.
*   **Internal Backend Integrations:**
    *   Database ([`src/core/prisma.js`](src/core/prisma.js:0)):
        *   Reads `Session` (to verify ownership via `telegramId` and get `session_type_id_fk`, `appointment_datetime`).
        *   Reads `User` (related to `Session.telegram_id` to authorize).
        *   Reads `SessionType` (related to `Session.session_type_id_fk` for `label`).
        *   Reads `AvailabilityRule` (associated with `SessionType` or `Session` to get `max_group_invites`).
        *   Reads all `SessionInvite` records where `parentSessionId` matches the given `:sessionId`.

**Detailed Requirements:**
*   **Requirement A (Authentication & Authorization):** The API must validate that the `telegramId` passed as a query parameter matches the `telegram_id` of the user who booked the `Session` identified by `:sessionId`. This prevents unauthorized users from viewing invite contexts for others' sessions.
*   **Requirement B (Data Aggregation):** The API must fetch and consolidate:
    *   `max_group_invites` from the relevant `AvailabilityRule`.
    *   Session details: `SessionType.label`, formatted `Session.appointment_datetime`.
    *   A list of `existingInvites`, including their `inviteToken`, `status`, and `friendNameOnWaiver` (if available).
*   **Requirement C (Clear Response Structure):** Return data in a well-defined JSON structure for easy consumption by the frontend.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Backend API endpoint. Handler in [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0) or new `src/handlers/api/sessionInviteApiHandler.js`.
*   **DB Schema:** Utilizes `Session`, `User`, `SessionType`, `AvailabilityRule` (with `max_group_invites`), and `SessionInvite` tables.
*   **API Design (`GET /api/sessions/:sessionId/invite-context`):**
    *   **Request:**
        *   Path parameter: `:sessionId` (ID of the parent session).
        *   Query parameter: `telegramId` (Telegram ID of the requesting user, the primary booker).
        *   Example: `GET /api/sessions/123/invite-context?telegramId=987654321`
    *   **Response (Success 200):**
      ```json
      {
        "success": true,
        "data": {
          "maxInvites": 3,
          "sessionDetails": {
            "typeLabel": "Standard Kambo Session",
            "appointmentTimeFormatted": "Monday, July 15, 2025 at 10:00 AM PDT"
          },
          "existingInvites": [
            { "token": "uuid-token-1", "status": "waiver_completed_by_friend", "friendName": "Alice" },
            { "token": "uuid-token-2", "status": "pending", "friendName": null }
          ]
        }
      }
      ```
    *   **Response (Error 403 - Forbidden):** If `telegramId` does not match `Session.telegram_id`.
      ```json
      { "success": false, "message": "Unauthorized to view this session's invite context." }
      ```
    *   **Response (Error 404 - Session Not Found):**
      ```json
      { "success": false, "message": "Session not found." }
      ```
    *   **Response (Error 500):**
      ```json
      { "success": false, "message": "Internal server error." }
      ```
    *   **Auth:** As described in Requirement A.
    *   **Rate Limiting:** Standard.
*   **Frontend Structure:** N/A (Backend API).
*   **CRUD Operations (Backend):** Read-only operations on multiple tables.
*   **UX Flow (Backend Perspective):**
    1.  Receive GET request with `sessionId` and `telegramId`.
    2.  Fetch `Session` by `sessionId`, including its related `User` and `SessionType`.
    3.  If session not found, return 404.
    4.  Verify `Session.user.telegram_id` matches query `telegramId`. If not, return 403.
    5.  Fetch `AvailabilityRule` associated with `Session.sessionType` to get `max_group_invites`. (Handle case where rule might not be found or link is indirect).
    6.  Fetch all `SessionInvite` records where `parentSessionId == sessionId`.
    7.  Format `appointment_datetime` and `SessionInvite` data.
    8.  Construct and return success response.
*   **Security:** Authorization check (Requirement A) is key.
*   **Testing:**
    *   **Unit:** Test handler logic with mocked Prisma calls. Test authorization logic. Test data formatting.
    *   **Integration (Supertest):**
        *   Test with valid `sessionId` and matching `telegramId`.
        *   Test with valid `sessionId` but non-matching `telegramId` (expect 403).
        *   Test with invalid `sessionId` (expect 404).
        *   Test scenarios with 0, 1, and multiple existing invites.
*   **Data Management:** Data is fetched fresh on each call. No specific caching on backend for this endpoint initially, but could be added if performance becomes an issue.
*   **Logging & Error Handling:**
    *   Log request details, authorization success/failure, data fetching steps.
    *   Return appropriate HTTP status codes and JSON error messages.

**Data Flow Steps:**
1.  `invite-friends.html` JS calls `GET /api/sessions/:sessionId/invite-context?telegramId=...`.
2.  API handler authenticates/authorizes the request.
3.  API handler queries DB for `Session`, `SessionType`, `AvailabilityRule.max_group_invites`, and related `SessionInvite`s.
4.  API handler formats data.
5.  API handler returns JSON response.

**Key Edge Cases:**
*   Session has no `AvailabilityRule` linked or `max_group_invites` is not set: API should handle gracefully, perhaps defaulting `maxInvites` to 0.
*   No existing invites for the session: `existingInvites` array should be empty.
*   Date/time formatting: Ensure consistent and user-friendly formatting, considering practitioner's timezone.

---
I will continue with PH6-21 through PH6-34 in the next message.
---
### Invite Friends WebApp: Initial Page Load &amp; Display

**Goal:**
Create the `invite-friends.html` Mini-App page. On load, this page will use the `sessionId` and `telegramId` from its URL parameters to call the `GET /api/sessions/:sessionId/invite-context` API (PH6-20). It will then display the session details (type, time), the maximum number of invites allowed, a list of any existing invites with their status, and provide UI elements to generate new invite links up to the allowed maximum.

**API Relationships:**
*   Calls `GET /api/sessions/:sessionId/invite-context` (defined in PH6-20) to fetch all necessary data.
    *   Request: `GET /api/sessions/{sessionId}/invite-context?telegramId={telegramId}`
    *   Response: JSON containing `maxInvites`, `sessionDetails`, `existingInvites`.

**Detailed Requirements:**
*   **Requirement A (Parameter Parsing):** JavaScript in `public/invite-friends.js` must parse `sessionId` and `telegramId` from the URL query parameters.
*   **Requirement B (API Call):** On page load, call `GET /api/sessions/:sessionId/invite-context` using the parsed parameters.
*   **Requirement C (Dynamic Content Display):**
    *   Display the session type and formatted appointment time.
    *   Display the number of remaining invites allowed (e.g., "You can invite X more friends").
    *   List existing invites, showing their status (e.g., "Pending", "Accepted by [Friend Name]", "Waiver Completed by [Friend Name]") and the shareable link/token.
    *   If `maxInvites` is 0 or all allowed invites have been generated, the "Generate Invite Link" button should be disabled or hidden.
*   **Requirement D (UI for Generating Invites):** Provide a button or UI element to trigger the generation of a new invite link (PH6-22), if remaining invites are available.
*   **Requirement E (Styling and UX):**
    *   The page should follow the aesthetic of `public/calendar-app.html` (dark theme, video background, Tailwind CSS).
    *   Clear visual distinction for different invite statuses.
    *   User-friendly messages and loading states.
*   **Requirement F (Error Handling):**
    *   If URL parameters are missing, display an error: "Invalid link. Session ID or User ID missing."
    *   If the API call fails (e.g., 403 Forbidden, 404 Not Found, 500 Server Error), display an appropriate error message from the API response or a generic one: "Could not load invite details. Please try again."

**Implementation Guide:**

*   **Architecture Overview:**
    *   New frontend Mini-App: `public/invite-friends.html`.
    *   Associated JavaScript: `public/invite-friends.js`.
    *   Associated CSS: `public/invite-friends.css` (or leverage shared/Tailwind styles).
    *   Client-side logic to fetch data and render UI.
*   **DB Schema:** N/A directly for this feature (relies on data fetched by PH6-20 API).
*   **API Design:** Consumes `GET /api/sessions/:sessionId/invite-context`. No new APIs defined by this feature.
*   **Frontend Structure (`public/invite-friends.html` and `public/invite-friends.js`):**
    *   **HTML (`public/invite-friends.html`):**
        *   Structure for displaying session information (e.g., `<div id="sessionInfo"></div>`).
        *   Structure for invite summary (e.g., `<p id="inviteSummary">You can invite <span id="remainingInvites"></span> more friends.</p>`).
        *   Container for listing existing invites (e.g., `<ul id="existingInvitesList"></ul>`).
            *   Template for an invite item: showing status, friend name, shareable link/token, copy button.
        *   Button to generate new invite (e.g., `<button id="generateInviteButton">Generate New Invite Link</button>`).
        *   Loading indicator elements.
        *   Error message display area.
        *   Video background element.
    *   **JavaScript (`public/invite-friends.js`):**
        *   `onPageLoad` function:
            *   Parse `sessionId`, `telegramId` from URL.
            *   Show loading state.
            *   Call `fetchInviteContext(sessionId, telegramId)`.
            *   On success: `renderInvitePage(data)`, hide loading.
            *   On error: `displayError(message)`, hide loading.
        *   `fetchInviteContext(sessionId, telegramId)` function:
            *   Makes `fetch` call to `GET /api/sessions/${sessionId}/invite-context?telegramId=${telegramId}`.
            *   Returns parsed JSON data or throws an error.
        *   `renderInvitePage(apiResponseData)` function:
            *   Populates `#sessionInfo` with `apiResponseData.data.sessionDetails`.
            *   Calculates remaining invites: `apiResponseData.data.maxInvites - apiResponseData.data.existingInvites.length`.
            *   Updates `#remainingInvites` and `#inviteSummary`.
            *   Disables/enables `#generateInviteButton` based on remaining invites.
            *   Clears and populates `#existingInvitesList` by creating list items for each invite in `apiResponseData.data.existingInvites`.
                *   Each item should display status, token (potentially as a shareable link `https://t.me/YourBotName?start=invite_{token}`), and friend's name if available.
                *   Add "Copy Link" button per invite.
        *   `displayError(message)` function: Shows error message to user.
        *   Event listener for `#generateInviteButton` (to trigger PH6-22).
        *   Event listeners for "Copy Link" buttons.
*   **CRUD Operations:** N/A (Read-only via API).
*   **UX Flow:**
    1.  User is redirected to `invite-friends.html?sessionId=X&telegramId=Y`.
    2.  Page loads, JS parses URL params.
    3.  Loading indicator is shown.
    4.  JS calls API to fetch invite context.
    5.  API returns data.
    6.  JS renders session details, remaining invites count, and list of existing invites.
    7.  "Generate Invite Link" button is enabled if invites are available.
    8.  User can see existing invites and copy their links.
    *   **Loading State:** Full page loader or skeleton UI while API call is in progress.
    *   **Error State:** Clear message indicating failure to load data, with advice to retry or contact support.
*   **Security:**
    *   Relies on the API (PH6-20) for authorization. The `telegramId` in the URL is used by the API to ensure the user is the primary booker.
    *   Shareable links will contain tokens; ensure these are handled securely.
*   **Testing:**
    *   **Unit Tests (`public/invite-friends.js`):**
        *   Test URL parameter parsing.
        *   Test `renderInvitePage` logic with various mock API responses (no invites, some invites, max invites reached, different statuses).
        *   Test calculation of remaining invites.
        *   Test enabling/disabling of "Generate Invite" button.
    *   **Integration Tests:**
        *   Test the page's interaction with the `GET /api/sessions/:sessionId/invite-context` API (using mock API).
    *   **E2E Tests:**
        *   Full flow: User books session -> gets redirected to `invite-friends.html` -> page loads and displays correct initial data based on session and `max_group_invites`.
        *   Test with a session allowing 0 invites (button should be disabled).
        *   Test with a session allowing N invites, with 0 existing invites.
        *   Test with a session allowing N invites, with M existing invites (M &lt; N).
        *   Test with a session allowing N invites, with N existing invites (button disabled).
*   **Data Management:** All data is fetched from the API on load. No client-side storage beyond what's needed for rendering.
*   **Logging & Error Handling:**
    *   Client-side JS: Log API call initiation, success, failure. Log parsed parameters. Log rendering steps.
    *   User-facing errors displayed clearly on the page.

**Data Flow Steps:**
1.  `invite-friends.html` loads. JS extracts `sessionId` and `telegramId` from URL.
2.  JS displays a loading indicator.
3.  JS calls `GET /api/sessions/{sessionId}/invite-context?telegramId={telegramId}`.
4.  Backend API (PH6-20) validates, fetches data from DB, and returns JSON.
5.  JS receives JSON response.
6.  JS hides loading indicator.
7.  If API call successful:
    *   JS parses response data.
    *   JS updates DOM to display session details.
    *   JS calculates and displays remaining invites.
    *   JS lists existing invites with their statuses and shareable links.
    *   JS enables/disables "Generate Invite Link" button.
8.  If API call fails:
    *   JS displays an error message.

**Key Edge Cases:**
*   API returns `maxInvites: 0`: "Generate Invite Link" button should be disabled, message indicates no invites possible.
*   API returns `existingInvites` array that fills up `maxInvites`: "Generate Invite Link" button disabled.
*   API returns error (403, 404, 500): Page displays appropriate error.
*   URL parameters `sessionId` or `telegramId` are missing: Page displays error, no API call made.
*   Network error during API call: Page displays generic network error.
---
###  API: `POST /api/sessions/:sessionId/generate-invite-token`

**Goal:**
Create an API endpoint that allows the primary booker (authenticated via `telegramId`) to generate a new unique invite token for their session, up to the `max_group_invites` limit. This involves creating a new `SessionInvite` record in the database.

**API Relationships:**
*   **Endpoint:** `POST /api/sessions/:sessionId/generate-invite-token`
    *   Called by: `public/invite-friends.js` when the user clicks "Generate New Invite Link".
*   **Internal Backend Integrations:**
    *   Database ([`src/core/prisma.js`](src/core/prisma.js:0)):
        *   Reads `Session` (to verify ownership via `telegramId` and link to `AvailabilityRule`).
        *   Reads `User` (related to `Session.telegram_id` to authorize).
        *   Reads `AvailabilityRule` (associated with `Session` to get `max_group_invites`).
        *   Counts existing `SessionInvite` records for the `parentSessionId`.
        *   Creates a new `SessionInvite` record.
    *   Uses a secure token generation mechanism (e.g., `crypto.randomBytes` or UUID).

**Detailed Requirements:**
*   **Requirement A (Authentication & Authorization):** The API must validate that the `telegramId` in the request body matches the `telegram_id` of the user who booked the `Session` identified by `:sessionId`.
*   **Requirement B (Invite Limit Check):** Before generating a token, the API must:
    *   Fetch `max_group_invites` for the session.
    *   Count the number of existing `SessionInvite` records for this `parentSessionId`.
    *   If the count of existing invites is greater than or equal to `max_group_invites`, return an error (e.g., "Invite limit reached").
*   **Requirement C (Token Generation):** Generate a cryptographically strong, unique `inviteToken`. UUIDs are a good choice.
*   **Requirement D (Database Record Creation):** Create a new `SessionInvite` record in the database with:
    *   `parentSessionId` set to `:sessionId`.
    *   The newly generated `inviteToken`.
    *   `status` set to "pending".
*   **Requirement E (API Response):** On successful token generation and record creation, respond with the new `SessionInvite` object (or at least the `inviteToken` and its initial status).

**Implementation Guide:**

*   **Architecture Overview:**
    *   Backend API endpoint. Handler in [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0) or new `src/handlers/api/sessionInviteApiHandler.js`.
*   **DB Schema:** Utilizes `Session`, `User`, `AvailabilityRule`, and `SessionInvite` tables.
*   **API Design (`POST /api/sessions/:sessionId/generate-invite-token`):**
    *   **Request:**
        *   Path parameter: `:sessionId` (ID of the parent session).
        *   Request Body (JSON): `{ "telegramId": "requestingUserTelegramId" }`
        *   Example: `POST /api/sessions/123/generate-invite-token` with body `{"telegramId": "987654321"}`
    *   **Response (Success 201 - Created):**
      ```json
      {
        "success": true,
        "data": {
          "id": "new-invite-uuid",
          "parentSessionId": 123,
          "inviteToken": "generated-unique-token-uuid",
          "status": "pending",
          "friendTelegramId": null,
          "friendNameOnWaiver": null,
          "createdAt": "2025-07-15T10:30:00.000Z",
          "updatedAt": "2025-07-15T10:30:00.000Z"
        }
      }
      ```
    *   **Response (Error 403 - Forbidden):** If `telegramId` does not match `Session.telegram_id`.
      ```json
      { "success": false, "message": "Unauthorized to generate invites for this session." }
      ```
    *   **Response (Error 404 - Session Not Found):**
      ```json
      { "success": false, "message": "Session not found." }
      ```
    *   **Response (Error 400 - Invite Limit Reached):**
      ```json
      { "success": false, "message": "Invite limit reached for this session." }
      ```
    *   **Response (Error 500):**
      ```json
      { "success": false, "message": "Internal server error while generating invite." }
      ```
    *   **Auth:** As described in Requirement A.
    *   **Rate Limiting:** Standard. Consider stricter rate limiting for token generation if abuse is a concern.
*   **Frontend Structure:** N/A (Backend API). Called by `public/invite-friends.js`.
*   **CRUD Operations (Backend):**
    *   Read: `Session`, `User`, `AvailabilityRule`, count of `SessionInvite`.
    *   Create: New `SessionInvite` record.
*   **UX Flow (Backend Perspective):**
    1.  Receive POST request with `sessionId` and `telegramId` in body.
    2.  Fetch `Session` by `sessionId`, including its related `User` and `AvailabilityRule` (or derive rule).
    3.  If session not found, return 404.
    4.  Verify `Session.user.telegram_id` matches request body `telegramId`. If not, return 403.
    5.  Get `max_group_invites` from `AvailabilityRule`.
    6.  Count existing `SessionInvite` records for this `parentSessionId`.
    7.  If `count >= max_group_invites`, return 400 "Invite limit reached".
    8.  Generate a new unique `inviteToken` (e.g., `crypto.randomUUID()`).
    9.  Create `SessionInvite` record in DB with `parentSessionId`, `inviteToken`, `status: 'pending'`.
    10. Return 201 with the new `SessionInvite` data.
*   **Security:**
    *   Authorization check is crucial.
    *   Ensure `inviteToken` is unique and unpredictable. Prisma's `@unique` on `inviteToken` field in `SessionInvite` model will enforce DB-level uniqueness.
*   **Testing:**
    *   **Unit:**
        *   Test handler logic with mocked Prisma calls.
        *   Test authorization logic.
        *   Test invite limit check logic.
        *   Test token generation (ensure it's called).
        *   Test `SessionInvite` record creation parameters.
    *   **Integration (Supertest):**
        *   Test successful token generation.
        *   Test with non-matching `telegramId` (expect 403).
        *   Test with invalid `sessionId` (expect 404).
        *   Test when invite limit is reached (expect 400).
        *   Verify a new `SessionInvite` record is created in the test DB.
*   **Data Management:** New `SessionInvite` records are persisted.
*   **Logging & Error Handling:**
    *   Log request details, auth success/failure, invite limit checks, token generation, DB record creation.
    *   Return appropriate HTTP status codes and JSON error messages.

**Data Flow Steps:**
1.  `public/invite-friends.js` calls `POST /api/sessions/:sessionId/generate-invite-token` with `telegramId` in body.
2.  API handler authenticates/authorizes.
3.  API handler checks if invite limit has been reached.
4.  If limit not reached, API handler generates a unique `inviteToken`.
5.  API handler creates a new `SessionInvite` record in the DB.
6.  API handler returns the new `SessionInvite` data with a 201 status.
7.  If limit reached or error, returns appropriate error response.

**Key Edge Cases:**
*   Race condition if multiple requests try to generate the last available invite slot: The first one to pass the count check and commit the DB transaction wins. Subsequent ones should fail the count check.
*   Token collision (highly unlikely with UUIDs, but DB unique constraint handles it): If a token collision did occur before DB insert, the generation logic could retry.
*   `AvailabilityRule` not found or `max_group_invites` is 0: Invite limit check should prevent generation.
---
###  Invite Friends WebApp: Update UI After Token Generation

**Goal:**
After successfully generating a new invite token via `POST /api/sessions/:sessionId/generate-invite-token` (PH6-22), the `public/invite-friends.js` script must dynamically update the UI to reflect this new invite. This includes adding the new invite to the list of existing invites, updating the count of remaining invites, and potentially disabling the "Generate Invite Link" button if the limit is reached.

**API Relationships:**
*   Consumes the response from `POST /api/sessions/:sessionId/generate-invite-token` (PH6-22).
    *   Expected success response: `{ success: true, data: { newSessionInviteObject } }`

**Detailed Requirements:**
*   **Requirement A (Successful API Call Handling):** JavaScript in `public/invite-friends.js` must handle the successful response from the token generation API.
*   **Requirement B (Dynamic UI Update - New Invite):**
    *   A new list item representing the newly generated invite (with status "pending" and the new token/shareable link) must be added to the `existingInvitesList` in the DOM.
    *   This new item should be visually consistent with other invite items.
*   **Requirement C (Dynamic UI Update - Counts & Button State):**
    *   The displayed count of "remaining invites" must be decremented.
    *   If the number of existing invites now equals `max_group_invites`, the "Generate Invite Link" button (`#generateInviteButton`) must be disabled.
*   **Requirement D (Error Handling):** If the API call to generate a token fails (e.g., limit reached, server error), an appropriate error message should be displayed to the user, and the UI should not change incorrectly. The "Generate Invite Link" button should be re-enabled if it was temporarily disabled during the API call, unless the error indicates the limit is permanently reached.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Client-side JavaScript logic in `public/invite-friends.js`.
    *   Manipulates the DOM of `public/invite-friends.html`.
*   **DB Schema:** N/A directly (UI reflects data now in DB).
*   **API Design:** Consumes API from PH6-22.
*   **Frontend Structure (`public/invite-friends.js`):**
    *   **Component:** Event handler for `#generateInviteButton` click.
    *   **State Management:** Relies on current DOM state and data fetched during initial load (PH6-21) for `maxInvites`.
    *   **DOM Manipulation:** Functions to add new invite items to the list, update text content for counts, and modify button attributes.
    *   **Pseudocode for `#generateInviteButton` click handler (relevant part):**
      ```javascript
      // In public/invite-friends.js
      // Assume 'maxInvitesAllowed' is stored from initial page load (PH6-21)
      // Assume 'currentTelegramId' and 'currentSessionId' are available

      generateInviteButton.addEventListener('click', async () => {
        // Optional: Disable button during API call
        generateInviteButton.disabled = true;
        generateInviteButton.textContent = 'Generating...';

        try {
          const response = await fetch(`/api/sessions/${currentSessionId}/generate-invite-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: currentTelegramId })
          });
          const result = await response.json();

          if (result.success && response.status === 201) {
            const newInvite = result.data;
            addInviteToDOM(newInvite); // Requirement B
            updateRemainingInvitesCount(); // Requirement C
            checkAndDisableGenerateButtonIfNeeded(); // Requirement C
            generateInviteButton.textContent = 'Generate New Invite Link'; // Reset button text
            // Button will be re-enabled by checkAndDisableGenerateButtonIfNeeded if applicable
          } else {
            // Requirement D: Handle API error
            showInviteGenerationError(result.message || 'Failed to generate invite.');
            generateInviteButton.disabled = false; // Re-enable unless error is 'limit reached'
            generateInviteButton.textContent = 'Generate New Invite Link';
            if (result.message && result.message.toLowerCase().includes('limit reached')) {
                generateInviteButton.disabled = true; // Keep disabled if limit is confirmed reached
            }
          }
        } catch (error) {
          // Requirement D: Handle network error
          showInviteGenerationError('Network error. Could not generate invite.');
          generateInviteButton.disabled = false;
          generateInviteButton.textContent = 'Generate New Invite Link';
          console.error("Error generating invite:", error);
        }
      });

      function addInviteToDOM(inviteData) {
        const list = document.getElementById('existingInvitesList');
        const listItem = document.createElement('li');
        // Populate listItem with inviteData.inviteToken, status, copy button, etc.
        // Example:
        listItem.innerHTML = `
          <span>Token: ${inviteData.inviteToken}</span>
          <span>Status: ${inviteData.status}</span>
          <button class="copy-link-btn" data-token="${inviteData.inviteToken}">Copy Link</button>
        `;
        list.appendChild(listItem);
        // Re-attach event listeners for new copy buttons if necessary
      }

      function updateRemainingInvitesCount() {
        const existingInvitesCount = document.getElementById('existingInvitesList').children.length;
        const remaining = maxInvitesAllowed - existingInvitesCount;
        document.getElementById('remainingInvites').textContent = remaining;
        // Update summary text if needed
        const summaryEl = document.getElementById('inviteSummary');
        if (summaryEl) summaryEl.textContent = `You can invite ${remaining} more friends.`;

      }

      function checkAndDisableGenerateButtonIfNeeded() {
        const existingInvitesCount = document.getElementById('existingInvitesList').children.length;
        if (existingInvitesCount >= maxInvitesAllowed) {
          generateInviteButton.disabled = true;
          generateInviteButton.textContent = 'Invite Limit Reached';
        } else {
          generateInviteButton.disabled = false; // Ensure it's enabled if limit not reached
          generateInviteButton.textContent = 'Generate New Invite Link';
        }
      }
      
      function showInviteGenerationError(message) {
        // Display this message in an error area on the page
        const errorDisplay = document.getElementById('inviteErrorArea'); // Assuming this element exists
        if (errorDisplay) {
            errorDisplay.textContent = message;
            errorDisplay.style.display = 'block';
        } else {
            alert(message); // Fallback
        }
      }
      ```
*   **CRUD Operations:** N/A (Client-side UI update based on API response).
*   **UX Flow:**
    1.  User is on `invite-friends.html`. "Generate Invite Link" button is enabled (assuming limit not reached).
    2.  User clicks "Generate Invite Link". Button may show a "Generating..." state.
    3.  JS calls `POST /api/sessions/:sessionId/generate-invite-token`.
    4.  API (PH6-22) responds.
    5.  If successful (201):
        *   JS parses new invite data.
        *   JS adds a new item to the list of invites on the page.
        *   JS decrements the "remaining invites" count.
        *   JS disables "Generate Invite Link" button if `existing_invites_count == max_invites`.
        *   Button text reverts to "Generate New Invite Link" or "Invite Limit Reached".
    6.  If API returns error:
        *   JS displays an error message.
        *   "Generate Invite Link" button is re-enabled (unless error is "limit reached").
*   **Security:** N/A for this client-side update logic itself. Relies on API security.
*   **Testing:**
    *   **Unit Tests (`public/invite-friends.js`):**
        *   Test `addInviteToDOM` function: verify correct HTML structure is created.
        *   Test `updateRemainingInvitesCount` function: verify count updates correctly.
        *   Test `checkAndDisableGenerateButtonIfNeeded` function: verify button state changes based on counts.
        *   Test the main event handler logic for successful API response: ensure all UI update functions are called.
        *   Test the main event handler logic for failed API response (various error types).
    *   **E2E Tests:**
        *   Click "Generate Invite Link" when invites are available:
            *   Verify a new invite appears in the list.
            *   Verify remaining count decrements.
            *   Verify button remains enabled if limit not yet reached.
        *   Click "Generate Invite Link" repeatedly until limit is reached:
            *   Verify button becomes disabled.
            *   Verify "Invite Limit Reached" text (or similar).
        *   Test API error scenario (e.g., mock API to return 500): Verify error message is shown and UI state is correct.
*   **Data Management:** Client-side state (number of invites, max invites) is managed through DOM reads/updates and JS variables initialized on page load.
*   **Logging & Error Handling:**
    *   Client-side JS: Log API call initiation, success/failure. Log data received. Log DOM updates.
    *   User-facing errors displayed on the page.

**Data Flow Steps (Client-Side Focus):**
1.  User clicks "Generate Invite Link" on `invite-friends.html`.
2.  JS sends `POST` request to `/api/sessions/:sessionId/generate-invite-token`.
3.  JS receives response from API.
4.  If response is success (201 Created, with new invite data):
    *   JS calls `addInviteToDOM(newInviteData)` to append to the list.
    *   JS calls `updateRemainingInvitesCount()` to adjust displayed numbers.
    *   JS calls `checkAndDisableGenerateButtonIfNeeded()` to update button state.
5.  If response is an error:
    *   JS calls `showInviteGenerationError(errorMessage)`.
    *   JS potentially re-enables the generate button.

**Key Edge Cases:**
*   User clicks "Generate Invite Link" very quickly multiple times: The button should be disabled during the API call to prevent multiple simultaneous requests. The backend API (PH6-22) also has checks.
*   `maxInvitesAllowed` is 0 initially: `checkAndDisableGenerateButtonIfNeeded` (called on page load after PH6-21) should have already disabled the button.
*   API returns an unexpected success/error format: JS should handle gracefully, perhaps showing a generic error.
---
###  Bot: Primary Booker's Confirmation Message - Add "Invite Friends" Button (Conditional)

**Goal:**
Modify the final booking confirmation message sent to the primary booker in Telegram (originally defined in PH6-17) to conditionally include an "Invite Friends" button. This button should only appear if the booked session allows for group invites (`AvailabilityRule.max_group_invites > 0`) and the "Invite Friends" feature is enabled.

**API Relationships:**
*   This feature modifies the logic within the `POST /api/submit-waiver` handler (or a function it calls, like one in [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0)) that constructs and sends/edits the final confirmation message.
*   It requires fetching `AvailabilityRule.max_group_invites` associated with the `Session` being confirmed.

**Detailed Requirements:**
*   **Requirement A (Check Invite Eligibility):** When preparing the final confirmation message for the primary booker, the system must check `AvailabilityRule.max_group_invites` for the session.
*   **Requirement B (Conditional Button):**
    *   If `max_group_invites > 0` (and `INVITE_FRIENDS_ENABLED='true'`): The Telegram confirmation message must include an inline keyboard button labeled "Invite Friends".
    *   This button, when clicked, should open the `invite-friends.html` WebApp, passing `sessionId` and `telegramId`. The URL would be `https://{your_domain}/invite-friends.html?sessionId={sessionId}&telegramId={telegramId}`.
*   **Requirement C (No Button):** If `max_group_invites == 0` or the feature is disabled, no "Invite Friends" button is added to the confirmation message (behavior remains as in PH6-17 MVP).
*   **Requirement D (Message Text):** The main text of the confirmation message remains largely the same (frog pic, "✅ Your {SessionTypeLabel} session is confirmed...").

**Implementation Guide:**

*   **Architecture Overview:**
    *   Backend logic modification, likely within [`src/handlers/api/waiverApiHandler.js`](src/handlers/api/waiverApiHandler.js:0) or a helper function in [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) responsible for formatting and sending the final confirmation.
    *   Utilizes Telegraf's `Markup.inlineKeyboard` and `Markup.button.webApp`.
*   **DB Schema:** Relies on `AvailabilityRule.max_group_invites` (PH6-18).
*   **API Design:** No new API endpoint. Modifies the behavior of `POST /api/submit-waiver`'s side effect (sending Telegram message).
*   **Backend Structure (Conceptual change in `telegramNotifier.editMessageText` or similar):**
    *   The function responsible for sending/editing the final confirmation message will need to accept `sessionId` or `max_group_invites` information.
    *   **Pseudocode for message sending/editing logic:**
      ```javascript
      // Inside a function in telegramNotifier.js, e.g., sendBookingConfirmation
      // async function sendOrEditFinalConfirmation(telegramId, editMsgId, sessionDetails, newSessionId, maxInvites) {
      //   const confirmationText = `✅ Your ${sessionDetails.label} session is confirmed...`;
      //   let inlineKeyboard = null;
      //
      //   if (maxInvites > 0 && process.env.INVITE_FRIENDS_ENABLED === 'true') {
      //     const webAppUrl = `${process.env.BASE_URL}/invite-friends.html?sessionId=${newSessionId}&telegramId=${telegramId}`;
      //     // Ensure BASE_URL is correctly configured (e.g., https://yourbotdomain.com/public)
      //     // The path to invite-friends.html might be just /invite-friends.html if served from same root
      //
      //     inlineKeyboard = Markup.inlineKeyboard([
      //       Markup.button.webApp('Invite Friends 🧑‍🤝‍🧑', webAppUrl)
      //     ]);
      //   }
      //
      //   // Logic to edit message with photo and caption, or just text
      //   if (editMsgId) {
      //     // If editing a message that already has a photo, can only edit caption.
      //     // If it was text, can edit to text + keyboard.
      //     // If need to add photo + caption + keyboard to a text message, might need to delete and send new.
      //     // For simplicity, assume we can edit text and add/remove keyboard.
      //     // The frog picture part from PH6-17 needs to be handled here.
      //     // If the original message (placeholder) was just text:
      //     await bot.telegram.editMessageText(telegramId, editMsgId, undefined, confirmationText, inlineKeyboard ? inlineKeyboard : undefined);
      //     // If it involved a photo, this is more complex.
      //     // A common pattern is to send a photo with caption and keyboard:
      //     // await bot.telegram.sendPhoto(telegramId, 'URL_OR_FILE_ID_TO_FROG_PIC', {
      //     //   caption: confirmationText,
      //     //   reply_markup: inlineKeyboard ? inlineKeyboard.reply_markup : undefined
      //     // });
      //     // And if editMsgId was for a previous message, delete that one.
      //     // This part needs careful handling of Telegram API capabilities for editing vs sending new.
      //   } else {
      //     // Send new message if no editMsgId
      //     await bot.telegram.sendPhoto(telegramId, 'URL_TO_FROG_PIC', { // Or use a file_id
      //        caption: confirmationText,
      //        reply_markup: inlineKeyboard ? inlineKeyboard.reply_markup : undefined
      //     });
      //   }
      // }
      ```
*   **CRUD Operations:** Reads `AvailabilityRule`.
*   **UX Flow:**
    1.  Primary booker completes waiver submission.
    2.  Backend (`POST /api/submit-waiver`) processes booking.
    3.  Backend determines `max_group_invites` for the session.
    4.  If `max_group_invites > 0`:
        *   The final confirmation message sent/edited in Telegram includes an "Invite Friends" button below the text.
        *   Clicking button opens `invite-friends.html` WebApp.
    5.  If `max_group_invites == 0`:
        *   Confirmation message appears without the "Invite Friends" button.
*   **Security:** The WebApp URL should use HTTPS. `sessionId` and `telegramId` in URL provide context to the WebApp.
*   **Testing:**
    *   **Backend:**
        *   Unit test the logic that decides whether to add the button and constructs the WebApp URL.
        *   Mock Telegraf calls to verify `editMessageText` or `sendPhoto` is called with the correct parameters (including inline keyboard when expected).
    *   **E2E:**
        *   Scenario 1: Book a session type that allows invites -> verify final Telegram confirmation message has "Invite Friends" button. Click button and verify it opens `invite-friends.html` (manual check or further automation if possible).
        *   Scenario 2: Book a session type that does NOT allow invites -> verify confirmation message has NO "Invite Friends" button.
*   **Data Management:** N/A for this specific modification beyond reading existing data.
*   **Logging & Error Handling:**
    *   Backend: Log whether the "Invite Friends" button was added. Log the generated WebApp URL.
    *   Log any errors during Telegraf API calls.

**Data Flow Steps (Focus on Telegram Message Modification):**
1.  Inside `POST /api/submit-waiver` handler, after successful booking.
2.  Fetch/determine `max_group_invites` for the `newSession.id`.
3.  Prepare confirmation message text and frog picture.
4.  If `max_group_invites > 0` and feature enabled:
    *   Construct `webAppUrl = "https://{domain}/invite-friends.html?sessionId={newSession.id}&telegramId={telegramId}"`.
    *   Create `inlineKeyboard` with `Markup.button.webApp("Invite Friends", webAppUrl)`.
5.  Call appropriate Telegraf method (e.g., `editMessageText`, `editMessageMedia`, `sendPhoto`) with text, photo, and the conditional `inlineKeyboard`.
6.  (Clear `edit_msg_id` as per PH6-17).

**Key Edge Cases:**
*   `process.env.BASE_URL` (or similar for WebApp domain) is not configured: Button URL would be invalid. System should have defaults or error out if critical env vars are missing.
*   Telegram API limitations on editing messages (e.g., cannot add media to a text-only message via edit): The implementation must choose the correct Telegraf method. It might be simpler to always send a new confirmation message with photo+caption+button and delete the `edit_msg_id` message if one existed. This simplifies the logic for what can be edited.
*   `telegramId` used for the WebApp URL must be the primary booker's ID.
This concludes Phase 6B features.
---
## Feature Specifications (Phase 6C: "Invite Friends" - Sharing & Friend Acceptance (Basic))

---
### Invite Friends WebApp: "Copy Link" & "Share on Telegram" Functionality

**Goal:**
Enable the primary booker on `invite-friends.html` to easily copy an individual invite link (containing the unique `inviteToken`) to their clipboard, and provide a "Share on Telegram" button that uses Telegram's URL scheme to open a chat with a pre-filled message containing the invite link.

**API Relationships:**
*   This is primarily a frontend feature. It uses the `inviteToken` obtained from `GET /api/sessions/:sessionId/invite-context` (PH6-20) or from the response of `POST /api/sessions/:sessionId/generate-invite-token` (PH6-22).

**Detailed Requirements:**
*   **Requirement A (Copy Link Button):** For each generated invite displayed on `invite-friends.html`, there must be a "Copy Link" button.
    *   Clicking this button copies the full shareable invite link (e.g., `https://t.me/YourBotName?start=invite_{token}`) to the user's clipboard.
    *   Provide visual feedback that the link has been copied (e.g., button text changes to "Copied!" temporarily, or a small toast message appears).
*   **Requirement B (Share on Telegram Button - Optional, if feasible):**
    *   For each generated invite, consider adding a "Share on Telegram" button.
    *   Clicking this button constructs a Telegram share URL (e.g., `https://t.me/share/url?url={encoded_invite_link}&text={encoded_message}`).
    *   The `url` parameter would be the invite link (`https://t.me/YourBotName?start=invite_{token}`).
    *   The `text` parameter could be a default message like "Join me for a Kambo session!".
    *   This will open the user's Telegram app to a chat picker to share the link.
*   **Requirement C (Link Construction):** The invite link must be correctly formatted using the bot's username and the `inviteToken`, suitable for deep linking (e.g., `https://t.me/YOUR_BOT_USERNAME?start=invite_UNIQUE_INVITE_TOKEN`). The `process.env.BOT_USERNAME` should be available to the frontend if needed, or links constructed relative to `t.me`.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Client-side JavaScript logic in `public/invite-friends.js`.
    *   DOM manipulation on `public/invite-friends.html`.
*   **DB Schema:** N/A.
*   **API Design:** N/A.
*   **Frontend Structure (`public/invite-friends.js`):**
    *   **Component:** Event listeners attached to "Copy Link" buttons (dynamically added for each invite).
    *   **State Management:** Reads `inviteToken` from the DOM element or associated data when a button is clicked.
    *   **Clipboard API:** Uses `navigator.clipboard.writeText()` for copying.
    *   **Pseudocode for "Copy Link" button click handler:**
      ```javascript
      // In public/invite-friends.js, likely using event delegation for dynamically added buttons
      document.getElementById('existingInvitesList').addEventListener('click', async (event) => {
        if (event.target.classList.contains('copy-link-btn')) {
          const button = event.target;
          const token = button.dataset.token; // Assuming token is stored in data-token attribute
          const botUsername = window.kamboKlarityConfig.botUsername; // Needs to be exposed to frontend
          const inviteLink = `https://t.me/${botUsername}?start=invite_${token}`;

          try {
            await navigator.clipboard.writeText(inviteLink);
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.disabled = true;
            setTimeout(() => {
              button.textContent = originalText;
              button.disabled = false;
            }, 2000); // Revert after 2 seconds
          } catch (err) {
            console.error('Failed to copy link: ', err);
            // Show an error message to the user if copy fails
            alert('Failed to copy link. Please copy manually.');
          }
        }

        if (event.target.classList.contains('share-telegram-btn')) {
            const button = event.target;
            const token = button.dataset.token;
            const botUsername = window.kamboKlarityConfig.botUsername;
            const inviteLink = `https://t.me/${botUsername}?start=invite_${token}`;
            const shareText = encodeURIComponent("Join me for a Kambo session!");
            const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${shareText}`;
            window.open(telegramShareUrl, '_blank'); // Opens in new tab/Telegram app
        }
      });
      
      // Expose BOT_USERNAME to frontend (e.g. via a script tag in invite-friends.html)
      // <script>
      //   window.kamboKlarityConfig = {
      //     botUsername: "{{BOT_USERNAME_FROM_ENV}}" // If using a template engine
      //     // Or hardcode if it's static and public, or fetch from an API endpoint
      //   };
      // </script>
      ```
*   **CRUD Operations:** N/A.
*   **UX Flow:**
    1.  Primary booker sees a list of generated invites on `invite-friends.html`.
    2.  Each invite has a "Copy Link" button.
    3.  User clicks "Copy Link".
    4.  Link is copied to clipboard. Button provides feedback.
    5.  (Optional) User clicks "Share on Telegram". Telegram app opens to share the link.
*   **Security:**
    *   Ensure `inviteToken` is not easily guessable (UUIDs are good).
    *   The `navigator.clipboard` API requires user permission or secure context (HTTPS).
*   **Testing:**
    *   **Manual:**
        *   Click "Copy Link" and verify link is in clipboard and correctly formatted.
        *   Verify visual feedback on button.
        *   (If implemented) Click "Share on Telegram" and verify it opens Telegram with correct pre-fill.
    *   **Unit Tests (`public/invite-friends.js`):**
        *   Mock `navigator.clipboard.writeText` and test the handler logic.
        *   Test invite link construction.
        *   Test visual feedback logic (e.g., button text change).
*   **Data Management:** N/A.
*   **Logging & Error Handling:**
    *   Client-side JS: Log copy attempts, success/failure.
    *   User-facing alert or message if copy fails.

**Data Flow Steps:**
1.  User clicks "Copy Link" on `invite-friends.html`.
2.  JS retrieves the `inviteToken` associated with that button.
3.  JS constructs the full `https://t.me/YourBotName?start=invite_{token}` link.
4.  JS calls `navigator.clipboard.writeText(inviteLink)`.
5.  JS updates button for feedback.
6.  (For Share button) JS constructs `t.me/share/url?...` and opens it.

**Key Edge Cases:**
*   Clipboard API not supported or permission denied: Provide fallback or clear error. Modern browsers generally support it in secure contexts.
*   `BOT_USERNAME` not available to frontend: Link construction will fail. Needs to be reliably provided.
*   User has Telegram Desktop/Web not configured: "Share on Telegram" might not work as expected, but this is user environment dependent.
---
### Bot: Handle `/start invite_{token}` Deep Link from Friend

**Goal:**
Enable the Telegram bot to recognize and process deep links of the format `/start invite_{token}`. When an invited friend clicks such a link, the bot should validate the token, retrieve invite and parent session details, and guide the friend through an acceptance/information flow.

**API Relationships:**
*   This feature modifies the bot's `/start` command handler (likely in [`src/commands/handlers.js`](src/commands/handlers.js:0) or a dedicated start command file, processed by [`src/handlers/commandHandler.js`](src/handlers/commandHandler.js:0) or [`src/middleware/updateRouter.js`](src/middleware/updateRouter.js:0)).
*   **Internal Backend Integrations:**
    *   Database ([`src/core/prisma.js`](src/core/prisma.js:0)):
        *   Reads `SessionInvite` by `inviteToken` to validate it and get `parentSessionId` and `status`.
        *   Reads `Session` (parent session) to get details like `appointment_datetime`, `session_type_id_fk`.
        *   Reads `SessionType` for `label`.
        *   Reads `User` (primary booker) to get their name/details for display to the friend.
        *   Potentially updates `SessionInvite.status` to 'viewed_by_friend' or similar if desired.

**Detailed Requirements:**
*   **Requirement A (Deep Link Parsing):** The bot's `/start` command handler must parse payloads of the format `invite_{token}`.
*   **Requirement B (Token Validation & Data Fetch):**
    *   Extract the `inviteToken` from the payload.
    *   Query the `SessionInvite` table for a record matching the `inviteToken`.
    *   If token not found or invite status is not 'pending' (or another acceptable state like 'viewed_by_friend'), inform the friend the invite is invalid/expired/already used.
    *   If valid, fetch details of the `parentSession` (type, date/time) and the primary booker's name.
*   **Requirement C (Friend Interaction - Initial Message):**
    *   Send a message to the invited friend:
        *   Acknowledging the invite: "You've been invited by [Primary Booker Name] to a [Session Type Label] session!"
        *   Displaying session details: "Date: [Formatted Date], Time: [Formatted Time]."
        *   Providing options: Inline buttons for "Accept Invite & View Details" (opens `join-session.html` WebApp) and "Decline Invite".
*   **Requirement D (State Management - Optional):** Consider storing the `inviteToken` and `parentSessionId` in the friend's user state ([`src/tools/stateManager.js`](src/tools/stateManager.js:0)) if they need to be accessed across multiple interactions before they click "Accept".

**Implementation Guide:**

*   **Architecture Overview:**
    *   Modification to the bot's `/start` command handler.
    *   Interaction with Prisma for DB lookups.
    *   Use Telegraf for message sending and inline keyboards.
*   **DB Schema:** Relies on `SessionInvite`, `Session`, `SessionType`, `User`.
*   **API Design:** N/A (Bot command handling).
*   **Backend Structure (`/start` command handler):**
    *   **Pseudocode for `/start` handler logic:**
      ```javascript
      // In the /start command handler (e.g., src/commands/client/start.js or similar)
      // ctx is the Telegraf context object

      const payload = ctx.startPayload; // This gets the part after /start
      if (payload && payload.startsWith('invite_')) {
        const inviteToken = payload.substring('invite_'.length);
        logger.info(`Processing invite deep link with token: ${inviteToken} for user ${ctx.from.id}`);

        try {
          const sessionInvite = await prisma.sessionInvite.findUnique({
            where: { inviteToken },
            include: {
              parentSession: {
                include: {
                  sessionType: true,
                  user: true // Primary booker
                }
              }
            }
          });

          if (!sessionInvite) {
            await ctx.reply("This invitation link is invalid or has expired. Please ask your friend for a new one.");
            return;
          }

          if (sessionInvite.status !== 'pending') { // Or other acceptable statuses
            // Example: if friend already accepted and completed waiver
            if (sessionInvite.status === 'waiver_completed_by_friend') {
                 await ctx.reply(`You have already accepted and completed the waiver for this session with ${sessionInvite.parentSession.user.firstName}.`);
                 // Optionally provide a button to view session details again or contact support
                 return;
            }
            // Example: if friend already accepted but not completed waiver
            if (sessionInvite.status === 'accepted_by_friend') {
                const joinSessionUrl = `${process.env.BASE_URL}/join-session.html?token=${inviteToken}&friend_tg_id=${ctx.from.id}`;
                await ctx.reply(
                    `You've already indicated interest in this session. Please complete the waiver to confirm your spot.`,
                    Markup.inlineKeyboard([
                        Markup.button.webApp('Complete Waiver 📝', joinSessionUrl)
                    ])
                );
                return;
            }
            await ctx.reply("This invitation has already been processed or is no longer valid.");
            return;
          }
          
          // Check if the invited friend is the same as the primary booker
          if (sessionInvite.parentSession.user.telegram_id === BigInt(ctx.from.id)) {
            await ctx.reply("This is an invite link for a session you booked. You can manage your invites from the 'Invite Friends' page if available.");
            // Optionally, provide a button to open invite-friends.html for the primary booker
            // const manageInvitesUrl = `${process.env.BASE_URL}/invite-friends.html?sessionId=${sessionInvite.parentSessionId}&telegramId=${ctx.from.id}`;
            // await ctx.reply("Manage your invites:", Markup.inlineKeyboard([
            //   Markup.button.webApp('Manage Invites', manageInvitesUrl)
            // ]));
            return;
          }


          const { parentSession } = sessionInvite;
          const primaryBookerName = parentSession.user.firstName || 'Your friend';
          const sessionTypeLabel = parentSession.sessionType.label;
          const appointmentDateTime = new Date(parentSession.appointment_datetime);
          const formattedDate = appointmentDateTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
          const formattedTime = appointmentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
          
          // Store friend's telegramId with the invite temporarily or upon explicit accept
          // This helps link the Telegram user to this specific invite slot
          // await prisma.sessionInvite.update({
          //    where: { id: sessionInvite.id },
          //    data: { friendTelegramId: BigInt(ctx.from.id) } // Or do this on explicit accept
          // });


          const messageText = `👋 You've been invited by ${primaryBookerName} to a Kambo session!\n\n` +
                              `✨ **Session Type:** ${sessionTypeLabel}\n` +
                              `🗓️ **Date:** ${formattedDate}\n` +
                              `⏰ **Time:** ${formattedTime}\n\n` +
                              `Would you like to join?`;

          const joinSessionUrl = `${process.env.BASE_URL}/join-session.html?token=${inviteToken}&friend_tg_id=${ctx.from.id}`;
          // Note: friend_tg_id is passed to pre-identify the user on join-session.html

          await ctx.reply(messageText, Markup.inlineKeyboard([
            Markup.button.webApp('Accept & View Details ✨', joinSessionUrl),
            Markup.button.callback('Decline Invite 😔', `decline_invite_${inviteToken}`)
          ]));

        } catch (error) {
          logger.error(`Error processing invite token ${inviteToken}: ${error.message}`, { stack: error.stack });
          await ctx.reply("Sorry, there was an error processing your invite. Please try again later or contact support.");
        }
      } else {
        // Standard /start command behavior if no valid payload
        await ctx.reply("Welcome to Kambo Klarity! How can I help you today?");
      }
      ```
*   **CRUD Operations:**
    *   Read: `SessionInvite`, `Session`, `SessionType`, `User`.
    *   Potentially Update: `SessionInvite.status` or `friendTelegramId` (though explicit accept might be better for status update).
*   **UX Flow (Friend's Perspective):**
    1.  Friend clicks `https://t.me/YourBotName?start=invite_{token}` link.
    2.  Telegram opens chat with bot, sending `/start invite_{token}` command.
    3.  Bot parses token.
    4.  Bot validates token and fetches details.
    5.  If valid: Bot sends message with session details, primary booker's name, and "Accept & View Details" / "Decline Invite" buttons.
    6.  If invalid: Bot sends message indicating invite is invalid.
*   **Security:**
    *   `inviteToken` should be unguessable.
    *   Ensure the bot doesn't leak sensitive information if a token is somehow compromised (though tokens are single-use for acceptance).
*   **Testing:**
    *   **Manual/Integration:**
        *   Generate an invite link from `invite-friends.html`.
        *   As a different Telegram user, click the link.
        *   Verify the bot responds with correct session details and buttons.
        *   Test with an invalid/expired token: verify error message.
        *   Test with an already accepted token: verify appropriate message.
        *   Test clicking the link as the primary booker: verify specific message.
    *   **Unit Tests (for `/start` handler logic):**
        *   Mock Prisma calls.
        *   Test payload parsing.
        *   Test token validation logic (valid, invalid, already used).
        *   Test message construction and button creation.
*   **Data Management:** `SessionInvite` status might be updated. User state might be used.
*   **Logging & Error Handling:**
    *   Log token processing attempts, validation results, errors.
    *   User-friendly error messages in chat.

**Data Flow Steps:**
1.  Friend clicks deep link. Telegram sends `/start invite_{token}` to bot.
2.  Bot's `/start` handler extracts `inviteToken`.
3.  Handler queries DB for `SessionInvite` using `inviteToken`.
4.  If found and valid:
    *   Fetches related `Session`, `SessionType`, `User` (primary booker) details.
    *   Constructs message with details.
    *   Constructs WebApp URL for `join-session.html` including the `inviteToken` and `friend_tg_id`.
    *   Sends message to friend with "Accept & View Details" (WebApp button) and "Decline Invite" (callback button).
5.  If not found or invalid: Sends error message to friend.

**Key Edge Cases:**
*   Token already used/accepted: Bot should inform friend appropriately.
*   Token expired (if expiry logic is added later): Bot should inform friend.
*   Primary booker clicks their own invite link: Bot should handle this gracefully (e.g., "This is your own session invite...").
*   `BASE_URL` for WebApp not configured: Button URL will be broken.
*   Friend is not registered with the bot yet: `/start` command will still trigger. The `ctx.from.id` will be available. Friend's `User` record might be created by `userLookup` middleware if they interact further.
---
###  Join Session WebApp: Initial Page Load & Display (`join-session.html`)

**Goal:**
Create the `public/join-session.html` Mini-App page. When an invited friend clicks "Accept & View Details" in the bot (PH6-26), this WebApp opens. It will use the `token` (inviteToken) and `friend_tg_id` from its URL parameters to call a new API (`GET /api/invites/:token/details`) to fetch invite-specific details (session info, primary booker name, current invite status). The page will then display this information and provide a button to proceed to the waiver form (`waiver-form.html`), passing necessary context.

**API Relationships:**
*   **New API Endpoint:** `GET /api/invites/:token/details`
    *   Called by: `public/join-session.js` on page load.
    *   Query parameter: `friend_tg_id` (optional, but useful for pre-association).
*   **Internal Backend Integrations (for the new API):**
    *   Database ([`src/core/prisma.js`](src/core/prisma.js:0)):
        *   Reads `SessionInvite` by `inviteToken` (path parameter `:token`).
        *   Validates `SessionInvite.status` (e.g., must be 'pending' or a similar pre-accepted state).
        *   Reads `parentSession` (including `SessionType` and `User` - the primary booker).
        *   Optionally, if `friend_tg_id` is passed and `SessionInvite.friendTelegramId` is null, it could update `SessionInvite.friendTelegramId` at this point, or simply use it for context.

**Detailed Requirements:**
*   **Requirement A (Parameter Parsing):** JavaScript in `public/join-session.js` must parse `token` (inviteToken) and `friend_tg_id` from the URL query parameters.
*   **Requirement B (API Call for Invite Details):** On page load, call `GET /api/invites/:token/details?friend_tg_id={friend_tg_id}`.
*   **Requirement C (Dynamic Content Display):**
    *   Display a welcome message: "You're invited by [Primary Booker Name]!"
    *   Display session details: Session Type, Date, Time.
    *   Display current status of the invite if relevant (e.g., "Status: Pending your confirmation").
    *   Provide a clear call to action button: "Confirm & Proceed to Waiver".
*   **Requirement D (Styling and UX):**
    *   Page should follow the aesthetic of `public/calendar-app.html` and `public/invite-friends.html` (dark theme, video background, Tailwind CSS).
    *   Clear, concise information. Loading states.
*   **Requirement E (Error Handling):**
    *   If URL parameters are missing: "Invalid invite link."
    *   If API call fails (token invalid, invite not pending, server error): Display appropriate error message. Button to proceed should be disabled.
*   **Requirement F (Proceed to Waiver Button):**
    *   The "Confirm & Proceed to Waiver" button, when clicked, should navigate the friend to `waiver-form.html`.
    *   It must pass parameters: `telegramId` (this friend's `friend_tg_id`), `sessionTypeId` (from parent session), `appointmentDateTimeISO` (from parent session), and importantly, `inviteToken`. The `inviteToken` is crucial for the backend waiver submission (PH6-30) to link this waiver to the `SessionInvite` record.

**Implementation Guide:**

*   **Architecture Overview:**
    *   New frontend Mini-App: `public/join-session.html`.
    *   Associated JavaScript: `public/join-session.js`.
    *   Associated CSS: `public/join-session.css` (or shared/Tailwind).
*   **DB Schema:** N/A directly for frontend. API relies on `SessionInvite`, `Session`, `SessionType`, `User`.
*   **API Design (`GET /api/invites/:token/details`):**
    *   **Request:**
        *   Path parameter: `:token` (the `inviteToken`).
        *   Query parameter: `friend_tg_id` (optional, Telegram ID of the friend viewing the invite).
        *   Example: `GET /api/invites/uuid-invite-token-abc/details?friend_tg_id=112233445`
    *   **Response (Success 200):**
      ```json
      {
        "success": true,
        "data": {
          "inviteStatus": "pending", // Current status of SessionInvite
          "primaryBookerName": "John Doe",
          "sessionDetails": {
            "sessionTypeId": "session-type-uuid-1",
            "typeLabel": "Standard Kambo Session",
            "appointmentDateTimeISO": "2025-07-15T10:00:00.000Z",
            "appointmentTimeFormatted": "Monday, July 15, 2025 at 10:00 AM PDT"
            // Potentially parentSessionId if needed by client, though token is key
          }
        }
      }
      ```
    *   **Response (Error 404 - Invite Not Found / Invalid):**
      ```json
      { "success": false, "message": "Invite not found or is invalid." }
      ```
    *   **Response (Error 403 - Invite Already Processed):** If `SessionInvite.status` is not 'pending' (or similar acceptable state).
      ```json
      { "success": false, "message": "This invite has already been processed." }
      ```
    *   **Response (Error 500):**
      ```json
      { "success": false, "message": "Internal server error." }
      ```
    *   **Auth:** The `inviteToken` itself acts as a form of authorization for viewing these details.
*   **Frontend Structure (`public/join-session.html` and `public/join-session.js`):**
    *   **HTML (`public/join-session.html`):**
        *   Structure for welcome message, primary booker name.
        *   Structure for session details display.
        *   "Confirm & Proceed to Waiver" button (`<button id="proceedToWaiverButton">`).
        *   Loading/error message areas. Video background.
    *   **JavaScript (`public/join-session.js`):**
        *   `onPageLoad`: Parse URL params (`token`, `friend_tg_id`). Call API. Render page or error.
        *   `fetchInviteDetails(token, friend_tg_id)`: Calls `GET /api/invites/:token/details`.
        *   `renderPage(data)`: Populates DOM with invite/session details. Enables proceed button. Stores necessary data (like `sessionTypeId`, `appointmentDateTimeISO`) for waiver redirect.
        *   `handleProceedToWaiverClick()`:
            *   Constructs URL for `waiver-form.html`:
              `waiver-form.html?telegramId=${friend_tg_id}&sessionTypeId=${sessionTypeId}&appointmentDateTimeISO=${appointmentDateTimeISO}&inviteToken=${token}`
            *   `window.location.href` redirect.
*   **CRUD Operations (Backend API):** Read-only. Potentially update `SessionInvite.friendTelegramId` if `friend_tg_id` is provided and not yet set on the invite.
*   **UX Flow:**
    1.  Friend clicks "Accept & View Details" in bot. `join-session.html` opens.
    2.  Page loads, JS calls API with `token` and `friend_tg_id`.
    3.  Loading indicator shown.
    4.  API returns details. Page renders info.
    5.  Friend reviews details, clicks "Confirm & Proceed to Waiver".
    6.  Friend is redirected to `waiver-form.html` with all necessary parameters.
*   **Security:** `inviteToken` is key. Ensure it's handled securely.
*   **Testing:**
    *   **API (`GET /api/invites/:token/details`):** Unit and integration tests for valid token, invalid token, already used token, server errors.
    *   **Frontend (`public/join-session.js`):** Unit tests for URL parsing, API call, page rendering, waiver redirect URL construction.
    *   **E2E:** Full flow from bot clicking "Accept" -> `join-session.html` loads -> displays correct data -> click "Proceed" -> `waiver-form.html` loads with correct parameters.

**Data Flow Steps:**
1.  `join-session.html` loads. JS extracts `token`, `friend_tg_id`.
2.  JS calls `GET /api/invites/:token/details?friend_tg_id=...`.
3.  Backend API validates token, fetches `SessionInvite`, `Session`, `SessionType`, `User` (booker).
4.  API returns JSON data.
5.  JS renders page with details. Stores `sessionTypeId`, `appointmentDateTimeISO` from response.
6.  User clicks "Confirm & Proceed to Waiver".
7.  JS constructs `waiver-form.html` URL with `friend_tg_id`, `sessionTypeId`, `appointmentDateTimeISO`, and `inviteToken`.
8.  JS redirects to `waiver-form.html`.

**Key Edge Cases:**
*   API returns error: Page should display error, disable proceed button.
*   `inviteToken` is for an invite that's no longer 'pending': API should reject, page shows error.
*   Missing URL parameters for `join-session.html`: Page shows error.
---
###  Bot: Handle "Decline Invite" Callback from Friend

**Goal:**
When an invited friend clicks the "Decline Invite 😔" button in the Telegram message sent by the bot (PH6-26), the bot needs to process this callback. This involves updating the `SessionInvite` status to 'declined_by_friend', informing the friend their decline has been noted, and potentially notifying the primary booker that their friend has declined.

**API Relationships:**
*   This feature modifies the bot's callback query handler (likely [`src/handlers/callbackQueryHandler.js`](src/handlers/callbackQueryHandler.js:0)).
*   **Internal Backend Integrations:**
    *   Database ([`src/core/prisma.js`](src/core/prisma.js:0)):
        *   Reads `SessionInvite` by `inviteToken` (extracted from callback data).
        *   Updates `SessionInvite.status` to 'declined_by_friend'.
        *   Updates `SessionInvite.friendTelegramId` with the declining friend's Telegram ID.
    *   Telegram Notifier ([`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0)):
        *   To answer the callback query (acknowledge the button press).
        *   To edit the original message to the friend, confirming their decline.
        *   (Optional) To send a notification to the primary booker.

**Detailed Requirements:**
*   **Requirement A (Callback Parsing):** The callback query handler must recognize and parse callbacks with data like `decline_invite_{token}`.
*   **Requirement B (Token Validation & Invite Update):**
    *   Extract `inviteToken` from callback data.
    *   Fetch the `SessionInvite`. If not found or status is not 'pending' (or similar initial state), handle gracefully (e.g., inform user invite is no longer active).
    *   Update `SessionInvite.status` to 'declined_by_friend'.
    *   Store the `friendTelegramId` (from `ctx.from.id`) on the `SessionInvite` record.
*   **Requirement C (Feedback to Friend):**
    *   Answer the callback query (e.g., `ctx.answerCbQuery("Decline recorded.")`).
    *   Edit the original message sent to the friend (the one with the Accept/Decline buttons) to confirm their decline (e.g., "You have declined the invitation. Thanks for letting us know."). Remove the inline keyboard.
*   **Requirement D (Notify Primary Booker - Optional but Recommended):**
    *   Fetch primary booker's `telegram_id` from `parentSession.user.telegram_id`.
    *   Send a message to the primary booker: "[Friend's First Name / Friend] has declined your Kambo session invite for [Date/Time]."
    *   This helps the primary booker manage their invites and potentially generate a new one if they wish (via `invite-friends.html`).

**Implementation Guide:**

*   **Architecture Overview:**
    *   Modification to the bot's callback query handler in [`src/handlers/callbackQueryHandler.js`](src/handlers/callbackQueryHandler.js:0).
*   **DB Schema:** Relies on `SessionInvite` (especially `status` and `friendTelegramId` fields).
*   **API Design:** N/A (Bot callback handling).
*   **Backend Structure (`callbackQueryHandler.js`):**
    *   **Pseudocode for `decline_invite_` callback:**
      ```javascript
      // In src/handlers/callbackQueryHandler.js
      // async function handleCallbackQuery(ctx) {
      //   const callbackData = ctx.callbackQuery.data;

      if (callbackData && callbackData.startsWith('decline_invite_')) {
        const inviteToken = callbackData.substring('decline_invite_'.length);
        const friendTelegramId = ctx.from.id;
        const friendFirstName = ctx.from.first_name || 'Your friend';

        try {
          await ctx.answerCbQuery("Processing your decline...");

          const sessionInvite = await prisma.sessionInvite.findUnique({
            where: { inviteToken },
            include: { parentSession: { include: { user: true, sessionType: true } } }
          });

          if (!sessionInvite) {
            await ctx.editMessageText("This invitation is no longer valid.", Markup.inlineKeyboard([]));
            return;
          }

          if (sessionInvite.status !== 'pending') { // Or other initial states
            await ctx.editMessageText("This invitation has already been processed. Thank you.", Markup.inlineKeyboard([]));
            return;
          }

          // Update SessionInvite status
          await prisma.sessionInvite.update({
            where: { id: sessionInvite.id },
            data: {
              status: 'declined_by_friend',
              friendTelegramId: BigInt(friendTelegramId) // Store who declined
            }
          });

          await ctx.editMessageText("You have declined the invitation. Thanks for letting us know!", Markup.inlineKeyboard([]));
          logger.info(`Invite ${inviteToken} declined by user ${friendTelegramId}`);

          // Requirement D: Notify Primary Booker (Optional)
          const primaryBooker = sessionInvite.parentSession.user;
          const sessionTime = new Date(sessionInvite.parentSession.appointment_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const sessionDate = new Date(sessionInvite.parentSession.appointment_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          const notificationMessage = `😔 ${friendFirstName} has declined your Kambo session invite for ${sessionInvite.parentSession.sessionType.label} on ${sessionDate} at ${sessionTime}.`;
          
          // Ensure telegramNotifier can send to a specific telegram_id
          await telegramNotifier.sendUserNotification(primaryBooker.telegram_id, notificationMessage);
          logger.info(`Notified primary booker ${primaryBooker.telegram_id} of decline for invite ${inviteToken}`);

        } catch (error) {
          logger.error(`Error processing decline_invite callback for token ${inviteToken}: ${error.message}`, { stack: error.stack });
          try { // Attempt to inform user of error even if initial answerCbQuery failed or other things went wrong
            await ctx.editMessageText("Sorry, there was an error processing your request. Please try again later.", Markup.inlineKeyboard([]));
          } catch (editError) {
            logger.error(`Failed to edit message on error for decline_invite: ${editError.message}`);
          }
        }
        return; // Callback handled
      }
      // ... other callback handlers ...
      // }
      ```
*   **CRUD Operations:**
    *   Read: `SessionInvite` (and related `parentSession`, `user`).
    *   Update: `SessionInvite.status` and `SessionInvite.friendTelegramId`.
*   **UX Flow:**
    1.  Friend clicks "Decline Invite 😔" button in bot message.
    2.  Bot's `callbackQueryHandler` receives `decline_invite_{token}`.
    3.  Bot answers callback query (e.g., spinner on button disappears).
    4.  Bot updates `SessionInvite` status to 'declined_by_friend' and stores `friendTelegramId`.
    5.  Bot edits the original message to the friend, confirming decline and removing buttons.
    6.  (Optional) Bot sends a notification to the primary booker.
*   **Security:** Callback data is generally secure within Telegram. Validate token existence.
*   **Testing:**
    *   **Manual/Integration:**
        *   Use `/start invite_{token}` to get the invite message.
        *   Click "Decline Invite".
        *   Verify message to friend is updated correctly.
        *   Verify `SessionInvite` status in DB is 'declined_by_friend' and `friendTelegramId` is set.
        *   (If implemented) Verify primary booker receives notification.
    *   **Unit Tests (for callback handler logic):**
        *   Mock Prisma and `telegramNotifier`.
        *   Test with valid token: verify DB update calls, message edit calls, primary booker notification call.
        *   Test with invalid/already processed token.
*   **Data Management:** `SessionInvite` record is updated.
*   **Logging & Error Handling:**
    *   Log callback processing, DB updates, notifications sent.
    *   Graceful error handling if DB update or message edit fails.

**Data Flow Steps:**
1.  Friend clicks "Decline Invite" button. Telegram sends callback query to bot.
2.  `callbackQueryHandler` parses `inviteToken` and `friendTelegramId`.
3.  Handler calls `ctx.answerCbQuery()`.
4.  Handler updates `SessionInvite` in DB: `status = 'declined_by_friend'`, `friendTelegramId = friendTelegramId`.
5.  Handler calls `ctx.editMessageText()` to update friend's message.
6.  (Optional) Handler calls `telegramNotifier.sendUserNotification()` to primary booker.

**Key Edge Cases:**
*   User clicks "Decline Invite" multiple times: First click processes. Subsequent clicks should find status is no longer 'pending' and inform user it's already processed.
*   `inviteToken` in callback data is invalid/malformed: Handler should ignore or log error.
*   Primary booker notification fails: Log error, but friend's decline is still processed.
---
###  Waiver Form: Friend-Specific Setup (Receiving `inviteToken`)
*(Adapting from [`Features_Phase_6.md`](Features_Phase_6.md:0))*

**Goal:**
Ensure `public/waiver-form.html` correctly initializes when accessed by an invited friend. This involves parsing the `inviteToken` from the URL, adjusting form behavior (e.g., back button, no slot checks), and including the token in the submission for backend processing (PH6-30).

**API Relationships:**
*   This feature primarily involves client-side modifications to `public/waiver-form.html`.
*   It consumes URL parameters generated by PH6-23 (`/join-session.html`) or PH6-25 (direct link from bot).
*   It prepares data for `POST /api/submit-waiver` (which is enhanced by PH6-30 to handle the `inviteToken`).
*   Relies on `GET /api/user-data?telegramId={friend_telegramId}` (from PH6-16) for pre-filling friend's data.

**Detailed Requirements:**
*   **Requirement A (Parameter Parsing - Friend Context):**
    *   JavaScript in `public/waiver-form.html` (or its associated JS file, e.g., `public/js/waiver-form.js`) must parse the following URL parameters:
        *   `inviteToken`: The unique token identifying the friend's invitation.
        *   `telegramId`: The friend's Telegram ID.
        *   `sessionTypeId`: The ID of the `SessionType`.
        *   `appointmentDateTimeISO`: The ISO string of the appointment date/time.
*   **Requirement B (Conditional Initialization - Friend's Flow):**
    *   This requirement integrates and expands upon **DF-3 (Waiver Form - Conditional Logic for Primary Booker vs. Invited Friend)**, specifically Req B (Friend's Flow).
    *   If `inviteToken` is present in the URL:
        *   **Telegram Back Button:** Configure `window.Telegram.WebApp.BackButton` to be visible and, when clicked, execute `window.Telegram.WebApp.close()`. (Reason: Friend's journey ends here if they go back, unlike primary booker who might go back to calendar).
        *   **No Reservation Warnings:** Do not display any 15-minute reservation countdowns or warnings. (Reason: The slot is already secured by the primary booker).
        *   **No Pre-Submission Slot Check:** Do not perform a `GET /api/slot-check` before form submission. (Reason: Same as above, slot is secured).
        *   **UI Indication (Optional but Recommended):** Display a subtle message indicating the user is filling the form as an invited friend (e.g., "Completing waiver for [Session Type Name] on [Date] as an invited guest.").
*   **Requirement C (Hidden Field for `inviteToken`):**
    *   The parsed `inviteToken` must be populated into a hidden input field within the waiver form (e.g., `<input type="hidden" id="inviteTokenValue" name="inviteToken" value="">`). This ensures the token is submitted with the rest of the waiver data.
*   **Requirement D (User Data Pre-fill - Friend):**
    *   Continue to pre-fill the friend's known data (name, email, etc.) by calling `GET /api/user-data?telegramId={friend_telegramId}` using the `telegramId` parsed from the URL (as per PH6-16 logic).

**Implementation Guide:**

*   **Architecture Overview:** Client-side HTML and JavaScript modifications in `public/waiver-form.html`.
*   **Frontend Structure (`public/waiver-form.html` and `public/js/waiver-form.js`):**
    *   **HTML:**
        *   Ensure the form includes: `<input type="hidden" id="inviteTokenValue" name="inviteToken" value="">`.
        *   (Optional) Add an element for the guest notice: `<p id="guestNotice" class="guest-notice"></p>`.
    *   **JavaScript (`onPageLoad` / `DOMContentLoaded`):**
      ```javascript
      // Pseudocode for public/js/waiver-form.js
      document.addEventListener('DOMContentLoaded', async () => {
          const urlParams = new URLSearchParams(window.location.search);
          const inviteToken = urlParams.get('inviteToken');
          const friendTelegramId = urlParams.get('telegramId'); // Friend's ID
          const sessionTypeId = urlParams.get('sessionTypeId');
          const appointmentDateTimeISO = urlParams.get('appointmentDateTimeISO');

          // Populate standard hidden fields (telegramId here is friend's)
          document.getElementById('telegramId').value = friendTelegramId;
          document.getElementById('appointmentDateTimeValue').value = appointmentDateTimeISO;
          document.getElementById('sessionTypeValue').value = sessionTypeId;

          if (inviteToken) {
              console.log("Waiver initiated by invited friend with token:", inviteToken);
              document.getElementById('inviteTokenValue').value = inviteToken;

              // Req B: Conditional Initialization
              Telegram.WebApp.BackButton.show();
              Telegram.WebApp.BackButton.onClick(() => Telegram.WebApp.close());
              
              // Hide/disable reservation timer/warnings if they exist
              // const reservationTimerElement = document.getElementById('reservationTimer');
              // if (reservationTimerElement) reservationTimerElement.style.display = 'none';

              // Optional UI Notice
              // const guestNoticeElement = document.getElementById('guestNotice');
              // if (guestNoticeElement) guestNoticeElement.textContent = "You are completing this waiver as an invited guest.";
              
              // Skip pre-submission slot check logic for friends
              // This means the part of the submit handler that calls /api/slot-check
              // needs to be conditional or bypassed.
          } else {
              // Primary booker flow (existing logic from PH6-16, DF-2, etc.)
              // E.g., setup back button to go to calendar, start reservation timer.
              Telegram.WebApp.BackButton.show();
              Telegram.WebApp.BackButton.onClick(() => {
                  // Redirect to calendar, potentially with pre-selected date/time
                  // window.location.href = `/calendar.html?sessionTypeId=${sessionTypeId}&selectedDateTime=${appointmentDateTimeISO}`;
                  // For simplicity now, or if context is lost, just go to calendar
                  window.location.href = `/calendar.html?sessionTypeId=${sessionTypeId}`;
              });
              // ... existing primary booker timer logic ...
          }

          // Req D: User Data Pre-fill (applies to both primary and friend)
          if (friendTelegramId) { // or primary booker's telegramId if not inviteToken flow
              try {
                  // const userData = await fetch(`/api/user-data?telegramId=${friendTelegramId}`).then(res => res.json());
                  // if (userData.success) { /* pre-fill form fields */ }
              } catch (error) { console.error("Error fetching user data:", error); }
          }
          
          // ... rest of existing onPageLoad logic (fetching session type details for display) ...
      });

      // Modify form submission handler to skip slot check if inviteToken is present
      // waiverForm.addEventListener('submit', async (event) => {
      //    event.preventDefault();
      //    const inviteToken = document.getElementById('inviteTokenValue').value;
      //    if (!inviteToken) {
      //        // Perform pre-submission slot check for primary booker (DF-2)
      //    }
      //    // ... rest of submission logic ...
      // });
      ```
*   **Testing:**
    *   Navigate to `public/waiver-form.html` with `inviteToken` and other required params:
        *   Verify hidden `inviteTokenValue` field is populated.
        *   Verify Telegram Back Button closes the app.
        *   Verify no reservation timer/warnings appear.
        *   Verify user data pre-fill still works for the friend.
    *   Navigate without `inviteToken` (primary booker flow):
        *   Verify existing behavior (back button to calendar, timer active).

**Key Edge Cases:**
*   **`inviteToken` missing from URL:** Form should operate in "primary booker" mode (e.g., back button to calendar, reservation timer active if applicable based on DF-2/DF-3). Hidden `inviteTokenValue` field remains empty. This is the expected flow for a primary booker.
*   **`inviteToken` present, but other required URL parameters missing** (e.g., `telegramId` of friend, `sessionTypeId`, `appointmentDateTimeISO`): The form should display an appropriate error message (e.g., "Invalid link. Please use the link provided in your invitation.") and not proceed with normal operation. Critical parameters must be validated at the start of the script.
*   **`inviteToken` present but invalid (e.g., malformed, non-existent, or already used/expired):** The frontend (`public/waiver-form.html`) does not typically validate the token's status itself. It populates the hidden field and includes it in the submission. Validation of the token's validity and status is the responsibility of the backend API (`POST /api/submit-waiver`, as per PH6-30). The backend should return a clear error if the token is invalid.
*   **JavaScript disabled or errors during script execution:** Core functionality (like populating hidden fields, setting up conditional back button behavior, or skipping slot checks) might fail. The form should ideally prevent submission or show a clear error if critical JS fails.

---
---
###  API & Waiver Submit: Handle Friend's Waiver (Update `SessionInvite`, GCal Desc/Title)

**Goal:**
Modify the `POST /api/submit-waiver` endpoint to comprehensively handle waiver submissions from invited friends. If an `inviteToken` is present, the API must validate it, update the `SessionInvite` record, store friend's waiver data, update the primary booker's Google Calendar event (description and title), and notify relevant parties.

**API Relationships:**
*   Modifies existing endpoint: `POST /api/submit-waiver`.
*   Consumes `inviteToken` from the request body.
*   Utilizes [`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0) for GCal event fetching and updates.
*   Utilizes [`src/core/prisma.js`](src/core/prisma.js:0) for DB operations on `SessionInvite`, `Session`, `User`.
*   Utilizes [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) for notifications.

**Detailed Requirements:**
*   **Requirement A (Conditional Logic based on `inviteToken`):** The `POST /api/submit-waiver` handler must prioritize the "friend's waiver path" if `inviteToken` is present in the request body.
*   **Requirement B (Friend's Waiver Path - If `inviteToken` present):**
    1.  **Validate `inviteToken`:** Fetch `SessionInvite` by token, including `parentSession` (with its `user` (primary booker), `sessionType`, and `googleEventId`). If not found, or status is not 'pending' or 'accepted_by_friend' (or other valid pre-waiver states), return an appropriate error.
    2.  **Update `SessionInvite` Record:**
        *   Set `status` to 'waiver_completed_by_friend'.
        *   Set `friendTelegramId` to the `telegramId` from the form submission (this is the friend's ID).
        *   Set `friendNameOnWaiver` to `firstName + " " + lastName` from the form data.
        *   Store the friend's full `liability_form_data` (JSON blob from the waiver) on the `SessionInvite` record (e.g., in a new `friendLiabilityFormData` JSON field).
    3.  **Google Calendar Event Update - Description (PH6-30 aspect from [`Features_Phase_6.md`](Features_Phase_6.md:332)):**
        *   If `parentSession.googleEventId` exists:
            *   Fetch the GCal event.
            *   Append the `friendNameOnWaiver` to the event's description, managing a "Guests:" list intelligently (avoid duplicates).
            *   Call [`googleCalendarTool.updateCalendarEventDescription`](src/tools/googleCalendar.js:0) (or similar). Log errors but do not fail the overall process.
    4.  **Google Calendar Event Update - Title (PH6-30.5 aspect from [`Features_Phase_6.md`](Features_Phase_6.md:350)):**
        *   If `parentSession.googleEventId` exists:
            *   Count `SessionInvite` records for the `parentSessionId` with `status: 'waiver_completed_by_friend'`.
            *   If this count is 1 (i.e., this is the *first* friend to complete waiver):
                *   Fetch the GCal event (if not already fetched).
                *   If its title does not already indicate a group session (e.g., not starting with "GROUP - "), construct a new title like "GROUP - {Primary Booker Name} & Friend(s) - {SessionType Label}" and update using [`googleCalendarTool.updateCalendarEventSummary`](src/tools/googleCalendar.js:0). Log errors but do not fail.
    5.  **Notify Primary Booker (PH6-33):** Inform the primary booker: "🎉 Good news! [Friend's Name] has completed their waiver and will be joining your [Session Type Label] session on [Date] at [Time]."
    6.  **Notify Admin (PH6-34):** Inform admin: "➕ INVITED GUEST CONFIRMED: [Friend's Name] (TGID: [Friend's TGID]) has completed waiver for [Primary Booker's Name]'s session on [Date] at [Time] (Invite Token: [Token])."
    7.  **Send Confirmation to Friend (PH6-31):** Send a Telegram message to the friend: "✅ Your spot for the Kambo session with [Primary Booker Name] on [Date] at [Time] is confirmed!"
    8.  **API Response:** Return `{ success: true, message: "Waiver submitted successfully! Your spot is confirmed." }` to the friend's waiver form.
*   **Requirement C (Primary Booker's Waiver Path - If `inviteToken` NOT present):**
    *   The existing logic (PH6-17, potentially modified by DF-4 for placeholders) applies.
*   **Requirement D (No New Session/GCal for Friend):** Ensure no new `Session` record or separate GCal event is created for the friend.

**Implementation Guide:**

*   **Architecture Overview:** Major refactoring of the `POST /api/submit-waiver` handler in [`src/handlers/api/waiverApiHandler.js`](src/handlers/api/waiverApiHandler.js:0) (or equivalent).
*   **DB Schema:**
    *   `SessionInvite` model needs `friendLiabilityFormData` (Json, nullable). A migration will be required.
      ```prisma
      model SessionInvite {
        // ... existing fields ...
        friendLiabilityFormData Json?
      }
      ```
*   **API Design (`POST /api/submit-waiver`):**
    *   The handler will have a primary conditional branch based on the presence of `inviteToken`.
*   **Backend Structure (Modified `handleSubmitWaiver`):**
    *   The pseudocode for the "Friend's Waiver Path" needs to be expanded to include the GCal description and title update logic, and storage of `friendLiabilityFormData`.
    ```javascript
    // Inside handleSubmitWaiver, within the 'if (inviteToken)' block:
    // ... (validate token, fetch sessionInvite with parentSession.user, parentSession.sessionType, parentSession.googleEventId) ...

    const updatedInvite = await prisma.sessionInvite.update({
      where: { id: sessionInvite.id },
      data: {
        status: 'waiver_completed_by_friend',
        friendTelegramId: BigInt(telegramId), // friend's telegramId from form
        friendNameOnWaiver: `${firstName} ${lastName}`, // friend's name from form
        friendLiabilityFormData: liability_form_data // friend's full waiver data
      },
      include: { parentSession: { include: { user: true, sessionType: true } } } // Re-include for fresh data
    });
    logger.info(`SessionInvite ${updatedInvite.id} status updated, friend details and waiver stored.`);

    // GCal Description Update (PH6-30)
    const googleEventId = updatedInvite.parentSession.googleEventId;
    const friendNameForGCal = updatedInvite.friendNameOnWaiver;
    if (googleEventId && friendNameForGCal) {
      try {
        const event = await googleCalendarTool.getCalendarEvent(googleEventId);
        if (event) {
          let description = event.description || "";
          const guestMarker = "Guests:\n";
          let newGuestEntry = `- ${friendNameForGCal}`;
          if (!description.includes(newGuestEntry)) { // Avoid duplicate entries
            if (description.includes(guestMarker)) {
              description += `\n${newGuestEntry}`;
            } else {
              description += (description ? "\n\n" : "") + guestMarker + newGuestEntry;
            }
            await googleCalendarTool.updateCalendarEventDescription(googleEventId, description);
            logger.info(`Updated GCal event ${googleEventId} description for friend: ${friendNameForGCal}`);
          }
        } else {
          logger.warn(`GCal event ${googleEventId} not found for description update.`);
        }
      } catch (gcalError) {
        logger.error(`Failed to update GCal event ${googleEventId} description: ${gcalError.message}`);
      }
    }

    // GCal Title Update (PH6-30.5)
    if (googleEventId) {
      try {
        const confirmedFriendsCount = await prisma.sessionInvite.count({
          where: { parentSessionId: updatedInvite.parentSessionId, status: 'waiver_completed_by_friend' }
        });
        if (confirmedFriendsCount === 1) { // This is the first friend
          const event = await googleCalendarTool.getCalendarEvent(googleEventId); // Fetch fresh event data
          if (event && event.summary && !event.summary.toUpperCase().startsWith("GROUP - ")) {
            const primaryBookerName = updatedInvite.parentSession.user.firstName || "Client";
            const sessionLabel = updatedInvite.parentSession.sessionType.label;
            const newTitle = `GROUP - ${primaryBookerName} & Friend(s) - ${sessionLabel}`;
            await googleCalendarTool.updateCalendarEventSummary(googleEventId, newTitle);
            logger.info(`Updated GCal event ${googleEventId} title to: ${newTitle}`);
          }
        }
      } catch (gcalError) {
        logger.error(`Failed to update GCal event ${googleEventId} title: ${gcalError.message}`);
      }
    }
    
    // ... (Notify Primary Booker - PH6-33) ...
    // ... (Notify Admin - PH6-34) ...
    // ... (Send Confirmation to Friend - PH6-31) ...
    // ... (Return success response to friend's waiver form) ...
    ```
*   **Testing:**
    *   **Backend:** Test the friend's waiver path extensively:
        *   Verify `SessionInvite` fields are updated correctly (status, names, `friendLiabilityFormData`).
        *   Verify GCal description appends names correctly and handles multiple friends.
        *   Verify GCal title updates only for the first confirmed friend and not for subsequent ones.
        *   Verify all notifications are triggered.
    *   **E2E:** Full friend invite flow: invite -> friend accepts -> fills waiver -> verify all DB updates, GCal changes (description, title), and all Telegram notifications.

**Data Flow Steps (Friend's Path Focus):**
1.  Friend's waiver form POSTs to `/api/submit-waiver` with `inviteToken` and waiver data.
2.  API handler validates `inviteToken`, fetches `SessionInvite` and `parentSession`.
3.  API updates `SessionInvite` (status, names, `friendLiabilityFormData`).
4.  API updates GCal event description with friend's name.
5.  API checks if this is the first friend; if so, updates GCal event title.
6.  API sends notifications to Primary Booker, Admin, and the Friend.
7.  API returns success to friend's waiver form.

**Key Edge Cases:**
*   `inviteToken` submitted is invalid, expired, or already used (e.g., 'waiver_completed_by_friend', 'declined_by_friend'): API returns error to waiver form.
*   Friend submits waiver for an invite they previously declined: Logic should prevent this if status check is robust ('declined_by_friend' should not be a valid pre-waiver state for submission).
*   Primary booker's GCal event (`parentSession.googleEventId`) is missing or deleted: Log warning, skip GCal updates, but proceed with other friend confirmation steps.
*   GCal API errors during description or title update: Log error, but proceed with other friend confirmation steps (these are non-critical enhancements).
*   Notifications (to primary booker, admin, or friend) fail: Log error, but the core friend booking/waiver completion is still considered successful.
*   Data integrity: Ensure `friendTelegramId` from form is correctly stored. If `friendNameOnWaiver` is missing from form, handle gracefully for GCal updates/notifications.
*   Concurrent waiver submissions by multiple friends for the same session: The GCal title update (for "GROUP -") should correctly identify the *first* confirmed friend based on the count at the time of processing. Description updates should append names as they come in.
---
### Bot: Friend's Confirmation Message (After Waiver)

**Goal:**
After an invited friend successfully submits their waiver (processed by PH6-30), the bot should send a confirmation message directly to that friend in their Telegram chat. This message confirms their spot in the session.

**API Relationships:**
*   This is a side effect of the friend's waiver submission path in `POST /api/submit-waiver` (PH6-30).
*   It uses [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) to send a message to the friend.

**Detailed Requirements:**
*   **Requirement A (Trigger):** This message is sent after the friend's `SessionInvite` status is successfully updated to 'waiver_completed_by_friend' in PH6-30.
*   **Requirement B (Recipient):** The message is sent to the invited friend (identified by `friendTelegramId` on the `SessionInvite` record, which was populated from the `telegramId` in their waiver submission).
*   **Requirement C (Message Content):**
    *   Clear confirmation: "✅ Your spot for the Kambo session with [Primary Booker Name] on [Date] at [Time] is confirmed!"
    *   Reiterate session details: Type, Date, Time.
    *   Mention primary booker: "You're joining [Primary Booker Name]'s group."
    *   Include a positive closing: "We look forward to seeing you!"
    *   No buttons needed on this message for MVP.
*   **Requirement D (No `edit_msg_id`):** This is a new message sent to the friend, not an edit of a previous one (unless a specific message ID was stored for the friend's interaction, which is not assumed here).

**Implementation Guide:**

*   **Architecture Overview:**
    *   Logic within the `POST /api/submit-waiver` handler (friend's path) in [`src/handlers/api/waiverApiHandler.js`](src/handlers/api/waiverApiHandler.js:0) or similar.
    *   Calls a function in [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0), e.g., `sendUserNotification(friendTelegramId, messageText)`.
*   **DB Schema:** Relies on `SessionInvite` (for `friendTelegramId`) and its relations to `Session` (for `appointment_datetime`, `sessionType.label`, `user.firstName` of primary booker).
*   **API Design:** N/A (Side effect of existing API).
*   **Backend Structure (Conceptual addition to PH6-30 logic):**
    *   **Pseudocode Snippet (within friend's waiver success block in `handleSubmitWaiver`):**
      ```javascript
      // Inside handleSubmitWaiver, after SessionInvite is updated for friend (PH6-30)
      // const updatedInvite = await prisma.sessionInvite.update({ ... });
      // const friendTelegramId = updatedInvite.friendTelegramId;
      // const primaryBookerName = sessionInvite.parentSession.user.firstName || "your friend";
      // const sessionTypeLabel = sessionInvite.parentSession.sessionType.label;
      // const appointmentDateTime = new Date(sessionInvite.parentSession.appointment_datetime);
      // const formattedDate = appointmentDateTime.toLocaleDateString(...);
      // const formattedTime = appointmentDateTime.toLocaleTimeString(...);

      if (friendTelegramId) {
        const friendConfirmationMessage = `✅ Your spot for the ${sessionTypeLabel} session with ${primaryBookerName} on ${formattedDate} at ${formattedTime} is confirmed!\n\n` +
                                          `You're joining ${primaryBookerName}'s group. We look forward to seeing you!`;
        try {
          await telegramNotifier.sendUserNotification(friendTelegramId, friendConfirmationMessage);
          logger.info(`Confirmation message sent to invited friend ${friendTelegramId} for invite ${inviteToken}`);
        } catch (notifyError) {
          logger.error(`Failed to send confirmation message to friend ${friendTelegramId}: ${notifyError.message}`);
          // Non-critical for booking itself, but impacts friend's direct confirmation.
        }
      } else {
        logger.warn(`No friendTelegramId found on SessionInvite ${updatedInvite.id} after waiver submission. Cannot send confirmation to friend.`);
      }
      ```
*   **CRUD Operations:** N/A for this specific notification feature (reads data fetched by PH6-30).
*   **UX Flow:**
    1.  Friend submits waiver.
    2.  Backend (PH6-30) successfully processes it, updates `SessionInvite`.
    3.  Backend triggers a new Telegram message to the friend.
    4.  Friend receives a direct confirmation message from the bot in their chat.
*   **Security:** N/A.
*   **Testing:**
    *   **Backend:**
        *   Unit test the logic that constructs the friend's confirmation message.
        *   Verify `telegramNotifier.sendUserNotification` is called with correct `friendTelegramId` and message content when a friend's waiver is processed.
    *   **E2E:** After a friend successfully submits a waiver, verify they receive the correct confirmation message in their Telegram chat.
*   **Data Management:** N/A.
*   **Logging & Error Handling:**
    *   Log message sending attempt to friend.
    *   Log success or failure of the notification.
    *   If `friendTelegramId` is somehow missing (shouldn't happen if waiver submission includes it and PH6-30 stores it), log a warning.

**Data Flow Steps:**
1.  Inside `POST /api/submit-waiver` (friend's path), after `SessionInvite` is successfully updated.
2.  Retrieve `friendTelegramId`, primary booker's name, and session details from the `sessionInvite` object and its relations.
3.  Construct the confirmation message string.
4.  Call `telegramNotifier.sendUserNotification(friendTelegramId, message)` to send the message.

**Key Edge Cases:**
*   `friendTelegramId` is missing on `SessionInvite` (data integrity issue from earlier steps): Message cannot be sent. Log warning.
*   Telegram API error when sending message to friend: Log error. Friend's booking is still valid.
*   Friend has blocked the bot: Message sending will fail silently or with an error from Telegram API.
---
###  Invite Friends WebApp: Update UI for Friend's Status Change

**Goal:**
The `public/invite-friends.html` page, viewed by the primary booker, should reflect updates to the status of sent invites (e.g., when a friend accepts by completing their waiver or declines). For MVP, this can be achieved by re-fetching invite data when the page gains focus or via a manual refresh button.

**API Relationships:**
*   Relies on `GET /api/sessions/:sessionId/invite-context` (PH6-20) to get the latest status of all invites for the session.

**Detailed Requirements:**
*   **Requirement A (Data Re-fetch):** Implement a mechanism in `public/invite-friends.js` to re-fetch data from `GET /api/sessions/:sessionId/invite-context`.
    *   Option 1 (Page Focus): Trigger re-fetch when the browser tab/window containing `invite-friends.html` regains focus (using `visibilitychange` or `focus` events).
    *   Option 2 (Manual Refresh): Add a "Refresh Status" button that, when clicked, triggers the re-fetch.
    *   Option 3 (Timed Polling - Use with caution): Periodically re-fetch data (e.g., every 30-60 seconds). This is generally less efficient.
    *   For MVP, Option 1 (page focus) combined with Option 2 (manual refresh button) offers a good balance.
*   **Requirement B (UI Update):** After re-fetching data, the list of existing invites (`#existingInvitesList`) must be re-rendered to display the latest statuses (e.g., 'pending', 'declined_by_friend', 'waiver_completed_by_friend') and any new friend names.
    *   The display for an invite should clearly change, for example:
        *   "Pending" -> "Waiver Completed by [Friend's Name]"
        *   "Pending" -> "Declined" (or "Declined by [Friend's Name]" if name is captured before decline, though less likely)
    *   The "Copy Link" and "Share on Telegram" buttons might be less relevant or disabled for invites that are no longer 'pending'.
*   **Requirement C (No Change to Max Invites/Generation):** This feature focuses on updating the status display of *existing* invites. The logic for `max_invites` and generating new invites remains as per PH6-21 and PH6-23.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Client-side JavaScript logic in `public/invite-friends.js`.
    *   DOM manipulation on `public/invite-friends.html`.
*   **DB Schema:** N/A (Consumes data reflecting DB state).
*   **API Design:** Uses existing `GET /api/sessions/:sessionId/invite-context` (PH6-20).
*   **Frontend Structure (`public/invite-friends.js`):**
    *   **HTML Changes (`public/invite-friends.html`):**
        *   (Optional) Add a "Refresh Status" button: `<button id="refreshInviteStatusButton">Refresh Status</button>`.
    *   **JavaScript Changes (`public/invite-friends.js`):**
        *   Modify `onPageLoad` or create a new function `loadAndRenderInvites()` that encapsulates fetching (PH6-21's `fetchInviteContext`) and rendering (`renderInvitePage`).
        *   **Event Listener for Page Focus:**
          ```javascript
          // document.addEventListener('visibilitychange', () => {
          //   if (document.visibilityState === 'visible') {
          //     loadAndRenderInvites(); // Assumes this function exists and handles fetching & rendering
          //   }
          // });
          // window.addEventListener('focus', () => {
          //    loadAndRenderInvites();
          // });
          ```
        *   **Event Listener for Manual Refresh Button:**
          ```javascript
          // const refreshButton = document.getElementById('refreshInviteStatusButton');
          // if (refreshButton) {
          //   refreshButton.addEventListener('click', () => {
          //     // Show loading indicator
          //     loadAndRenderInvites().finally(() => { /* hide loading indicator */ });
          //   });
          // }
          ```
        *   The `renderInvitePage(apiResponseData)` function (from PH6-21) will be reused. It should already be capable of clearing the existing list and re-populating it based on the new data, ensuring statuses and names are updated.
        *   The rendering logic for each invite item should clearly display the `status` and `friendNameOnWaiver` if available.
          ```javascript
          // Inside renderInvitePage, when creating list items for existingInvites:
          // let statusText = invite.status;
          // if (invite.status === 'waiver_completed_by_friend' && invite.friendName) {
          //   statusText = `Accepted by ${invite.friendName}`;
          // } else if (invite.status === 'declined_by_friend') {
          //   statusText = 'Declined';
          // } // etc.
          // listItem.innerHTML = `... <span>Status: ${statusText}</span> ...`;
          ```
*   **CRUD Operations:** N/A (Client-side UI update based on re-fetched API data).
*   **UX Flow:**
    1.  Primary booker is on `invite-friends.html`.
    2.  A friend accepts/declines an invite. `SessionInvite.status` changes in DB.
    3.  Primary booker's `invite-friends.html` tab regains focus, or they click "Refresh Status".
    4.  JS re-fetches data from `GET /api/sessions/:sessionId/invite-context`.
    5.  JS re-renders the list of invites, showing the updated status for the relevant invite.
*   **Security:** N/A for this client-side update logic. Relies on API security.
*   **Testing:**
    *   **Manual:**
        *   Open `invite-friends.html`.
        *   In a separate process/browser, have a friend accept or decline an invite (triggering DB change).
        *   Switch focus back to `invite-friends.html` or click "Refresh". Verify the status updates.
    *   **Unit Tests (`public/invite-friends.js`):**
        *   Test the re-fetch trigger logic (focus/refresh button).
        *   Test that `renderInvitePage` correctly displays different statuses and friend names based on mock API data.
*   **Data Management:** Data is re-fetched. No complex client-side state management for statuses beyond re-rendering.
*   **Logging & Error Handling:**
    *   Client-side JS: Log re-fetch attempts, success/failure.
    *   If re-fetch fails, display a non-intrusive error or rely on existing error display from initial load.

**Data Flow Steps (UI Update):**
1.  Re-fetch trigger occurs (page focus, manual refresh).
2.  JS calls `GET /api/sessions/:sessionId/invite-context`.
3.  API returns latest invite data.
4.  JS clears the current list of displayed invites (or updates items in place if doing more complex rendering).
5.  JS iterates through new invite data and re-renders each invite item with its current status and details.

**Key Edge Cases:**
*   Rapid status changes: If multiple changes occur between refreshes, only the latest status will be shown. This is acceptable for MVP.
*   API error during re-fetch: The page might show stale data or an error message. Should handle gracefully.
*   Network connectivity issues during re-fetch.
---
###  Bot: Notify Primary Booker of Friend's Waiver Completion

**Goal:**
After an invited friend successfully submits their waiver and their `SessionInvite` status is updated (as part of PH6-30), the bot should send a notification message to the primary booker, informing them that their friend has completed the process and will be joining the session.

**API Relationships:**
*   This is a side effect of the friend's waiver submission path in `POST /api/submit-waiver` (PH6-30).
*   It uses [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) to send a message to the primary booker.

**Detailed Requirements:**
*   **Requirement A (Trigger):** This notification is sent after the friend's `SessionInvite.status` is successfully updated to 'waiver_completed_by_friend' within the PH6-30 API handler.
*   **Requirement B (Recipient):** The message is sent to the primary booker (identified by `parentSession.user.telegram_id` associated with the `SessionInvite`).
*   **Requirement C (Message Content):**
    *   Clear notification: "🎉 Good news! [Friend's Name on Waiver] has completed their waiver and will be joining your [Session Type Label] session on [Date] at [Time]."
    *   Include friend's name (captured from their waiver submission and stored in `SessionInvite.friendNameOnWaiver`).
    *   Reiterate key session details for context.
    *   No buttons needed on this message for MVP.
*   **Requirement D (Context):** This notification helps the primary booker keep track of who among their invitees has successfully confirmed.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Logic within the `POST /api/submit-waiver` handler (friend's path) in [`src/handlers/api/waiverApiHandler.js`](src/handlers/api/waiverApiHandler.js:0) or similar.
    *   Calls a function in [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0), e.g., `sendUserNotification(primaryBookerTelegramId, messageText)`.
*   **DB Schema:** Relies on `SessionInvite` (for `friendNameOnWaiver`) and its relations to `Session` (for `appointment_datetime`, `sessionType.label`, and `user.telegram_id` of primary booker).
*   **API Design:** N/A (Side effect of existing API PH6-30).
*   **Backend Structure (Conceptual addition to PH6-30 logic, as already outlined in its pseudocode):**
    *   **Pseudocode Snippet (within friend's waiver success block in `handleSubmitWaiver` from PH6-30):**
      ```javascript
      // This logic is part of the PH6-30 (handleSubmitWaiver for friend) success path:
      // const updatedInvite = await prisma.sessionInvite.update({ ... }); // friend's invite
      // const primaryBooker = sessionInvite.parentSession.user;
      // const friendName = updatedInvite.friendNameOnWaiver || "Your friend";
      // const sessionTypeLabel = sessionInvite.parentSession.sessionType.label;
      // const appointmentDateTime = new Date(sessionInvite.parentSession.appointment_datetime);
      // const formattedDate = appointmentDateTime.toLocaleDateString(...);
      // const formattedTime = appointmentDateTime.toLocaleTimeString(...);

      const bookerNotificationMessage = `🎉 Good news! ${friendName} has completed their waiver and will be joining your ${sessionTypeLabel} session on ${formattedDate} at ${formattedTime}.`;
      try {
        await telegramNotifier.sendUserNotification(primaryBooker.telegram_id, bookerNotificationMessage);
        logger.info(`Notified primary booker ${primaryBooker.telegram_id} about friend ${friendName}'s waiver completion for invite ${inviteToken}`);
      } catch (notifyError) {
        logger.error(`Failed to send waiver completion notification to primary booker ${primaryBooker.telegram_id}: ${notifyError.message}`);
      }
      ```
*   **CRUD Operations:** N/A for this specific notification feature (reads data fetched by PH6-30).
*   **UX Flow:**
    1.  Friend submits waiver.
    2.  Backend (PH6-30) successfully processes it, updates `SessionInvite`.
    3.  Backend triggers a new Telegram message to the primary booker.
    4.  Primary booker receives a message informing them their friend has completed the waiver.
*   **Security:** N/A.
*   **Testing:**
    *   **Backend:**
        *   Unit test the logic that constructs the primary booker's notification message.
        *   Verify `telegramNotifier.sendUserNotification` is called with correct primary booker `telegram_id` and message content when a friend's waiver is processed.
    *   **E2E:** After a friend successfully submits a waiver, verify the primary booker receives the correct notification message in their Telegram chat.
*   **Data Management:** N/A.
*   **Logging & Error Handling:**
    *   Log message sending attempt to primary booker.
    *   Log success or failure of the notification.
    *   If primary booker's `telegram_id` is somehow missing (data integrity issue), log a warning.

**Data Flow Steps:**
1.  Inside `POST /api/submit-waiver` (friend's path), after `SessionInvite` is successfully updated.
2.  Retrieve primary booker's `telegram_id`, friend's name from waiver, and session details from the `sessionInvite` object and its relations.
3.  Construct the notification message string for the primary booker.
4.  Call `telegramNotifier.sendUserNotification(primaryBookerTelegramId, message)` to send the message.

**Key Edge Cases:**
*   Primary booker's `telegram_id` is missing (data integrity issue): Message cannot be sent. Log warning.
*   Telegram API error when sending message to primary booker: Log error. Friend's booking and primary booker's session are still valid.
*   Primary booker has blocked the bot: Message sending will fail silently or with an error from Telegram API.
---
###  Admin Notification: Friend Joins Session

**Goal:**
After an invited friend successfully submits their waiver and their `SessionInvite` status is updated (as part of PH6-30), the system should send a notification message to the Kambo Klarity admin(s), informing them that an invited guest has confirmed their attendance for a session.

**API Relationships:**
*   This is a side effect of the friend's waiver submission path in `POST /api/submit-waiver` (PH6-30).
*   It uses [`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0) (specifically `sendAdminNotification`) to send a message to the designated admin(s).

**Detailed Requirements:**
*   **Requirement A (Trigger):** This notification is sent after the friend's `SessionInvite.status` is successfully updated to 'waiver_completed_by_friend' within the PH6-30 API handler.
*   **Requirement B (Recipient):** The message is sent to the admin(s) configured in the system (as per existing admin notification mechanisms).
*   **Requirement C (Message Content):**
    *   Clear notification: "➕ INVITED GUEST CONFIRMED: [Friend's Name on Waiver] (TGID: [Friend's Telegram ID]) has completed their waiver and will join [Primary Booker's First Name] [Primary Booker's Last Name]'s session."
    *   Include key details for context:
        *   Friend's name and Telegram ID.
        *   Primary booker's name.
        *   Session details: Session Type, Date, Time.
        *   Reference to the invite: `(Invite Token: [inviteToken])`.
*   **Requirement D (Consistency):** The format should be consistent with other admin notifications.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Logic within the `POST /api/submit-waiver` handler (friend's path) in [`src/handlers/api/waiverApiHandler.js`](src/handlers/api/waiverApiHandler.js:0) or similar.
    *   Calls `telegramNotifier.sendAdminNotification(messageText)`.
*   **DB Schema:** Relies on `SessionInvite` (for `friendNameOnWaiver`, `friendTelegramId`, `inviteToken`) and its relations to `Session` (for `appointment_datetime`, `sessionType.label`, and `user` details of primary booker).
*   **API Design:** N/A (Side effect of existing API PH6-30).
*   **Backend Structure (Conceptual addition to PH6-30 logic, as already outlined in its pseudocode):**
    *   **Pseudocode Snippet (within friend's waiver success block in `handleSubmitWaiver` from PH6-30):**
      ```javascript
      // This logic is part of the PH6-30 (handleSubmitWaiver for friend) success path:
      // const updatedInvite = await prisma.sessionInvite.update({ ... }); // friend's invite
      // const primaryBooker = sessionInvite.parentSession.user;
      // const friendName = updatedInvite.friendNameOnWaiver || "A friend";
      // const friendTelegramId = updatedInvite.friendTelegramId;
      // const sessionTypeLabel = sessionInvite.parentSession.sessionType.label;
      // const appointmentDateTime = new Date(sessionInvite.parentSession.appointment_datetime);
      // const formattedDate = appointmentDateTime.toLocaleDateString(...);
      // const formattedTime = appointmentDateTime.toLocaleTimeString(...);
      // const inviteToken = updatedInvite.inviteToken;

      const adminNotificationMessage = `➕ INVITED GUEST CONFIRMED: ${friendName} (TGID: ${friendTelegramId || 'N/A'}) has completed their waiver and will join ${primaryBooker.firstName || ''} ${primaryBooker.lastName || ''}'s session.\n\n` +
                                     `Session: ${sessionTypeLabel} on ${formattedDate} at ${formattedTime}.\n` +
                                     `Primary Booker TGID: ${primaryBooker.telegram_id}.\n` +
                                     `Invite Token: ${inviteToken}.`;
      try {
        await telegramNotifier.sendAdminNotification(adminNotificationMessage);
        logger.info(`Admin notification sent for friend ${friendName}'s waiver completion (Invite: ${inviteToken})`);
      } catch (notifyError) {
        logger.error(`Failed to send admin notification for friend's waiver (Invite: ${inviteToken}): ${notifyError.message}`);
      }
      ```
*   **CRUD Operations:** N/A for this specific notification feature (reads data fetched by PH6-30).
*   **UX Flow (Admin's Perspective):**
    1.  Friend submits waiver.
    2.  Backend (PH6-30) successfully processes it.
    3.  Backend triggers a Telegram message to the admin(s).
    4.  Admin(s) receive a message informing them a guest has confirmed for an existing session.
*   **Security:** N/A.
*   **Testing:**
    *   **Backend:**
        *   Unit test the logic that constructs the admin notification message.
        *   Verify `telegramNotifier.sendAdminNotification` is called with the correct message content when a friend's waiver is processed.
    *   **E2E:** After a friend successfully submits a waiver, verify the admin(s) receive the correct notification message in their Telegram chat(s).
*   **Data Management:** N/A.
*   **Logging & Error Handling:**
    *   Log admin message sending attempt.
    *   Log success or failure of the notification.
    *   If admin notification fails, it's generally non-critical to the booking itself but should be logged for ops awareness.

**Data Flow Steps:**
1.  Inside `POST /api/submit-waiver` (friend's path), after `SessionInvite` is successfully updated.
2.  Retrieve all necessary details: friend's name/TGID, primary booker's name/TGID, session details, invite token.
3.  Construct the admin notification message string.
4.  Call `telegramNotifier.sendAdminNotification(message)` to send the message.

**Key Edge Cases:**
*   Admin user(s) not configured or `telegramNotifier.sendAdminNotification` fails: Log error. Friend's booking is still valid.
*   Data for message construction (e.g., primary booker name) is partially missing: Message should be resilient, perhaps using placeholders like "N/A" or omitting optional parts.
This completes all features for Phase 6A, 6B, and 6C.
---
### PH6-XX: Admin Interface for Session Type Management (Placeholder)

**Goal:** Provide an administrative interface (details TBD - could be bot commands or a separate web UI) for managing `SessionType` properties, including `waiverType`, `allowsGroupInvites`, and `maxGroupSize`.

**Note:** This is a placeholder for a future feature. The specific implementation (bot commands, web interface) and detailed requirements will be defined later. Its existence is noted here due to its direct relationship with the dynamic booking flow logic introduced in Phase 6.
---