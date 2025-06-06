# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

**Testing & Quality:**
- `npm test` - Run Jest test suite with coverage (70% minimum thresholds)
- `npm run lint` - ESLint validation
- `npm run format` - Prettier code formatting

**Development & Runtime:**
- `npm start` / `npm run dev` - Start the bot and web server
- `npm run webhook:set` - Configure Telegram webhook for development

**Database:**
- `npx prisma migrate dev` - Apply database migrations
- `npx prisma db seed` - Seed database with initial data

**Administration:**
- `npm run set-admin` - Designate admin users (interactive)
- `npm run set-commands` - Register bot commands with Telegram

## Architecture Overview

### Core System Design
This is a **Telegram bot with integrated web mini-apps** for Kambo healing session booking. The system uses a dependency injection pattern through `src/app.js` which orchestrates all components.

**Key Architecture Patterns:**
- **Dependency Injection**: All modules receive dependencies via `initializeApp(deps)`
- **JWT-based Flow Management**: Stateless booking flows using signed tokens
- **Test-Driven Development**: Tests written first, then implementation
- **500-line file limit**: Enforced for maintainability - break larger files into modules

### Core Components

**`src/core/`** - Singleton instances and core utilities:
- `prisma.js` - Database client
- `bot.js` - Telegraf bot instance  
- `logger.js` - Pino structured logging
- `env.js` - Environment configuration with validation
- `sessionTypes.js` - Dynamic session configuration loader

**`src/core/bookingFlow/`** - Dynamic booking orchestration:
- `bookingFlowManager.js` - Central flow orchestrator using JWT tokens
- `flowStepHandlers.js` - Individual flow step processors
- `flowTokenManager.js` - JWT token management for stateless flows

**`src/handlers/`** - Request/event processing:
- `commandHandler.js` - Telegram bot command routing
- `callbackQueryHandler.js` - Telegram inline button callbacks
- `registrationHandler.js` - User registration workflows
- `api/` - HTTP API handlers for mini-apps

**`src/tools/`** - Business logic utilities:
- `googleCalendar.js` - Calendar integration with placeholder management
- `telegramNotifier.js` - Notification orchestration
- `stateManager.js` - Temporary state management

### Database Architecture

**Core Models:**
- `users` - Client profiles with Telegram integration
- `sessions` - Appointments with Google Calendar linkage  
- `SessionType` - Dynamic session configurations with flow control
- `SessionInvite` - Group booking invitation system
- `AvailabilityRule` - Practitioner scheduling constraints

**Enhanced SessionType Features:**
```javascript
{
  waiverType: "KAMBO_V1" | "NONE",           // Dynamic waiver requirements
  allowsGroupInvites: boolean,               // Group session capability  
  maxGroupSize: number,                      // Participant limits
  customFormDefinitions: JSON               // Future dynamic forms
}
```

### Frontend Mini-Apps (public/)

**Calendar Application** (`calendar-app.html`):
- Progressive disclosure: Date → Time → Confirmation
- Real-time Google Calendar availability checking
- Mobile-optimized with touch interactions
- 15-minute placeholder reservations

**Form Handler** (`form-handler.html`):
- Dynamic form rendering based on `SessionType.waiverType`
- Digital signature canvas support
- User data pre-filling via API integration
- Conditional logic for primary vs invited friend flows

**Booking Flow Integration:**
- URL parameter-based state transfer between mini-apps
- JWT flow tokens for stateless orchestration
- Automatic Telegram WebApp closure on completion

## Development Patterns

### Testing Strategy
- **Jest with 70% coverage minimum** across all modules
- **Test structure mirrors src structure** in `tests/` directory
- **Mock external dependencies** (Google Calendar, Telegram API)
- **Integration tests** for complex workflows in `tests/integration/`

### Code Organization Rules
- **Maximum 500 lines per file** - break into modules in subdirectories
- **Comprehensive JSDoc** documentation for all public functions
- **TDD approach** - write tests first, then implement
- **Conventional commits** for structured git history

### Google Calendar Integration
The `GoogleCalendarTool` class handles:
- **Placeholder Management**: 15-minute temporary reservations
- **Real-time Availability**: Live slot checking during booking
- **Event Lifecycle**: Create/update/delete with proper error handling
- **Timezone Handling**: Practitioner-centric scheduling

### Error Handling
- **Centralized error processing** via `src/middleware/errorHandler.js`
- **Structured logging** with Pino for debugging
- **Graceful degradation** - system continues during partial failures
- **Admin notifications** for critical errors via Telegram

### Environment Configuration
Required environment variables (see `.env.example`):
- `TELEGRAM_BOT_TOKEN` - Bot authentication
- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_CALENDAR_CREDENTIALS` - Service account JSON
- `JWT_SECRET` - Flow token signing key
- `WEBHOOK_SECRET` - Telegram webhook validation

## Known Issues & Technical Debt

### Security & Reliability Issues
- **Weak JWT Security**: Fallback secret "fallback-secret-for-development" in production poses security risk

### Code Quality Improvements Needed
- **Database Naming Inconsistency**: Mixed conventions (`users` vs `SessionType` vs `AvailabilityRule`)
- **Frontend Modularization**: Large files could benefit from breaking into modules
- **Input Validation**: Consider centralizing validation with Zod schemas (already a dependency)
- **Error Information Leakage**: Some API responses expose internal details in error messages

### Long-term Architecture Considerations
- **API Versioning Strategy**: Consider implementing for future-proofing
- **Performance Monitoring**: Add observability for production deployments
- **Automated Security Scanning**: Integrate into CI/CD pipeline
- **Token Rotation**: Consider implementing for enhanced JWT security

## Phase 6: Enhanced Booking Flow System

### Overview
Phase 6 implements a **BookingFlowManager** system that orchestrates dynamic booking and group invitation flows using JWT-based stateless flow management with a two-step booking process.

### Phase 6 Features Status
- ✅ **Feature 1**: BookingFlowManager Core Module (JWT-based orchestration)
- ✅ **Feature 2**: API Endpoints for Flow Management (`/api/booking-flow/*`)
- ✅ **Feature 3**: Enhanced SessionType Model (dynamic flow configuration)
- ✅ **Feature 4**: Refactored Calendar App (two-step booking with placeholders)
- ✅ **Feature 5**: Generic Form Handler Mini-App (dynamic form rendering)
- ❌ **Feature 6**: Waiver Processing Logic (friend invitation flows - NEEDS IMPLEMENTATION)

### Core Architecture

#### BookingFlowManager System
- **Central orchestrator** for all booking and invitation flows
- **JWT-based stateless design** - flow state encoded in signed tokens
- **Two-step booking**: placeholder creation → flow initiation → completion
- **Dynamic routing** based on SessionType configuration (`waiverType`, `allowsGroupInvites`, `maxGroupSize`)

#### Database Schema Requirements
- ✅ Enhanced `SessionType` with dynamic flow fields
- ⚠️ Legacy `sessions` table (needs migration to proper `Session` model with relations)
- ❌ Missing `SessionInvite` model (required for friend invitation system)

#### Frontend Mini-Apps
- ✅ `calendar-app.html` - Two-step booking with placeholder creation
- ✅ `form-handler.html` - Generic form rendering (primary + friend waivers)
- ❌ `invite-friends.html` - Friend invitation management (Feature 6)
- ❌ `join-session.html` - Friend invitation acceptance (Feature 6)

### Critical Implementation Gaps

#### Feature 6: Waiver Processing Logic
**Missing Components:**
- **Friend waiver submission processing** - Update `SessionInvite`, Google Calendar events, notifications
- **Primary booker completion logic** - Session creation, calendar events, conditional friend invitation redirect
- **Multi-party notification system** - Friend, primary booker, and admin notifications
- **Group session management** - Calendar event title/description updates for groups

#### Database Migration Required
- **`SessionInvite` model** for friend invitation tracking with status management
- **Proper `Session` model** with foreign key relations to `SessionType` and `SessionInvite`
- **Migration from legacy `sessions` table** without data loss

### Flow Token Structure (JWT)
Contains essential flow context: `userId`, `flowType`, `sessionTypeId`, `appointmentDateTimeISO`, `placeholderId`, `parentSessionId`, `inviteToken` - signed with short expiry for security.

### Two-Step Booking Design
1. **Placeholder Creation** - 15-minute Google Calendar reservation prevents race conditions
2. **Flow Initiation** - BookingFlowManager orchestrates based on SessionType configuration
3. **Completion** - Atomic session creation with proper error handling and rollback

## Key Development Considerations

### Booking Flow Architecture
The system uses **JWT-based stateless flows** rather than server-side session storage:
- Flow state encoded in signed tokens passed between mini-apps
- 1-2 hour token expiry for security
- Support for primary booking and friend invitation flows
- Dynamic routing based on `SessionType` configuration

### Mini-App Integration Patterns
- **Deep linking**: `/start invite_{token}` for friend invitations
- **WebApp parameters**: State transfer via URL query parameters  
- **Auto-close behavior**: Programmatic mini-app closure on completion
- **Back button handling**: Custom behavior per flow context

### Database Migration Strategy
- Use Prisma migrations: `npx prisma migrate dev --name description`
- Seed data available via `npm run db:seed`
- Enhanced `SessionType` model supports dynamic form definitions
- `SessionInvite` model enables group booking workflows