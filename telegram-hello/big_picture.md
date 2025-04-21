Big Picture – Telegram Bot Platform for Kambo Klarity
A north-star overview for all contributors & AI agents. Refer back to this file before adding or modifying any workflow.

1. Vision
Offer veterans, first-responders, and service-industry personnel a seamless conversational gateway to Kambo services.

Provide the admin team with a unified command center for communication, record-keeping, and insight generation.

Architect the bot so that new capabilities can be plugged in as self-contained workflows without disturbing the core experience.

2. Core Architectural Concepts
2.1 Central Dispatcher Pattern

[TG Update] → [Dispatcher] ─┬─▶ Workflow A (Onboarding)
                            ├─▶ Workflow B (Scheduling)
                            ├─▶ Workflow C (Admin Analytics)
                            └─▶ … future workflows
2.2 Single-URL Mini-App Hosting
All web content—static forms and admin viewers—is served from one base URL. The Telegram mini-app loads specific paths or query-based routes to display:

/forms/onboarding.html – client intake

/forms/scheduling.html – session booking

/admin/viewer.html – client & session dashboard

Backend logic selects and injects the appropriate path based on user role & context, satisfying the mini-app restriction of a single domain.

2.3 Modular Components (n8n-style concept)
Responsibility: Route every Telegram update in bot.js to all enabled workflows, allowing workflows to decide entry and processing logic.

Benefit: Enables parallel evolution—new workflows can be added with minimal coupling.


Layer-	               Purpose-	               Examples
Triggers	Listen for TG updates / cron events	Chat Trigger, Time Trigger
Logic	Decision-making & tool invocation	AI Agent, IF, Switch
Tools	External integrations & utilities	Postgres, HTTP Request, Google Calendar
State	Persist & query data	Postgres, Vector DB (future)
Guideline: One workflow = one coherent capability. Keep inputs/outputs explicit.

3. MVP Scope (Phase 1)
3.1 Client Experience
/start → welcome + brief explanation.

Onboarding Form: Custom static HTML page (/forms/onboarding.html) served via shared URL used by Telegram mini-app.

AI Scheduler suggests available slots 👉 inline “Book Now” button.

Confirmation + automated reminders (24h / 3h before session).

Post-session feedback form sent via mini app.

/help command available for immediate client assistance.

3.2 Admin Experience
New Client Alert with quick-view card + link to DB record.

Commands: /clients, /sessions, /broadcast <msg>.

State Updates: Admin marks sessions as Completed, Cancelled, etc.

Admin writes detailed session notes post-session, including payment received.

Chrono Trigger: Admin receives interactive message prompting session status update at scheduled end-time. If completed, admin prompted for notes entry via mini app.

Admin can search sessions by client name or date range in dashboard.

Regular summary reports (weekly/monthly) on session stats delivered by AI agent, including custom graphs or charts.

4. Near-Term Expansions (Phase 2+)

Area	Feature Idea	Notes
AI Coaching	Post-session guidance agent	Daily prompts, journaling
Analytics	KPI dashboards via Supabase/Metabase	Pull TG stats, revenue
5. Guiding Principles
Security-First: Store secrets securely. No hard-coded tokens.

Single Source of Truth: PostgreSQL as canonical DB; avoid duplication of client state.

Observability: Structured logging + error alerts to admin channel.

Extensibility: Prefer modular workflows and clear message passing.

Human-Centric: Empathic tone, minimal friction, accessible interactions.

6. Tech Stack Snapshot
PostgreSQL (Render PG instance)

Telegram Bot API

Prisma ORM (migration & type safety)

OpenAI/Gemini/Anthropic (AI agents)

Ngrok (local development tunneling)

LangChain

Node.js

Telegraf

Express

Cors

Others as needed

Note: Keep tooling cloud-agnostic where possible.

7. Example Use Cases
7.1 Client Experience
New Client (First-Time User):
Jordan, a veteran interested in Kambo, sends /start, fills out onboarding form, and schedules a session seamlessly. Jordan receives session reminders, provides post-session feedback via the mini app, and optionally leaves a Google review.

Returning Client:
Alex quickly schedules a follow-up session directly through the bot's scheduling feature without repeating onboarding and uses the /help command when encountering an issue.

7.2 Admin Experience
Daily Session Management:
Dana manages daily session completions and cancellations, enters detailed notes, and reviews session analytics via the admin dashboard.

Client Communication:
Roy sends targeted /broadcast messages to inform clients about upcoming events or important announcements.

Weekly Reporting:
Gabriel reviews automated weekly summary reports from the AI agent, containing insights on client engagement and session statistics.

8. Open Questions / TODO
❓ Confirm final front-end stack (pure HTML vs. lightweight framework).

❓ Finalize DB schema (clients, sessions, logs).

🔲 Define error-handling policy for AI agent failures.

🔲 Set up staging vs. production environments.