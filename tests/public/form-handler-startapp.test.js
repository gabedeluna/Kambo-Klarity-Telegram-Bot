/**
 * @fileoverview Tests for form handler StartApp functionality
 * @jest-environment jsdom
 */

// Mock global dependencies
global.fetch = jest.fn();
global.window = global;
global.Telegram = {
  WebApp: {
    ready: jest.fn(),
    initDataUnsafe: {},
    BackButton: {
      hide: jest.fn(),
    },
    close: jest.fn(),
  },
};

// Mock DOM elements and document
const mockElements = {
  loadingIndicator: { classList: { add: jest.fn(), remove: jest.fn() } },
  sessionTypeId: { value: "" },
  appointmentDateTimeISO: { value: "" },
  inviteToken: { value: "" },
  genericForm: {
    classList: { remove: jest.fn() },
    addEventListener: jest.fn(),
  },
  submitButton: { disabled: false },
};

global.document = {
  getElementById: jest.fn((id) => mockElements[id] || null),
  addEventListener: jest.fn(),
  readyState: "complete",
};

// Mock window object
global.window = {
  formHandlerCore: {
    setUrlParams: jest.fn(),
  },
  formHandlerUI: {
    showLoadingSpinner: jest.fn(),
    hideLoadingSpinner: jest.fn(),
    showError: jest.fn(),
    initializeStaticContent: jest.fn().mockResolvedValue(true),
    initializeDynamicForm: jest.fn().mockResolvedValue(true),
    setupFriendInvitationUI: jest.fn(),
  },
};

describe("Form Handler StartApp Integration", () => {
  let formHandlerMain;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset mock elements
    Object.values(mockElements).forEach((element) => {
      if (element.classList && element.classList.add) {
        element.classList.add.mockClear();
        element.classList.remove.mockClear();
      }
      if (element.addEventListener) {
        element.addEventListener.mockClear();
      }
    });

    // Re-require the module under test
    formHandlerMain = require("../../public/form-handler/main");
  });

  describe("handleStartAppInviteFlow", () => {
    it("should handle valid invite token successfully", async () => {
      const inviteToken = "TEST123TOKEN";
      const mockInviteData = {
        success: true,
        data: {
          sessionDetails: {
            sessionTypeLabel: "Kambo Session",
            formattedDateTime: "Wednesday, January 15, 2025 at 2:00 PM",
          },
          flowConfiguration: {
            formType: "KAMBO_WAIVER_FRIEND_V1",
            allowsGroupInvites: true,
            maxGroupSize: 2,
          },
          inviteToken: inviteToken,
          sessionTypeId: "kambo-session-1",
          appointmentDateTimeISO: "2025-01-15T14:00:00Z",
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInviteData),
      });

      await formHandlerMain.handleStartAppInviteFlow(inviteToken);

      expect(fetch).toHaveBeenCalledWith(`/api/invite-context/${inviteToken}`);
      expect(window.formHandlerUI.showLoadingSpinner).toHaveBeenCalledWith(
        "Loading invitation details...",
      );
      expect(window.formHandlerUI.hideLoadingSpinner).toHaveBeenCalled();
      expect(window.formHandlerCore.setUrlParams).toHaveBeenCalledWith({
        formType: "KAMBO_WAIVER_FRIEND_V1",
        telegramId: null,
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2025-01-15T14:00:00Z",
        inviteToken: inviteToken,
        flowToken: null,
      });
    });

    it("should handle API errors gracefully", async () => {
      const inviteToken = "INVALID123";

      fetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            success: false,
            message: "Invitation not found",
          }),
      });

      await formHandlerMain.handleStartAppInviteFlow(inviteToken);

      expect(window.formHandlerUI.showError).toHaveBeenCalledWith(
        "Invitation not found",
      );
      expect(window.formHandlerUI.hideLoadingSpinner).toHaveBeenCalled();
    });

    it("should handle network errors", async () => {
      const inviteToken = "NETWORK123";

      fetch.mockRejectedValueOnce(new Error("Network error"));

      await formHandlerMain.handleStartAppInviteFlow(inviteToken);

      expect(window.formHandlerUI.showError).toHaveBeenCalledWith(
        "Failed to load invitation. Please try again.",
      );
      expect(window.formHandlerUI.hideLoadingSpinner).toHaveBeenCalled();
    });

    it("should handle malformed API response", async () => {
      const inviteToken = "MALFORMED123";

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: false, // Missing data field
          }),
      });

      await formHandlerMain.handleStartAppInviteFlow(inviteToken);

      expect(window.formHandlerUI.showError).toHaveBeenCalledWith(
        "Failed to load invitation. Please try again.",
      );
    });
  });

  describe("initializeInviteFriendForm", () => {
    it("should initialize friend form with invite data", async () => {
      const inviteData = {
        sessionDetails: {
          sessionTypeLabel: "Kambo Session",
          formattedDateTime: "Wednesday, January 15, 2025 at 2:00 PM",
        },
        flowConfiguration: {
          formType: "KAMBO_WAIVER_FRIEND_V1",
          allowsGroupInvites: true,
          maxGroupSize: 2,
        },
        inviteToken: "TEST123",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2025-01-15T14:00:00Z",
      };

      await formHandlerMain.initializeInviteFriendForm(inviteData);

      expect(mockElements.sessionTypeId.value).toBe("kambo-session-1");
      expect(mockElements.appointmentDateTimeISO.value).toBe(
        "2025-01-15T14:00:00Z",
      );
      expect(mockElements.inviteToken.value).toBe("TEST123");

      expect(window.formHandlerUI.initializeStaticContent).toHaveBeenCalledWith(
        expect.objectContaining({
          formType: "KAMBO_WAIVER_FRIEND_V1",
          sessionTypeId: "kambo-session-1",
          appointmentDateTimeISO: "2025-01-15T14:00:00Z",
          inviteToken: "TEST123",
        }),
        inviteData.sessionDetails,
      );

      expect(window.formHandlerUI.initializeDynamicForm).toHaveBeenCalledWith(
        "KAMBO_WAIVER_FRIEND_V1",
      );

      expect(window.formHandlerUI.setupFriendInvitationUI).toHaveBeenCalledWith(
        inviteData.sessionDetails,
      );

      expect(mockElements.loadingIndicator.classList.add).toHaveBeenCalledWith(
        "hidden",
      );
      expect(mockElements.genericForm.classList.remove).toHaveBeenCalledWith(
        "hidden",
      );
      expect(mockElements.submitButton.disabled).toBe(false);
    });

    it("should handle form initialization failure", async () => {
      const inviteData = {
        sessionDetails: { sessionTypeLabel: "Kambo Session" },
        flowConfiguration: { formType: "KAMBO_WAIVER_FRIEND_V1" },
        inviteToken: "TEST123",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2025-01-15T14:00:00Z",
      };

      // Mock form initialization failure
      window.formHandlerUI.initializeDynamicForm.mockResolvedValueOnce(false);

      await formHandlerMain.initializeInviteFriendForm(inviteData);

      expect(window.formHandlerUI.initializeDynamicForm).toHaveBeenCalled();
      // Should return early without setting up form
      expect(mockElements.genericForm.classList.remove).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      const inviteData = {
        sessionDetails: { sessionTypeLabel: "Kambo Session" },
        flowConfiguration: { formType: "KAMBO_WAIVER_FRIEND_V1" },
        inviteToken: "TEST123",
        sessionTypeId: "kambo-session-1",
        appointmentDateTimeISO: "2025-01-15T14:00:00Z",
      };

      // Mock UI initialization error
      window.formHandlerUI.initializeStaticContent.mockRejectedValueOnce(
        new Error("UI initialization failed"),
      );

      await formHandlerMain.initializeInviteFriendForm(inviteData);

      expect(window.formHandlerUI.showError).toHaveBeenCalledWith(
        "An error occurred while loading the invitation form.",
      );
    });
  });

  describe("initializeFormHandler with StartApp", () => {
    it("should detect and handle StartApp invite flow", async () => {
      const inviteToken = "STARTAPP123";

      // Mock Telegram WebApp initDataUnsafe
      global.Telegram.WebApp.initDataUnsafe = {
        start_param: `invite_${inviteToken}`,
      };

      const mockInviteData = {
        success: true,
        data: {
          sessionDetails: { sessionTypeLabel: "Kambo Session" },
          flowConfiguration: { formType: "KAMBO_WAIVER_FRIEND_V1" },
          inviteToken: inviteToken,
          sessionTypeId: "kambo-session-1",
          appointmentDateTimeISO: "2025-01-15T14:00:00Z",
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInviteData),
      });

      await formHandlerMain.initializeFormHandler();

      expect(fetch).toHaveBeenCalledWith(`/api/invite-context/${inviteToken}`);
      expect(window.formHandlerUI.showLoadingSpinner).toHaveBeenCalled();
    });

    it("should fallback to normal flow when no StartApp param", async () => {
      // Mock no start_param
      global.Telegram.WebApp.initDataUnsafe = {};

      // Mock normal URL params
      window.formHandlerCore.parseUrlParameters = jest.fn().mockReturnValue({
        flowToken: null, // This will trigger missing parameters error
        formType: null,
        telegramId: null,
        sessionTypeId: null,
        appointmentDateTimeISO: null,
      });

      await formHandlerMain.initializeFormHandler();

      expect(window.formHandlerCore.parseUrlParameters).toHaveBeenCalled();
      expect(window.formHandlerUI.showError).toHaveBeenCalledWith(
        "Missing required parameters. Please return to the calendar and try again.",
      );
    });

    it("should handle StartApp param without invite prefix", async () => {
      // Mock start_param that doesn't start with invite_
      global.Telegram.WebApp.initDataUnsafe = {
        start_param: "other_param",
      };

      // Mock normal URL params
      window.formHandlerCore.parseUrlParameters = jest.fn().mockReturnValue({
        flowToken: null,
        formType: null,
        telegramId: null,
        sessionTypeId: null,
        appointmentDateTimeISO: null,
      });

      await formHandlerMain.initializeFormHandler();

      // Should fall through to normal parameter parsing
      expect(window.formHandlerCore.parseUrlParameters).toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle missing Telegram WebApp gracefully", async () => {
      global.Telegram = undefined;

      // Mock normal URL params
      window.formHandlerCore.parseUrlParameters = jest.fn().mockReturnValue({
        flowToken: null,
        formType: null,
        telegramId: null,
        sessionTypeId: null,
        appointmentDateTimeISO: null,
      });

      await formHandlerMain.initializeFormHandler();

      // Should fall through to normal flow since Telegram is not available
      expect(window.formHandlerCore.parseUrlParameters).toHaveBeenCalled();
    });

    it("should handle initialization errors gracefully", async () => {
      const inviteToken = "ERROR123";

      // Restore Telegram for this test
      global.Telegram = {
        WebApp: {
          ready: jest.fn(),
          initDataUnsafe: {
            start_param: `invite_${inviteToken}`,
          },
          BackButton: {
            hide: jest.fn(),
          },
          close: jest.fn(),
        },
      };

      // Mock API error
      fetch.mockRejectedValueOnce(new Error("Initialization failed"));

      await formHandlerMain.initializeFormHandler();

      expect(window.formHandlerUI.showError).toHaveBeenCalledWith(
        "Failed to load invitation. Please try again.",
      );
    });
  });
});
