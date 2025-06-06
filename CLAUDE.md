# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CRITICAL DATABASE PROTECTION RULES ⚠️

**NEVER DESTROY USER DATA - ABSOLUTE RULE:**
- **NEVER run database reset commands** (`--force-reset`, `db push --force-reset`, `migrate reset`, etc.) without explicit user permission and confirmed backup
- **NEVER run destructive database operations** without warning about data loss and getting explicit consent
- **ALWAYS ask permission before ANY database commands** that could affect existing data (migrations, seeds, resets)
- **ALWAYS suggest backup procedures** before risky operations
- **Data preservation is the highest priority** - user data is irreplaceable and sacred

**Historical Context:** During Feature 8 implementation, database reset commands were run that destroyed all user data and availability rules. This must NEVER happen again.

**Required Process for ANY database operations:**
1. Ask explicit permission before running ANY database command
2. Warn about potential data loss 
3. Suggest backup procedures
4. Get confirmed consent before proceeding
5. Use non-destructive approaches whenever possible

## Database MCP Server - Safe Database Operations

**Installation & Configuration:**
- **Installed**: `@modelcontextprotocol/server-postgres@0.6.2`
- **Config file**: `.mcpconfig.json` (contains database connection)
- **Binary**: `mcp-server-postgres`

**Available MCP Tools (PREFERRED for database operations):**
- `mcp__database__query` - Execute SELECT queries safely
- `mcp__database__schema` - Inspect database schema and tables
- `mcp__database__describe` - Get table structure and relationships

**Key Benefits:**
- **Built-in safety features** prevent accidental destructive operations
- **Structured access** to database through MCP protocol
- **Query validation** before execution
- **Schema inspection** without raw SQL commands
- **Connection management** with proper error handling

**Usage Priority:**
1. **FIRST**: Use MCP tools for database operations
2. **SECOND**: Use Prisma client methods in code
3. **LAST RESORT**: Direct database commands (WITH EXPLICIT PERMISSION ONLY)

## Common Development Commands

**Testing & Quality:**
- `npm test` - Run Jest test suite with coverage (70% minimum thresholds)
- `npm run lint` - ESLint validation
- `npm run format` - Prettier code formatting

**Development & Runtime:**
- `npm start` / `npm run dev` - Start the bot and web server
- `npm run webhook:set` - Configure Telegram webhook for development

**Database:**
- `npx prisma migrate dev` - Apply database migrations (⚠️ REQUIRES EXPLICIT PERMISSION)
- `npx prisma db seed` - Seed database with initial data (⚠️ REQUIRES EXPLICIT PERMISSION)
- **Database MCP Server** - Use MCP tools for safer database operations (PREFERRED METHOD)

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


### Two-Step Booking Design
1. **Placeholder Creation** - 15-minute Google Calendar reservation prevents race conditions
2. **Flow Initiation** - BookingFlowManager orchestrates based on SessionType configuration
3. **Completion** - Atomic session creation with proper error handling and rollback


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