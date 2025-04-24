// ======================================================================
// UTILITY: Booking AI Agent
// ======================================================================
// Purpose: Handle scheduling conversations for Kambo sessions
// Input: User messages, conversation history, user context
// Output: Structured responses with scheduling actions

const { ChatOpenAI } = require("@langchain/openai");
const { ChatAnthropic } = require("@langchain/anthropic");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const {
  HumanMessage,
  SystemMessage,
  AIMessage,
} = require("@langchain/core/messages");
const { z } = require("zod");

// ======================================================================
// NODE: Model Configuration
// ======================================================================
// Purpose: Create configurable LLM instances based on provider
// Input: Provider name, API keys
// Output: Configured LLM instance

const getAIModel = (provider = "openai") => {
  console.log(`🔄 [bookingAgent/getAIModel] Initializing ${provider} model`);

  switch (provider.toLowerCase()) {
    case "openai":
      return new ChatOpenAI({
        modelName: "gpt-4.1",
        temperature: 0.2,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
    case "anthropic":
      return new ChatAnthropic({
        modelName: "claude-3-opus-20240229",
        temperature: 0.2,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      });
    case "gemini":
      // Using a standard model name that should be available in the API
      return new ChatGoogleGenerativeAI({
        model: "gemini-1.5-pro",
        temperature: 0.2,
        apiKey: process.env.GOOGLE_API_KEY,
        maxOutputTokens: 1024,
      });
    default:
      console.warn(
        `⚠️ [bookingAgent/getAIModel] Unknown provider: ${provider}, falling back to OpenAI`,
      );
      return new ChatOpenAI({
        modelName: "gpt-4-turbo",
        temperature: 0.2,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
  }
};

// ======================================================================
// NODE: System Prompt
// ======================================================================
// Purpose: Define system instructions for the booking agent
// Input: Context variables
// Output: Formatted system prompt

const getBookingSystemPrompt = (currentDateTime, sessionType) => {
  return `You are a scheduling assistant for a Kambo practitioner.

Current Date and Time: ${currentDateTime}
Session Type Selected: ${sessionType}

**Core Rules & Tool Usage:**

1. **Availability Constraints:**
   * Sessions are available between 10:00 AM and 4:00 PM Central Time.
   * Sessions can be booked up to 60 days in advance from today.
   * Sessions start on the hour (10:00 AM, 11:00 AM, etc., not 10:30 AM).

2. **\`cancel\` Command Handling:**
   * If the client messages "cancel" (or similar intent) during a booking process:
     * Set responseType to "cancel" in your output.
     * Include a polite cancellation message.
     * Include a toolCall to reset the client state.

3. **Booking Confirmation Step:**
   * When a specific date and time slot is agreed upon, set responseType to "confirmation".
   * Format the date and time clearly (e.g., "Wednesday, the 14th of May at 2:00 PM").
   * Ensure that in your JSON output, the "confirmedSlot" field is an ISO-8601 UTC timestamp (e.g., "2025-05-14T14:00:00Z").
   * Ask if they want to proceed with booking that specific slot.

4. **Final Booking Trigger:**
   * If the user explicitly confirms readiness to book the proposed slot:
     * Set responseType to "booking".
     * Include toolCalls for both sending the booking form and resetting client state.
     * Do not include any message text - the tool itself will handle messaging.

**Your Responsibilities During Scheduling:**
* If the timeframe is vague, suggest 1-3 specific dates and times (responseType: "suggestion").
* If the client gives a specific date, list all available whole-hour time slots for that day.
* Guide the client towards selecting one specific date and time.
* Once a slot is chosen, follow the "Booking Confirmation Step" (Rule 3 above).
* If they confirm readiness, follow the "Final Booking Trigger" (Rule 4 above).

YOU MUST ALWAYS RESPOND IN THE FOLLOWING JSON FORMAT:
\`\`\`json
{
  "responseType": "suggestion|confirmation|booking|clarification|cancel|error",
  "message": "Your message to the user (empty for booking)",
  "suggestedSlots": ["May 14, 2025 at 2:00 PM", "May 15, 2025 at 3:00 PM"],
  "confirmedSlot": "May 14, 2025 at 2:00 PM",
  "toolCalls": [
    {
      "tool": "send_form",
      "parameters": { "telegramId": "user_id", "sessionType": "session_type" }
    },
    {
      "tool": "reset_state",
      "parameters": { "telegramId": "user_id" }
    }
  ]
}
\`\`\``;
};

// ======================================================================
// NODE: Response Schema
// ======================================================================
// Purpose: Define the expected structure of AI responses
// Input: None
// Output: Zod schema for validation

const responseSchema = z.object({
  responseType: z.enum([
    "suggestion", // Suggesting available times
    "confirmation", // Confirming a specific slot
    "booking", // Final booking confirmation
    "clarification", // Asking for more details
    "cancel", // User wants to cancel
    "error", // Something went wrong
  ]),
  message: z.string().describe("The message to send to the user"),
  suggestedSlots: z
    .array(z.string())
    .optional()
    .describe("List of suggested date/time slots"),
  confirmedSlot: z
    .string()
    .optional()
    .describe("The specific date/time slot confirmed for booking"),
  toolCalls: z
    .array(
      z.object({
        tool: z.string().describe("Tool name to call"),
        parameters: z.record(z.any()).describe("Parameters for the tool"),
      }),
    )
    .optional()
    .describe("Tools to call"),
});

// ======================================================================
// NODE: Process User Message
// ======================================================================
// Purpose: Process user input and generate AI response
// Input: User message, conversation history, user context
// Output: Structured response with next actions

const processUserMessage = async (
  userMessage,
  conversationHistory,
  userContext,
  provider = "openai",
) => {
  try {
    console.log(
      `🔄 [bookingAgent/processUserMessage] Processing message: "${userMessage}"`,
    );

    const model = getAIModel(provider);
    const currentDateTime = new Date().toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "full",
      timeStyle: "long",
    });

    // Create the system prompt with current context
    const systemPrompt = getBookingSystemPrompt(
      currentDateTime,
      userContext.sessionType || "Unknown Session Type",
    );

    // Build message history
    const messages = [
      new SystemMessage(systemPrompt),
      ...conversationHistory.map((msg) =>
        msg.role === "user"
          ? new HumanMessage(msg.content)
          : new AIMessage(msg.content),
      ),
      new HumanMessage(userMessage),
    ];

    console.log(
      `🔄 [bookingAgent/processUserMessage] Sending ${messages.length} messages to AI`,
    );

    // Get response from AI
    const response = await model.call(messages);

    // Parse the response
    try {
      // Extract JSON from the response
      const responseText = response.content;
      const jsonMatch = responseText.match(
        /```(?:json)?\s*([\s\S]*?)\s*```/,
      ) || [null, responseText];
      const jsonString = jsonMatch[1].trim();

      // Parse JSON
      const parsedResponse = JSON.parse(jsonString);

      // Validate against schema
      const validatedResponse = responseSchema.parse(parsedResponse);

      console.log(
        `✅ [bookingAgent/processUserMessage] Successfully processed AI response:`,
        validatedResponse,
      );
      return validatedResponse;
    } catch (parseError) {
      console.warn(
        `❗ [bookingAgent/processUserMessage] AI returned non-JSON, wrapping as clarification.`,
      );
      console.log(`Raw response:`, response.content);

      const fallbackResponse = {
        responseType: "clarification",
        message: response.content,
        toolCalls: [],
      };

      // Validate and return fallback response
      return responseSchema.parse(fallbackResponse);
    }
  } catch (error) {
    console.error(
      `❌ [bookingAgent/processUserMessage] Error calling AI model:`,
      error,
    );
    return {
      responseType: "error",
      message:
        "I'm sorry, I'm experiencing technical difficulties. Please try again later.",
      toolCalls: [],
    };
  }
};

module.exports = {
  processUserMessage,
  getAIModel,
  responseSchema,
};
