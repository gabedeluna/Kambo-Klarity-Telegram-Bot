# Feature 9 Task List - Bot Deep Link & Friend Flow

## Overview
Feature 9 implements the Telegram bot's ability to handle `/start invite_{token}` deep links for friend invitations. This task list focuses on MVP implementation with simplicity and testability as primary goals.

## Prerequisites
- Completed Features 1-8 (BookingFlowManager, Friend Invitations, etc.)
- Working test environment with Jest
- Telegram bot webhook configured

## Task List

### Task 1: Create /start Command Handler Structure
**Priority**: High  
**Estimated Time**: 2 hours  
**Dependencies**: None

1. **Write Tests First** (`tests/commands/client/start.test.js`):
   - Test basic `/start` command without parameters
   - Test `/start` with `invite_{token}` pattern
   - Test `/start` with invalid patterns
   - Test error handling for missing dependencies

2. **Implement Handler** (`src/commands/client/start.js`):
   - Create `initializeStartCommandHandler(deps)` function
   - Create `handleStartCommand(ctx)` function
   - Parse `ctx.startPayload` for invite tokens
   - Add basic logging using injected logger

3. **Register Command**:
   - Add `start` entry to `src/commands/registry.js`
   - Import handler from new start.js file
   - Add command description

4. **Integration**:
   - Update command handler initialization in `src/app.js` if needed
   - Ensure dependencies are passed correctly

**Acceptance Criteria**:
- `/start` command responds to users
- Invite tokens are correctly extracted from deep links
- All tests pass

---

### Task 2: Implement Friend Invite Flow API Call
**Priority**: High  
**Estimated Time**: 3 hours  
**Dependencies**: Task 1

1. **Write Tests** (`tests/commands/client/start.test.js` - extend):
   - Mock API call to `/api/booking-flow/start-invite/{token}`
   - Test successful invite validation response
   - Test various error responses (expired, invalid, already accepted)
   - Test self-invite prevention

2. **Implement API Integration**:
   - Add fetch/axios call to BookingFlowManager API
   - Pass friend's Telegram ID as query parameter
   - Handle response and extract session details
   - Format invite details message

3. **Create Inline Keyboard**:
   - "View Invite & Accept ✨" WebApp button
   - "Decline Invite 😔" callback button
   - Use existing Markup patterns from codebase

**Acceptance Criteria**:
- API call validates invite tokens
- Appropriate messages shown for each invite state
- Inline keyboard appears for valid invites

---

### Task 3: Handle Decline Callback
**Priority**: Medium  
**Estimated Time**: 2 hours  
**Dependencies**: Task 2

1. **Write Tests** (`tests/handlers/callbackQueryHandler.test.js` - extend):
   - Test decline callback pattern recognition
   - Test API call to decline endpoint
   - Test notification sending
   - Test error scenarios

2. **Extend Callback Handler**:
   - Add pattern for `decline_invite_{token}` in `callbackQueryHandler.js`
   - Make API call to `/api/session-invites/{token}/respond`
   - Send confirmation message to friend
   - Update message to show declined status

3. **Add Notification**:
   - Use existing `telegramNotifier` to inform primary booker
   - Simple text message about declined invite

**Acceptance Criteria**:
- Decline button updates invite status
- Friend receives confirmation
- Primary booker is notified

---

### Task 4: Create Friend Response API Endpoint
**Priority**: High  
**Estimated Time**: 3 hours  
**Dependencies**: None (can be done in parallel)

1. **Write Tests** (`tests/routes/api/friendResponse.test.js`):
   - Test POST `/api/session-invites/:token/respond`
   - Test 'accepted' and 'declined' responses
   - Test invalid tokens
   - Test notification triggers

2. **Implement Endpoint** (in `src/routes/api.js`):
   - Add new POST route
   - Validate token and response type
   - Update SessionInvite record in database
   - Trigger notifications via telegramNotifier

3. **Database Updates**:
   - Set invite status to 'accepted' or 'declined'
   - Record response timestamp
   - Handle database errors gracefully

**Acceptance Criteria**:
- Endpoint updates invite status correctly
- Notifications are sent to relevant parties
- Proper error responses for invalid requests

---

### Task 5: Implement Basic Inline Query Handler
**Priority**: Medium  
**Estimated Time**: 3 hours  
**Dependencies**: None

1. **Write Tests** (`tests/handlers/inlineQueryHandler.test.js`):
   - Test inline query pattern matching `kbinvite_{token}`
   - Test result formatting
   - Test error handling for invalid tokens

2. **Create Handler** (`src/handlers/inlineQueryHandler.js`):
   - Initialize function accepting dependencies
   - Handle function processing inline queries
   - Extract invite token from query
   - Create single inline result with invite details

3. **Register with Bot**:
   - Add `bot.on('inline_query', handler)` in app.js
   - Ensure proper middleware ordering
   - Test inline query in Telegram

**Acceptance Criteria**:
- Inline queries return formatted invite cards
- Results are shareable in any chat
- Invalid tokens show appropriate message

---

### Task 6: Add StartApp Support to Form Handler
**Priority**: High  
**Estimated Time**: 2 hours  
**Dependencies**: None

1. **Write Tests** (`tests/public/form-handler.test.js` - extend):
   - Test start_param detection
   - Test invite context API call
   - Test form pre-filling for invited friends
   - Test fallback to normal flow

2. **Update form-handler.js**:
   - Check `window.Telegram.WebApp.initDataUnsafe.start_param`
   - Extract invite token from `invite_{token}` pattern
   - Call `/api/invite-context/{token}` if present
   - Pre-fill form with friend context
   - Show loading state during API call

**Acceptance Criteria**:
- Form detects StartApp parameters
- Invite context is loaded for friends
- Normal flow works when no invite present

---

### Task 7: Create Invite Context API Endpoint
**Priority**: Medium  
**Estimated Time**: 2 hours  
**Dependencies**: Task 6 (for testing)

1. **Write Tests** (`tests/routes/api/inviteContext.test.js`):
   - Test GET `/api/invite-context/:token`
   - Test valid token responses
   - Test invalid/expired tokens
   - Test response format

2. **Implement Endpoint** (in `src/routes/api.js`):
   - Add GET route for invite context
   - Fetch SessionInvite with session details
   - Return formatted context for form
   - Handle not found/expired cases

**Acceptance Criteria**:
- Endpoint returns invite and session details
- Form handler can use response to pre-fill
- Appropriate errors for invalid tokens

---

### Task 8: Integration Testing
**Priority**: High  
**Estimated Time**: 3 hours  
**Dependencies**: Tasks 1-7

1. **Write Integration Tests** (`tests/integration/friendInviteFlow.test.js`):
   - Test complete flow: click link → see invite → accept → complete waiver
   - Test decline flow
   - Test expired invite handling
   - Test self-invite prevention

2. **Manual Testing Checklist**:
   - [ ] Create session with group invites enabled
   - [ ] Generate invite link via mini-app
   - [ ] Click link as friend (different account)
   - [ ] Accept invite and complete waiver
   - [ ] Verify all notifications sent
   - [ ] Test decline flow
   - [ ] Test inline query sharing

**Acceptance Criteria**:
- End-to-end flow works seamlessly
- All edge cases handled gracefully
- No regression in existing features

---

### Task 9: Documentation and Cleanup
**Priority**: Low  
**Estimated Time**: 1 hour  
**Dependencies**: Tasks 1-8

1. **Update Documentation**:
   - Add inline comments to new handlers
   - Update command registry descriptions
   - Document new API endpoints

2. **Code Cleanup**:
   - Remove any console.logs
   - Ensure consistent error messages
   - Verify all files under 500 lines

3. **Update CHANGE-LOG.md**:
   - Document Feature 9 implementation
   - List all new files created
   - Note test coverage achieved

**Acceptance Criteria**:
- Code follows project conventions
- Documentation is clear
- Change log updated

---

## Testing Strategy

### Unit Tests
- Each handler function tested in isolation
- Mock all external dependencies
- Test both success and failure paths
- Aim for >80% code coverage

### Integration Tests
- Test complete user flows
- Use test database with fixtures
- Mock Telegram API responses
- Verify notification delivery

### Manual Testing
- Use Telegram test environment
- Test with multiple user accounts
- Verify mobile and desktop behavior
- Check all error scenarios

---

## File Structure (New/Modified)

```
src/
├── commands/
│   ├── client/
│   │   └── start.js [NEW]
│   └── registry.js [MODIFIED]
├── handlers/
│   ├── callbackQueryHandler.js [MODIFIED]
│   └── inlineQueryHandler.js [NEW]
├── routes/
│   └── api.js [MODIFIED]
└── app.js [MODIFIED]

tests/
├── commands/
│   └── client/
│       └── start.test.js [NEW]
├── handlers/
│   ├── callbackQueryHandler.test.js [MODIFIED]
│   └── inlineQueryHandler.test.js [NEW]
├── routes/
│   └── api/
│       ├── friendResponse.test.js [NEW]
│       └── inviteContext.test.js [NEW]
├── integration/
│   └── friendInviteFlow.test.js [NEW]
└── public/
    └── form-handler.test.js [MODIFIED]

public/
└── form-handler.js [MODIFIED]
```

---

## Notes for Junior Developer

1. **Start with Tests**: Write tests before implementation (TDD)
2. **Keep It Simple**: MVP focus - no premature optimization
3. **Use Existing Patterns**: Copy patterns from existing handlers
4. **Ask Questions**: If spec is unclear, ask before implementing

---

## Success Metrics

- [ ] All tests passing (100% pass rate)
- [ ] No regression in existing features  
- [ ] Friend can successfully join session via invite link
- [ ] All notifications delivered correctly
- [ ] Code review approved
- [ ] Deployed to staging environment

---
