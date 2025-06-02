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
### Feature: PH6-15: Calendar Mini-App: Transition to Waiver Form on "Submit"

**Goal:**
When a user confirms a valid time slot in the `calendar-app.html` Mini-App, transition them directly to the `waiver-form.html` Mini-App within the Telegram WebApp environment, passing necessary booking context (Telegram ID, Session Type ID, selected Appointment DateTime ISO) via URL parameters.

**API Relationships:**
*   This feature is primarily frontend client-side logic.
*   It consumes data validated by previous interactions with:
    *   `GET /api/session-types/:id` (for session duration)
    *   `GET /api/calendar/availability` (for slot validation)
*   It prepares data to be sent to `waiver-form.html`, which will then use APIs like `GET /api/user-data` and `POST /api/submit-waiver`.

**Detailed Requirements:**
*   **Requirement A (Data Integrity):** Ensure `telegramId`, `initialSessionTypeId` (as `sessionTypeId`), and the validated `selectedTimeSlotISO` are correctly gathered from the calendar app's state.
*   **Requirement B (URL Construction):** The URL for `waiver-form.html` must be correctly constructed with all three parameters: `telegramId`, `sessionTypeId`, and `appointmentDateTimeISO`.
*   **Requirement C (Redirection):** A client-side JavaScript redirect (`window.location.href`) must be used to navigate to the waiver form.
*   **Requirement D (Context Preservation):** The transition must feel seamless to the user, implying they are moving to the next step of the same booking process.

**Implementation Guide:**

*   **Architecture Overview:**
    *   This is a client-side feature within the Telegram Mini-App environment.
    *   Tech Stack: HTML, CSS, Vanilla JavaScript (specifically in [`public/calendar-app.js`](public/calendar-app.js:0)).
    *   Deployment: Static files served by the Express server.
*   **DB Schema:** No direct DB interaction for this specific transition feature itself. It relies on data integrity from previous steps that involved DB reads.
*   **API Design:** No new API endpoints are defined for this feature.
*   **Frontend Structure (`public/calendar-app.js`):**
    *   Component: The `submitBookingButton` click handler in [`public/calendar-app.js`](public/calendar-app.js:238).
    *   State Management: Relies on JavaScript variables within [`public/calendar-app.js`](public/calendar-app.js:0) scope holding `telegramId`, `initialSessionTypeId`, and `selectedTimeSlotISO`.
    *   Navigation: Achieved via `window.location.href`.
    *   **Pseudocode for `submitBookingButton` click handler (relevant part):**
      ```javascript
      // Inside submitBookingButton click event listener, after isStillAvailable check passes:
      // const telegramId = // get from app state
      // const initialSessionTypeId = // get from app state
      // const selectedTimeSlotISO = // get from app state (validated UTC ISO string)

      if (telegramId && initialSessionTypeId && selectedTimeSlotISO) {
        const waiverFormUrl = `waiver-form.html?telegramId=${telegramId}&sessionTypeId=${initialSessionTypeId}&appointmentDateTimeISO=${selectedTimeSlotISO}`;
        // Potentially prefix with process.env.FORM_URL if not relative
        window.location.href = waiverFormUrl;
      } else {
        // This case should ideally be prevented by disabling button if data is missing
        showError("Critical information missing. Cannot proceed.");
        console.error("Missing data for waiver form transition:", { telegramId, initialSessionTypeId, selectedTimeSlotISO });
      }
      ```
*   **CRUD Operations:** N/A for this feature.
*   **UX Flow:**
    1.  User has selected a date and time on `calendar-app.html`.
    2.  `submitBookingButton` is enabled.
    3.  User clicks `submitBookingButton`.
    4.  (PH6-14 final validation occurs: `validateSlotAvailability`).
    5.  If validation passes, button text might briefly change (e.g., "Proceeding...").
    6.  Browser navigates to `waiver-form.html` with parameters.
    *   **Loading State:** Brief browser loading state during redirection.
    *   **Error State:** If critical parameters (`telegramId`, `sessionTypeId`, `selectedTimeSlotISO`) are somehow missing at this stage (which should be prevented by prior logic), an error message should be displayed on `calendar-app.html`, and redirection should not occur.
*   **Security:**
    *   Parameters are passed via URL. While not highly sensitive for read, ensure `waiver-form.html` validates these parameters server-side upon its own data submissions.
    *   No direct auth flow here, relies on context established by bot.
*   **Testing:**
    *   **Unit:** Test the URL construction logic.
    *   **Integration/E2E:** Verify that clicking "Submit" on `calendar-app.html` correctly navigates to `waiver-form.html` with all expected URL parameters. Test with various valid session types and time slots.
*   **Data Management:** No data is stored by this feature; it passes transient state via URL.
*   **Logging & Error Handling:**
    *   Client-side logging in [`public/calendar-app.js`](public/calendar-app.js:0) for successful redirection initiation or errors if parameters are missing.
    *   `showError` function in [`public/calendar-ui.js`](public/calendar-ui.js:7) for user-facing errors.

**Data Flow Steps:**
1.  User clicks "Submit" on `calendar-app.html`.
2.  JavaScript in [`public/calendar-app.js`](public/calendar-app.js:0) retrieves `telegramId`, `initialSessionTypeId`, `selectedTimeSlotISO` from its current state.
3.  JavaScript constructs the target URL: `waiver-form.html?param1=value1&param2=value2...`.
4.  JavaScript executes `window.location.href = targetUrl;`.
5.  Browser loads `waiver-form.html`.

**Key Edge Cases:**
*   One or more required URL parameters (`telegramId`, `initialSessionTypeId`, `selectedTimeSlotISO`) are null or undefined before redirection attempt: Log error, show user error message, do not redirect.
*   `selectedTimeSlotISO` is not a valid UTC ISO string: This should be caught by earlier validation.

---
### Feature: PH6-16: Waiver Form: Adapt to Receive & Use Calendar Data

**Goal:**
Enable `waiver-form.html` to parse context (Telegram ID, Session Type ID, Appointment DateTime ISO) from URL parameters passed by `calendar-app.html`. Use this data to pre-fill relevant user information (fetched via API) and display appointment context, streamlining the waiver completion process for the user.

**API Relationships:**
*   Consumes URL parameters: `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`.
*   Calls `GET /api/user-data?telegramId={telegramId}` to fetch user's registration details for pre-filling.
    *   Expected backend: [`src/routes/api.js`](src/routes/api.js:0), handler in [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0) or new `src/handlers/api/userDataApiHandler.js`.
*   Calls `GET /api/session-types/{sessionTypeId}` (existing API from PH6-12) to fetch session label for display.
    *   Expected backend: [`src/routes/api.js`](src/routes/api.js:0), handler in [`src/handlers/api/sessionTypesApiHandler.js`](src/handlers/api/sessionTypesApiHandler.js:0).

**Detailed Requirements:**
*   **Requirement A (Parameter Parsing):** JavaScript in `waiver-form.html` must correctly parse `telegramId`, `sessionTypeId`, and `appointmentDateTimeISO` from the URL.
*   **Requirement B (User Data Fetch & Pre-fill):**
    *   Fetch user data (first name, last name, email, phone, DOB, emergency contact details) using the parsed `telegramId`.
    *   Pre-fill corresponding input fields on the waiver form.
*   **Requirement C (Session Data Fetch & Display):**
    *   Fetch session type details (specifically the `label`) using the parsed `sessionTypeId`.
    *   Display the session label and the formatted `appointmentDateTimeISO` prominently on the form.
*   **Requirement D (Hidden Fields Population):** Populate hidden form fields for `telegramId`, `sessionTypeId`, and `appointmentDateTimeISO` to be included in the waiver submission (PH6-17).
*   **Requirement E (Error Handling):** Gracefully handle cases where URL parameters are missing or API calls fail.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Client-side logic within the `waiver-form.html` Mini-App.
    *   Interacts with backend APIs for data enrichment.
    *   Tech Stack: HTML, CSS ([`public/waiver-form.css`](public/waiver-form.css:0)), Vanilla JavaScript (embedded or in `public/waiver-form.js`).
*   **DB Schema:**
    *   Relies on existing `User` and `SessionType` table structures. No new schema changes for this specific feature.
    *   `User` table must contain: `firstName`, `lastName`, `email`, `phoneNumber`, `dateOfBirth`, and potentially `emergencyContactFirstName`, `emergencyContactLastName`, `emergencyContactPhone`.
*   **API Design:**
    *   **`GET /api/user-data?telegramId={telegramId}`:**
        *   **Request:** `GET /api/user-data?telegramId=123456789`
        *   **Response (Success 200):**
            ```json
            {
              "success": true,
              "data": {
                "firstName": "John",
                "lastName": "Doe",
                "email": "john.doe@example.com",
                "phoneNumber": "123-456-7890",
                "dateOfBirth": "1990-01-15", // YYYY-MM-DD
                "emergencyContactFirstName": "Jane",
                "emergencyContactLastName": "Doe",
                "emergencyContactPhone": "987-654-3210"
                // rawAppointmentDateTime and formatted appointmentDateTime are NOT part of this API
              }
            }
            ```
        *   **Response (Error 404 - User not found):**
            ```json
            { "success": false, "message": "User not found." }
            ```
        *   **Response (Error 500):**
            ```json
            { "success": false, "message": "Internal server error." }
            ```
        *   **Auth:** Implicitly authorized by the fact that `telegramId` is used. For more security, a session token obtained during bot interaction could be used if Mini-Apps support secure header passing. For now, `telegramId` is assumed sufficient for this internal context.
        *   **Rate Limiting:** Standard API rate limiting.
    *   **`GET /api/session-types/{sessionTypeId}`:** (Existing from PH6-12)
        *   **Request:** `GET /api/session-types/some-uuid-or-id`
        *   **Response (Success 200):**
            ```json
            {
              "success": true,
              "data": {
                "id": "some-uuid-or-id",
                "label": "Standard Kambo Session",
                "durationMinutes": 90,
                "description": "A standard 90-minute Kambo session.",
                "price": 150.00,
                "active": true
              }
            }
            ```
*   **Frontend Structure (`waiver-form.html` JavaScript):**
    *   **Component Hierarchy (Conceptual):**
        *   `WaiverFormApp` (main controller)
            *   `AppointmentInfoDisplay` (renders session type and date/time)
            *   `ParticipantInfoSection` (handles pre-filling of user details)
            *   `WaiverSections` (the actual waiver content)
            *   `HiddenFieldsManager`
    *   **State Management:** JavaScript variables to store parsed URL params, fetched user data, and session type data.
    *   **Navigation:** N/A (this is a single page load context).
    *   **Pseudocode for `onPageLoad` logic:**
      ```javascript
      // In waiver-form.html's script or waiver-form.js
      document.addEventListener('DOMContentLoaded', async () => {
        // 1. Parse URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const telegramId = urlParams.get('telegramId');
        const sessionTypeId = urlParams.get('sessionTypeId'); // Note: PLANNING.md uses initialSessionTypeId, waiver-form.html uses sessionType. Standardize.
        const appointmentDateTimeISO = urlParams.get('appointmentDateTimeISO');

        if (!telegramId || !sessionTypeId || !appointmentDateTimeISO) {
          showWaiverError("Booking information incomplete. Please start over from Telegram.");
          // Disable form submission
          return;
        }

        // 2. Populate hidden fields
        document.getElementById('telegramId').value = telegramId;
        document.getElementById('appointmentDateTimeValue').value = appointmentDateTimeISO; // Raw ISO
        document.getElementById('sessionTypeValue').value = sessionTypeId; // Assuming this is the ID

        // 3. Fetch and display session type label and format appointment date/time
        try {
          const sessionDetails = await fetch(`/api/session-types/${sessionTypeId}`).then(res => res.json());
          if (sessionDetails.success) {
            document.getElementById('sessionType').textContent = `Session Type: ${sessionDetails.data.label}`;
          } else {
            throw new Error(sessionDetails.message || 'Failed to load session type.');
          }
          
          const apptDate = new Date(appointmentDateTimeISO);
          const formattedDateTime = apptDate.toLocaleString([], { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
            hour: '2-digit', minute: '2-digit', timeZoneName: 'short' 
          });
          document.getElementById('appointmentDateTime').textContent = `Appointment: ${formattedDateTime}`;

        } catch (error) {
          showWaiverError("Could not load appointment details.");
          console.error("Error fetching session/appointment details:", error);
        }

        // 4. Fetch and pre-fill user data
        try {
          const userDataResponse = await fetch(`/api/user-data?telegramId=${telegramId}`);
          const userDataContainer = await userDataResponse.json();

          if (userDataContainer.success) {
            const user = userDataContainer.data;
            document.getElementById('firstName').value = user.firstName || '';
            document.getElementById('lastName').value = user.lastName || '';
            document.getElementById('email').value = user.email || '';
            document.getElementById('phone').value = user.phoneNumber || ''; // Ensure field name consistency
            document.getElementById('dob').value = user.dateOfBirth || '';
            
            // Pre-fill emergency contacts if elements exist and data is present
            if (document.getElementById('emergencyFirstName')) document.getElementById('emergencyFirstName').value = user.emergencyContactFirstName || '';
            if (document.getElementById('emergencyLastName')) document.getElementById('emergencyLastName').value = user.emergencyContactLastName || '';
            if (document.getElementById('emergencyPhone')) document.getElementById('emergencyPhone').value = user.emergencyContactPhone || '';
          } else {
            // Do not show error for missing user data, allow manual fill
            console.warn("User data not found or API error, user will need to fill manually.");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          // Do not block form for this, allow manual fill
        }
      });

      function showWaiverError(message) {
        // Implement a user-friendly error display on waiver-form.html
        alert(message); // Placeholder
      }
      ```
*   **CRUD Operations:** Primarily Read operations (fetching user and session type data).
*   **UX Flow:**
    1.  `waiver-form.html` loads.
    2.  URL parameters are parsed.
    3.  Loading indicators shown for dynamic content areas.
    4.  API calls made to fetch user data and session type label.
    5.  Appointment details section is populated.
    6.  Personal information fields are pre-filled.
    7.  User reviews context and proceeds to fill the rest of the waiver.
    *   **Loading States:** Placeholders or subtle spinners for `appointmentInfo` and pre-fillable fields during API calls.
    *   **Error States:** If URL params missing: "Invalid booking link. Please restart from Telegram." If API calls fail: "Could not load your details. Please fill them manually." (Form should still be submittable if user fills manually).
*   **Security:**
    *   Input sanitization is not directly relevant for pre-filling, but the fetched data should be treated as text content, not HTML.
    *   The `telegramId` from URL is used to fetch user data; ensure the `/api/user-data` endpoint is appropriately secured if it provides sensitive information beyond what's needed for pre-filling.
*   **Testing:**
    *   **Unit:** Test URL parsing logic. Test API call functions with mocks.
    *   **Integration:** Test that `waiver-form.html` correctly calls backend APIs and populates fields.
    *   **E2E:** Full flow from calendar submit to waiver form load with correct pre-filled data. Test cases:
        *   User with full registration data.
        *   User with partial/missing registration data (form should still load, fields remain blank).
        *   Invalid/missing URL parameters.
        *   API errors during data fetch.
*   **Data Management:**
    *   Fetched data is transient, used for one-time pre-fill and display. No client-side caching strictly needed for this specific feature beyond browser's default.
*   **Logging & Error Handling:**
    *   Client-side: Log successful parsing, API call initiation, success/failure of API calls, and pre-filling actions. Use `console.error` for issues.
    *   User-facing errors displayed via `showWaiverError` or similar.
    *   Backend: Standard logging for API endpoints.

**Data Flow Steps:**
1.  `waiver-form.html` loads in browser.
2.  JS: Parses `telegramId`, `sessionTypeId`, `appointmentDateTimeISO` from URL.
3.  JS: Populates hidden form fields with these values.
4.  JS: Makes async call to `GET /api/session-types/{sessionTypeId}`.
5.  Backend: Fetches `SessionType.label` from DB, returns it.
6.  JS: Displays session label and formatted `appointmentDateTimeISO`.
7.  JS: Makes async call to `GET /api/user-data?telegramId={telegramId}`.
8.  Backend: Fetches user details from DB, returns them.
9.  JS: Pre-fills relevant form fields with user details.

**Key Edge Cases:**
*   `telegramId`, `sessionTypeId`, or `appointmentDateTimeISO` missing from URL: Display error, prevent form use.
*   `/api/user-data` returns no data or error: Log, allow user to fill form manually.
*   `/api/session-types/:id` returns error: Log, display placeholder for session name, but allow form use.
*   `appointmentDateTimeISO` is invalid: Date formatting will fail; display an error for the date.

---
### Feature: PH6-17: API & Waiver Submit: Create Session, GCal Event, Edit Bot Msg to Final Confirmation

**Goal:**
Securely process the submitted waiver form data. This involves: creating a `Session` record in the database, booking the corresponding event in Google Calendar, editing the original bot message (that initiated the WebApp flow) to a final confirmation (with frog picture), notifying the Kambo Klarity admin of the new booking, and sending a success response back to the waiver form Mini-App to allow it to close.

**API Relationships:**
*   **Endpoint:** `POST /api/submit-waiver`
    *   Called by: `waiver-form.html` upon submission.
*   **Internal Backend Integrations:**
    *   Database ([`src/core/prisma.js`](src/core/prisma.js:0)): To create `Session` record and update `User.edit_msg_id`.
    *   Google Calendar Tool ([`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0)): To call `createCalendarEvent`.
    *   Telegram Notifier Tool ([`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0)): To edit the client's bot message and send admin notifications.
    *   Session Types Core ([`src/core/sessionTypes.js`](src/core/sessionTypes.js:0)): To fetch `SessionType.label` and `durationMinutes`.

**Detailed Requirements:**
*   **Requirement A (Data Reception & Validation):** API must receive all form data from `waiver-form.html`, including hidden fields (`telegramId`, `sessionTypeId`, `appointmentDateTimeISO`) and the full JSON of waiver responses. Perform server-side validation on key fields.
*   **Requirement B (Session Creation):** Create a new `Session` record in the database with `status: 'CONFIRMED'`, all relevant foreign keys, the appointment datetime (stored in UTC), and the complete waiver form data as a JSON blob.
*   **Requirement C (Google Calendar Event):** Create an event in the practitioner's Google Calendar for the booked slot. The event details should include client name, session type, and a link/reference to the booking. Store the `googleEventId` on the `Session` record.
*   **Requirement D (Bot Message Update):** Edit the original Telegram bot message (identified by `edit_msg_id` associated with the user) to display a final confirmation message, including a frog picture and details of the confirmed session.
*   **Requirement E (Clear `edit_msg_id`):** After successfully editing the message, set the `edit_msg_id` for the user to `null` in the database to prevent re-editing.
*   **Requirement F (Admin Notification):** Send a notification to the designated admin(s) via Telegram about the new confirmed booking.
*   **Requirement G (Client Feedback):** Respond to `waiver-form.html` with a success status, allowing it to close. For Phase 6B, this response will be augmented to include a redirect URL.
*   **Requirement H (Atomicity/Error Handling):** The entire process should be as atomic as possible. If a critical step fails (e.g., GCal booking after DB write), the system should attempt to log the inconsistency and notify admins. Full rollback is complex but desirable if feasible for key operations.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Backend API endpoint implemented in Express.js.
    *   Handler function in [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0) or a new `src/handlers/api/waiverApiHandler.js`.
    *   Utilizes various core modules and tools.
    *   Tech Stack: Node.js, Express.js, Prisma, `googleapis`, Telegraf (via `telegramNotifier`).
*   **DB Schema:**
    *   **`Session` Table (Existing, but key fields for creation):**
        *   `id` (PK)
        *   `telegram_id` (BigInt, FK to `User.telegram_id`)
        *   `session_type_id_fk` (Int, FK to `SessionType.id`)
        *   `appointment_datetime` (DateTime, UTC)
        *   `status` (String, e.g., 'CONFIRMED')
        *   `liability_form_data` (Json)
        *   `google_event_id` (String, nullable)
        *   `createdAt`, `updatedAt`
    *   **`User` Table (Existing, relevant field):**
        *   `edit_msg_id` (Int, nullable) - Stores the ID of the Telegram message to be edited.
    *   **`SessionType` Table (Existing, relevant fields):**
        *   `label` (String)
        *   `durationMinutes` (Int)
*   **API Design (`POST /api/submit-waiver`):**
    *   **Request Body (Example):**
      ```json
      {
        "telegramId": "123456789",
        "sessionType": "session-type-uuid-1", // This is sessionTypeId
        "appointmentDateTime": "2025-07-15T10:00:00.000Z", // UTC ISO String from hidden field
        "firstName": "John",
        "lastName": "Doe",
        "phone": "123-456-7890",
        "dob": "1990-01-15",
        "email": "john.doe@example.com",
        "emergencyFirstName": "Jane",
        // ... all other waiver form fields ...
        "contraindications": [
          {"description": "Serious heart problems", "checked": false},
          {"description": "On a no-salt diet...", "checked": true}
        ],
        "substanceAgreements": [
          {"substance": "Alcohol – high doses", "prior": "48 h", "post": "7 days", "checked": true}
        ],
        "confirmations": {
          "avoidAgreement": true,
          "substanceAgreement": true,
          "liabilityAgreement": true,
          "electronicSignature": true
        },
        "signature": "John Doe"
      }
      ```
    *   **Response (Success 200 - Phase 6A MVP):**
      ```json
      { "success": true, "message": "Booking Confirmed!" }
      ```
    *   **Response (Success 200 - Phase 6B onwards, conditional):**
      ```json
      { 
        "success": true, 
        "message": "Booking Confirmed!", 
        "redirectTo": "/invite-friends.html?sessionId=new-session-db-id&telegramId=123456789" 
      }
      ```
    *   **Response (Error 400 - Bad Request/Validation Error):**
      ```json
      { "success": false, "message": "Invalid data provided. Missing required fields." }
      ```
    *   **Response (Error 500 - Internal Server Error):**
      ```json
      { "success": false, "message": "An error occurred while confirming your booking. Please contact support." }
      ```
    *   **Auth:** Relies on `telegramId` passed from the client. Server should validate that this `telegramId` corresponds to an existing user who is in a state expecting waiver submission (e.g., by checking `edit_msg_id` is not null, or a temporary booking state if implemented).
    *   **Rate Limiting:** Apply standard API rate limiting.
*   **Frontend Structure:** N/A (This is a backend API). Client-side is `waiver-form.html`'s submission script.
*   **CRUD Operations (Backend):**
    *   **Create:** New `Session` record.
    *   **Create:** New Google Calendar event.
    *   **Update:** `User` record to set `edit_msg_id` to `null`.
    *   **Update:** `Session` record to store `googleEventId`.
*   **UX Flow (Backend Perspective):**
    1.  Receive POST request.
    2.  Validate data. If invalid, return 400.
    3.  Start DB transaction (if Prisma supports it for this flow).
    4.  Fetch `SessionType` details (label, duration).
    5.  Create `Session` record in DB. If fails, rollback/log, return 500.
    6.  Call `googleCalendarTool.createCalendarEvent`. If fails, log critical, consider manual intervention path, return 500. Store `googleEventId`.
    7.  Fetch `user.edit_msg_id`.
    8.  Call `telegramNotifier` to edit bot message with confirmation & frog pic. If fails, log warning (booking is made, but client message not updated).
    9.  Update `user.edit_msg_id` to `null` in DB. If fails, log warning.
    10. Call `telegramNotifier` to send admin notification. If fails, log warning.
    11. Commit DB transaction (if used).
    12. Return success (200) to client (with `redirectTo` if applicable for Phase 6B+).
*   **Security:**
    *   **Input Sanitization/Validation:** Crucial for all incoming data, especially `liability_form_data` if it's ever displayed raw. Prisma helps with type safety for DB operations.
    *   **Authorization:** Ensure the `telegramId` submitting the waiver is the one expected for this booking stage.
    *   **Google API Security:** Service account credentials for Google Calendar API must be securely stored and managed.
    *   **CSRF:** Since this is an API called from a Mini-App (same-origin or trusted context usually), traditional CSRF tokens might not be standard, but ensure requests originate from expected client.
*   **Testing:**
    *   **Unit Tests:**
        *   Test the API handler logic with mocked dependencies (Prisma, GCal tool, Notifier tool).
        *   Test data validation logic.
        *   Test GCal event detail construction.
        *   Test bot message content construction.
    *   **Integration Tests (Supertest):**
        *   Test the `POST /api/submit-waiver` endpoint with valid and invalid payloads.
        *   Verify interactions with a test database (e.g., session creation, `edit_msg_id` update).
        *   Mock Google Calendar and Telegram API calls to verify they are called with correct parameters.
    *   **E2E:** Full flow: Client selects slot -> navigates to waiver -> submits waiver -> verifies DB record, GCal event (manual check or test GCal account), admin notification (test admin account), client bot message update.
*   **Data Management:**
    *   `Session` data is persisted. `liability_form_data` (JSON) can be large.
    *   `google_event_id` is critical for future cancellations/modifications.
*   **Logging & Error Handling:**
    *   **Structured Logs ([`src/core/logger.js`](src/core/logger.js:0)):**
        *   Log start and end of API request processing.
        *   Log successful creation of Session, GCal event.
        *   Log parameters for external calls (GCal, Telegram).
        *   Log successful message edits and admin notifications.
        *   **Critical Errors:** DB write failure, GCal event creation failure. These should trigger alerts if monitoring is set up.
        *   **Warnings:** Failure to edit bot message or send admin notification (if main booking succeeded).
    *   **Error Recovery:** For critical failures, a manual intervention process might be needed (e.g., admin alerted to manually create GCal event if DB write succeeded but GCal failed). Full atomicity is hard.

**Implementation Guide (Pseudocode for API Handler):**
```javascript
// src/handlers/api/waiverApiHandler.js (or similar)
// const prisma = require('../../core/prisma');
// const googleCalendarTool = require('../../tools/googleCalendar');
// const telegramNotifier = require('../../tools/telegramNotifier');
// const coreSessionTypes = require('../../core/sessionTypes');
// const logger = require('../../core/logger').child({ context: 'WaiverSubmitAPI' });

async function handleSubmitWaiver(req, res, _next) {
  try {
    // 1. Extract and validate data from req.body
    const {
      telegramId,
      sessionType: sessionTypeId, // Renaming for clarity if needed
      appointmentDateTime: appointmentDateTimeISO,
      firstName, lastName, /* ... other waiver fields ... */,
      liability_form_data // Assuming all waiver fields are bundled here by client
    } = req.body;

    // Basic validation (more thorough validation needed)
    if (!telegramId || !sessionTypeId || !appointmentDateTimeISO || !firstName /*...*/) {
      logger.warn('Submit Waiver: Missing required fields.');
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // --- Start Transaction-like block (conceptual, Prisma handles actual transactions) ---
    logger.info(`Submit Waiver: Processing for user ${telegramId}, sessionType ${sessionTypeId}`);

    // 2. Fetch SessionType details (label for GCal/notifications, duration for GCal)
    const sessionTypeDetails = await coreSessionTypes.getById(sessionTypeId);
    if (!sessionTypeDetails) {
      logger.error(`Submit Waiver: Invalid sessionTypeId ${sessionTypeId}`);
      return res.status(400).json({ success: false, message: 'Invalid session type.' });
    }

    // 3. Create Session Record in DB
    const newSession = await prisma.session.create({
      data: {
        user: { connect: { telegram_id: BigInt(telegramId) } },
        sessionType: { connect: { id: sessionTypeId } },
        appointment_datetime: new Date(appointmentDateTimeISO), // Ensure UTC
        status: 'CONFIRMED',
        liability_form_data: liability_form_data, // The JSON blob of waiver answers
        // google_event_id will be updated later
      },
      include: { user: true } // To get user.edit_msg_id
    });
    logger.info(`Submit Waiver: Session ${newSession.id} created for user ${telegramId}`);

    // 4. Create Google Calendar Event
    const eventEndTime = new Date(new Date(appointmentDateTimeISO).getTime() + sessionTypeDetails.durationMinutes * 60000);
    const gcalEvent = await googleCalendarTool.createCalendarEvent({
      start: appointmentDateTimeISO,
      end: eventEndTime.toISOString(),
      summary: `${firstName} ${lastName} - ${sessionTypeDetails.label}`,
      description: `Booked via Kambo Klarity Bot. Waiver submitted. Session ID: ${newSession.id}`
    });

    if (!gcalEvent || !gcalEvent.id) {
      logger.error(`Submit Waiver: Failed to create GCal event for session ${newSession.id}.`);
      // CRITICAL: Consider cleanup or admin alert for inconsistency
      // For now, proceed but log heavily. A more robust solution might try to delete the session record.
      // Or, have a retry mechanism for GCal event creation.
    } else {
      logger.info(`Submit Waiver: GCal event ${gcalEvent.id} created for session ${newSession.id}`);
      await prisma.session.update({
        where: { id: newSession.id },
        data: { google_event_id: gcalEvent.id },
      });
    }
    
    // 5. Fetch user's edit_msg_id (already fetched if session include user)
    const userEditMsgId = newSession.user.edit_msg_id;

    if (userEditMsgId) {
      // 6. Edit Bot Message
      const practitionerTZ = process.env.PRACTITIONER_TIMEZONE || 'America/New_York'; // Configurable
      const formattedApptTime = new Date(appointmentDateTimeISO).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', timeZone: practitionerTZ, timeZoneName: 'short'
      });
      const formattedApptDate = new Date(appointmentDateTimeISO).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', timeZone: practitionerTZ
      });

      const confirmationMessageText = `✅ Your ${sessionTypeDetails.label} session is confirmed for ${formattedApptDate} at ${formattedApptTime}! We look forward to seeing you.`;
      
      try {
        // Assuming telegramNotifier.sendPhotoWithMessage can handle this, or a similar method
        // This might involve sending a new photo message and deleting the old one if editing with photo is tricky.
        // For MVP, a text-only edit might be simpler if photo edit is complex.
        // For "Frog Pic + Booking Confirmed!":
        // Option 1: Edit message with HTML if supported for images.
        // Option 2: Send new photo message with caption, then delete original message (harder to manage edit_msg_id).
        // Option 3: Edit text only, and user knows frog means Kambo.
        // Simplest for MVP edit:
        await telegramNotifier.editMessageText(
          telegramId, // or newSession.user.chat_id if available
          userEditMsgId,
          confirmationMessageText, // Potentially with HTML for formatting if supported
          null // No inline keyboard for MVP
        );
        logger.info(`Submit Waiver: Bot message ${userEditMsgId} edited for user ${telegramId}`);

        // 7. Clear edit_msg_id
        await prisma.user.update({
          where: { telegram_id: BigInt(telegramId) },
          data: { edit_msg_id: null },
        });
        logger.info(`Submit Waiver: edit_msg_id cleared for user ${telegramId}`);

      } catch (editError) {
        logger.error(`Submit Waiver: Failed to edit message or clear edit_msg_id for user ${telegramId}: ${editError.message}`);
        // Non-critical for booking itself, but impacts user confirmation.
      }
    } else {
      logger.warn(`Submit Waiver: No edit_msg_id found for user ${telegramId}. Cannot edit confirmation message.`);
    }

    // 8. Notify Admin
    const adminMessage = `CONFIRMED BOOKING: Client ${firstName} ${lastName} (TGID: ${telegramId}) for ${sessionTypeDetails.label} on ${new Date(appointmentDateTimeISO).toLocaleString('en-US', { timeZone: practitionerTZ })}. Waiver submitted. Session ID: ${newSession.id}`;
    await telegramNotifier.sendAdminNotification(adminMessage);
    logger.info(`Submit Waiver: Admin notification sent for session ${newSession.id}`);

    // --- End Transaction-like block ---

    // 9. Respond to waiver-form.html
    // Check if invites are possible for Phase 6B+
    const availabilityRule = await prisma.availabilityRule.findFirst({ 
      // Assuming a way to link SessionType or Practitioner to AvailabilityRule
      // This might need to be fetched based on practitioner settings if not directly on SessionType
      // For simplicity, let's assume a general rule or one linked to sessionType if applicable
      // where: { sessionTypes: { some: { id: sessionTypeId } } } // Example if relation exists
    });
    
    let responsePayload = { success: true, message: "Booking Confirmed!" };
    if (availabilityRule && availabilityRule.max_group_invites > 0 && process.env.INVITE_FRIENDS_ENABLED === 'true') {
        responsePayload.redirectTo = `/invite-friends.html?sessionId=${newSession.id}&telegramId=${telegramId}`;
        logger.info(`Submit Waiver: Redirecting user ${telegramId} to invite page for session ${newSession.id}`);
    }

    return res.status(200).json(responsePayload);

  } catch (error) {
    logger.error(`Submit Waiver: Unhandled error for user ${req.body.telegramId}: ${error.message}`, { stack: error.stack });
    return res.status(500).json({ success: false, message: 'An internal error occurred. Please contact support.' });
  }
}
```

**Data Flow Steps (Summary):**
1.  `waiver-form.html` POSTs JSON data to `/api/submit-waiver`.
2.  API Handler: Validates input.
3.  API Handler: Creates `Session` in DB.
4.  API Handler: Creates Google Calendar event via `googleCalendarTool`.
5.  API Handler: Updates `Session` with `googleEventId`.
6.  API Handler: Fetches `user.edit_msg_id`.
7.  API Handler: Edits original bot message via `telegramNotifier`.
8.  API Handler: Clears `user.edit_msg_id`.
9.  API Handler: Sends admin notification via `telegramNotifier`.
10. API Handler: Responds to `waiver-form.html` with success (and conditional redirect URL for 6B+).

**Key Edge Cases:**
*   **Duplicate Submission:** If user double-clicks submit. Implement idempotency if possible, or rely on GCal conflict for subsequent attempts. For now, a second submission might create a duplicate if not handled.
*   **GCal API Down/Error:** Booking in DB exists, but not in GCal. Critical inconsistency. Log, alert admin.
*   **Telegram API Down/Error (for message edit/admin notification):** Booking is made, but confirmation/notification fails. Log as warning.
*   **User `edit_msg_id` is stale/invalid:** Message edit fails. Log warning.
*   **`appointmentDateTimeISO` is in the past:** Add validation to prevent booking past slots.
*   **Slot just taken (race condition):** `googleCalendarTool.createCalendarEvent` should ideally detect conflicts. If it doesn't and overbooks, this is a problem. The pre-validation in PH6-14 helps mitigate but isn't foolproof for simultaneous requests.

---
This completes the detailed specifications for Phase 6A (PH6-15 to PH6-17).

---
## Feature Specifications (Phase 6B: "Invite Friends" - Initial Setup & Invite Generation)

---
### Feature: PH6-18: DB Updates for Invites

**Goal:**
Modify the database schema to support the "Invite Friends" functionality. This involves adding a field to `AvailabilityRule` to control the maximum number of invites per session and creating a new `SessionInvite` table to track individual invitation details and statuses.

**API Relationships:**
*   This feature primarily involves database schema changes and migrations.
*   It does not define new APIs but lays the groundwork for:
    *   `POST /api/submit-waiver` (PH6-19, PH6-24) to check `max_group_invites`.
    *   `GET /api/sessions/:sessionId/invite-context` (PH6-20) to read `max_group_invites` and existing `SessionInvite` records.
    *   `POST /api/sessions/:sessionId/generate-invite-token` (PH6-22) to create `SessionInvite` records.
    *   And subsequent APIs in Phase 6C that read/update `SessionInvite`.

**Detailed Requirements:**
*   **Requirement A (AvailabilityRule Update):** Add an integer field `max_group_invites` to the `AvailabilityRule` model in [`prisma/schema.prisma`](prisma/schema.prisma:0). This field should have a default value (e.g., 3) and be non-nullable.
*   **Requirement B (SessionInvite Model):** Define a new model `SessionInvite` in [`prisma/schema.prisma`](prisma/schema.prisma:0) with the following fields:
    *   `id`: String, primary key, default to UUID.
    *   `parentSessionId`: Int, foreign key referencing `Session.id`. Indexed for efficient lookups.
    *   `inviteToken`: String, unique. Indexed for efficient lookups.
    *   `status`: String, default "pending". Enum-like values: 'pending', 'accepted_by_friend', 'declined_by_friend', 'waiver_completed_by_friend'.
    *   `friendTelegramId`: BigInt, optional. Should be unique in combination with `parentSessionId` to prevent one friend from accepting multiple invites to the same parent session.
    *   `friendNameOnWaiver`: String, optional.
    *   `createdAt`: DateTime, default to `now()`.
    *   `updatedAt`: DateTime, auto-updated on change.
*   **Requirement C (Database Migration):** Generate and apply a new database migration using `npx prisma migrate dev`.
*   **Requirement D (Seed Data Update):** Update any seed scripts or manual seed data for `AvailabilityRule` to include values for the new `max_group_invites` field.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Database-centric changes.
    *   Tech Stack: Prisma ORM, PostgreSQL.
*   **DB Schema (`prisma/schema.prisma` changes):**
    *   **`AvailabilityRule` model update:**
      ```prisma
      model AvailabilityRule {
        // ... existing fields ...
        max_group_invites Int    @default(3)
        // ... existing relations ...
      }
      ```
    *   **New `SessionInvite` model:**
      ```prisma
      model SessionInvite {
        id                  String    @id @default(uuid())
        parentSession       Session   @relation(fields: [parentSessionId], references: [id])
        parentSessionId     Int
        inviteToken         String    @unique
        status              String    @default("pending") // Consider Prisma enum if appropriate for DB
        friendTelegramId    BigInt?   // No direct @unique here, handled by application logic or composite index if needed
        friendNameOnWaiver  String?
        createdAt           DateTime  @default(now())
        updatedAt           DateTime  @updatedAt

        @@index([parentSessionId])
        @@index([inviteToken])
        // Composite unique constraint for friendTelegramId per parentSessionId if desired at DB level:
        // @@unique([parentSessionId, friendTelegramId]) // Requires friendTelegramId to be non-nullable or careful handling
      }
      ```
    *   **Update `Session` model for relation (Prisma does this implicitly if named correctly, but good to note):**
      ```prisma
      model Session {
        // ... existing fields ...
        invites SessionInvite[] // Relation to SessionInvite records
        // ...
      }
      ```
    *   **Migration Script (`npx prisma migrate dev --name add_invites_functionality`):**
        *   Prisma will generate the SQL for adding the column to `AvailabilityRule` and creating the `SessionInvite` table with its indexes and foreign keys.
*   **API Design:** N/A for this feature directly.
*   **Frontend Structure:** N/A for this feature directly.
*   **CRUD Operations:**
    *   This feature enables future CRUD on `SessionInvite`.
    *   `AvailabilityRule` update is a schema change.
*   **UX Flow:** N/A directly, but enables the invite UX flow.
*   **Security:**
    *   `inviteToken` should be cryptographically strong enough if used as the sole means of accessing an invite (though typically combined with session context). UUIDs are generally good.
*   **Testing:**
    *   **Migrations:** Verify migration applies cleanly and schema is updated as expected.
    *   **Seed Data:** Verify seed data for `AvailabilityRule` includes `max_group_invites`.
    *   **Model Integrity:** (Future tests) Unit tests for services interacting with `SessionInvite` will validate relations and constraints.
*   **Data Management:**
    *   New table `SessionInvite` will store invite data.
    *   Consider cleanup strategies for old/expired `inviteToken`s if they become numerous over time (future concern).
*   **Logging & Error Handling:**
    *   Migration process has its own logging.
    *   Application-level logging will occur when these new fields/tables are accessed.

**Data Flow Steps:**
1.  Developer defines schema changes in `prisma/schema.prisma`.
2.  Developer runs `npx prisma migrate dev --name add_invites_functionality`.
3.  Prisma generates SQL migration script.
4.  Prisma applies migration to the database.
5.  Developer updates seed scripts/data if necessary.

**Key Edge Cases:**
*   Migration failure: Prisma handles rollback or provides error messages.
*   Existing `AvailabilityRule` records: Will get the default value for `max_group_invites` upon migration.

---
### Feature: PH6-19: `/api/submit-waiver` Redirects to `invite-friends.html` (Conditional)

**Goal:**
Modify the `POST /api/submit-waiver` endpoint to conditionally redirect the primary booker to the `invite-friends.html` page after their successful waiver submission, if the session they booked allows for group invites.

**API Relationships:**
*   Modifies existing endpoint: `POST /api/submit-waiver`.
*   Internally, after successful core booking logic (DB write, GCal event):
    *   Reads `Session.session_type_id_fk` for the newly created session.
    *   Reads `SessionType` to find its associated `AvailabilityRule` (this link needs to be clear in the schema, e.g., `SessionType` belongs to an `AvailabilityRule` or has a direct link).
    *   Reads `AvailabilityRule.max_group_invites`.

**Detailed Requirements:**
*   **Requirement A (Fetch Invite Eligibility):** After successfully creating the session and GCal event, the API must determine if invites are allowed for this session by checking `AvailabilityRule.max_group_invites` associated with the booked `SessionType`.
*   **Requirement B (Conditional API Response):**
    *   If `max_group_invites > 0` (and the invite feature is globally enabled via an environment variable e.g., `INVITE_FRIENDS_ENABLED='true'`): The API response to `waiver-form.html` must include a `redirectTo` field in the JSON payload, containing the URL for `invite-friends.html` with `sessionId` (of the newly created session) and `telegramId` as query parameters.
    *   If `max_group_invites == 0` or feature is disabled: The API response remains as in Phase 6A MVP (no `redirectTo` field).
*   **Requirement C (Client-Side Handling):** JavaScript in `waiver-form.html` must be updated to check for the `redirectTo` field in the API response and perform `window.location.href` navigation if present.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Backend modification to an existing Express API endpoint handler.
    *   Frontend modification to JavaScript in `waiver-form.html`.
*   **DB Schema:**
    *   Relies on `AvailabilityRule.max_group_invites` (from PH6-18).
    *   Assumes a way to get from `Session` -> `SessionType` -> `AvailabilityRule`. If `SessionType` can belong to multiple rules, logic to determine the *active* rule for that session time would be needed (this might be complex and implies `AvailabilityRule` is more dynamic than a simple FK on `SessionType`). For MVP, assume a simpler link or that the relevant `AvailabilityRule` is determined during slot finding.
    *   **Simplified Assumption:** For now, let's assume `SessionType` has a direct or easily derivable link to one `AvailabilityRule` or that the `AvailabilityRule` context is passed along/retrievable. A more robust system might store the `availabilityRuleId` on the `Session` itself if it's determined at booking time.
*   **API Design (`POST /api/submit-waiver` - Modification):**
    *   **Response (Success 200 - Conditional for Phase 6B):**
      ```json
      // If invites allowed:
      {
        "success": true,
        "message": "Booking Confirmed!",
        "redirectTo": "/invite-friends.html?sessionId={newSession.id}&telegramId={telegramId}"
      }
      // If invites NOT allowed:
      { "success": true, "message": "Booking Confirmed!" }
      ```
*   **Frontend Structure (`waiver-form.html` JavaScript update):**
    *   **Pseudocode for submission success handler:**
      ```javascript
      // Inside waiverForm submit's .then(data => { ... }) block
      if (data.success) {
        if (data.redirectTo) {
          // User feedback before redirect (optional, can be quick)
          // showTemporaryMessage("Booking confirmed! Taking you to invite friends...");
          window.location.href = data.redirectTo;
        } else {
          // Original Phase 6A behavior
          showTemporaryMessage("Booking Confirmed! Thank you.");
          setTimeout(() => tgApp.close(), 3000); // tgApp is window.Telegram.WebApp
        }
      } else {
        // ... existing error handling ...
      }
      ```
*   **CRUD Operations:** No new CRUD, but reads `AvailabilityRule`.
*   **UX Flow:**
    1.  User submits waiver on `waiver-form.html`.
    2.  Backend processes (PH6-17 logic).
    3.  Backend checks `max_group_invites` for the session.
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
### Feature: PH6-20: API: GET `/api/sessions/:sessionId/invite-context` for Invite Page

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
### Feature: PH6-21: Invite Friends WebApp: Initial Page Load &amp; Display

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
### Feature: PH6-22: API: `POST /api/sessions/:sessionId/generate-invite-token`

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
### Feature: PH6-23: Invite Friends WebApp: Update UI After Token Generation

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
### Feature: PH6-24: Bot: Primary Booker's Confirmation Message - Add "Invite Friends" Button (Conditional)

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
### Feature: PH6-25: Invite Friends WebApp: "Copy Link" & "Share on Telegram" Functionality

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
### Feature: PH6-26: Bot: Handle `/start invite_{token}` Deep Link from Friend

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
### Feature: PH6-27: Join Session WebApp: Initial Page Load & Display (`join-session.html`)

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
### Feature: PH6-28: Bot: Handle "Decline Invite" Callback from Friend

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
### Feature: PH6-29: Waiver Form: Adapt for Invited Friend (Receive `inviteToken`)

**Goal:**
Modify `public/waiver-form.html` so it can receive an `inviteToken` as a URL parameter. When present, this token indicates the waiver is being filled out by an invited friend. The form should store this `inviteToken` in a hidden field to be submitted along with the waiver data. This allows the backend (PH6-30) to link the friend's waiver submission to the specific `SessionInvite`.

**API Relationships:**
*   This is a frontend modification to `public/waiver-form.html`.
*   It prepares data for `POST /api/submit-waiver` (which will be further modified in PH6-30).

**Detailed Requirements:**
*   **Requirement A (Parameter Parsing):** JavaScript in `waiver-form.html` (or `public/waiver-form.js`) must check for and parse an `inviteToken` from the URL query parameters. This is in addition to existing parameters like `telegramId`, `sessionTypeId`, `appointmentDateTimeISO`.
*   **Requirement B (Hidden Field Population):** If `inviteToken` is present in the URL:
    *   A new hidden input field (e.g., `<input type="hidden" id="inviteTokenValue" name="inviteToken">`) must be populated with this token.
*   **Requirement C (Conditional Logic - Optional):**
    *   The UI of the waiver form might subtly change if an `inviteToken` is present (e.g., a small note "You are completing this waiver as an invited guest for [Primary Booker Name]'s session."). This would require fetching primary booker info, possibly via an updated `GET /api/invites/:token/details` or a new API if `join-session.html` doesn't pass all context. For MVP, just passing the token is key.
    *   Pre-filling user data (`GET /api/user-data?telegramId={friend_telegramId}`) for the friend should still work as before (PH6-16), using the friend's `telegramId` passed in the URL.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Client-side JavaScript and HTML modifications in `public/waiver-form.html`.
*   **DB Schema:** N/A for this frontend change.
*   **API Design:** N/A for this frontend change. Consumes URL params.
*   **Frontend Structure (`waiver-form.html` JavaScript):**
    *   **HTML Changes:**
        *   Add to form: `<input type="hidden" id="inviteTokenValue" name="inviteToken" value="">`
    *   **JavaScript Changes (in `onPageLoad` or similar logic from PH6-16):**
      ```javascript
      // In waiver-form.html's script or waiver-form.js
      // document.addEventListener('DOMContentLoaded', async () => {
      //   // ... existing parameter parsing from PH6-16 ...
      //   const telegramId = urlParams.get('telegramId'); // This is the friend's telegramId
      //   const sessionTypeId = urlParams.get('sessionTypeId');
      //   const appointmentDateTimeISO = urlParams.get('appointmentDateTimeISO');
      const inviteToken = urlParams.get('inviteToken'); // New parameter

      //   if (!telegramId || !sessionTypeId || !appointmentDateTimeISO) { /* ... existing error ... */ }

      //   // ... existing hidden field population ...
      //   document.getElementById('telegramId').value = telegramId;
      //   document.getElementById('appointmentDateTimeValue').value = appointmentDateTimeISO;
      //   document.getElementById('sessionTypeValue').value = sessionTypeId;

      if (inviteToken) {
        document.getElementById('inviteTokenValue').value = inviteToken;
        console.log("Waiver initiated with inviteToken:", inviteToken);
        // Optional: UI change to indicate this is for an invited guest
        // const guestNoticeElement = document.getElementById('guestNotice');
        // if (guestNoticeElement) guestNoticeElement.textContent = "Completing waiver as an invited guest.";
      }

      //   // ... rest of existing onPageLoad logic (fetching session details, user data for pre-fill) ...
      // });
      ```
*   **CRUD Operations:** N/A.
*   **UX Flow:**
    1.  Invited friend is redirected from `join-session.html` to `waiver-form.html` with `inviteToken` in URL.
    2.  `waiver-form.html` loads. JS parses `inviteToken` along with other params.
    3.  Hidden `inviteTokenValue` field is populated.
    4.  (Optional) Minor UI cue indicates guest status.
    5.  Friend fills out and submits waiver. The `inviteToken` is included in the form data POSTed to `/api/submit-waiver`.
*   **Security:** `inviteToken` is passed via URL. The backend submission handler (PH6-30) will validate it.
*   **Testing:**
    *   **Manual:**
        *   Navigate to `waiver-form.html` with an `inviteToken` in the URL.
        *   Inspect page source/DOM to verify hidden field is populated.
        *   Submit the form (if backend is ready for PH6-30) and verify `inviteToken` is sent in payload.
    *   **Unit Tests (`waiver-form.js` if separated):**
        *   Test URL parsing logic for `inviteToken`.
        *   Test hidden field population.
*   **Data Management:** `inviteToken` is transiently stored in hidden field for submission.
*   **Logging & Error Handling:**
    *   Client-side JS: Log if `inviteToken` is found and populated.

**Data Flow Steps:**
1.  `waiver-form.html` loads with `...&inviteToken={tokenValue}` in URL.
2.  JS in `waiver-form.html` parses `inviteToken` from `URLSearchParams`.
3.  JS sets `value` of hidden input field `#inviteTokenValue` to the parsed token.
4.  When form is submitted, `inviteTokenValue` is included in the POST data to `/api/submit-waiver`.

**Key Edge Cases:**
*   `inviteToken` parameter is missing from URL: Form behaves as normal (for primary booker), hidden field remains empty. This is expected if primary booker is filling it.
*   `inviteToken` is present but invalid: Frontend doesn't validate it; backend (PH6-30) will handle validation upon submission.
---
### Feature: PH6-30: API & Waiver Submit: Handle Friend's Waiver (Update `SessionInvite`)

**Goal:**
Modify the `POST /api/submit-waiver` endpoint to handle waiver submissions from invited friends. If an `inviteToken` is present in the submission, the API must validate it, update the corresponding `SessionInvite` record (status, friend's name), and then proceed with common logic like notifying the admin. It should *not* create a new `Session` or GCal event for the friend, as they are joining the primary booker's existing session.

**API Relationships:**
*   Modifies existing endpoint: `POST /api/submit-waiver`.
*   Consumes `inviteToken` from the request body (populated by PH6-29).
*   **Internal Backend Integrations:**
    *   Database ([`src/core/prisma.js`](src/core/prisma.js:0)):
        *   Reads `SessionInvite` by `inviteToken`.
        *   Validates `SessionInvite.status` (e.g., must be 'pending' or 'accepted_by_friend').
        *   Updates `SessionInvite.status` to 'waiver_completed_by_friend'.
        *   Updates `SessionInvite.friendTelegramId` (if not already set) and `SessionInvite.friendNameOnWaiver` (from waiver form data).
        *   Reads `parentSession` for context (e.g., primary booker details for notifications).
    *   Telegram Notifier ([`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0)):
        *   To notify the primary booker that their friend has completed the waiver.
        *   To notify the admin about the friend's waiver completion.

**Detailed Requirements:**
*   **Requirement A (Conditional Logic based on `inviteToken`):** The `POST /api/submit-waiver` handler must check if `inviteToken` is present in the request body.
*   **Requirement B (Friend's Waiver Path - If `inviteToken` present):**
    1.  **Validate `inviteToken`:** Fetch `SessionInvite` by token. If not found or status is not suitable (e.g., already 'waiver_completed_by_friend' or 'declined_by_friend'), return an error.
    2.  **Update `SessionInvite`:**
        *   Set `status` to 'waiver_completed_by_friend'.
        *   Set `friendTelegramId` to the `telegramId` from the form submission (this is the friend's ID).
        *   Set `friendNameOnWaiver` to `firstName + " " + lastName` from the form.
    3.  **Store Friend's Waiver Data:** The full waiver data from the friend should be stored. This could be on the `SessionInvite` record itself (e.g., a new JSON field `friend_liability_form_data`) or in a separate related table if preferred for normalization. For simplicity, adding to `SessionInvite` might be acceptable initially.
    4.  **Notify Primary Booker:** Inform the primary booker that "[Friend's Name] has completed their waiver and will be joining your session."
    5.  **Notify Admin:** Inform admin: "INVITED GUEST CONFIRMED: [Friend's Name] (TGID: [Friend's TGID]) has completed waiver for [Primary Booker's Name]'s session on [Date] at [Time] (Invite Token: [Token])."
    6.  **API Response:** Return `{ success: true, message: "Waiver submitted successfully! Your spot is confirmed." }` to the friend's waiver form. No `redirectTo` for invite page here.
*   **Requirement C (Primary Booker's Waiver Path - If `inviteToken` NOT present):**
    *   The existing logic from PH6-17 (create `Session`, GCal event, edit bot message, conditional redirect to `invite-friends.html`) applies.
*   **Requirement D (No New Session/GCal for Friend):** Crucially, when processing a friend's waiver (identified by `inviteToken`), the API must *not* create a new `Session` record or a new Google Calendar event. The friend is joining the existing parent session.

**Implementation Guide:**

*   **Architecture Overview:**
    *   Major modification to the existing `POST /api/submit-waiver` handler in [`src/handlers/api/waiverApiHandler.js`](src/handlers/api/waiverApiHandler.js:0) or similar.
*   **DB Schema:**
    *   `SessionInvite` model may need a new field like `friendLiabilityFormData` (Json, nullable) if storing waiver data directly there.
*   **API Design (`POST /api/submit-waiver` - Request Body Update):**
    *   Request body now optionally includes `inviteToken`.
      ```json
      {
        "telegramId": "friendTelegramId_112233", // Friend's TG ID
        "sessionType": "session-type-uuid-1", // From parent session, passed via waiver form URL
        "appointmentDateTime": "2025-07-15T10:00:00.000Z", // From parent session
        "inviteToken": "invite-token-for-friend-abc", // << NEW OPTIONAL FIELD
        "firstName": "Alice", // Friend's name
        "lastName": "Smith",
        // ... rest of waiver fields ...
      }
      ```
*   **Backend Structure (Modified `handleSubmitWaiver`):**
    *   **Pseudocode Snippet (Illustrating the fork in logic):**
      ```javascript
      // Inside handleSubmitWaiver in src/handlers/api/waiverApiHandler.js
      // const { telegramId, sessionType: sessionTypeId, appointmentDateTime: appointmentDateTimeISO, inviteToken, firstName, lastName, liability_form_data, ...otherWaiverData } = req.body;

      if (inviteToken) {
        // --- Friend's Waiver Path (PH6-30) ---
        logger.info(`Processing waiver for invited friend with token: ${inviteToken}, friend TGID: ${telegramId}`);
        const sessionInvite = await prisma.sessionInvite.findUnique({
          where: { inviteToken },
          include: { parentSession: { include: { user: true, sessionType: true } } }
        });

        if (!sessionInvite) {
          return res.status(400).json({ success: false, message: "Invalid invite token." });
        }
        if (sessionInvite.status !== 'pending' && sessionInvite.status !== 'accepted_by_friend') { // Or other valid pre-waiver states
          return res.status(400).json({ success: false, message: "This invite has already been processed or is not in a valid state for waiver submission." });
        }

        // Update SessionInvite
        const updatedInvite = await prisma.sessionInvite.update({
          where: { id: sessionInvite.id },
          data: {
            status: 'waiver_completed_by_friend',
            friendTelegramId: BigInt(telegramId),
            friendNameOnWaiver: `${firstName} ${lastName}`,
            // friendLiabilityFormData: liability_form_data // Store waiver if schema updated
          }
        });
        logger.info(`SessionInvite ${updatedInvite.id} status updated to waiver_completed_by_friend for friend ${telegramId}`);

        // Notify Primary Booker
        const primaryBooker = sessionInvite.parentSession.user;
        const bookerMessage = `🎉 Good news! ${firstName} ${lastName} has completed their waiver and will be joining your ${sessionInvite.parentSession.sessionType.label} session.`;
        await telegramNotifier.sendUserNotification(primaryBooker.telegram_id, bookerMessage);

        // Notify Admin
        const adminMessage = `INVITED GUEST CONFIRMED: ${firstName} ${lastName} (TGID: ${telegramId}) completed waiver for ${primaryBooker.firstName}'s session (${sessionInvite.parentSession.sessionType.label} on ${new Date(sessionInvite.parentSession.appointment_datetime).toLocaleDateString()}). Invite Token: ${inviteToken}.`;
        await telegramNotifier.sendAdminNotification(adminMessage);
        
        return res.status(200).json({ success: true, message: "Waiver submitted successfully! Your spot is confirmed." });

      } else {
        // --- Primary Booker's Waiver Path (PH6-17 logic) ---
        logger.info(`Processing waiver for primary booker: ${telegramId}`);
        // ... existing logic to create Session, GCal event, edit bot msg, etc. ...
        // ... this existing logic will also determine if redirectTo for invite-friends.html is needed ...
      }
      ```
*   **CRUD Operations:**
    *   If `inviteToken`: Read `SessionInvite`, Update `SessionInvite`.
    *   If no `inviteToken`: Existing CRUD from PH6-17.
*   **UX Flow:**
    1.  Friend submits waiver form (which includes hidden `inviteToken`).
    2.  `POST /api/submit-waiver` receives data.
    3.  API detects `inviteToken`.
    4.  API validates token, updates `SessionInvite` status, name, stores waiver.
    5.  API notifies primary booker and admin.
    6.  API responds success to friend's waiver form. Friend's WebApp shows success and closes.
*   **Security:** Validate `inviteToken` thoroughly. Ensure friend's `telegramId` matches expectations if pre-associated.
*   **Testing:**
    *   **Backend (API Handler):**
        *   Test friend's waiver path: valid token, invalid token, token for already completed/declined invite. Verify `SessionInvite` updates, notifications.
        *   Test primary booker's path: ensure it still works as before.
        *   Verify NO new Session/GCal event is created for friend.
    *   **E2E:** Full flow: Primary booker invites -> Friend clicks link -> Accepts in bot -> Fills waiver -> Verifies `SessionInvite` updated, notifications sent, friend sees success.

**Data Flow Steps (Friend's Path):**
1.  Friend's waiver form POSTs to `/api/submit-waiver` with `inviteToken`.
2.  API handler sees `inviteToken`.
3.  Validates `inviteToken`, fetches `SessionInvite`.
4.  Updates `SessionInvite` (status, friend name, friend TGID, friend waiver data).
5.  Notifies primary booker.
6.  Notifies admin.
7.  Returns success JSON to friend's waiver form.

**Key Edge Cases:**
*   `inviteToken` submitted is invalid/expired/already used: API returns error to waiver form.
*   Friend submits waiver for an invite they previously declined: Logic should prevent this if status check is robust.
*   Primary booker's notification fails: Log, but friend's confirmation is still valid.
*   Admin notification fails: Log.
*   Conflict if friend's `telegramId` on waiver form doesn't match `friendTelegramId` if it was somehow pre-set on `SessionInvite` and meant to be immutable: Decide on validation strategy. Usually, the `telegramId` from the form submission (who is logged into TG for the WebApp) is authoritative for the friend.
---
### Feature: PH6-31: Bot: Friend's Confirmation Message (After Waiver)

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
### Feature: PH6-32: Invite Friends WebApp: Update UI for Friend's Status Change

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
### Feature: PH6-33: Bot: Notify Primary Booker of Friend's Waiver Completion

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
### Feature: PH6-34: Admin Notification: Friend Joins Session

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