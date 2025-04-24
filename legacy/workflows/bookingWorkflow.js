// ======================================================================
// WORKFLOW: Booking Workflow
// ======================================================================
// Purpose: Handle session booking requests from existing clients, present options, and process selections
// Input: Telegram /book command or session type callback queries from clients
// Output: Interactive booking messages with session type options and scheduling assistance

const { Markup } = require('telegraf');

// Import PrismaClient to update user state in the database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import AI agent and tools
const { bookingAgent } = require('../utils/aiAgents');
const { bookingTools } = require('../utils/tools');

module.exports = {
  name: 'booking',
  enabled: true,
  async trigger(ctx) {
    const wf = this.name; // Workflow name for logging scope
    
    // ======================================================================
    // NODE: entry
    // ======================================================================
    // Purpose: Determine if this is a booking command or callback query
    // Input: ctx (Telegram context)
    // Output: Continue to appropriate node or exit
    
    // Check if this is a /book command
    const isBookCommand = ctx.message?.text === '/book';
    
    // Check if this is a callback query for a session type
    const isSessionTypeCallback = ctx.callbackQuery?.data && 
      ['1 hr Kambo', '3 hr Kambo', '1 hr Alternative Modality'].includes(ctx.callbackQuery.data);

    // If this is a session type callback, edit the original message with the AI assistant prompt
    if (isSessionTypeCallback) {
      try {
        // Retrieve and clear the edit_msg_id
        const user = await prisma.users.findUnique({
          where: { telegram_id: BigInt(ctx.from.id) },
          select: { edit_msg_id: true }
        });
        let origMsgId = user?.edit_msg_id;
        if (origMsgId) {
          // Clear the edit_msg_id after retrieval
          await prisma.users.update({
            where: { telegram_id: BigInt(ctx.from.id) },
            data: { edit_msg_id: null }
          });
        }
        // Compose the AI assistant intro prompt
        const aiPrompt = `Hi Gabriel! I'm your smart scheduling assistant, here to help you book your 1 hr Kambo session. You can speak to me naturally and I'll guide you through the booking process.\n\nCould you please tell me when you would like to schedule your session? Sessions are available between 10:00 AM and 4:00 PM Central Time, up to 60 days in advance from today.\n\nIf at any point you'd like to cancel the booking process, just say "cancel" or text "cancel," and I'll stop and reset everything for you.\n\nWhen would you like to book your 1 hr Kambo session?`;
        if (origMsgId) {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            origMsgId,
            undefined,
            aiPrompt
          );
        } else {
          await ctx.reply(aiPrompt);
        }
        // Set user state to BOOKING and session_type to the selected type
        await prisma.users.update({
          where: { telegram_id: BigInt(ctx.from.id) },
          data: {
            state: 'BOOKING',
            session_type: ctx.callbackQuery.data
          }
        });
        return;
      } catch (error) {
        console.error(`❌ [${wf}/sessionTypeCallback] Error handling session type callback:`, error);
        await ctx.reply("Sorry, there was an error starting your booking. Please try again.");
        return;
      }
    }
    
    // Check if user is in BOOKING state
    const isInBookingState = ctx.state.user?.state === 'BOOKING';
    
    // Check if this is a cancel request
    const isCancelRequest = ctx.message?.text?.toLowerCase() === 'cancel';
    
    // Skip if not a booking command, session callback, or user in BOOKING state
    if (!isBookCommand && !isSessionTypeCallback && !isInBookingState) {
      console.log(`⏭ [${wf}/entry] Skipped (not a booking command, session callback, or user in BOOKING state)`);
      return;
    }
    
    // Skip if not a client (unless it's a callback query which we already validated)
    if ((isBookCommand || isInBookingState) && ctx.state.user?.role !== 'client') {
      console.log(`⏭ [${wf}/entry] Skipped (user is not a client)`);
      return;
    }
    
    // Handle cancel request
    if (isCancelRequest && isInBookingState) {
      await handleCancelBooking(ctx, wf);
      return;
    }
    
    console.log(`🔄 [${wf}/entry] Handling booking workflow for user: ${ctx.from.id}`);
    
    // ======================================================================
    // NODE: showSessionOptions
    // ======================================================================
    // Purpose: Display available session types to the client
    // Input: ctx (Telegram context)
    // Output: Message with inline buttons for session selection
    
    if (isBookCommand) {
      try {
        console.log(`🔄 [${wf}/showSessionOptions] Showing session options to user: ${ctx.from.id}`);
        
        const message = `🐸 *Choose Your Kambo Experience* 🐸

Select the option that best suits your needs:

*1 hr Kambo*
_A focused session lasting about an hour, ideal for introduction or maintenance\\._

*3x3 Kambo \\(3 hr\\)*
_An intensive protocol with three applications in close succession, aimed at a deeper process\\. \\(*Requires previous 1 hr session experience with Kambo Klarity, even with prior experience with another practioner\\.*\\)_

*Alternative Modality \\(1hr\\)*
_Explore other healing practices offered alongside or separate from Kambo\\._

👇 Tap one of the buttons below to choose\\.`;
        
        // Send the session options message and store its message ID in edit_msg_id
        const sentMsg = await ctx.replyWithMarkdownV2(message, 
          Markup.inlineKeyboard([
            [Markup.button.callback('1 hr Kambo 🐸', '1 hr Kambo')],
            [Markup.button.callback('3x3 Kambo 🐸', '3 hr Kambo')],
            [Markup.button.callback('1 hr Alternative Modality', '1 hr Alternative Modality')]
          ])
        );
        // Store message ID for later editing
        await prisma.users.update({
          where: { telegram_id: BigInt(ctx.from.id) },
          data: { edit_msg_id: sentMsg.message_id }
        });
        
        console.log(`✅ [${wf}/showSessionOptions] Session options displayed successfully`);
      } catch (error) {
        console.error(`❌ [${wf}/showSessionOptions] Error showing session options:`, error);
        await ctx.reply("Sorry, I couldn't show the session options. Please try again later.");
      }
      return;
    }
    
    // ======================================================================
    // NODE: handleSessionSelection
    // ======================================================================
    // Purpose: Process the selected session type and initiate scheduling
    // Input: ctx.callbackQuery.data (selected session type)
    // Output: Message with scheduling instructions
    
    if (isSessionTypeCallback) {
      try {
        const sessionType = ctx.callbackQuery.data;
        const firstName = ctx.from.first_name || 'there';
        
        console.log(`🔄 [${wf}/handleSessionSelection] User selected session type: ${sessionType}`);
        
        // Acknowledge the callback query to remove loading indicator
        await ctx.telegram.answerCbQuery(ctx.callbackQuery.id);
        
        const message = `Hi ${firstName}! I'm your smart scheduling assistant, here to help you book your ${sessionType} session. You can speak to me naturally and I'll guide you through the booking process.

Could you please tell me when you would like to schedule your session? Sessions are available between 10:00 AM and 4:00 PM Central Time, up to 60 days in advance from today.

If at any point you'd like to cancel the booking process, just say "cancel" or text "cancel," and I'll stop and reset everything for you.

When would you like to book your ${sessionType} session?`;
        
        await ctx.reply(message);
        
        // Store the session type and set user state to BOOKING
        try {
          await prisma.users.update({
            where: { telegram_id: BigInt(ctx.from.id) },
            data: { 
              session_type: sessionType,
              state: 'BOOKING'
            }
          });
          console.log(`✅ [${wf}/handleSessionSelection] Updated user state to BOOKING and saved session type: ${sessionType}`);
        } catch (dbError) {
          console.error(`❌ [${wf}/handleSessionSelection] Database error while updating user state:`, dbError);
        }
        
        console.log(`✅ [${wf}/handleSessionSelection] Scheduling instructions sent for session type: ${sessionType}`);
      } catch (error) {
        console.error(`❌ [${wf}/handleSessionSelection] Error handling session selection:`, error);
      }
      return;
    }
    
    // ======================================================================
    // NODE: handleDateTimeInput
    // ======================================================================
    // Purpose: Process date/time input using AI agent
    // Input: ctx.message.text (user's suggested date/time)
    // Output: AI-generated response based on input
    
    if (isInBookingState && ctx.message?.text && !isCancelRequest) {
      try {
        const userInput = ctx.message.text;
        console.log(`🔄 [${wf}/handleDateTimeInput] Received date/time input: ${userInput}`);
        
        // Get user's conversation history from database or initialize if not exists
        const user = await prisma.users.findUnique({
          where: { telegram_id: BigInt(ctx.from.id) }
        });
        
        // Initialize or parse conversation history
        let conversationHistory = [];
        try {
          conversationHistory = user.conversation_history ? 
            JSON.parse(user.conversation_history) : [];
        } catch (parseError) {
          console.error(`❌ [${wf}/handleDateTimeInput] Error parsing conversation history:`, parseError);
          // Initialize empty history if parsing fails
          conversationHistory = [];
        }
        
        // Add user message to history
        conversationHistory.push({
          role: 'user',
          content: userInput
        });
        
        // Get user context for AI
        const userContext = {
          telegramId: ctx.from.id,
          firstName: user.first_name,
          sessionType: user.session_type
        };
        
        // Get AI provider from .env
        const provider = process.env.AI_PROVIDER || 'openai';
        
        // ======================================================================
        // [NODE_TYPE: AI_AGENT_NODE]
        // ======================================================================
        // Purpose: Process user input with AI agent
        // Input: User message, conversation history, context
        // Output: AI response with booking actions

        console.log(`🔄 [${wf}/handleDateTimeInput] Sending to AI agent with provider: ${provider}`);
        const aiResponse = await bookingAgent.processUserMessage(
          userInput,
          conversationHistory,
          userContext,
          provider
        );
        
        // Add AI response to history
        conversationHistory.push({
          role: 'assistant',
          content: JSON.stringify(aiResponse)
        });
        
        // Save updated conversation history
        await prisma.users.update({
          where: { telegram_id: BigInt(ctx.from.id) },
          data: { conversation_history: JSON.stringify(conversationHistory) }
        });
        
        // Handle AI response based on type
        await handleAIResponse(ctx, aiResponse, wf);
        
        console.log(`✅ [${wf}/handleDateTimeInput] Processed user input with AI agent`);
      } catch (error) {
        console.error(`❌ [${wf}/handleDateTimeInput] Error processing with AI agent:`, error);
        await ctx.reply("I'm sorry, I encountered an error processing your request. Please try again later.");
      }
      return;
    }
  }
};

// ======================================================================
// NODE: Handle AI Response
// ======================================================================
// Purpose: Process the structured response from the AI agent
// Input: ctx, AI response object, workflow name
// Output: Appropriate message and/or tool execution

async function handleAIResponse(ctx, aiResponse, wf) {
  const { responseType, message, suggestedSlots, confirmedSlot, toolCalls } = aiResponse;
  
  console.log(`🔄 [${wf}/handleAIResponse] Processing AI response type: ${responseType}`);
  
  switch (responseType) {
    case 'suggestion':
      // Format suggested slots if available
      let formattedMessage = message;
      if (suggestedSlots && suggestedSlots.length > 0) {
        formattedMessage += '\n\nAvailable slots:\n' + 
          suggestedSlots.map(slot => `• ${slot}`).join('\n');
      }
      await ctx.reply(formattedMessage);
      break;
      
    case 'confirmation':
      // Store the confirmed slot if available
      if (confirmedSlot) {
        await bookingTools.storeConfirmedSlot(ctx.from.id, confirmedSlot);
      }
      await ctx.reply(message);
      break;
      
    case 'booking':
      // Execute tool calls for booking
      if (toolCalls && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          await executeToolCall(ctx, toolCall, wf);
        }
      }
      break;
      
    case 'cancel':
      await handleCancelBooking(ctx, wf);
      if (message) {
        await ctx.reply(message);
      }
      break;
      
    case 'clarification':
    case 'error':
    default:
      await ctx.reply(message);
      break;
  }
}

// ======================================================================
// NODE: Execute Tool Call
// ======================================================================
// Purpose: Execute a tool requested by the AI agent
// Input: ctx, tool call object, workflow name
// Output: Tool execution result

async function executeToolCall(ctx, toolCall, wf) {
  const { tool, parameters } = toolCall;
  
  console.log(`🔄 [${wf}/executeToolCall] Executing tool: ${tool}`);
  
  try {
    switch (tool) {
      case 'send_form':
        await bookingTools.sendForm(ctx.from.id, parameters.sessionType, ctx.telegram);
        break;
        
      case 'reset_state':
        await bookingTools.resetState(ctx.from.id, ctx.telegram);
        break;
        
      default:
        console.warn(`⚠️ [${wf}/executeToolCall] Unknown tool: ${tool}`);
        break;
    }
  } catch (error) {
    console.error(`❌ [${wf}/executeToolCall] Error executing tool ${tool}:`, error);
  }
}

// Helper function to handle booking cancellation
async function handleCancelBooking(ctx, wf) {
  try {
    console.log(`🔄 [${wf}/handleCancelBooking] User requested to cancel booking: ${ctx.from.id}`);
    
    // Reset user state to NONE
    await prisma.users.update({
      where: { telegram_id: BigInt(ctx.from.id) },
      data: { 
        state: 'NONE',
        session_type: null, // Clear the session type
        conversation_history: null // Clear conversation history
      }
    });
    
    await ctx.reply("Booking process canceled. You can start over anytime with the /book command.");
    console.log(`✅ [${wf}/handleCancelBooking] Booking canceled, user state reset to NONE`);
  } catch (error) {
    console.error(`❌ [${wf}/handleCancelBooking] Error canceling booking:`, error);
    await ctx.reply("There was an issue canceling your booking. Please try again or contact support.");
  }
}
