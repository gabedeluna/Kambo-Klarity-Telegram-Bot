/**
 * Assembles and exports the booking conversation graph using LangGraph's StateGraph.
 * This graph orchestrates the flow of booking conversations by connecting various nodes
 * with conditional edges based on agent decisions and operation outcomes.
 *
 * State Schema:
 * - userInput: string - Current user message
 * - telegramId: string - User's Telegram ID
 * - sessionId: string - Current session identifier
 * - sessionType: string - Type of booking session
 * - availableSlots: Array<Date> - Available booking slots
 * - confirmedSlot: Date - Selected and confirmed booking time
 * - googleEventId: string - Created Google Calendar event ID
 * - agentOutcome: Object - Agent's decision and reasoning
 * - error: Error - Any error that occurred during processing
 * - lastToolResponse: Object - Response from the last tool operation
 * - userProfile: Object - User's profile information
 * - pastSessionDates: Array<Date> - User's past session dates
 */

const { StateGraph, END } = require("@langchain/langgraph");

/**
 * Defines the valid states for the booking conversation graph.
 * @typedef {object} BookingState
 * @property {string} userInput - The latest input from the user.
 * @property {string} telegramId - The user's Telegram ID.
 * @property {Array<object>} chatHistory - The history of the conversation.
 * @property {object} agentOutcome - The outcome from the main agent's processing.
 * @property {Array<object>} availableSlots - Slots found by the calendar tool.
 * @property {object} bookingDetails - Confirmed booking details.
 * @property {string} googleEventId - ID of the event created in Google Calendar.
 * @property {string} waiverType - Type of waiver to be sent (e.g., 'kambo', 'course').
 * @property {string} lastToolResponse - Response from the last tool executed.
 * @property {string} [error] - Any error message from the last operation.
 * @property {string} sessionType - E.g. 'private', 'group', 'course'
 * @property {string} eventName - E.g. 'Kambo Session', 'Training Course: Level 1'
 * @property {string} bookingStatus - e.g. 'pending_payment', 'confirmed', 'cancelled'
 * @property {number} [remainingSpots] - For group sessions or courses
 */

/**
 * Initializes and compiles the booking conversation graph.
 *
 * @param {object} params - The parameters object.
 * @param {object} params.graphNodes - The initialized nodes module containing agentNode, findSlotsNode, etc.
 * @param {object} params.graphEdges - The initialized edges module containing routeAgentDecision, etc.
 * @param {object} params.logger - The application logger instance.
 * @returns {StateGraph} The compiled LangGraph workflow.
 */
function initializeGraph({ graphNodes, graphEdges, logger }) {
  logger.info(
    "[bookingGraph] Initializing graph with destructured dependencies...",
  );

  // Log the types of the main node functions to verify they are functions
  logger.info(
    `[bookingGraph] Type of graphNodes.agentNode: ${typeof graphNodes.agentNode}`,
  );
  logger.info(
    `[bookingGraph] Type of graphNodes.findSlotsNode: ${typeof graphNodes.findSlotsNode}`,
  );
  logger.info(
    `[bookingGraph] Type of graphNodes.storeBookingNode: ${typeof graphNodes.storeBookingNode}`,
  );
  logger.info(
    `[bookingGraph] Type of graphNodes.createCalendarEventNode: ${typeof graphNodes.createCalendarEventNode}`,
  );

  // Initialize the workflow state graph with object-based channels
  // TODO: Define a proper BookingState class for channels for better type safety
  const workflow = new StateGraph({ channels: Object });

  // Register all nodes using the provided nodes object
  workflow.addNode("agentNode", graphNodes.agentNode);
  workflow.addNode("findSlotsNode", graphNodes.findSlotsNode);
  workflow.addNode("storeBookingNode", graphNodes.storeBookingNode);
  workflow.addNode(
    "createCalendarEventNode",
    graphNodes.createCalendarEventNode,
  );
  workflow.addNode("sendWaiverNode", graphNodes.sendWaiverNode);
  workflow.addNode("resetStateNode", graphNodes.resetStateNode);
  workflow.addNode("handleErrorNode", graphNodes.handleErrorNode);
  workflow.addNode(
    "deleteCalendarEventNode",
    graphNodes.deleteCalendarEventNode,
  );
  workflow.addNode("sendTextMessageNode", graphNodes.sendTextMessageNode);

  // Set the entry point to the agent node
  workflow.setEntryPoint("agentNode");

  // Add edges with conditional routing
  workflow.addConditionalEdges("agentNode", graphEdges.routeAgentDecision, {
    findSlotsNode: "findSlotsNode",
    storeBookingNode: "storeBookingNode",
    createCalendarEventNode: "createCalendarEventNode",
    sendWaiverNode: "sendWaiverNode",
    resetStateNode: "resetStateNode",
    deleteCalendarEventNode: "deleteCalendarEventNode",
    sendTextMessageNode: "sendTextMessageNode",
    handleErrorNode: "handleErrorNode",
    [END]: END,
  });

  // Route after finding slots
  workflow.addConditionalEdges(
    "findSlotsNode",
    graphEdges.routeAfterSlotFinding,
    {
      agentNode: "agentNode",
      handleErrorNode: "handleErrorNode",
    },
  );

  // Route after storing booking data
  workflow.addConditionalEdges(
    "storeBookingNode",
    graphEdges.routeAfterBookingStorage,
    {
      createCalendarEventNode: "createCalendarEventNode",
      handleErrorNode: "handleErrorNode",
    },
  );

  // Route after creating calendar event
  workflow.addConditionalEdges(
    "createCalendarEventNode",
    graphEdges.routeAfterGCalCreation,
    {
      sendWaiverNode: "sendWaiverNode",
      handleErrorNode: "handleErrorNode",
    },
  );

  // Route after sending waiver
  workflow.addConditionalEdges(
    "sendWaiverNode",
    graphEdges.routeAfterWaiverSent,
    {
      [END]: END,
      handleErrorNode: "handleErrorNode",
    },
  );

  // Route after resetting state
  workflow.addConditionalEdges("resetStateNode", graphEdges.routeAfterReset, {
    [END]: END,
    handleErrorNode: "handleErrorNode",
  });

  // Direct edges for terminal nodes
  workflow.addEdge("handleErrorNode", END);
  workflow.addEdge("sendTextMessageNode", END);
  workflow.addEdge("deleteCalendarEventNode", "resetStateNode");

  // Compile the graph
  const bookingGraphInstance = workflow.compile(); // Renamed to avoid confusion with module name
  logger.info("[bookingGraph] Graph compiled successfully.");
  return bookingGraphInstance;
}

module.exports = { initializeGraph };
