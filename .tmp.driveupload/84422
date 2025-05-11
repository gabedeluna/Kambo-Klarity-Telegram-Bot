/**
 * Unit tests for src/graph/edges.js
 */

const chai = require("chai");
const sinon = require("sinon");
// Correctly import sinon-chai for CommonJS
const sinonChai = require("sinon-chai").default;
const { END } = require("@langchain/langgraph");

const edges = require("../../src/graph/edges"); // Target module
const logger = require("../../src/core/logger"); // Keep require for logger

chai.use(sinonChai);
const { expect } = chai;

describe("Graph Edges (src/graph/edges.js)", () => {
  let sandbox;

  beforeEach(() => {
    // Create a sandbox for this test
    sandbox = sinon.createSandbox();

    // Stub individual logger methods within the sandbox using sandbox.replace
    sandbox.replace(logger, "info", sandbox.stub().returns());
    sandbox.replace(logger, "warn", sandbox.stub().returns());
    sandbox.replace(logger, "error", sandbox.stub().returns());
  });

  afterEach(() => {
    // Restore all stubs created within the sandbox
    sandbox.restore();
  });

  describe("routeAgentDecision", () => {
    it("should route to handleErrorNode if state has an error", () => {
      const state = { error: "Something went wrong" };
      const result = edges.routeAgentDecision(state);
      expect(result).to.equal("handleErrorNode");
    });

    it("should route to the correct tool node if agent requests a known tool", () => {
      const state = {
        agentOutcome: { tool_calls: [{ name: "findFreeSlots", args: {} }] },
      };
      const result = edges.routeAgentDecision(state);
      expect(result).to.equal("findSlotsNode");
    });

    it("should route back to agentNode if agent requests a data fetching tool", () => {
      const state = {
        agentOutcome: {
          tool_calls: [{ name: "getUserProfileData", args: {} }],
        },
      };
      const result = edges.routeAgentDecision(state);
      expect(result).to.equal("agentNode");
    });

    it("should route to handleErrorNode if agent requests an unknown tool", () => {
      const state = {
        agentOutcome: { tool_calls: [{ name: "unknownTool", args: {} }] },
      };
      const result = edges.routeAgentDecision(state);
      expect(result).to.equal("handleErrorNode");
      expect(state.error).to.include("unknown tool: unknownTool");
    });

    it("should route to handleErrorNode if tool_calls is missing a name", () => {
      const state = {
        agentOutcome: { tool_calls: [{ args: {} }] }, // Missing name
      };
      const result = edges.routeAgentDecision(state);
      expect(result).to.equal("handleErrorNode");
      expect(state.error).to.include("tool name is missing");
    });

    it("should return END if agent provides a direct output", () => {
      const state = {
        agentOutcome: { output: "Here is the information you requested." },
      };
      const result = edges.routeAgentDecision(state);
      expect(result).to.equal(END);
    });

    it("should route to handleErrorNode if agent outcome is unclear", () => {
      const state = { agentOutcome: {} }; // No tool_calls or output
      const result = edges.routeAgentDecision(state);
      expect(result).to.equal("handleErrorNode");
      expect(state.error).to.include(
        "did not produce a tool call or a direct response",
      );
    });

    it("should route to handleErrorNode if agent outcome is null/undefined", () => {
      const state = { agentOutcome: null };
      const result = edges.routeAgentDecision(state);
      expect(result).to.equal("handleErrorNode");
      expect(state.error).to.include(
        "did not produce a tool call or a direct response",
      );
    });
  });

  describe("routeAfterSlotFinding", () => {
    it("should route to handleErrorNode if state has an error", () => {
      const state = { error: "DB connection failed" };
      const result = edges.routeAfterSlotFinding(state);
      expect(result).to.equal("handleErrorNode");
    });

    it("should route to agentNode if slots were found (or not)", () => {
      const state = { availableSlots: ["slot1", "slot2"] };
      const result = edges.routeAfterSlotFinding(state);
      expect(result).to.equal("agentNode");
    });

    it("should route to agentNode even if no slots were found", () => {
      const state = { availableSlots: [] };
      const result = edges.routeAfterSlotFinding(state);
      expect(result).to.equal("agentNode");
    });
  });

  describe("routeAfterBookingStorage", () => {
    it("should route to handleErrorNode if state has an error", () => {
      const state = { error: "Failed to write booking" };
      const result = edges.routeAfterBookingStorage(state);
      expect(result).to.equal("handleErrorNode");
    });

    it("should route to createCalendarEventNode if bookingId is present", () => {
      const state = { bookingId: "booking-123" };
      const result = edges.routeAfterBookingStorage(state);
      expect(result).to.equal("createCalendarEventNode");
    });

    it("should route to handleErrorNode if bookingId is missing after storage", () => {
      const state = {}; // No bookingId
      const result = edges.routeAfterBookingStorage(state);
      expect(result).to.equal("handleErrorNode");
      expect(state.error).to.include("Booking ID missing");
    });
  });

  describe("routeAfterGCalCreation", () => {
    it("should route to handleErrorNode if state has an error", () => {
      const state = { bookingId: "b-1", error: "GCal API limit reached" };
      const result = edges.routeAfterGCalCreation(state);
      expect(result).to.equal("handleErrorNode");
    });

    it("should route to sendWaiverNode if calendarEventId is present", () => {
      const state = { bookingId: "b-1", calendarEventId: "cal-abc" };
      const result = edges.routeAfterGCalCreation(state);
      expect(result).to.equal("sendWaiverNode");
    });

    it("should route to handleErrorNode if calendarEventId is missing after creation", () => {
      const state = { bookingId: "b-1" }; // No calendarEventId
      const result = edges.routeAfterGCalCreation(state);
      expect(result).to.equal("handleErrorNode");
      expect(state.error).to.include("Calendar Event ID missing");
    });
  });

  describe("routeAfterWaiverSent", () => {
    it("should route to handleErrorNode if state has an error", () => {
      const state = {
        bookingId: "b-1",
        calendarEventId: "c-1",
        error: "Waiver service down",
      };
      const result = edges.routeAfterWaiverSent(state);
      expect(result).to.equal("handleErrorNode");
    });

    it("should return END if waiver was sent successfully", () => {
      const state = { bookingId: "b-1", calendarEventId: "c-1" };
      const result = edges.routeAfterWaiverSent(state);
      expect(result).to.equal(END);
    });
  });

  describe("routeAfterReset", () => {
    it("should route to handleErrorNode if state has an error", () => {
      const state = { error: "Failed to reset state in DB" };
      const result = edges.routeAfterReset(state);
      expect(result).to.equal("handleErrorNode");
    });

    it("should return END if state was reset successfully", () => {
      const state = {}; // State after reset might be empty or have confirmation
      const result = edges.routeAfterReset(state);
      expect(result).to.equal(END);
    });
  });
});
