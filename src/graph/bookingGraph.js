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
const nodes = require("./nodes");
const edges = require("./edges");

// Initialize the workflow state graph with object-based channels
const workflow = new StateGraph({ channels: Object });

// Register all nodes
workflow.addNode("agentNode", nodes.agentNode);
workflow.addNode("findSlotsNode", nodes.findSlotsNode);
workflow.addNode("storeBookingNode", nodes.storeBookingNode);
workflow.addNode("createCalendarEventNode", nodes.createCalendarEventNode);
workflow.addNode("sendWaiverNode", nodes.sendWaiverNode);
workflow.addNode("resetStateNode", nodes.resetStateNode);
workflow.addNode("handleErrorNode", nodes.handleErrorNode);
workflow.addNode("deleteCalendarEventNode", nodes.deleteCalendarEventNode);
workflow.addNode("sendTextMessageNode", nodes.sendTextMessageNode);

// Set the entry point to the agent node
workflow.setEntryPoint("agentNode");

// Add edges with conditional routing
workflow.addConditionalEdges("agentNode", edges.routeAgentDecision, {
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
workflow.addConditionalEdges("findSlotsNode", edges.routeAfterSlotFinding, {
  agentNode: "agentNode",
  handleErrorNode: "handleErrorNode",
});

// Route after storing booking data
workflow.addConditionalEdges(
  "storeBookingNode",
  edges.routeAfterBookingStorage,
  {
    createCalendarEventNode: "createCalendarEventNode",
    handleErrorNode: "handleErrorNode",
  },
);

// Route after creating calendar event
workflow.addConditionalEdges(
  "createCalendarEventNode",
  edges.routeAfterGCalCreation,
  {
    sendWaiverNode: "sendWaiverNode",
    handleErrorNode: "handleErrorNode",
  },
);

// Route after sending waiver
workflow.addConditionalEdges("sendWaiverNode", edges.routeAfterWaiverSent, {
  [END]: END,
  handleErrorNode: "handleErrorNode",
});

// Route after resetting state
workflow.addConditionalEdges("resetStateNode", edges.routeAfterReset, {
  [END]: END,
  handleErrorNode: "handleErrorNode",
});

// Direct edges for terminal nodes
workflow.addEdge("handleErrorNode", END);
workflow.addEdge("sendTextMessageNode", END);
workflow.addEdge("deleteCalendarEventNode", "resetStateNode");

// Compile the graph
const bookingGraph = workflow.compile();

module.exports = { bookingGraph };
