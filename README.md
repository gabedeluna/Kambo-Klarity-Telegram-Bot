# Kambo Klarity Telegram Bot

A Telegram bot for the Kambo Klarity project, built with Node.js, Telegraf, Express, and Prisma.

## Features
- Receives and responds to Telegram messages via webhook
- Remembers users with the `/rememberme` command (stores in database)
- Echoes all text messages

## Setup

### Prerequisites
- Node.js (v16+ recommended)
- npm
- ngrok (for local webhook testing)
- A PostgreSQL database (for Prisma)

### Environment Variables
Copy `.env.example` to `.env` and fill in your secrets:
```
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
DATABASE_URL=your-database-url
WEBHOOK_SECRET=your-webhook-secret
```

### Install dependencies
```
cd telegram-hello
npm install
```

### Start ngrok
```
ngrok http 3000
```
Copy your forwarding address (e.g., `https://xxxx.ngrok-free.app`).

### Register the webhook with Telegram
```
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" -d "url=https://<your-ngrok-domain>/webhook/<WEBHOOK_SECRET>"
```

### Start the bot
```
node index.js
```

## Endpoints
- `/webhook/<WEBHOOK_SECRET>`: Receives Telegram updates (POST), testable with GET
- `/`: Health check

## Security
- Never commit your real `.env` file to git.
- Use `.env.example` for sharing config structure.

## License
MIT
