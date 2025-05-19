# Kambo Klarity Telegram Bot

A Telegram bot for Kambo Klarity that handles user registration and client workflows.

[![Node.js CI](https://github.com/yourusername/kambo-klarity-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/kambo-klarity-bot/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/yourusername/kambo-klarity-bot/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/kambo-klarity-bot)

## Features

- User role-based workflows (admin, client, new client)
- User registration via Telegram mini-app form
- Session booking via calendar integration
- Waiver form submission and tracking
- Database integration with PostgreSQL via Prisma
- Google Calendar integration for availability and booking

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- Telegram Bot Token (from BotFather)
- Google API credentials for Calendar access
- LangChain API key for AI components
- Ngrok or similar for webhook development (optional)

## Setup

1. Clone the repository
   ```
   git clone https://github.com/yourusername/kambo-klarity-bot.git
   cd kambo-klarity-bot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```
   TG_TOKEN=your-telegram-bot-token
   DATABASE_URL=your-database-url
   FORM_URL=your-form-url
   LANGCHAIN_API_KEY=your-langchain-api-key
   NGROK_URL=your-ngrok-url
   AI_PROVIDER=openai  # or 'gemini'
   OPENAI_API_KEY=your-openai-api-key  # if using OpenAI
   GOOGLE_API_KEY=your-google-api-key  # if using Gemini
   ```

4. Run Prisma migrations to set up the database:
   ```
   npx prisma migrate dev
   ```

## Development

### Running the Bot

Run both the bot and the registration form server:

```
npm run dev
```

### Setting Webhook (Development)

For local development with webhook:

```
npm run webhook:set
```

### Testing

Run tests:

```
npm test
```

Run tests with coverage:

```
npm run test:coverage
```

### Linting and Formatting

```
npm run lint      # Check for linting errors
npm run format    # Automatically fix formatting issues
```

## Admin Setup

To set a user as an admin:

1. Run the admin setup script:
   ```
   npm run set-admin
   ```
2. Send any message to the bot from the Telegram account you want to make an admin
3. The script will automatically set that user as an admin and exit

## Setting Bot Commands

To set the default commands for the bot:

```
npm run set-commands
```

## Project Structure

- `src/app.js` - Main Express application setup
- `src/core/` - Core modules (bot, env, logger, prisma)
- `src/commands/` - Telegram bot commands
- `src/routes/` - Express API routes
- `src/middleware/` - Express and Telegram middleware
- `src/tools/` - Utility tools (Google Calendar, state management, notifications)
- `src/graph/` - LangGraph conversation flow (for AI components)
- `src/agents/` - AI agent setup and configuration
- `prisma/schema.prisma` - Database schema definition
- `public/` - Static files for forms and web apps

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Branching Strategy

This project follows a Git Flow approach:

- `main`: Production-ready code
- `develop`: Main development branch
- `feature/XX-feature-name`: New features
- `bugfix/XX-description`: Bug fixes
- `release/X.X.X`: Release candidates
- `hotfix/XX-description`: Critical production fixes

## License

ISC