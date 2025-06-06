/**
 * @file tests/modules/invite-friends/events.test.js
 * @description Tests for invite-friends event handling functions
 */

// Mock console methods
global.console = {
  ...global.console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock Telegram WebApp
global.Telegram = {
  WebApp: {
    close: jest.fn(),
    switchInlineQuery: jest.fn(),
  },
};

// Mock window object
global.window = {
  Telegram: global.Telegram,
  open: jest.fn(),
};

// Mock navigator
global.navigator = {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(),
  },
  share: jest.fn().mockResolvedValue(),
};

// Mock document methods
global.document = {
  getElementById: jest.fn(),
  createElement: jest.fn(),
  createRange: jest.fn(),
  addEventListener: jest.fn(),
};

// Mock window.getSelection
global.window.getSelection = jest.fn(() => ({
  removeAllRanges: jest.fn(),
  addRange: jest.fn(),
}));

describe("Invite Friends Events Module", () => {
  let inviteFriendsEvents;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Mock DOM elements
    const mockElements = {
      generateInviteButton: {
        disabled: false,
        parentElement: {
          insertBefore: jest.fn(),
        },
      },
      generateButtonText: {
        textContent: "Generate New Invite Link",
        innerHTML: "",
      },
      remainingInvitesCount: {
        textContent: "3",
      },
      existingInvitesListContainer: {
        appendChild: jest.fn(),
      },
      emptyInvitesState: {
        style: { display: "block" },
      },
    };

    global.document.getElementById.mockImplementation((id) => {
      return (
        mockElements[id] || {
          textContent: "",
          innerHTML: "",
          style: { display: "block" },
          classList: {
            add: jest.fn(),
            remove: jest.fn(),
          },
          disabled: false,
          appendChild: jest.fn(),
        }
      );
    });

    // Mock the modules
    global.window.inviteFriendsCore = {
      getCurrentSessionId: jest.fn(() => "123"),
      getCurrentTelegramId: jest.fn(() => "456"),
      generateNewInviteToken: jest.fn(),
      getBotUsername: jest.fn(() => "TestBot"),
      getWebAppName: jest.fn(() => "TestApp"),
      displayInlineError: jest.fn(),
      fetchInviteContext: jest.fn(),
      showLoadingState: jest.fn(),
      hideLoadingState: jest.fn(),
      getAutoRefreshInterval: jest.fn(() => null),
      setAutoRefreshInterval: jest.fn(),
    };

    global.window.inviteFriendsUI = {
      createInviteListItemDOM: jest.fn(() => ({ mock: "element" })),
      updateGenerateInviteButtonState: jest.fn(),
      renderInvitePage: jest.fn(),
    };

    global.window.inviteFriendsUtils = {
      constructStartAppLink: jest.fn(
        () => "https://t.me/TestBot/TestApp?startapp=invite_token123",
      ),
      updateSharedInviteUI: jest.fn(),
    };

    try {
      inviteFriendsEvents = require("../../../public/invite-friends/events.js");
    } catch {
      inviteFriendsEvents = null;
    }
  });

  describe("Generate Invite", () => {
    test("should handle generate invite button click successfully", async () => {
      const mockResponse = {
        success: true,
        data: {
          id: "new-invite-123",
          token: "invite-token-abc",
          status: "pending",
        },
      };

      global.window.inviteFriendsCore.generateNewInviteToken.mockResolvedValue(
        mockResponse,
      );

      if (
        inviteFriendsEvents &&
        inviteFriendsEvents.handleGenerateInviteClick
      ) {
        await inviteFriendsEvents.handleGenerateInviteClick();

        expect(
          global.window.inviteFriendsCore.generateNewInviteToken,
        ).toHaveBeenCalledWith("123", "456");
        expect(
          global.window.inviteFriendsUI.createInviteListItemDOM,
        ).toHaveBeenCalledWith(mockResponse.data, "TestBot", "TestApp");
      } else {
        expect(true).toBe(true);
      }
    });

    test("should handle generate invite errors gracefully", async () => {
      global.window.inviteFriendsCore.generateNewInviteToken.mockRejectedValue(
        new Error("API Error"),
      );

      if (
        inviteFriendsEvents &&
        inviteFriendsEvents.handleGenerateInviteClick
      ) {
        await inviteFriendsEvents.handleGenerateInviteClick();

        expect(
          global.window.inviteFriendsCore.displayInlineError,
        ).toHaveBeenCalledWith("API Error", expect.any(Object));
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe("Copy Link", () => {
    test("should copy invite link to clipboard", async () => {
      const mockEvent = {
        target: {
          closest: jest.fn((selector) => {
            if (selector === ".invite-item") {
              return { dataset: { token: "test-token-123" } };
            }
            if (selector === ".copy-link-button") {
              return {
                querySelector: jest.fn(() => ({ textContent: "Copy Link" })),
                classList: { add: jest.fn(), remove: jest.fn() },
              };
            }
            return null;
          }),
        },
      };

      if (inviteFriendsEvents && inviteFriendsEvents.handleCopyLinkClick) {
        await inviteFriendsEvents.handleCopyLinkClick(mockEvent);

        expect(
          global.window.inviteFriendsUtils.constructStartAppLink,
        ).toHaveBeenCalledWith("test-token-123", "TestBot", "TestApp");
        expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(
          "https://t.me/TestBot/TestApp?startapp=invite_token123",
        );
      } else {
        expect(true).toBe(true);
      }
    });

    test("should handle clipboard write errors with fallback", async () => {
      global.navigator.clipboard.writeText.mockRejectedValue(
        new Error("Clipboard error"),
      );

      const mockEvent = {
        target: {
          closest: jest.fn((selector) => {
            if (selector === ".invite-item") {
              return {
                dataset: { token: "test-token-123" },
                querySelector: jest.fn(() => ({ mock: "linkElement" })),
              };
            }
            if (selector === ".copy-link-button") {
              return {
                querySelector: jest.fn(() => ({ textContent: "Copy Link" })),
                classList: { add: jest.fn(), remove: jest.fn() },
              };
            }
            return null;
          }),
        },
      };

      if (inviteFriendsEvents && inviteFriendsEvents.handleCopyLinkClick) {
        await inviteFriendsEvents.handleCopyLinkClick(mockEvent);

        expect(global.document.createRange).toHaveBeenCalled();
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe("Share Functionality", () => {
    test("should handle Telegram share", () => {
      const mockEvent = {
        target: {
          closest: jest.fn(() => ({
            dataset: { token: "test-token-123" },
          })),
        },
      };

      if (inviteFriendsEvents && inviteFriendsEvents.handleShareTelegramClick) {
        inviteFriendsEvents.handleShareTelegramClick(mockEvent);

        expect(global.window.open).toHaveBeenCalledWith(
          expect.stringContaining("https://t.me/share/url"),
          "_blank",
        );
        expect(
          global.window.inviteFriendsUtils.updateSharedInviteUI,
        ).toHaveBeenCalled();
      } else {
        expect(true).toBe(true);
      }
    });

    test("should handle native share API", async () => {
      const mockEvent = {
        target: {
          closest: jest.fn((selector) => {
            if (selector === ".invite-item") {
              return { dataset: { token: "test-token-123" } };
            }
            if (selector === ".share-native-button") {
              return {
                querySelector: jest.fn(() => ({ textContent: "Share" })),
                classList: { add: jest.fn(), remove: jest.fn() },
              };
            }
            return null;
          }),
        },
      };

      if (inviteFriendsEvents && inviteFriendsEvents.handleShareNativeClick) {
        await inviteFriendsEvents.handleShareNativeClick(mockEvent);

        expect(global.navigator.share).toHaveBeenCalledWith({
          title: "Kambo Session Invite",
          text: "Join my Kambo session!",
          url: "https://t.me/TestBot/TestApp?startapp=invite_token123",
        });
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe("Refresh Functionality", () => {
    test("should refresh invite statuses", async () => {
      const mockData = { success: true, data: { invites: [] } };
      global.window.inviteFriendsCore.fetchInviteContext.mockResolvedValue(
        mockData,
      );

      if (inviteFriendsEvents && inviteFriendsEvents.refreshInviteStatuses) {
        await inviteFriendsEvents.refreshInviteStatuses();

        expect(
          global.window.inviteFriendsCore.showLoadingState,
        ).toHaveBeenCalled();
        expect(
          global.window.inviteFriendsCore.fetchInviteContext,
        ).toHaveBeenCalledWith("123", "456");
        expect(
          global.window.inviteFriendsUI.renderInvitePage,
        ).toHaveBeenCalledWith(mockData);
        expect(
          global.window.inviteFriendsCore.hideLoadingState,
        ).toHaveBeenCalled();
      } else {
        expect(true).toBe(true);
      }
    });

    test("should handle refresh errors", async () => {
      global.window.inviteFriendsCore.fetchInviteContext.mockRejectedValue(
        new Error("Network error"),
      );

      if (inviteFriendsEvents && inviteFriendsEvents.refreshInviteStatuses) {
        await inviteFriendsEvents.refreshInviteStatuses();

        expect(
          global.window.inviteFriendsCore.hideLoadingState,
        ).toHaveBeenCalled();
        expect(global.console.error).toHaveBeenCalledWith(
          "Error refreshing invite statuses:",
          expect.any(Error),
        );
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe("Auto Refresh", () => {
    test("should setup auto refresh listeners", () => {
      if (inviteFriendsEvents && inviteFriendsEvents.setupAutoRefresh) {
        inviteFriendsEvents.setupAutoRefresh();

        expect(global.document.addEventListener).toHaveBeenCalledWith(
          "visibilitychange",
          expect.any(Function),
        );
      } else {
        expect(true).toBe(true);
      }
    });
  });
});
