// ======================================================================
// BOT: Kambo Klarity Telegram Bot
// ======================================================================
// Purpose: Initialize and configure the Telegram bot, load workflows, handle updates and HTTP endpoints
// Input: Telegram webhook updates and HTTP requests (health checks, form submissions)
// Output: Telegram messages to clients/admin, HTTP JSON responses, and application logs

// ======================================================================
// INITIALIZATION NODE: Environment and Dependencies
// ======================================================================
// Purpose: Load environment variables and initialize core dependencies
// Input: None
// Output: Configured bot, express app, and database client

console.log('🔄 [bot/init] Starting initialization...');

// Load environment variables from .env file
require('dotenv').config();

// Log environment variables (excluding sensitive data)
console.log('📋 [bot/init] Environment variables loaded:', {
  NGROK_URL: process.env.NGROK_URL,
  FORM_SERVER_URL: process.env.FORM_SERVER_URL,
  FORM_SERVER_PORT: process.env.FORM_SERVER_PORT,
  PORT: process.env.PORT || '3000 (default)',
  // Not logging tokens or secrets for security
});

// Import dependencies
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const bodyParser = require('body-parser');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

console.log('🔄 [bot/init] Starting initialization...');

// Initialize Telegram bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
console.log('🤖 [bot/init] Telegram bot initialized');

// For webhook verification
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Create Express app for webhook handling
const app = express();
console.log('🌐 [bot/init] Express server initialized');

// Initialize Prisma client for database operations
const prisma = new PrismaClient();
console.log('💾 [bot/init] Database client initialized:', prisma ? 'Success' : 'Failed');

console.log('✅ [bot/init] Initialization complete');

// --- EXPRESS MIDDLEWARE SETUP ---
// ======================================================================
// SETUP NODE: Express Middleware
// ======================================================================
// Purpose: Configure CORS and JSON/body parsing for incoming HTTP requests
// Input: HTTP requests
// Output: Parsed request bodies and CORS enabled on app
app.use(cors()); // Enable CORS for requests from the form URL
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(bodyParser.urlencoded({ extended: true })); // Optional: if form sends urlencoded data

// --- WORKFLOW LOADER NODE ---
// ======================================================================
// LOADER NODE: Workflow Loader
// ======================================================================
// Purpose: Dynamically load dispatcher and form workflows
// Input: Files in workflows directory
// Output: Registered workflows in memory
console.log('🔄 [bot/workflowLoader] Starting workflow loading...');
const workflows = [];
const workflowsDir = path.join(__dirname, 'workflows');
// Define which workflows are managed by the dispatcher
const dispatcherWorkflowFiles = ['newUserWorkflow.js', 'clientWorkflow.js', 'adminWorkflow.js', 'bookingWorkflow.js', 'waiverWorkflow.js'];

fs.readdirSync(workflowsDir).forEach(file => {
  // Only load files designated for the dispatcher
  if (dispatcherWorkflowFiles.includes(file) && file.endsWith('.js')) {
    try {
      const workflowPath = path.join(workflowsDir, file);
      const workflow = require(workflowPath);
      if (workflow.name && typeof workflow.trigger === 'function') {
        workflows.push(workflow);
        console.log(`✅ [bot/workflowLoader] Loaded dispatcher workflow: ${workflow.name} (enabled=${!!workflow.enabled})`);
      } else {
        console.warn(`⚠️ [bot/workflowLoader] Skipping invalid dispatcher workflow file: ${file}`);
      }
    } catch (error) {
      console.error(`❌ [bot/workflowLoader] Error loading dispatcher workflow ${file}:`, error);
    }
  }
});
console.log(`✅ [bot/workflowLoader] Finished loading ${workflows.length} dispatcher workflows.`);

// Load the form workflow separately as it's triggered via HTTP POST
let formWorkflow;
try {
  formWorkflow = require(path.join(workflowsDir, 'formWorkflow.js'));
  console.log(`✅ [bot/workflowLoader] Form workflow loaded separately.`);
} catch (error) {
  console.error(`❌ [bot/workflowLoader] Failed to load formWorkflow.js:`, error);
  // Handle error appropriately - maybe the bot can't handle registrations?
  // For now, we'll log the error and continue.
}

// ======================================================================
// MIDDLEWARE NODE: User Lookup
// ======================================================================
// Purpose: Fetch and attach user context based on Telegram ID
// Input: Telegram update (ctx)
// Output: ctx.state.user or ctx.state.isNewUser flag
bot.use(async (ctx, next) => {
  const middlewareName = 'userLookup'; // For logging scope
  const telegramIdSource = ctx.from?.id;
  console.log(`🔄 [bot/${middlewareName}/entry] Checking user existence for ID: ${telegramIdSource}`);

  if (!telegramIdSource) {
    console.log(`⏭ [bot/${middlewareName}/entry] Skipped: No user ID found in context.`);
    return next(); // Should not happen with standard Telegram updates
  }

  // PARSE ID
  let telegramId;
  try {
    telegramId = BigInt(telegramIdSource);
    console.log(`🔄 [bot/${middlewareName}/parseId] Parsed telegramId: ${telegramId}`);
  } catch (error) {
    console.error(`❌ [bot/${middlewareName}/parseId] Failed to parse Telegram ID: ${telegramIdSource}`, error);
    return next(); // Stop processing if ID is invalid
  }

  // DB LOOKUP
  try {
    const user = await prisma.users.findUnique({
      where: { telegram_id: telegramId },
      // Optionally include related data if needed often:
      // include: { flags: true, preferences: true }
    });

    if (!user) {
      // MARK AS NEW USER
      console.log(`⏭ [bot/${middlewareName}/dbLookup] User not found.`);
      ctx.state.isNewUser = true;
    } else {
      // ATTACH USER 
      ctx.state.user = user; // Attach the full user object
      console.log(`✅ [bot/${middlewareName}/dbLookup] User found and attached to ctx.state.user:`, { clientId: user.client_id, role: user.role /* add other relevant fields */ });
    }
  } catch (error) {
    console.error(`❌ [bot/${middlewareName}/dbLookup] Database error during user lookup for ${telegramId}:`, error);
    // Decide if you want to stop processing or continue without user data
    // For now, we'll continue, but workflows should handle ctx.state.user potentially being undefined
  }

  // EXIT  - Pass control to the next middleware (the dispatcher)
  console.log(`✅ [bot/${middlewareName}/exit] User lookup complete. isNewUser=${!!ctx.state.isNewUser}, userExists=${!!ctx.state.user}`);
  return next();
});


// ======================================================================
// NODE: Dispatcher
// ======================================================================
// Purpose: Route updates to appropriate workflows based on user context and update type
// Input: ctx with user context
// Output: Triggered workflows
bot.use(async (ctx, next) => {
  const userContext = ctx.state.user ? `Role: ${ctx.state.user.role}` : (ctx.state.isNewUser ? 'New User' : 'No User Data');
  console.log(`🔄 [bot/dispatcher] Dispatching update to ${workflows.length} workflows (User context: ${userContext})`);

  // Determine the type of update for more specific routing
  const isTextMessage = !!ctx.message?.text;
  const isCommand = isTextMessage && ctx.message.text.startsWith('/');
  const isCallbackQuery = !!ctx.update.callback_query;
  
  // Get user state for state-based routing
  const userState = ctx.state.user?.state || 'NONE';

  // Track which workflows are actually triggered
  const dispatchedWorkflows = [];
  for (const wf of workflows) {
    if (!wf.enabled) {
      console.log(`⏭ [bot/dispatcher] Skipping disabled workflow: ${wf.name}`);
      continue;
    }

    let shouldTrigger = false;
    
    // Rule: newUserWorkflow triggers for any update type if it's a new user.
    if (wf.name === 'newUser' && ctx.state.isNewUser) {
      shouldTrigger = true;
    }
    // Rule: bookingWorkflow triggers for /book command, booking-related callbacks, or any message when user state is BOOKING
    else if (wf.name === 'booking' && (
      // Trigger on /book command from clients
      (isCommand && ctx.message.text === '/book' && ctx.state.user?.role === 'client') ||
      // Trigger on session type callback queries
      (isCallbackQuery && ['1 hr Kambo', '3 hr Kambo', '1 hr Alternative Modality'].includes(ctx.callbackQuery.data)) ||
      // Trigger on any message when user is in BOOKING state
      (userState === 'BOOKING' && ctx.state.user?.role === 'client')
    )) {
      shouldTrigger = true;
    }
    // Rule: clientWorkflow triggers for text messages/commands from existing 'client' users in NONE state
    // (except for the /book command which is handled by bookingWorkflow)
    else if (wf.name === 'client' && 
             ctx.state.user?.role === 'client' && 
             userState === 'NONE' && 
             (isTextMessage || isCommand) && 
             (!isCommand || ctx.message.text !== '/book')) {
      shouldTrigger = true;
    }
    // Rule: adminWorkflow triggers for text messages/commands from existing 'admin' users.
    else if (wf.name === 'admin' && ctx.state.user?.role === 'admin' && (isTextMessage || isCommand)) {
      shouldTrigger = true;
    }
    // Rule: waiverWorkflow triggers for waiver form callback queries
    else if (wf.name === 'waiver' && isCallbackQuery && ctx.callbackQuery.data?.startsWith('waiver:')) {
      shouldTrigger = true;
    }
    // Add more specific rules here if needed for other workflows/update types

    if (shouldTrigger) {
      console.log(`🔄 [bot/dispatcher] Triggering workflow: ${wf.name}`);
      dispatchedWorkflows.push(wf.name);
      try {
        await wf.trigger(ctx);
        // Optional: Log success after trigger? `✅ [bot/dispatcher] Completed ${wf.name}`
      } catch (err) {
        console.error(`❌ [bot/dispatcher] Error in workflow ${wf.name}:`, err);
      }
    } else {
      // Optional: Add log for skipped workflows due to conditions not met
      // console.log(`⏭ [bot/dispatcher] Skipping workflow ${wf.name} (conditions not met for this update type/user state)`);
    }
  }

  // We might not need 'return next()' if no further general Telegraf middleware runs after the dispatcher.
  // However, keeping it allows for potential future middleware.
  return next();
});

// --- EXPRESS ROUTES ---
// ======================================================================
// [NODE_TYPE: EXPRESS_ROUTES_NODE]
// ======================================================================
// Purpose: Define HTTP endpoints for the bot server
// Input: HTTP requests
// Output: HTTP responses and bot actions
// Purpose: Define HTTP endpoints (health check, form submission)
// Input: HTTP requests
// Output: HTTP responses
app.get('/health', (req, res) => {
  console.log('ጤና [bot/healthCheck] Received health check request');
  res.status(200).send('OK');
});

// Form Submission Endpoint
// This endpoint is called by the HTML form, NOT by Telegram.
app.post('/submit-registration', async (req, res) => {
  console.log('🔄 [bot/formSubmission] Registration form submission received');
  if (!formWorkflow) {
    console.error('❌ [bot/formSubmission] Form workflow not loaded, cannot process submission');
    return res.status(500).json({ success: false, message: 'Form processing not available' });
  }
  
  try {
    const result = await formWorkflow.processRegistration(req.body);
    res.json(result);
  } catch (error) {
    console.error('❌ [bot/formSubmission] Error processing registration:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ======================================================================
// [NODE_TYPE: WAIVER_COMPLETION_WEBHOOK_NODE]
// ======================================================================
// Purpose: Handle notifications when a waiver form is completed
// Input: Session ID and Telegram ID from form server
// Output: Updated Telegram message and session status
// ======================================================================
// [NODE_TYPE: WAIVER_COMPLETION_WEBHOOK_NODE]
// ======================================================================
// Purpose: Handle notifications when a waiver form is completed
// Input: Session ID, Telegram ID, and message tracking info
// Output: Updated Telegram message and session status
app.post('/waiver-completed', async (req, res) => {
  console.log('🔄 [bot/waiverCompletion] Waiver completion notification received');
  
  try {
    const { telegramId, sessionId, messageId, chatId, timestamp } = req.body;
    
    if (!telegramId || !sessionId) {
      console.error('❌ [bot/waiverCompletion] Missing required fields');
      return res.status(400).json({ success: false, message: 'Missing telegramId or sessionId' });
    }
    
    console.log(`🔄 [bot/waiverCompletion] Processing for telegramId: ${telegramId}, sessionId: ${sessionId}`);
    
    // Load the waiver workflow
    const waiverWorkflow = require('./workflows/waiverWorkflow');
    
    // ======================================================================
    // [NODE_TYPE: MESSAGE_TRACKING_NODE]
    // ======================================================================
    // Purpose: Check if we have message tracking info from the form server
    // Input: messageId and chatId from request
    // Output: Decision on how to handle the message update
    console.log(`🔄 [bot/waiverCompletion/tracking] Checking message tracking info`);
    
    // Check if we have the message ID and chat ID directly from the form server
    if (messageId && chatId) {
      console.log(`✅ [bot/waiverCompletion/tracking] Using provided message ID: ${messageId} and chat ID: ${chatId}`);
      
      // ======================================================================
      // [NODE_TYPE: CONTEXT_CREATION_NODE]
      // ======================================================================
      // Purpose: Create a mock context for the workflow with provided tracking info
      // Input: Message tracking data and bot instance
      // Output: Context object with required methods
      console.log(`🔄 [bot/waiverCompletion/context] Creating mock context with provided tracking info`);
      
      // Create a mock context for the workflow using the provided message tracking info
      const mockCtx = {
        telegram: bot.telegram,
        from: { id: telegramId },
        chat: { id: chatId },
        editMessageText: async (text, extra) => {
          try {
            console.log(`🔄 [bot/waiverCompletion/edit] Editing message ${messageId} in chat ${chatId}`);
            await bot.telegram.editMessageText(
              chatId, 
              messageId, 
              undefined, 
              text, 
              extra
            );
            console.log(`✅ [bot/waiverCompletion/edit] Message edited successfully`);
            return true;
          } catch (error) {
            console.error(`❌ [bot/waiverCompletion/edit] Error editing message:`, error);
            return false;
          }
        },
        answerCbQuery: async () => true
      };
      
      // Call the waiver workflow handler with the mock context
      await waiverWorkflow.handleWaiverSubmission(mockCtx, sessionId);
      
      console.log(`✅ [bot/waiverCompletion] Successfully processed waiver completion with provided tracking info`);
      return res.json({ success: true });
    }
    
    // If we don't have message tracking info from the form server, try to look it up in the database
    console.log(`🔄 [bot/waiverCompletion/fallback] No tracking info provided, falling back to database lookup`);
    
    // Find the user's chat data to get message ID for editing
    const user = await prisma.users.findUnique({
      where: { telegram_id: BigInt(telegramId) }
    });
    
    if (!user) {
      console.error(`❌ [bot/waiverCompletion] User not found: ${telegramId}`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Verify that we have the required message data
    if (!user.chat_id || !user.last_booking_message_id) {
      console.error(`❌ [bot/waiverCompletion] Missing chat_id or message_id for user ${telegramId}`);
      console.log(`Debug info - chat_id: ${user.chat_id}, message_id: ${user.last_booking_message_id}`);
      
      // Still return success to the form server since the waiver was processed
      return res.json({ 
        success: true, 
        warning: 'Could not update Telegram message due to missing chat data'
      });
    }
    
    console.log(`✅ [bot/waiverCompletion/fallback] Found user with chat_id: ${user.chat_id} and message_id: ${user.last_booking_message_id}`);
    
    // Create a mock context for the workflow using database values
    const mockCtx = {
      telegram: bot.telegram,
      from: { id: telegramId },
      chat: { id: user.chat_id },
      editMessageText: async (text, extra) => {
        try {
          console.log(`🔄 [bot/waiverCompletion/edit] Editing message ${user.last_booking_message_id} in chat ${user.chat_id}`);
          await bot.telegram.editMessageText(
            user.chat_id, 
            user.last_booking_message_id, 
            undefined, 
            text, 
            extra
          );
          console.log(`✅ [bot/waiverCompletion/edit] Message edited successfully`);
          return true;
        } catch (error) {
          console.error(`❌ [bot/waiverCompletion/edit] Error editing message:`, error);
          return false;
        }
      },
      answerCbQuery: async () => true
    };
    
    // Call the waiver workflow handler
    await waiverWorkflow.handleWaiverSubmission(mockCtx, sessionId);
    
    console.log(`✅ [bot/waiverCompletion] Successfully processed waiver completion using database fallback`);
    res.json({ success: true });
  } catch (error) {
    console.error(`❌ [bot/waiverCompletion] Error processing waiver completion:`, error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// --- TELEGRAM WEBHOOK HANDLER ---
// ======================================================================
// NODE: Webhook Handler
// ======================================================================
// Purpose: Receive Telegram updates via Express
// Input: Webhook HTTP POST
// Output: Handled update by Telegraf
// Use a secret path to avoid random requests hitting the webhook handler
const secretPath = `/telegraf/${bot.secretPathComponent()}`;

// Set telegram webhook
// Note: You MUST use the NGROK_URL environment variable for the webhook URL
// when running locally with ngrok.
const webhookUrl = `${process.env.NGROK_URL}${secretPath}`;
bot.telegram.setWebhook(webhookUrl)
  .then(() => {
    console.log(`✅ [bot/webhookSetup] Webhook set to ${webhookUrl}`);
  })
  .catch((error) => {
    console.error('❌ [bot/webhookSetup] Error setting webhook:', error);
  });

// Start Express server to listen for webhook updates
// The webhook handler needs to parse the request body correctly.
// Telegraf's webhookCallback handles this automatically.
app.use(bot.webhookCallback(secretPath));

// --- SERVER STARTUP ---
// ======================================================================
// NODE: Server Startup
// ======================================================================
// Purpose: Start Express server and listen on configured port
// Input: None
// Output: Running HTTP server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 [bot/serverStartup] Server running on port ${PORT}`);
  console.log(`👂 [bot/serverStartup] Listening for Telegram updates at ${secretPath}`);
  console.log(`📝 [bot/serverStartup] Registration form submissions expected at /submit-registration`);
});

// ======================================================================
// NODE: Graceful Shutdown
// ======================================================================
// Purpose: Handle SIGINT/SIGTERM to clean up resources
// Input: System signals
// Output: Bot stopped and DB disconnected
process.once('SIGINT', () => {
  console.log('💀 [bot/shutdown] SIGINT received, shutting down bot...');
  bot.stop('SIGINT');
  prisma.$disconnect().then(() => console.log('💾 [bot/shutdown] Database connection closed.'));
});
process.once('SIGTERM', () => {
  console.log('💀 [bot/shutdown] SIGTERM received, shutting down bot...');
  bot.stop('SIGTERM');
  prisma.$disconnect().then(() => console.log('💾 [bot/shutdown] Database connection closed.'));
});
