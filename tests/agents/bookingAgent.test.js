const chai = require("chai");
const sinon = require("sinon");
const { StructuredTool } = require("@langchain/core/tools");
const proxyquire = require("proxyquire").noCallThru();
const sinonChai = require("sinon-chai");

// Handle potential default export
chai.use(sinonChai.default || sinonChai);

const { expect } = chai;

describe("Booking Agent - Integration Tests", () => {
  // Define supported providers for multi-provider testing
  const providers = ["openai", "gemini"];

  // Loop through each provider to test both configurations
  providers.forEach((provider) => {
    describe(`Agent Execution (Provider: ${provider})`, async () => {
      let sandbox;

      // Declare mock instances used across beforeEach and tests
      let mockLLMInstance,
        mockBoundLLMInstance,
        mockPromptInstance,
        mockOutputParser,
        mockAgentExecutorInstance;
      let bookingAgent; // Declare bookingAgent here

      // Add mocks for application-specific dependencies used by the agent or its tools
      let mockLogger,
        mockConfig,
        mockPrisma,
        mockGoogleCalendar,
        mockNotifier,
        mockStateManager,
        mockBot,
        mockSessionMemory;

      beforeEach(async () => {
        sandbox = sinon.createSandbox();

        // --- Create Mocks Inside beforeEach ---
        mockPromptInstance = {
          _isRunnable: true,
          lc_namespace: ["langchain", "core", "prompts"],
          invoke: sandbox.stub().resolves("Mocked Prompt Output"),
        };

        mockOutputParser = {
          _isRunnable: true, // Identify as Runnable
          lc_namespace: ["langchain", "google-genai", "output_parsers"], // More specific namespace
          invoke: sandbox.stub().resolves({
            /* Mock parsed output */
          }),
        };

        mockAgentExecutorInstance = {
          invoke: sandbox
            .stub()
            .resolves({ output: "Agent finished successfully." }),
        };

        // Initialize application-specific mocks
        mockLogger = {
          debug: sandbox.stub(),
          info: sandbox.stub(),
          warn: sandbox.stub(),
          error: sandbox.stub(),
        };
        mockConfig = { openaiApiKey: "tk", geminiApiKey: "tk" }; // Make sure API keys are present
        mockPrisma = {
          /* simplified */
        };
        // Mock functions needed by the tools
        mockStateManager = {
          retrieveSessionMemory: sandbox.stub().resolves({ chatHistory: [] }),
          getUserProfile: sandbox.stub().resolves({
            /* mock profile */
          }),
          storeBookingData: sandbox.stub().resolves(),
          retrieveBookingData: sandbox.stub().resolves({
            /* mock booking */
          }),
          deleteBookingData: sandbox.stub().resolves(),
          resetUserState: sandbox.stub().resolves(),
        };
        mockSessionMemory = {
          chatHistory: { getMessages: sandbox.stub().resolves([]) },
        };
        mockBot = { telegram: {} };
        mockNotifier = {
          sendWaiverLink: sandbox.stub().resolves(),
          sendConfirmation: sandbox.stub().resolves(),
          notifyCancellation: sandbox.stub().resolves(),
        };
        mockGoogleCalendar = {
          findFreeSlots: sandbox.stub().resolves(["slot1", "slot2"]), // Example slots
          createCalendarEvent: sandbox.stub().resolves("eventId123"),
          deleteCalendarEvent: sandbox.stub().resolves(),
        };

        // Reset mocks before each test
        sandbox.resetHistory();

        // Recreate mock LLM instances for isolation
        mockLLMInstance = {
          _isRunnable: true,
          invoke: sandbox.stub().resolves({ content: "Mock LLM Response" }),
          bindTools: sandbox.stub().callsFake(() => {
            console.log(`[${provider}] mockLLMInstance.bindTools called`); // DEBUG LOG
            // Return a *new* mock object representing the bound LLM
            mockBoundLLMInstance = {
              // Assign to the outer variable
              _isRunnable: true,
              invoke: sandbox.stub().resolves({
                /* mock bound LLM output */
              }),
              // Add other relevant properties if needed by the RunnableSequence
            };
            return mockBoundLLMInstance;
          }),
        };

        // --- Mocking Dependencies ---
        // Assign to the outer variable
        bookingAgent = proxyquire("../../src/agents/bookingAgent", {
          "@langchain/openai": {
            ChatOpenAI: sandbox.stub().returns(mockLLMInstance),
          },
          "@langchain/google-genai": {
            ChatGoogleGenerativeAI: sandbox.stub().returns(mockLLMInstance),
            GoogleGenerativeAIFunctionsAgentOutputParser: sandbox
              .stub()
              .returns(mockOutputParser),
          },
          "@langchain/core/prompts": {
            ChatPromptTemplate: {
              fromMessages: sandbox.stub().returns(mockPromptInstance),
            },
            MessagesPlaceholder: sandbox.stub().returns({}),
          },
          "@langchain/core/messages": {
            SystemMessage: function () {
              this._isBaseMessage = true;
            },
            HumanMessage: function () {
              this._isBaseMessage = true;
            },
            AIMessage: function () {
              this._isBaseMessage = true;
            },
            ToolMessage: function () {
              this._isBaseMessage = true;
            },
            BaseMessage: function () {}, // Base constructor for instanceof
          },
          "@langchain/core/runnables": {
            // Mock RunnableSequence.from directly
            RunnableSequence: {
              from: sandbox.stub().returns({
                _isRunnable: true,
                invoke: sandbox.stub().resolves("Mock RunnableSequence Output"),
              }),
            },
          },
          "langchain/agents": {
            // Mock the module
            AgentExecutor: Object.assign(
              // Mock the class/constructor
              sandbox.stub().returns(mockAgentExecutorInstance), // The constructor itself
              {
                // Static methods
                fromAgentAndTools: sandbox
                  .stub()
                  .returns(mockAgentExecutorInstance),
              },
            ),
            createOpenAIFunctionsAgent: sandbox.stub().returns({
              // Mock the function to return a runnable
              _isRunnable: true,
              invoke: sandbox
                .stub()
                .resolves("Mock createOpenAIFunctionsAgent Output"),
            }),
          },
          "../config/agentPrompts": { bookingAgentSystemPrompt: "Test Prompt" }, // Mock prompts if needed
          "../tools/stateManager": mockStateManager,
          "../tools/googleCalendar": mockGoogleCalendar, // Mock the *module* if tools require it
          "../tools/telegramNotifier": mockNotifier, // Mock the *module* if tools require it
          "../core/sessionMemory": sandbox.stub().returns(mockSessionMemory),
          uuid: { v4: sandbox.stub().returns("mock-uuid") },
        });

        console.log(
          `[${provider}] After proxyquire, before initializeAgent...`,
        ); // DEBUG LOG

        try {
          // --- Load Schemas within beforeEach ---
          const schemas = require("../../src/tools/toolSchemas");

          console.log(`[${provider}] Constructing tools array...`);

          const tools = [
            new StructuredTool({
              name: "find_available_slots", // Keep the tool name consistent for the agent
              description: schemas.findFreeSlotsSchema.description, // Use correct schema name
              schema: schemas.findFreeSlotsSchema, // Use correct schema name
              func: mockGoogleCalendar.findFreeSlots, // Use the stubbed function
            }),
            new StructuredTool({
              name: "book_appointment",
              description: schemas.bookAppointmentSchema.description, // Use dot notation
              schema: schemas.bookAppointmentSchema, // Use dot notation
              // Mock the async function that would normally be here
              func: sandbox
                .stub()
                .callsFake(async ({ date, time, service }) => {
                  // Simulate interaction with mocked dependencies
                  const eventId = await mockGoogleCalendar.createCalendarEvent({
                    date,
                    time,
                  });
                  await mockStateManager.storeBookingData("mockUserId", {
                    eventId,
                    date,
                    time,
                    service,
                  });
                  return `Booking confirmed for ${service} on ${date} at ${time} (Event ID: ${eventId})`;
                }),
            }),
            new StructuredTool({
              name: "cancel_booking",
              description: schemas.cancelBookingSchema.description, // Use dot notation
              schema: schemas.cancelBookingSchema, // Use dot notation
              func: sandbox.stub().callsFake(async ({ bookingId }) => {
                const bookingData =
                  await mockStateManager.retrieveBookingData(bookingId);
                if (!bookingData?.eventId) return "Booking not found.";
                await mockGoogleCalendar.deleteCalendarEvent(
                  bookingData.eventId,
                );
                await mockStateManager.deleteBookingData(bookingId);
                await mockNotifier.notifyCancellation(
                  "mockUserId",
                  bookingData,
                );
                return "Booking cancelled successfully.";
              }),
            }),
            new StructuredTool({
              name: "send_waiver",
              description: schemas.sendWaiverLinkSchema.description, // Use dot notation
              schema: schemas.sendWaiverLinkSchema, // Use dot notation
              func: mockNotifier.sendWaiverLink, // Use the stubbed function
            }),
          ];

          console.log(
            `[${provider}] Tools array constructed. Initializing agent...`,
          );

          // Explicitly set API key for Gemini test
          if (provider === "gemini") {
            mockConfig.googleApiKey = "test-key";
            console.log("[gemini] Set mockConfig.googleApiKey"); // DEBUG LOG
          }

          await bookingAgent.initializeAgent({
            logger: mockLogger,
            config: mockConfig, // Pass the potentially modified mockConfig
            prisma: mockPrisma,
            tools: tools,
            provider: provider,
            bot: mockBot,
            notifier: mockNotifier,
            googleCalendar: mockGoogleCalendar,
          });
          console.log(`[${provider}] Agent initialized successfully.`);
        } catch (err) {
          console.error(
            `Error during initializeAgent in beforeEach for provider '${provider}':`,
            err,
          ); // DEBUG LOG
          throw err; // Re-throw to fail the test
        }
      });

      afterEach(() => {
        sandbox.restore();
      });

      it("runBookingAgent should initialize dependencies and invoke executor", async () => {
        console.log(`[${provider}] Running test case...`);
        // Arrange
        const userInput = "Hello";
        const telegramId = "123";
        mockAgentExecutorInstance.invoke.resolves({ output: "Test Response" }); // Customize mock for this test

        // Act: Run the agent
        await bookingAgent.runBookingAgent({
          userInput,
          telegramId,
          provider,
        });

        // Assertions
        // Check if state manager was called to get profile
        expect(mockStateManager.retrieveSessionMemory).to.have.been.calledWith(
          telegramId,
        );
        // Check if the AgentExecutor mock's invoke was called
        expect(mockAgentExecutorInstance.invoke).to.have.been.calledOnce;
        // Check the structure passed to invoke (input + chat_history)
        expect(mockAgentExecutorInstance.invoke).to.have.been.calledWith({
          input: userInput,
          chat_history: [],
        });

        // expect(result.success).to.be.true;
        // expect(result.output).to.equal("Test Response");
      });
    });
  });
});
