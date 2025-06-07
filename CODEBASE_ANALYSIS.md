# Kambo Klarity Bot - Codebase Analysis

**Date:** June 6, 2025
**Author:** Roo

## 1. High-Level Architecture Overview

This document provides a detailed analysis of the Kambo Klarity Bot codebase. The application is a Node.js project built with Express and Telegraf, designed to manage session bookings through a Telegram bot and a web interface. It follows a modular architecture, separating concerns into distinct directories for core functionalities, handlers, routes, and tools.

### Key Components:

- **Entry Point:** The application starts with [`bin/server.js`](bin/server.js), which initializes the Express app and Telegraf bot.
- **Express App:** [`src/app.js`](src/app.js) sets up the Express server, configures middleware, and mounts the various routers.
- **Core Functionalities:** The [`src/core`](src/core) directory contains singletons for essential services:
    - [`bot.js`](src/core/bot.js): Manages the Telegraf bot instance.
    - [`prisma.js`](src/core/prisma.js): Handles the database connection using Prisma.
    - [`env.js`](src/core/env.js): Loads and validates environment variables.
    - [`logger.js`](src/core/logger.js): Provides structured logging with Pino.
- **Database:** The data model is defined in [`prisma/schema.prisma`](prisma/schema.prisma), which includes tables for users, sessions, session types, and more.
- **Routing and Handlers:** Routes are defined in [`src/routes`](src/routes) and are handled by corresponding logic in [`src/handlers`](src/handlers).
- **Telegram Bot Logic:** The bot's command handling and middleware are located in [`src/commands`](src/commands) and [`src/middleware`](src/middleware), respectively.
- **Booking Flow:** The booking process is managed by a set of modules in [`src/core/bookingFlow`](src/core/bookingFlow), which orchestrate the flow using JWTs for state management.
- **Google Calendar Integration:** The [`src/tools/googleCalendar.js`](src/tools/googleCalendar.js) module and its sub-modules manage interactions with the Google Calendar API.
- **Frontend:** The [`public`](public) directory contains static assets for the web-based portions of the application, such as registration forms and the calendar interface.

### Architecture Diagram:

```mermaid
graph TD
    subgraph "Client Interfaces"
        A[Telegram Bot]
        B[Web App]
    end

    subgraph "Application Server"
        C[Express App]
        D[Telegraf Bot]
    end

    subgraph "Core Logic"
        E[Routes & Handlers]
        F[Middleware]
        G[Booking Flow Manager]
        H[State Manager]
    end

    subgraph "External Services"
        I[Database (Prisma)]
        J[Google Calendar API]
    end

    A --> D
    B --> C

    C --> E
    D --> F
    F --> E

    E --> G
    E --> H
    G --> H

    H --> I
    G --> J
```

## 2. Data Model

The database schema is defined in [`prisma/schema.prisma`](prisma/schema.prisma) and is well-structured to support the application's functionalities.

### Main Models:

- **`users`**: Stores user information, including their Telegram ID, contact details, and current state in the booking flow.
- **`sessions`**: Represents a booked session, linking a user to a session type and an appointment time.
- **`SessionType`**: Defines the different types of sessions available, including their duration, price, and other properties.
- **`SessionInvite`**: Manages invitations for friends to join a session.
- **`AvailabilityRule`**: Stores rules for the practitioner's availability, such as working hours and buffer times.

### Relationships:

- A `user` can have multiple `sessions`.
- A `session` belongs to one `user` and one `SessionType`.
- A `session` can have multiple `SessionInvite` records.

## 3. Core Workflows

### User Registration

1.  A new user interacts with the bot for the first time.
2.  The `userLookupMiddleware` identifies them as a new user.
3.  The `updateRouter` sends a welcome message with a link to the registration form.
4.  The user fills out the form in the web app (`public/registration-form.html`).
5.  The form submission is handled by the `registrationHandler`, which creates a new user record in the database.

### Session Booking

1.  A registered user sends the `/book` command.
2.  The `commandHandler` triggers the `handleBookCommand` function.
3.  The `telegramNotifier` sends a message with a list of available session types.
4.  The user selects a session type, which opens the calendar web app (`public/calendar-app.html`).
5.  The frontend fetches available slots from the `/api/calendar/availability` endpoint.
6.  The user selects a time slot, which initiates the booking flow managed by the `bookingFlowManager`.
7.  The user is guided through the remaining steps, such as filling out a waiver, via the `flowStepHandlers`.
8.  Once the booking is confirmed, a new `session` record is created, and a Google Calendar event is scheduled.

### Friend Invitation

1.  After booking a session, a user can invite friends if the session type allows it.
2.  The user is directed to the invite friends page (`public/invite-friends.html`).
3.  An invite link is generated, which can be shared with friends.
4.  When a friend clicks the link, they are guided through the acceptance and waiver process.
5.  The `SessionInvite` record is updated, and the Google Calendar event is modified to include the new participant.

## 4. Potential Improvements

### Refactoring and Code Quality

- **Consolidate Error Handling:** While there is a global error handler, some parts of the code use custom error handling. Consolidating all error handling into the global middleware would improve consistency.
- **Dependency Injection:** The application already uses dependency injection in many places, but this could be applied more consistently, especially for the `logger` and `prisma` instances. This would make testing easier and improve modularity.
- **Configuration Management:** Move hardcoded values, such as time zones and default settings, into the configuration file ([`src/core/env.js`](src/core/env.js)) to make them easier to manage.

### Performance

- **Database Queries:** Some database queries could be optimized. For example, in the `userLookupMiddleware`, selecting only the necessary fields can reduce the amount of data transferred from the database.
- **Caching:** For frequently accessed data, such as session types, implementing a caching layer (e.g., with Redis) could improve performance.

### New Features

- **Admin Dashboard:** A web-based admin dashboard would provide an easier way for administrators to manage users, sessions, and other application settings.
- **Payment Integration:** Integrating a payment gateway (e.g., Stripe) would allow for paid sessions to be booked and managed directly through the application.
- **User Profile Management:** Allow users to view and edit their profile information directly within the Telegram bot or a dedicated web interface.

## 5. Conclusion

The Kambo Klarity Bot is a robust and well-architected application with a clear separation of concerns. The codebase is generally clean and easy to understand, and the use of modern tools and technologies like Prisma and Telegraf makes it a solid foundation for future development. The suggested improvements are intended to further enhance the application's quality, performance, and feature set.