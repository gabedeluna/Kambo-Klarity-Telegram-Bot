const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();

// Mock node functions
const mockNodes = {
    agentNode: () => {},
    findSlotsNode: () => {},
    storeBookingNode: () => {},
    createCalendarEventNode: () => {},
    sendWaiverNode: () => {},
    resetStateNode: () => {},
    handleErrorNode: () => {},
    deleteCalendarEventNode: () => {},
    sendTextMessageNode: () => {}
};

// Mock edge functions
const mockEdges = {
    routeAgentDecision: () => {},
    routeAfterSlotFinding: () => {},
    routeAfterBookingStorage: () => {},
    routeAfterGCalCreation: () => {},
    routeAfterWaiverSent: () => {},
    routeAfterReset: () => {}
};

// Mock StateGraph class
class MockStateGraph {
    constructor() {
        this.nodes = {};
        this.edges = {};
    }

    addNode(name, fn) {
        this.nodes[name] = fn;
    }

    setEntryPoint() {}

    addConditionalEdges() {}

    addEdge() {}

    compile() {
        return {
            invoke: () => {},
            graph: {
                nodes: this.nodes
            }
        };
    }
}

// Get bookingGraph with mocked dependencies
const { bookingGraph } = proxyquire("../../src/graph/bookingGraph", {
    "@langchain/langgraph": { StateGraph: MockStateGraph, END: "END" },
    "./nodes": mockNodes,
    "./edges": mockEdges
});

describe("bookingGraph", () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("should compile and export a runnable graph object", () => {
        expect(bookingGraph).to.be.an("object");
        expect(bookingGraph.invoke).to.be.a("function");
    });

    it("should register all required nodes", () => {
        const expectedNodes = [
            "agentNode",
            "findSlotsNode",
            "storeBookingNode",
            "createCalendarEventNode",
            "sendWaiverNode",
            "resetStateNode",
            "handleErrorNode",
            "deleteCalendarEventNode",
            "sendTextMessageNode"
        ];

        expectedNodes.forEach(nodeName => {
            expect(bookingGraph.graph.nodes).to.have.property(nodeName);
        });
    });
});
