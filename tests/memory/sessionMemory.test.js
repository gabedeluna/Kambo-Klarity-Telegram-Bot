/**
 * Unit tests for the session memory manager.
 */
const { expect } = require("chai");
const { BufferMemory } = require("langchain/memory");
const {
  getMemoryForSession,
  clearMemoryForSession,
} = require("../../src/memory/sessionMemory");

describe("Session Memory Manager", () => {
  afterEach(() => {
    // Clear all memories after each test to prevent test interference
    const testSessions = ["session1", "session2", "session3", "session4"];
    testSessions.forEach((sessionId) => clearMemoryForSession(sessionId));
  });

  it("should create a new BufferMemory instance for a new sessionId", () => {
    // Act
    const memory = getMemoryForSession("session1");

    // Assert
    expect(memory).to.be.instanceOf(BufferMemory);
  });

  it("should return the same BufferMemory instance for an existing sessionId", () => {
    // Arrange
    const mem1 = getMemoryForSession("session2");

    // Act
    const mem2 = getMemoryForSession("session2");

    // Assert
    expect(mem1).to.equal(mem2);
  });

  it("BufferMemory instance should store and retrieve conversation history correctly", async () => {
    // Arrange
    const memory = getMemoryForSession("session3");

    // Act
    await memory.saveContext({ input: "Hello" }, { output: "Hi there!" });
    await memory.saveContext(
      { input: "How are you?" },
      { output: "I am fine, thank you." },
    );

    const history = await memory.loadMemoryVariables({});

    // Assert
    expect(history.chat_history).to.be.an("array");
    expect(history.chat_history).to.have.lengthOf(4);
    expect(history.chat_history[0].content).to.equal("Hello");
    expect(history.chat_history[1].content).to.equal("Hi there!");
    expect(history.chat_history[2].content).to.equal("How are you?");
    expect(history.chat_history[3].content).to.equal("I am fine, thank you.");
  });

  it("clearMemoryForSession should remove the instance from the cache", () => {
    // Arrange
    const mem1 = getMemoryForSession("session4");

    // Act
    clearMemoryForSession("session4");
    const mem2 = getMemoryForSession("session4");

    // Assert
    expect(mem1).to.not.equal(mem2);
  });
});
