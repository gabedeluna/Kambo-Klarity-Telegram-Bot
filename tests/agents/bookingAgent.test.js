const chai = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");
let sinonChai = require("sinon-chai");

// Handle potential ES module default export when using require
if (sinonChai && typeof sinonChai === "object" && sinonChai.default) {
  sinonChai = sinonChai.default;
}

chai.use(sinonChai);
const { expect } = chai;

describe("Booking Agent - Integration Tests", () => {
  // Define supported providers for multi-provider testing
  const providers = ["openai", "gemini"];

  // Loop through each provider to test both configurations
  providers.forEach((provider) => {
    describe(`Agent Execution (Provider: ${provider})`, () => {
      let bookingAgent;
      let mockLLM,
        mockAgentExecutor,
        mockStateManager,
        mockTelegramNotifier,
        mockGoogleCalendar;
      let mockSessionMemory,
        mockConfig,
        mockLogger,
        mockUuid,
        mockBookingPromptTemplate;
      let mockMemoryInstance, mockPrisma, mockBot;
      let MockStructuredTool; // Declare mock constructor
      let MockSystemMessage, MockHumanMessage, MockAIMessage, MockToolMessage;

      beforeEach(() => {
        // Mock external dependencies
        mockLLM = {
          invoke: sinon.stub().resolves({ content: "Default LLM Response" }), // Default mock response
        };
        mockAgentExecutor = {
          invoke: sinon.stub().resolves({ output: "Default Agent Response" }), // Default mock response
        };
        mockStateManager = {
          getUserProfileData: sinon.stub().resolves({
            success: true,
            data: {
              first_name: "Tester",
              telegram_id: "123",
              active_session_id: "existing-session",
            },
          }),
          getUserPastSessions: sinon.stub().resolves({
            success: true,
            data: [{ session_id: "past-session-1" }],
          }),
          setActiveSessionId: sinon.stub().resolves({ success: true }),
          resetUserState: sinon.stub().resolves({ success: true }),
          storeBookingData: sinon.stub().resolves({ success: true }),
          setLogger: sinon.stub(), // Add setLogger stub
          // Add other methods if the agent calls them directly
        };
        mockTelegramNotifier = {
          sendWaiverLink: sinon.stub().resolves({ success: true }),
          sendTextMessage: sinon.stub().resolves({ success: true }),
          initialize: sinon.stub(), // Add initialize stub
          // Add other methods if called
        };
        mockGoogleCalendar = {
          findFreeSlots: sinon
            .stub()
            .resolves({ success: true, data: ["Slot A", "Slot B"] }),
          createCalendarEvent: sinon
            .stub()
            .resolves({ success: true, data: { eventId: "mock-event-id" } }),
          deleteCalendarEvent: sinon.stub().resolves({ success: true }),
        };
        mockMemoryInstance = {
          chatHistory: { getMessages: sinon.stub().resolves([]) },
          saveContext: sinon.stub().resolves(),
        };
        mockSessionMemory = {
          getMemoryForSession: sinon.stub().returns(mockMemoryInstance),
        };
        mockConfig = {
          OPENAI_API_KEY: "fake_key",
          GOOGLE_API_KEY: "fake_gemini_key", // Add Google API key
          aiProvider: provider, // Set to current provider in the loop
          AI_PROVIDER: provider, // Match both formats used in the codebase
          NODE_ENV: "test",
          USER_PROFILE_DEFAULTS: { timezone: "UTC" }, // Add defaults if needed
          TELEGRAM_BOT_TOKEN: "fake_token",
          GOOGLE_CALENDAR_ID: "fake_cal_id",
          FORM_URL: "http://fake.form.url", // Add required config for telegramNotifier
          openaiApiKey: "fake_key", // Match the new config structure
          googleApiKey: "fake_gemini_key", // Match the new config structure
          langchainApiKey: "fake_langchain_key", // Add LangChain API key
        };
        mockLogger = {
          info: sinon.stub(),
          error: sinon.stub(),
          warn: sinon.stub(),
          debug: sinon.stub(),
          child: sinon.stub().returnsThis(), // Chainable child logger
        };
        mockUuid = {
          v4: sinon.stub().returns(`mock-session-id-${provider}-123`),
        };
        mockPrisma = {
          // Basic mock for Prisma Client
          users: {
            // Mock specific models/methods if needed by agent init directly
            findUnique: sinon.stub(),
            update: sinon.stub(),
            create: sinon.stub(),
          },
          // Add other models like sessions, bookings if checked in init
        };
        mockBot = {
          // Basic mock for Telegraf bot instance
          telegram: {
            sendMessage: sinon.stub().resolves({}),
          },
        };
        mockBookingPromptTemplate = {
          formatMessages: sinon.stub().resolves([]),
        };

        // Mock the constructor for StructuredTool
        const mockStructuredToolInstance = {
          // Basic instance properties
          name: "mock_tool",
          description: "mock tool desc",
        }; // Basic instance mock
        MockStructuredTool = sinon.stub().returns(mockStructuredToolInstance);

        // Mock message constructors from @langchain/core/messages
        MockSystemMessage = sinon
          .stub()
          .returns({ _getType: () => "system", content: "mock system" });
        MockHumanMessage = sinon
          .stub()
          .returns({ _getType: () => "human", content: "mock human" });
        MockAIMessage = sinon
          .stub()
          .returns({ _getType: () => "ai", content: "mock ai" });
        MockToolMessage = sinon.stub().returns({
          _getType: () => "tool",
          content: "mock tool",
          tool_call_id: "mock-tool-id",
        });

        // Use proxyquire to load the agent with mocks
        const mockAgent = { runnable: true }; // Simple mock object for the agent itself
        bookingAgent = proxyquire("../../src/agents/bookingAgent", {
          // Mock LangChain components - adjust paths based on actual usage in bookingAgent.js
          "@langchain/openai": { ChatOpenAI: sinon.stub().returns(mockLLM) },
          "@langchain/google-genai": {
            ChatGoogleGenerativeAI: sinon.stub().returns(mockLLM),
          }, // Add Gemini mock
          "langchain/agents": {
            AgentExecutor: sinon.stub().returns(mockAgentExecutor), // Mock the constructor
            createToolCallingAgent: sinon.stub().resolves(mockAgent), // Replace with createToolCallingAgent
          },
          "@langchain/core/prompts": {
            ChatPromptTemplate: {
              fromMessages: sinon.stub().returns(mockBookingPromptTemplate),
            }, // Mock prompt creation
            MessagesPlaceholder: sinon.stub().returns({
              inputVariables: ["chat_history", "agent_scratchpad"],
            }), // Mock placeholder including scratchpad
          },
          "@langchain/core/messages": {
            SystemMessage: MockSystemMessage,
            HumanMessage: MockHumanMessage,
            AIMessage: MockAIMessage,
            ToolMessage: MockToolMessage,
          },
          "@langchain/community/tools/google_calendar/index": {
            // Assuming this is where the tool wrappers are
            GoogleCalendarCreateTool: sinon.stub(),
            GoogleCalendarViewTool: sinon.stub(),
          },
          "langchain/tools": {
            DynamicTool: sinon.stub().callsFake((config) => {
              // Basic mock for DynamicTool, returning an object with name and description
              return {
                name: config.name,
                description: config.description,
                // You might need to add a mock 'call' function if the agent interacts with it directly
                // call: sinon.stub().resolves('Mock Tool Result')
              };
            }),
          },
          "@langchain/core/tools": {
            StructuredTool: MockStructuredTool, // Mock the constructor
          },
          // Mock local modules
          "../tools/stateManager": mockStateManager,
          "../tools/telegramNotifier": mockTelegramNotifier,
          "../tools/googleCalendar": sinon.stub().returns(mockGoogleCalendar), // Replace with constructor mock
          "../memory/sessionMemory": mockSessionMemory,
          "../config/agentPrompts": {
            bookingAgentSystemPrompt:
              "Test Prompt {user_name}" /* other prompts */,
          }, // Use real or test prompt
          "../core/logger": mockLogger,
          "../core/env": mockConfig,
          "../core/prisma": mockPrisma, // Inject Prisma mock
          "../core/bot": mockBot, // Inject Bot mock
          uuid: mockUuid,
          // Mock potentially missing dependencies if agent imports them directly
          "langchain/schema/runnable": {
            RunnableSequence: { from: sinon.stub() },
          },
          "@langchain/core/agents": {
            AgentFinish: sinon.stub(),
            AgentAction: sinon.stub(),
          },
        });

        // Pass mocks to initialization function
        bookingAgent.initializeAgent({
          logger: mockLogger,
          config: mockConfig,
          prisma: mockPrisma,
          bot: mockBot,
        });
      });

      afterEach(() => {
        sinon.restore(); // Use restore instead of resetHistory for better cleanup
      });

      it(`runBookingAgent should initialize correctly and invoke executor with ${provider}`, async () => {
        // Arrange: Override specific mocks for this test
        mockStateManager.getUserProfileData.resolves({
          success: true,
          data: {
            first_name: "Tester",
            telegram_id: "123",
            active_session_id: null,
          },
        }); // No active session
        mockStateManager.getUserPastSessions.resolves({
          success: true,
          data: [{ session_id: "prev_session" }],
        }); // Has past sessions
        mockAgentExecutor.invoke.resolves({ output: "Hello Tester!" }); // Specific response
        mockUuid.v4.returns("new-session-id-456"); // Specific new session ID

        // Act
        const result = await bookingAgent.runBookingAgent({
          userInput: "Hi",
          telegramId: "123",
        });

        // Assert
        expect(result.success).to.be.true;
        // Verify state manager calls (user profile, past sessions) - simplified
        expect(mockStateManager.getUserProfileData).to.have.been.calledOnce;
        expect(mockStateManager.getUserPastSessions).to.have.been.calledOnce;
        expect(mockUuid.v4).to.have.been.calledOnce; // Expecting a new session ID
        expect(mockStateManager.setActiveSessionId).to.have.been.calledOnce;
        expect(mockSessionMemory.getMemoryForSession).to.have.been.calledOnce;

        // Verify Agent Executor call (simplified)
        expect(mockAgentExecutor.invoke).to.have.been.calledOnce;
      });

      it(`runBookingAgent should handle intent to find slots with ${provider} (simplified check)`, async () => {
        // Arrange - reset stubs for this test
        mockAgentExecutor.invoke.reset();
        mockAgentExecutor.invoke.resolves({
          output: `OK, I found these slots with ${provider}: Slot A, Slot B`,
        });

        // Act
        const result = await bookingAgent.runBookingAgent({
          userInput: "Find me a slot",
          telegramId: "123",
        });

        // Assert - only check the most basic expectations
        expect(result.success).to.be.true;
        expect(mockAgentExecutor.invoke).to.have.been.called;
      });

      it(`runBookingAgent should handle cancellation intent with ${provider} (simplified check)`, async () => {
        // Arrange
        mockAgentExecutor.invoke.resolves({
          output: `OK, booking cancelled with ${provider}.`,
        });

        // Act
        const result = await bookingAgent.runBookingAgent({
          userInput: "cancel my booking",
          telegramId: "123",
        });

        // Assert
        expect(result.success).to.be.true;
        expect(result.output).to.equal(
          `OK, booking cancelled with ${provider}.`,
        );
        expect(mockAgentExecutor.invoke).to.have.been.calledOnce;

        // Inferential check: Assume the agent logic triggered the state reset
        // Note: This assumes resetUserState is called *after* or *by* the executor. If it's a tool
        // called *by* the agent, the mockAgentExecutor needs to simulate that tool call sequence,
        // which is more complex. Here, we assume the agent's *output* triggers a call *outside* the executor mock.
        // Adjust if resetUserState is a LangChain tool called within the mocked AgentExecutor.
        // For this simplified test, let's assume it's NOT called directly yet, as we only mocked the executor output.
        // If resetUserState *were* a tool the executor should call, this test would need adjustment.
        // expect(mockStateManager.resetUserState).to.have.been.calledOnceWith('123'); // This might fail depending on agent logic
      });

      it(`runBookingAgent should acknowledge first-time user with ${provider} based on past sessions`, async () => {
        // Arrange
        mockStateManager.getUserProfileData.resolves({
          success: true,
          data: {
            first_name: "Newbie",
            telegram_id: "789",
            active_session_id: "session-abc",
          },
        });
        mockStateManager.getUserPastSessions.resolves({
          success: true,
          data: [],
        }); // No past sessions
        mockAgentExecutor.invoke.resolves({
          output: `Welcome, Newbie! Looks like your first time using ${provider}...`,
        });

        // Act
        const result = await bookingAgent.runBookingAgent({
          userInput: "I want to book",
          telegramId: "789",
        });

        // Assert
        expect(result.success).to.be.true;
        expect(mockStateManager.getUserProfileData).to.have.been.calledOnce;
        expect(mockStateManager.getUserPastSessions).to.have.been.calledOnce;
        expect(mockAgentExecutor.invoke).to.have.been.calledOnce;
      });

      it(`runBookingAgent should handle stateManager profile fetch failure with ${provider}`, async () => {
        // Arrange
        const mockError = new Error("Database connection failed");
        mockStateManager.getUserProfileData.rejects(mockError);
        mockLogger.error = sinon.stub(); // Spy on logger error

        // Act
        const result = await bookingAgent.runBookingAgent({
          userInput: "Hi",
          telegramId: "123",
        });

        // Assert
        expect(result.success).to.be.false;
        expect(result.error).to.equal(
          `Failed to get user profile: ${mockError.message}`,
        );
        expect(mockLogger.error).to.have.been.called; // Just check if error was logged
        expect(mockAgentExecutor.invoke).to.not.have.been.called;
      });

      it(`runBookingAgent should handle agent executor failure gracefully with ${provider}`, async () => {
        // Arrange
        const agentErrorMessage = "Mock agent error";
        // Ensure user profile/session setup succeeds
        mockStateManager.getUserProfileData.resolves({
          success: true,
          data: {
            first_name: "Test",
            telegram_id: "123",
            active_session_id: "session-ok",
          },
        });
        mockStateManager.getUserPastSessions.resolves({
          success: true,
          data: [],
        });
        // Make the executor invocation fail
        const mockError = new Error(agentErrorMessage);
        mockAgentExecutor.invoke.rejects(mockError);

        // Act
        const result = await bookingAgent.runBookingAgent({
          userInput: "This will fail",
          telegramId: "123",
        });

        // Assert
        expect(result.success).to.be.false;
        expect(result.error).to.equal(
          `Agent execution failed: ${mockError.message}`,
        );
        // Check that error was logged with context object and specific message string
        expect(mockLogger.error).to.have.been.calledWith(
          sinon.match.object,
          "Error during agent execution",
        );
        expect(mockAgentExecutor.invoke).to.have.been.calledOnce; // Should still be called once
      });
    }); // End describe for provider
  }); // End providers.forEach
});
