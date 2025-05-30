# Kambo Klarity - Phase 6 (A, B, C) Design Brief

This document outlines the design brief for the active and upcoming sub-phases of Phase 6 for the Kambo Klarity Telegram assistant:
*   **Phase 6A:** MVP - Client Booking Core via Calendar APP
*   **Phase 6B:** "Invite Friends" - Initial Setup & Invite Generation
*   **Phase 6C:** "Invite Friends" - Sharing & Friend Acceptance (Basic)

It details the aesthetic principles, practical considerations, project context, and functional design for each feature within these sub-phases.

## Design Brief

### Aesthetics

*   Bold simplicity with intuitive navigation creating frictionless experiences.
*   Breathable whitespace complemented by strategic color accents for visual hierarchy.
*   Strategic negative space calibrated for cognitive breathing room and content prioritization.
*   Systematic color theory applied through subtle gradients and purposeful accent placement.
*   Typography hierarchy utilizing weight variance and proportional scaling for information architecture.
*   Visual density optimization balancing information availability with cognitive load management.
*   Motion choreography implementing physics-based transitions for spatial continuity.
*   Accessibility-driven contrast ratios paired with intuitive navigation patterns ensuring universal usability.
*   Feedback responsiveness via state transitions communicating system status with minimal latency.
*   Content-first layouts prioritizing user objectives over decorative elements for task efficiency.
*   **Inspiration:** The design of [`public/calendar-app.html`](public/calendar-app.html:0) serves as a primary inspiration, particularly its dark theme, use of a dynamic video background (requested for the waiver form and implemented in the calendar, to be continued in [`public/waiver-form.html`](public/waiver-form.html:0) and other new Mini-Apps like `invite-friends.html` and `join-session.html`), frog motif, and clean, modern layout achieved with Tailwind CSS. Subtle animations and clear visual feedback are key.

### Practicalities

*   **Project Goal (Overall):** Build a scalable, observable, feature-rich Telegram assistant for Kambo Klarity, emphasizing community building, intelligent scheduling, streamlined registration/waiver processes, and comprehensive admin management tools, as outlined in [`PLANNING.md`](PLANNING.md:8).
*   **Current Phase Focus (6A, 6B, 6C):**
    *   **Phase 6A (MVP):** Enable a single client to fully book a session: select type via bot -> open calendar app ([`public/calendar-app.html`](public/calendar-app.html:0)) -> pick date/time -> transition to waiver app ([`public/waiver-form.html`](public/waiver-form.html:0)) -> submit waiver. Session created in DB & GCal. Admin notified. Bot message updates to final confirmation (frog pic). (Reference: [`PLANNING.md`](PLANNING.md:239), [`PLANNING.md`](PLANNING.md:248)).
    *   **Phase 6B (Invite Friends - Setup):** Allow the primary booker, after their own booking is confirmed, to generate and see shareable invite links for friends via a dedicated WebApp page (`invite-friends.html`). This involves DB updates, API changes, and new UI for invite generation. (Reference: [`PLANNING.md`](PLANNING.md:241)).
    *   **Phase 6C (Invite Friends - Sharing & Acceptance):** Enable sharing of invite links and the friend's acceptance flow, including a landing page (`join-session.html`), API updates, and bot deep link handling for friend onboarding. (Reference: [`PLANNING.md`](PLANNING.md:243)).
*   **Target Users:**
    *   **Clients:** Individuals seeking Kambo sessions, interacting primarily through the Telegram bot and associated Mini-Apps (Calendar, Waiver, Invite Friends, Join Session).
    *   **Admins:** Practitioners or Kambo Klarity staff managing sessions, clients, availability, and other administrative tasks.
*   **Key Technologies & Stack:** (Consistent with overall project)
    *   Runtime: Node.js (ES2020, CommonJS)
    *   Bot Framework: Telegraf for Telegram
    *   Web Framework: Express 4
    *   Database: PostgreSQL with Prisma ORM ([`src/core/prisma.js`](src/core/prisma.js:0))
    *   Frontend (Mini-Apps): Vanilla JavaScript, HTML5, CSS3 (Tailwind CSS via CDN). New pages (`invite-friends.html`, `join-session.html`) will follow the style of [`public/calendar-app.html`](public/calendar-app.html:0).
    *   Scheduling: Custom logic with `date-fns`, `date-fns-tz`, and live Google Calendar API ([`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0)).
*   **Design Philosophy (Derived):** Mobile-first, intuitive, frictionless, clear feedback, aesthetically pleasing (dark theme, video backgrounds, frog motif), performance-conscious.
*   **Development Constraints:** Files ≤ 500 lines, JSDoc, Conventional Commits.

### Context

*   **Project:** Kambo Klarity Telegram Assistant & Booking System.
*   **Foundation (Completed):** Phase 6 tasks PH6-01 through PH6-13 (detailed in [`TASK.md`](TASK.md:0)) are complete. This work established:
    *   Admin designation ([`bin/set_admin.js`](bin/set_admin.js:0)).
    *   Role-based command handling ([`src/handlers/commandHandler.js`](src/handlers/commandHandler.js:0), [`src/commands/registry.js`](src/commands/registry.js:0)).
    *   Database models for `SessionType` ([`prisma/schema.prisma`](prisma/schema.prisma:0)) and core DB access logic ([`src/core/sessionTypes.js`](src/core/sessionTypes.js:0)).
    *   Dynamic session type selection in the bot ([`src/tools/telegramNotifier.js`](src/tools/telegramNotifier.js:0), `/book` command in [`src/commands/client/book.js`](src/commands/client/book.js:0), callback handling in [`src/handlers/callbackQueryHandler.js`](src/handlers/callbackQueryHandler.js:0)).
    *   Live Google Calendar integration for availability ([`src/tools/googleCalendar.js`](src/tools/googleCalendar.js:0)).
    *   Supporting APIs: `GET /api/calendar/availability` and `GET /api/session-types/:id` ([`src/routes/api.js`](src/routes/api.js:0)).
    *   The initial dynamic calendar Mini-App ([`public/calendar-app.html`](public/calendar-app.html:0), [`public/calendar-app.js`](public/calendar-app.js:0), and its helper JS/CSS files).
*   **Current Design Focus:** This document provides the detailed functional design briefs for the features PH6-14 through PH6-34, covering the MVP booking completion (Phase 6A), and the "Invite Friends" functionality (Phases 6B and 6C), as specified in [`PLANNING.md`](PLANNING.md:263) (Section 11).

---

## Feature Functional Briefs (Phase 6A, 6B, 6C)

---
### PH6-14: Calendar Mini-App: Fetch Initial Session Details & Display Availability
*(Goal and Acceptance Criteria as per [`PLANNING.md`](PLANNING.md:265). This feature is foundational for the MVP flow and its design aspects are critical, even if marked complete in [`TASK.md`](TASK.md:23).)*

#### Screen: Calendar WebApp ([`public/calendar-app.html`](public/calendar-app.html:0)) - Dynamic Interaction
##### State: Initial Load & Data Fetch
*   **User Goals and Tasks:** Client expects to see the calendar populate with their chosen session type information and current availability seamlessly after clicking "Book Now" in Telegram.
*   **UI & UX Details:**
    *   **Loading Animation:** Upon entry, a visually subtle loading animation (e.g., a pulsing frog icon or a themed spinner as implemented in [`public/calendar-ui.js`](public/calendar-ui.js:262) `showLoadingAnimation`) is displayed to indicate data fetching. This should be non-jarring and align with the app's aesthetic.
    *   **Parameter Parsing:** [`public/calendar-app.js`](public/calendar-app.js:90) silently parses `telegramId` and `initialSessionTypeId` from the URL.
    *   **Session Details Fetch & Display:**
        *   [`public/calendar-app.js`](public/calendar-app.js:112) calls `fetchSessionTypeDetails` (from [`public/calendar-api.js`](public/calendar-api.js:33)) using `initialSessionTypeId`.
        *   The `sessionTypeNamePlaceholder` and `sessionTypeDurationPlaceholder` in [`public/calendar-app.html`](public/calendar-app.html:257) are updated with the fetched `label` and `durationMinutes`. This text should appear smoothly, perhaps with a gentle fade-in animation.
    *   **Availability Fetch:**
        *   [`public/calendar-data.js`](public/calendar-data.js:95) (`loadMonthOverview`) initiates fetching availability for the current month using the `sessionDurationMinutes` by calling `fetchMonthOverview` from [`public/calendar-api.js`](public/calendar-api.js:77).
        *   **Caching:** Client-side caching ([`public/calendar-api.js`](public/calendar-api.js:7), [`public/calendar-data.js`](public/calendar-data.js:6)) is used to speed up subsequent loads or month navigations.
    *   **Error Handling:** If API calls fail, [`public/calendar-ui.js`](public/calendar-ui.js:7) (`showError`) displays a user-friendly, non-intrusive error message (e.g., a temporary toast/banner that auto-dismisses or has a clear close option). The message should guide the user (e.g., "Could not load session details. Please try again or return to Telegram.").
*   **Animations:**
    *   Loading spinner/indicator.
    *   Smooth text population for session details.

##### State: Calendar Rendered with Availability
*   **User Goals and Tasks:** Client needs to easily identify which dates have available slots and select a preferred date.
*   **UI & UX Details:**
    *   **Calendar Grid Rendering:** [`public/calendar-ui.js`](public/calendar-ui.js:54) (`renderCalendar`) dynamically generates day cells.
        *   **Visual Distinction:** Days with available slots are visually distinct (e.g., brighter text color `faf0e6`, bold font, potentially a subtle background highlight or dot indicator, as per `.calendar-day.available` in [`public/calendar-app.html`](public/calendar-app.html:81)). Non-available days are muted (e.g., `rgba(245, 245, 220, 0.3)` color).
        *   **Today's Date:** Consider a subtle visual cue for the current day if it's in the displayed month.
    *   **Visual Hierarchy:** Available dates should clearly pop out against unavailable ones. The current month/year display (`currentMonthYear`) is prominent.
    *   **Feedback on Hover/Tap (Available Day):**
        *   Hover (desktop): Day cell subtly changes background (e.g., `rgba(83, 210, 44, 0.2)`), text color becomes accent green (`#53d22c`), and scales slightly (transform: `scale(1.1)`) as per [`public/calendar-app.html`](public/calendar-app.html:86).
        *   Tap (mobile): Provides immediate visual feedback of interaction before selection confirmation.
*   **Animations:**
    *   Smooth transition effects on hover/tap for available days.
    *   Calendar grid itself could fade in once data is ready, replacing the loading animation.

##### State: Date Selected
*   **User Goals and Tasks:** Client wants to see available time slots for their chosen date and confirm their date selection.
*   **UI & UX Details:**
    *   **Selection Feedback:** Clicking an available day calls `selectDate` in [`public/calendar-app.js`](public/calendar-app.js:22). The selected day receives a strong visual highlight (e.g., solid accent green background `#53d22c`, contrasting text color `#162013`, slight scale, shadow, as per `.calendar-day.selected` in [`public/calendar-app.html`](public/calendar-app.html:92)). Any previously selected day returns to its normal available state.
    *   **UI Update (Progressive Disclosure):**
        *   The "Select an available day" message (`selectDateMessage`) is hidden.
        *   The time picker container (`timePickerContainer`) becomes visible (e.g., slides or fades in).
        *   The booking summary text (`selectedBookingInfo`) updates to show the fully selected date (e.g., "Monday, June 10 - Select a time") or immediately with the first available/auto-selected time.
    *   **Time Slot Loading & Rendering:**
        *   [`public/calendar-app.js`](public/calendar-app.js:84) (`loadAndRenderTimeSlotsForDate`) uses `getSlotsForDate` (from [`public/calendar-api.js`](public/calendar-api.js:131)) to retrieve slots from `monthSlotData`.
        *   [`public/calendar-ui.js`](public/calendar-ui.js:117) (`renderTimeSlotsForDate`) populates the `timeSlotList`. Slots are formatted to the user's local time, including timezone abbreviation.
        *   If no slots are available for a selected *available* day (edge case, could happen if availability changes rapidly), the UI should clearly state "No time slots available for this date" in both the time scroller and booking summary. The submit button remains disabled.
*   **Animations:**
    *   Transition for selected day style.
    *   Time picker container animates into view.
    *   Time slots list populates smoothly.

##### State: Scrolling/Selecting Time Slot
*   **User Goals and Tasks:** Client needs to easily browse and select a specific time for their session.
*   **UI & UX Details:**
    *   **Scroll Interaction:** The `timeSlotList` is a vertically scrollable list. The central item in the viewport is considered "selected" or "focused". The `selectorBar` in [`public/calendar-app.html`](public/calendar-app.html:309) provides a persistent visual indication of the selection area.
    *   **Dynamic Feedback (Scroll-to-Select):** As the user scrolls, [`public/calendar-ui.js`](public/calendar-ui.js:169) (`setupTimeSlotScrollDisplay` and `updateTimeDisplay`) updates the `selectedBookingInfo` text in real-time to reflect the time slot currently aligned with the `selectorBar`. The `selectedTimeSlotISO` variable in [`public/calendar-app.js`](public/calendar-app.js:17) is updated when scrolling stops or a slot is centered.
    *   **Visual Highlight:** The centered time slot receives a distinct visual style (e.g., background color `#53d22c`, contrasting text `#162013`, rounded corners, shadow, as per `.time-slot-item.selected` in [`public/calendar-app.html`](public/calendar-app.html:108)). Other slots are less prominent.
    *   **Haptic Feedback (Mobile):** Consider subtle haptic feedback on mobile devices as slots snap into the central selected position.
    *   **Submit Button State:** The "Submit" button (`submitBookingButton`) is enabled once a valid time slot is selected/centered. Its text updates to "Book for {Time}" (e.g., "Book for 10:00 AM"). This is handled in [`public/calendar-app.js`](public/calendar-app.js:77) logic.
*   **Animations:**
    *   Smooth scrolling of time slots.
    *   Real-time update of `selectedBookingInfo` text.
    *   Visual transition for time slots moving into/out of the selected state.
    *   The `pulseGreen` animation on the enabled submit button ([`public/calendar-app.html`](public/calendar-app.html:127)) draws attention.
    *   CSS mask gradient on `time-scroll-container` ([`public/calendar-app.html`](public/calendar-app.html:58)) creates a fade effect for items scrolling in/out of view.

##### State: Month Navigation (Prev/Next Month buttons clicked)
*   **User Goals and Tasks:** Client wants to view availability for adjacent months.
*   **UI & UX Details:**
    *   **Action:** Clicking `prevMonthButton` or `nextMonthButton` ([`public/calendar-app.html`](public/calendar-app.html:266)).
    *   **Feedback:** Buttons provide visual feedback on click (e.g., scale transform).
    *   **State Update:** `currentMonth` and `currentYear` in [`public/calendar-app.js`](public/calendar-app.js:147) are updated. `selectedDate`, `selectedTimeSlotISO` are reset.
    *   **UI Reset:** Time picker is hidden. "Select an available day" message is shown. Booking info text and submit button are reset to initial states.
    *   **Data Fetch & Render:** `loadMonthOverview` ([`public/calendar-data.js`](public/calendar-data.js:72)) is called. If data is not cached or stale, a loading animation is shown while fetching. Then `renderCalendar` ([`public/calendar-ui.js`](public/calendar-ui.js:54)) updates the grid.
*   **Animations:**
    *   Loading animation if fetching new month data.
    *   Calendar grid updates (potentially with a quick fade transition between month views).
*   **Performance:** Preloading of adjacent months ([`public/calendar-data.js`](public/calendar-data.js:31)) aims to make this transition feel instant if data is ready.

---
### PH6-15: Calendar Mini-App: Transition to Waiver Form on "Submit"
*(Goal and Acceptance Criteria as per [`PLANNING.md`](PLANNING.md:278))*

#### Screen: Calendar WebApp ([`public/calendar-app.html`](public/calendar-app.html:0))
##### State: User clicks "Submit" button (after a valid slot is selected and PH6-14 final validation passes)
*   **User Goals and Tasks:** Client wants to proceed to the next step (waiver) after confirming their chosen date and time.
*   **UI & UX Details:**
    *   **Pre-condition:** `selectedTimeSlotISO` is populated, `selectedDate` is set, and the `submitBookingButton` is enabled. The final client-side slot validation from PH6-14 (`validateSlotAvailability` in [`public/calendar-api.js`](public/calendar-api.js:160)) has just passed.
    *   **Action:** User clicks the `submitBookingButton`.
    *   **Feedback:**
        *   The button text might briefly change to "Proceeding..." or show a subtle loading indicator within the button.
        *   The primary feedback is the navigation to the waiver form.
    *   **Data Gathering:** [`public/calendar-app.js`](public/calendar-app.js:267) (inside the submit handler, after successful `isStillAvailable` check) gathers `telegramId`, `initialSessionTypeId` (as `sessionTypeId`), and the `selectedTimeSlotISO`.
    *   **Client-Side Redirect:**
        *   `window.location.href` is set to: `waiver-form.html?telegramId={tgId}&sessionTypeId={sTypeId}&appointmentDateTimeISO={slotISO}`.
        *   The base URL for `waiver-form.html` (e.g., `https://yourdomain.com/public/`) should be configurable or dynamically determined (e.g., from `process.env.FORM_URL` if this JS is ever templated, or assumed relative if always served from same origin).
*   **Animations:** Standard browser page load transition.
*   **Error Prevention:** This step only occurs if a slot is selected and has passed the final validation. If `telegramId`, `initialSessionTypeId`, or `selectedTimeSlotISO` are missing, the redirect should not occur, and an error should be shown (though this should be caught by earlier button disable logic).
*   **Performance:** The redirect should be immediate.

---
### PH6-16: Waiver Form: Adapt to Receive & Use Calendar Data
*(Goal and Acceptance Criteria as per [`PLANNING.md`](PLANNING.md:286))*

#### Screen: Waiver Form WebApp ([`public/waiver-form.html`](public/waiver-form.html:0))
##### State: Page Loaded (Receiving context from Calendar App)
*   **User Goals and Tasks:** Client expects to see context about their selected appointment and have some personal details pre-filled to streamline the waiver process.
*   **UI & UX Details:**
    *   **Parameter Parsing:** On load, JavaScript within [`public/waiver-form.html`](public/waiver-form.html:1088) parses `telegramId`, `sessionTypeId`, and `appointmentDateTimeISO` from the URL query parameters.
    *   **Loading State:** While fetching data, placeholders or subtle loading indicators can be shown for:
        *   Appointment details section (`appointmentInfo` div).
        *   Personal information fields that will be pre-filled.
    *   **Data Fetching (Concurrent):**
        *   **User Details:** Call `GET /api/user-data?telegramId={telegramId}` to fetch the user's registration data (name, email, phone, DOB, emergency contact). (API endpoint defined in [`src/routes/api.js`](src/routes/api.js:0), likely handled by [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0) or a specific user API handler).
        *   **Session Type Details:** Call `GET /api/session-types/{sessionTypeId}` (API from PH6-12) to get the session `label`.
    *   **UI Update with Fetched Data:**
        *   **Appointment Context:** The `appointmentInfo` div ([`public/waiver-form.html`](public/waiver-form.html:17)) is populated:
            *   `appointmentDateTime`: Displays the `appointmentDateTimeISO` formatted into a user-friendly string (e.g., "Monday, June 10, 2025 at 10:00 AM PST"). This formatting should ideally happen client-side for user's local timezone.
            *   `sessionType`: Displays "Session Type: {Session Label}".
        *   **Pre-fill Form Fields:**
            *   `firstName`, `lastName`, `email`, `phone`, `dob` fields ([`public/waiver-form.html`](public/waiver-form.html:910)) are pre-filled with data from `GET /api/user-data`.
            *   Emergency contact fields (`emergencyFirstName`, `emergencyLastName`, `emergencyPhone`) are also pre-filled if available.
        *   **Hidden Fields:**
            *   `telegramId` input is populated.
            *   `appointmentDateTimeValue` input is populated with the raw `appointmentDateTimeISO`.
            *   `sessionTypeValue` input is populated with `sessionTypeId`.
    *   **Visual Consistency:** The waiver form should adopt the same aesthetic as the calendar app: dark theme, video background (as per user inspiration: "I want to use the moving background in the waiver form"), similar typography (Manrope, Noto Sans from [`public/calendar-app.html`](public/calendar-app.html:11)), and button styles. The existing [`public/waiver-form.css`](public/waiver-form.css:0) provides a base but should be reviewed for consistency with [`public/calendar-app.html`](public/calendar-app.html:0) styling.
    *   **Error Handling:**
        *   If URL parameters are missing, display a clear error: "Invalid link. Please return to Telegram and try booking again."
        *   If API calls fail, display an error: "Could not load your details. Please try refreshing or contact support."
*   **Animations:**
    *   Subtle fade-in for fetched content (appointment details, pre-filled fields).
    *   Video background provides ambient motion.
*   **Microcopy:** Clear labels for all fields. Contextual information in the `appointmentInfo` div is crucial.

---
### PH6-17: API & Waiver Submit: Create Session, GCal Event, Edit Bot Msg to Final Confirmation
*(Goal and Acceptance Criteria as per [`PLANNING.md`](PLANNING.md:296))*

#### Screen: Waiver Form WebApp ([`public/waiver-form.html`](public/waiver-form.html:0))
##### State: User clicks "Submit Waiver Form"
*   **User Goals and Tasks:** Client wants to finalize their booking by submitting the completed waiver.
*   **UI & UX Details (Client-side in [`public/waiver-form.html`](public/waiver-form.html:1246)):**
    *   **Client-Side Validation:** Before submission, robust client-side validation (using JavaScript, potentially a library like PristineJS, which is present as [`public/pristine.min.js`](public/pristine.min.js:0) but not explicitly used in the provided HTML) ensures all required fields are filled (participant info, emergency contact, signature) and mandatory checkboxes (avoidance, substance, liability, electronic signature agreements) are checked.
        *   Invalid fields are highlighted (e.g., red border).
        *   Clear error messages appear near invalid fields.
        *   The first invalid field is focused.
    *   **Feedback During Submission:**
        *   The `submitButton` is disabled.
        *   Button text changes to "Submitting..." and a spinner icon appears (as styled in [`public/waiver-form.html`](public/waiver-form.html:1059)).
    *   **Data Collection:** All form data, including hidden fields (`telegramId`, `sessionTypeId` from `sessionTypeValue`, `appointmentDateTimeISO` from `appointmentDateTimeValue`) and the structured JSON of all waiver questions/answers, is collected.
    *   **API Call:** A `POST` request is made to `/api/submit-waiver` with the collected data in the JSON body.
*   **Animations:** Spinner animation on the submit button.

#### Screen: System Processing (Backend API: `POST /api/submit-waiver`)
##### State: API Receives Waiver Data
*   **Process (Handler likely in [`src/handlers/apiHandler.js`](src/handlers/apiHandler.js:0) or a dedicated waiver API handler):**
    1.  **Input Validation:** Server-side validation of all received data (Telegram ID, Session Type ID, DateTime ISO, waiver content).
    2.  **Create `Session` Record:**
        *   Using [`src/core/prisma.js`](src/core/prisma.js:0), create a new `Session` in the database.
        *   Fields: `telegram_id`, `session_type_id_fk` (maps to `SessionType.id`), `appointment_datetime` (parsed from `appointmentDateTimeISO` and stored as UTC DateTime), `status: 'CONFIRMED'`, `liability_form_data` (JSON blob of the entire waiver form content).
    3.  **Create Google Calendar Event:**
        *   Call [`googleCalendarTool.createCalendarEvent`](src/tools/googleCalendar.js:0).
        *   Parameters: `start` (from `appointmentDateTimeISO`), `end` (calculated by adding `SessionType.durationMinutes` to start time), `summary` (e.g., "{Client First Name} {Client Last Name} - {SessionType.label}"), `description` (e.g., "Booked via Kambo Klarity Bot. Waiver submitted.").
        *   Store the returned `googleEventId` on the newly created `Session` record.
    4.  **Fetch User's `edit_msg_id`:** Retrieve `edit_msg_id` for the `telegramId` from the `Users` table (this ID was stored in PH6-09).
    5.  **Fetch `SessionType.label`:** Get the label for the `sessionTypeId`.
    6.  **Edit Original Bot Message:**
        *   Use [`telegramNotifier.editMessageText`](src/tools/telegramNotifier.js:0) (or a method that supports sending a photo with a caption).
        *   Target message: The one identified by `user.edit_msg_id`.
        *   New content: A visually appealing confirmation.
            *   **Image:** A prominent frog picture (e.g., `public/frog.png` or a specific confirmation frog image). This might require `telegramNotifier` to use `sendPhoto` and then `editMessageCaption`, or use HTML formatting if the Telegram client supports images in edited messages well.
            *   **Text:** "✅ Your {SessionTypeLabel} session is confirmed for {Formatted Date & Time in Practitioner's Timezone}! We look forward to seeing you." (Date/Time needs to be formatted for the practitioner's timezone, which should be a system config).
        *   **Buttons:** No buttons on this message for the pure MVP (Phase 6A).
    7.  **Clear `edit_msg_id`:** Set `edit_msg_id = null` for the user in the `Users` table.
    8.  **Notify Admin:**
        *   Use [`telegramNotifier.sendAdminNotification`](src/tools/telegramNotifier.js:0).
        *   Message: "CONFIRMED BOOKING: Client {Client Name} (TGID: {telegramId}) for {SessionTypeLabel} on {Date} at {Time}. Waiver submitted."
    9.  **API Response to Waiver Form:**
        *   Return JSON: `{ success: true, message: "Booking Confirmed!" }`.
        *   (For Phase 6B, this response will be augmented with `redirectTo: '/invite-friends.html?sessionId=...'`).
*   **Error Handling (Robust):**
    *   If any step fails (DB write, GCal API error, Telegram API error for message edit):
        *   Log the detailed error using [`src/core/logger.js`](src/core/logger.js:0).
        *   Attempt to roll back or compensate if possible (e.g., if GCal event created but DB session fails, try to delete GCal event). This is complex.
        *   Return `{ success: false, message: "An error occurred while confirming your booking. Please contact support." }` to the client.
        *   Send a critical error notification to the admin with details of the failure.

#### Screen: Waiver Form WebApp ([`public/waiver-form.html`](public/waiver-form.html:0))
##### State: API Responds with Success
*   **User Goals and Tasks:** Client wants clear confirmation that their booking is complete and the waiver was successfully submitted.
*   **UI & UX Details (Client-side in [`public/waiver-form.html`](public/waiver-form.html:1423)):**
    *   On receiving `{ success: true }` from the API:
        *   Display a clear, positive success message on the page: "Booking Confirmed! Thank you. You will receive a confirmation in your Telegram chat."
        *   The submit button remains disabled, text could change to "Submitted!".
        *   After a short delay (e.g., 2-3 seconds) to allow the user to read the message, automatically call `tg.close()` to close the WebApp.
*   **Animations:** Success message can animate in. The closing of the WebApp is handled by Telegram.

##### State: API Responds with Error
*   **User Goals and Tasks:** Client needs to understand that the booking failed and what, if anything, they can do.
*   **UI & UX Details (Client-side in [`public/waiver-form.html`](public/waiver-form.html:1445)):**
    *   On receiving `{ success: false }`:
        *   Display the error message from the API (e.g., `data.message`). If no specific message, show a generic "Submission failed. Please try again or contact support."
        *   Re-enable the `submitButton` and revert its text to "Submit Waiver Form".
        *   The user remains on the waiver form, allowing them to retry or contact support.
*   **Error Prevention:** Providing clear error messages helps the user understand the issue.

#### Screen: Telegram Chat
##### State: Bot Message Updated to Final Confirmation
*   **User Goals and Tasks:** Client sees a persistent, final confirmation of their booking directly in their Telegram chat with the bot.
*   **UI & UX Details:**
    *   The bot message previously showing "You selected {Type}. [Book Now]" is edited.
    *   **Visuals:** A prominent frog image is displayed.
    *   **Text:** "✅ Your {SessionTypeLabel} session is confirmed for {Formatted Date & Time in Practitioner TZ}! We look forward to seeing you."
    *   **Clarity:** The message is unambiguous and celebratory.
*   **Aesthetic Appeal:** The frog image reinforces brand identity. The checkmark emoji adds a positive visual cue.
*   **Consistency:** The booking journey, which started in the bot, also concludes with a final confirmation in the bot.

---
### PH6-18 (was PH6-19): DB Updates for Invites
*(Goal and Acceptance Criteria as per [`PLANNING.md`](PLANNING.md:313))*

*   **Feature Goal:** Modify the database schema to support the "Invite Friends" functionality by adding capacity for group invites on availability rules and creating a new table to track individual session invites.
*   **Primary Interaction:** N/A (Backend - Database Schema).
*   **Impact on Design:**
    *   **`AvailabilityRule.max_group_invites`:**
        *   This new integer field (defaulting to a value like 3, not null) on the `AvailabilityRule` model in [`prisma/schema.prisma`](prisma/schema.prisma:0) determines how many additional guests a primary booker can invite for a session booked under that rule.
        *   This directly impacts the UI of `invite-friends.html` (PH6-21, PH6-23) by setting the upper limit for generating invite links.
        *   If `max_group_invites` is 0 or not set for a rule, the "Invite Friends" flow should be skipped or disabled for sessions booked under that rule.
    *   **`SessionInvite` Model:**
        *   This new table in [`prisma/schema.prisma`](prisma/schema.prisma:0) is central to tracking the lifecycle of each friend invitation.
        *   `id` (String, UUID, PK)
        *   `parentSessionId` (Int, FK to `Session.id`): Links the invite to the primary booker's session.
        *   `inviteToken` (String, Unique): A secure, unique token used in shareable links. Design consideration: ensure this token is sufficiently random and hard to guess.
        *   `status` (String, default "pending"): Tracks the invite state (e.g., "pending", "accepted_by_friend", "declined_by_friend", "waiver_completed_by_friend"). This status will drive UI changes in `invite-friends.html` (PH6-21) and `join-session.html` (PH6-27), and logic in API handlers.
        *   `friendTelegramId` (BigInt, Optional, Unique per `parentSessionId`): Stores the Telegram ID of the friend once they accept/interact via the bot. Making it unique per `parentSessionId` ensures one friend can't accept multiple slots for the same original booking.
        *   `friendNameOnWaiver` (String, Optional): Captured when the friend completes their waiver.
        *   `createdAt`, `updatedAt`: Standard timestamps.
    *   **Migration:** Running `npx prisma migrate dev` applies these changes. Seed data for `AvailabilityRule.max_group_invites` needs to be updated.
    *   **Design Implications:**
        *   The existence and value of `max_group_invites` will determine if the "Invite Friends" button appears on the primary booker's confirmation message (PH6-24) and if the `invite-friends.html` page is accessible/functional.
        *   The `SessionInvite` statuses will dictate what the primary booker sees on `invite-friends.html` (e.g., "Invite sent", "Accepted by {Name}", "Friend completed waiver") and what the invited friend sees on `join-session.html`.

---
### PH6-19 (was PH6-17 part): `/api/submit-waiver` Redirects to `invite-friends.html`
*(Goal and Acceptance Criteria as per [`PLANNING.md`](PLANNING.md:320))*

#### Screen: System Processing (Backend API: `POST /api/submit-waiver`)
##### State: API Successfully Processes Primary User's Waiver (and `max_group_invites > 0`)
*   **Process (Modification to PH6-17 API response):**
    *   After all steps in PH6-17 are successful (Session created, GCal event booked, admin notified, bot message edited):
    *   Fetch the `AvailabilityRule` associated with the `SessionType` of the booked `Session` to get `max_group_invites`.
    *   **Conditional Redirect Logic:**
        *   If `max_group_invites > 0` (and the "Invite Friends" feature is generally enabled):
            *   The API response to [`public/waiver-form.html`](public/waiver-form.html:0) is modified from just `{ success: true, message: "Booking Confirmed!" }` to:
                `{ success: true, message: "Booking Confirmed!", redirectTo: '/invite-friends.html?sessionId=' + newSession.id + '&telegramId=' + telegramId }`
                (Note: `newSession.id` is the ID of the `Session` record just created for the primary booker).
        *   Else (if `max_group_invites == 0` or feature disabled):
            *   The API responds as in pure MVP (Phase 6A): `{ success: true, message: "Booking Confirmed!" }` (no `redirectTo`).
*   **Impact on Design:** This change in API response is the trigger for navigating the primary booker to the "Invite Friends" page, initiating Phase 6B flow.

#### Screen: Waiver Form WebApp ([`public/waiver-form.html`](public/waiver-form.html:0))
##### State: API Responds with Success and `redirectTo`
*   **User Goals and Tasks:** Seamlessly transition from waiver submission to the "Invite Friends" page if applicable.
*   **UI & UX Details (Client-side JS modification in [`public/waiver-form.html`](public/waiver-form.html:1423)):**
    *   The JavaScript handling the successful submission response is updated:
        *   If `data.success` is true:
            *   Check if `data.redirectTo` exists in the response.
            *   If `data.redirectTo` exists:
                *   Perform `window.location.href = data.redirectTo;`. The user is navigated to `invite-friends.html` with the necessary `sessionId` and `telegramId` parameters.
            *   Else (no `redirectTo`):
                *   Display the "Booking Confirmed! Thank you." message.
                *   Call `tg.close()` after a short delay.
*   **Animations:** Standard browser page load transition to `invite-friends.html`.
*   **Error Prevention:** Ensures redirect only happens if the API explicitly provides the URL.

---
*I will continue with PH6-20 through PH6-34 in the next message if this structure is correct and you'd like me to proceed.*