# Kambo Klarity Telegram Bot

A Telegram bot for Kambo Klarity that handles user registration and client workflows.

## Features

- User role-based workflows (admin, client, new client)
- User registration via Telegram mini-app form
- Database integration with PostgreSQL via Prisma
- Command handling for various user interactions

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- Telegram Bot Token (from BotFather)
- Ngrok or similar for webhook development (optional)

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token
   DATABASE_URL=your-database-url
   WEBHOOK_SECRET=your-webhook-secret
   FORM_SERVER_PORT=3001
   FORM_SERVER_URL=https://your-domain.com
   ```
4. Run Prisma migrations to set up the database:
   ```
   npx prisma migrate dev
   ```

## Running the Bot

### Development Mode

Run both the bot and the registration form server:

```
npm run dev
```

### Production Mode

Run the bot and server separately:

```
npm run start        # Start the bot
npm run start:server # Start the registration form server
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

## Testing

This project uses Jest for automated unit and integration testing.

To run the tests:

```
npm test
```

This will execute all tests located in the `tests/` directory and generate a coverage report in the `coverage/` directory.
```

## Project Structure

- `bot.js` - Main bot logic and webhook handling
- `server.js` - Server for hosting the registration form
- `registration-form.html` - Telegram mini-app form for user registration
- `set_admin.js` - Script to set a user as an admin
- `set_default_commands.js` - Script to set default bot commands
- `prisma/schema.prisma` - Database schema definition

## Workflow

1. New users are prompted to fill out a registration form
2. Upon form submission, user data is stored in the database
3. Users are assigned the 'client' role by default
4. Different message handlers process requests based on user role
5. Commands provide specific functionality based on user role

## License

ISC
