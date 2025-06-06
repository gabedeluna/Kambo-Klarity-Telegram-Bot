# Phase 6 Friend Invitation Features Integration Plan

## Integration Strategy

After analyzing the existing Phase-6-Detailed-Specs-Refactored.md, I recommend **enhancing existing Features 8 and 9** rather than adding new features. This maintains the current 15-feature structure while incorporating all the missing friend invitation functionality.

## Feature 8 Enhancements: Advanced Invite Management System

### Current Coverage in Feature 8
✅ Basic invite-friends.html structure and functionality  
✅ Generate invite tokens and display existing invites  
✅ Basic copy link and Telegram sharing  
✅ Status refresh mechanism  

### Missing Components to Add

#### **Requirement I (Enhanced Sharing Options - PH6-26):**
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
    *   **SKIPS join-session.html** - friend goes directly to registration/waiver on Accept
    *   Update UI to "Shared via Telegram ✔️" on successful switch
    *   Disable share buttons and move to top of invite list

*   **Two-Path Sharing Strategy:**
    *   **Rich Sharing Path**: "Share on Telegram (Rich)" → inline query → direct bot interaction
    *   **Link Sharing Path**: "Copy Link" & "Share via Other" → join-session.html landing page
    *   Both paths lead to same final destination but different user experiences

## Feature 9 Enhancements: Complete Friend Onboarding System

### Current Coverage in Feature 9
✅ Basic `/start invite_{token}` deep link parsing and handling  
✅ API call to BookingFlowManager for friend flow initiation  
✅ Basic friend interaction with accept/decline buttons  

### Missing Components to Add

#### **Requirement G (Enhanced Friend Response API - PH6-29):**
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

*   **Bot Callback Query Handler for Rich Invites:**
    *   Handle `accept_invite_{token}` callback queries from rich sharing
    *   Process acceptance without join-session.html:
        1. Validate invite token and update SessionInvite status
        2. Check if friend is registered user
        3. If new user: Send registration form link directly
        4. If existing user: Send waiver form link directly
        5. Send notifications to primary booker and admin
    *   Handle `decline_invite_{token}` callback queries:
        1. Update SessionInvite status to declined
        2. Send confirmation to friend
        3. Notify primary booker and admin

## New Frontend Components Required

### **join-session.html Enhancements**
*   **Accept/Decline Button Integration:**
    *   "Accept Invite" button: POST to `/api/session-invites/:token/respond` with `{response: 'accepted'}`
    *   On success with `action === 'proceedToBot'`: `tg.openTelegramLink(response.deepLink)` then `tg.close()`
    *   "Decline Invite" button: POST with `{response: 'declined'}`
    *   On success: Show "Response sent" message, then `tg.close()`

### **Enhanced Friend Registration Flow**
*   **registration-form.html Parameter Support:**
    *   Support `inviteToken` and `friendTelegramId` URL parameters
    *   Modified registration flow for invited friends
    *   Post-registration redirect to waiver form with invite context

*   **form-handler.html Friend Flow Integration:**
    *   Enhanced friend waiver flow with invite token context
    *   Automatic session association for invited friends
    *   Streamlined UI for friends vs primary bookers

## API Endpoints to Add/Modify

### New Endpoints
```javascript
POST /api/session-invites/:token/respond     // Friend accepts/declines invite
GET /api/sessions/:sessionId/invite-context  // Enhanced with stepper data
POST /api/sessions/:sessionId/generate-invite-token // Enhanced with stepper logic
```

### Enhanced Endpoints
```javascript
GET /api/booking-flow/start-invite/:inviteToken // Enhanced for friend registration flow
POST /api/booking-flow/continue                 // Enhanced friend waiver processing
```

## Database Schema Enhancements

No additional schema changes required - existing `SessionInvite` model supports all functionality.

## Bot Integration Enhancements

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

### Enhanced Callback Query Handler
```javascript
// Handle accept_invite_{token} and decline_invite_{token} callbacks
// Process friend responses and update SessionInvite status
// Send appropriate notifications to all parties
```

## Implementation Dependencies

1. **Database Foundation**: Requires proper `SessionInvite` model (Feature 7)
2. **Core BookingFlowManager**: Requires enhanced waiver processing (Feature 6)
3. **API Infrastructure**: Requires booking flow APIs (Feature 2)
4. **Frontend Foundation**: Requires existing form-handler.html (Feature 5)

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

This integration plan maintains the existing architectural consistency while adding comprehensive friend invitation functionality across the entire system.