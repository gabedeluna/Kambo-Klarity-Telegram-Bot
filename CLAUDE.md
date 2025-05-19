# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development

```bash
# Install dependencies
npm install

# Start both bot and form server (development mode)
npm run dev

# Start bot only
npm run start

# Start form server only
npm run start:server

# Set webhook (for development)
npm run webhook:set
```

### Testing (with Jest)

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch

# Run a specific test file
npm test -- path/to/test.js

# Update snapshots
npm test -- -u
```

### Code Quality

```bash
# Run ESLint
npm run lint

# Format code with Prettier
npm run format
```

### Database

```bash
# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Open Prisma Studio
npx prisma studio
```

### Bot Administration

```bash
# Set a user as admin
npm run set-admin

# Set default commands for the bot
npm run set-commands
```

## GitHub Workflow

### Branching Strategy

This project follows a Git Flow approach with the following branches:

- `main`: Production-ready code
- `develop`: Main development branch, all feature branches are merged here
- `feature/FEATURE-NAME`: New features (branch from `develop`)
- `bugfix/ISSUE-NUMBER`: Bug fixes (branch from `develop`)
- `release/VERSION`: Release candidates (branch from `develop`)
- `hotfix/ISSUE-NUMBER`: Critical production fixes (branch from `main`)

### Workflow Steps

1. **Feature Development**:
   ```bash
   # Create a feature branch from develop
   git checkout develop
   git pull
   git checkout -b feature/PH6-XX-feature-name
   
   # Make changes, commit, and push
   git add .
   git commit -m "feat(PH6-XX): Implement feature"
   git push -u origin feature/PH6-XX-feature-name
   
   # Create a pull request to develop
   # After review and approval, merge to develop
   ```

2. **Bug Fixes**:
   ```bash
   # Create a bugfix branch from develop
   git checkout develop
   git pull
   git checkout -b bugfix/ISSUE-NUMBER-description
   
   # Make changes, commit, and push
   git add .
   git commit -m "fix: Resolve issue #ISSUE-NUMBER"
   git push -u origin bugfix/ISSUE-NUMBER-description
   
   # Create a pull request to develop
   ```

3. **Release Process**:
   ```bash
   # Create a release branch from develop
   git checkout develop
   git pull
   git checkout -b release/X.Y.Z
   
   # Make final adjustments, bump version
   git add .
   git commit -m "chore: Prepare release X.Y.Z"
   git push -u origin release/X.Y.Z
   
   # After testing, merge to main and develop
   git checkout main
   git merge release/X.Y.Z --no-ff
   git tag -a vX.Y.Z -m "Release X.Y.Z"
   git push origin main --tags
   
   git checkout develop
   git merge release/X.Y.Z --no-ff
   git push origin develop
   
   # Delete release branch
   git branch -d release/X.Y.Z
   git push origin --delete release/X.Y.Z
   ```

4. **Hotfixes**:
   ```bash
   # Create a hotfix branch from main
   git checkout main
   git pull
   git checkout -b hotfix/ISSUE-NUMBER-description
   
   # Make urgent fixes, commit, and push
   git add .
   git commit -m "fix: Critical fix for issue #ISSUE-NUMBER"
   git push -u origin hotfix/ISSUE-NUMBER-description
   
   # After testing, merge to main and develop
   git checkout main
   git merge hotfix/ISSUE-NUMBER-description --no-ff
   git tag -a vX.Y.Z+1 -m "Hotfix X.Y.Z+1"
   git push origin main --tags
   
   git checkout develop
   git merge hotfix/ISSUE-NUMBER-description --no-ff
   git push origin develop
   
   # Delete hotfix branch
   git branch -d hotfix/ISSUE-NUMBER-description
   git push origin --delete hotfix/ISSUE-NUMBER-description
   ```

## Jest Testing Setup

### Configuration

The project uses Jest for testing with the following configuration:

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['./jest.setup.js'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

### Mocking Guidelines

1. **HTTP Requests**: Use `jest-fetch-mock` or `nock` for API calls
2. **Database**: Use `@shelf/jest-mongodb` or mock the Prisma client
3. **Telegram API**: Mock the Telegraf instance
4. **Environment**: Use a `.env.test` file for test-specific variables

### Testing Structure

Organize tests following the same structure as the source files:

```
src/
  feature/
    component.js
    component.test.js
```

### Testing Standards

1. **Descriptive Test Names**: Use the pattern "it should..." for test descriptions
2. **Isolation**: Each test should be independent and not rely on other tests
3. **Mocking Dependencies**: Use Jest's mocking capabilities to isolate components
4. **Code Coverage**: Aim for at least 80% coverage for all components
5. **Snapshots**: Use for complex UI structures or response objects

## Environment Variables

The application requires the following environment variables:

```
# Always required
TG_TOKEN             # Telegram Bot Token
DATABASE_URL         # PostgreSQL connection string
FORM_URL             # URL for the registration form
LANGCHAIN_API_KEY    # LangChain API key
NGROK_URL            # Ngrok URL for local development

# Provider-specific (based on AI_PROVIDER)
AI_PROVIDER          # 'openai' (default) or 'gemini'
OPENAI_API_KEY       # Required when AI_PROVIDER=openai
GOOGLE_API_KEY       # Required when AI_PROVIDER=gemini

# Optional
PORT                 # Server port (default: 3000)
APP_URL              # Production URL for webhook
NODE_ENV             # 'development' (default), 'test', or 'production'
```

## Architecture Overview

The Kambo Klarity Telegram Bot is a Node.js application that handles:

1. User registration via Telegram mini-app forms
2. Session booking via calendar integration
3. Waiver form completion
4. Admin functionality for managing sessions and users

### Core Components

- **Express Server (`app.js`, `bin/server.js`)**: Handles HTTP requests, webhooks, and serves static files
- **Telegram Bot (`core/bot.js`)**: Manages interactions with the Telegram Bot API
- **Command System (`commands/`)**: Role-based command handlers
- **Database (`prisma/`)**: PostgreSQL via Prisma ORM
- **Tools (`tools/`)**: Utilities for common operations (Google Calendar, state management, Telegram notifications)
- **Middleware (`middleware/`)**: Request processing pipeline, including user lookup and update routing
- **Routes (`routes/`)**: API endpoints for forms and data

### Key Workflows

#### User Registration Flow

1. New users are prompted to fill out a registration form
2. Form submission stores user data in the database
3. Users are assigned the 'client' role by default
4. The bot acknowledges successful registration

#### Booking Flow

The booking flow uses a calendar mini-app approach:

1. Client uses `/book` command to see session type options
2. Session types are filtered based on user permissions (e.g., 3x3 Kambo requires previous sessions)
3. After selecting a session type, users get a "Book Now" button linking to the calendar app
4. The calendar app shows available slots based on Google Calendar availability
5. After selecting a slot, user is sent a waiver form link
6. Upon waiver completion, the session is confirmed and added to Google Calendar

### Graph-Based AI Conversation (For agent-based flows)

Some interactions use a stateful graph implemented with LangGraph:

- **State (`graph/state.js`)**: Tracks information like user input, agent decisions, availability, and errors
- **Nodes (`graph/nodes.js`)**: Actions within the flow that invoke the agent or tools
- **Edges (`graph/edges.js`)**: Conditional functions that route the flow based on the current state
- **Graph Assembly (`graph/bookingGraph.js`)**: Defines the graph structure

The AI provider is configurable via the `AI_PROVIDER` environment variable ('openai' for GPT-4 Turbo, 'gemini' for Gemini 1.5 Flash).

## Testing Strategy

### Unit Testing

- **Components**: Test each component in isolation
- **Mocking**: Use jest.mock() to mock dependencies
- **Coverage**: Aim for 80%+ coverage

Example unit test:

```javascript
// src/tools/stateManager.test.js
const { getUserProfileData } = require('../tools/stateManager');
const { PrismaClient } = require('@prisma/client');

// Mock Prisma
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      user: {
        findUnique: jest.fn(),
      },
    })),
  };
});

describe('stateManager', () => {
  let prismaMock;
  
  beforeEach(() => {
    prismaMock = new PrismaClient();
    jest.clearAllMocks();
  });
  
  describe('getUserProfileData', () => {
    it('should return user data when user exists', async () => {
      // Arrange
      const mockUser = { id: 1, name: 'Test User', telegramId: '123456' };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      
      // Act
      const result = await getUserProfileData('123456');
      
      // Assert
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: '123456' },
      });
      expect(result).toEqual(mockUser);
    });
    
    it('should throw an error when user does not exist', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);
      
      // Act & Assert
      await expect(getUserProfileData('123456')).rejects.toThrow('User not found');
    });
  });
});
```

### Integration Testing

- **API Endpoints**: Test all Express routes
- **Middleware Chain**: Test middleware interactions
- **Database Interactions**: Test full database queries

Example integration test:

```javascript
// src/routes/api.test.js
const request = require('supertest');
const app = require('../app');
const { PrismaClient } = require('@prisma/client');

// Mock Prisma
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      user: {
        findUnique: jest.fn(),
      },
      session: {
        create: jest.fn(),
      },
    })),
  };
});

describe('API Routes', () => {
  let prismaMock;
  
  beforeEach(() => {
    prismaMock = new PrismaClient();
    jest.clearAllMocks();
  });
  
  describe('GET /api/user-data', () => {
    it('should return user data for valid telegramId', async () => {
      // Arrange
      const mockUser = { id: 1, name: 'Test User', telegramId: '123456' };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      
      // Act & Assert
      const response = await request(app)
        .get('/api/user-data')
        .query({ telegramId: '123456' });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUser);
    });
    
    it('should return 404 for invalid telegramId', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);
      
      // Act & Assert
      const response = await request(app)
        .get('/api/user-data')
        .query({ telegramId: 'invalid' });
      
      expect(response.status).toBe(404);
    });
  });
});
```

### End-to-End Testing

- **User Flows**: Test complete user journeys
- **Mock External APIs**: Telegram, Google Calendar
- **Focus on critical paths**: Registration, booking, waiver submission

### Snapshot Testing

- **Response Objects**: Verify API responses match expected structure
- **HTML Templates**: Ensure templates render correctly

Example snapshot test:

```javascript
// src/routes/forms.test.js
const { getRegistrationForm } = require('../routes/forms');

describe('Forms', () => {
  describe('getRegistrationForm', () => {
    it('should return the correct registration form HTML', () => {
      // Act
      const html = getRegistrationForm();
      
      // Assert
      expect(html).toMatchSnapshot();
    });
  });
});
```

## Prisma Schema

The database schema includes the following key models:

- `User`: Stores user information, preferences, and Telegram details
- `Session`: Represents booking sessions with timestamps and status
- `SessionType`: Defines available session types with durations and pricing
- `AvailabilityRule`: Specifies practitioner availability and booking rules

## Code Coverage Reporting

Jest automatically generates coverage reports when run with the `--coverage` flag. The reports include:

- **Statement Coverage**: Percentage of statements executed
- **Branch Coverage**: Percentage of control flow branches executed
- **Function Coverage**: Percentage of functions called
- **Line Coverage**: Percentage of executable lines executed

Coverage reports are generated in HTML format in the `coverage/` directory.

## Gotchas & Tips

1. **User States**: The application tracks user state (e.g., 'BOOKING', 'AWAITING_WAIVER') to handle conversational flow
2. **Message IDs**: Waiver and booking confirmations rely on stored message IDs to edit previous messages
3. **Timezone Handling**: Google Calendar operations require careful timezone handling
4. **Environment Setup**: Ensure all required environment variables are set before running
5. **Test Independence**: Each test should run in isolation without depending on the state from other tests
6. **Mock Reset**: Always clear mocks between tests using `jest.clearAllMocks()`
7. **Snapshot Updates**: Use `npm test -- -u` to update snapshots when intentional changes are made