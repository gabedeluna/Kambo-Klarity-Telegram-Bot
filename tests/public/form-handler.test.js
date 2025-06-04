/**
 * @file tests/public/form-handler.test.js
 * @description Unit tests for the generic form handler mini-app core logic
 */

// Mock Telegram WebApp
global.Telegram = {
  WebApp: {
    BackButton: {
      show: jest.fn(),
      hide: jest.fn(),
      onClick: jest.fn(),
    },
    close: jest.fn(),
    ready: jest.fn(),
  },
};

// Mock fetch
global.fetch = jest.fn();

// Mock URLSearchParams for URL parameter parsing tests
const mockURLSearchParams = jest.fn();
global.URLSearchParams = mockURLSearchParams;

// Mock window object for basic functionality
global.window = {
  location: {
    search: "",
    href: "",
  },
};

// Mock document for basic DOM operations
global.document = {
  getElementById: jest.fn(),
  createElement: jest.fn(),
  addEventListener: jest.fn(),
  readyState: "complete",
  querySelectorAll: jest.fn(),
};

describe("Form Handler - URL Parameter Parsing", () => {
  let formHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset URLSearchParams mock
    mockURLSearchParams.mockClear();
  });

  test("should parse all required URL parameters correctly", () => {
    const mockParams = new Map([
      ["flowToken", "test-token"],
      ["formType", "KAMBO_WAIVER_V1"],
      ["telegramId", "12345"],
      ["sessionTypeId", "session-1"],
      ["appointmentDateTimeISO", "2025-06-01T10:00:00.000Z"],
      ["placeholderId", "placeholder-123"],
    ]);

    mockURLSearchParams.mockImplementation(() => ({
      get: (key) => mockParams.get(key) || null,
    }));

    // Import the module after setting up mocks
    formHandler = require("../../public/form-handler.js");
    const params = formHandler.parseUrlParameters();

    expect(params.flowToken).toBe("test-token");
    expect(params.formType).toBe("KAMBO_WAIVER_V1");
    expect(params.telegramId).toBe("12345");
    expect(params.sessionTypeId).toBe("session-1");
    expect(params.appointmentDateTimeISO).toBe("2025-06-01T10:00:00.000Z");
    expect(params.placeholderId).toBe("placeholder-123");
  });

  test("should parse optional parameters for friend flow", () => {
    const mockParams = new Map([
      ["flowToken", "test-token"],
      ["formType", "KAMBO_WAIVER_FRIEND_V1"],
      ["telegramId", "67890"],
      ["sessionTypeId", "session-1"],
      ["appointmentDateTimeISO", "2025-06-01T10:00:00.000Z"],
      ["inviteToken", "invite-123"],
      ["primaryBookerName", "John Doe"],
    ]);

    mockURLSearchParams.mockImplementation(() => ({
      get: (key) => mockParams.get(key) || null,
    }));

    formHandler = require("../../public/form-handler.js");
    const params = formHandler.parseUrlParameters();

    expect(params.inviteToken).toBe("invite-123");
    expect(params.primaryBookerName).toBe("John Doe");
  });

  test("should handle missing critical parameters", () => {
    const mockParams = new Map([
      ["formType", "KAMBO_WAIVER_V1"],
      ["telegramId", "12345"],
    ]);

    mockURLSearchParams.mockImplementation(() => ({
      get: (key) => mockParams.get(key) || null,
    }));

    formHandler = require("../../public/form-handler.js");
    const params = formHandler.parseUrlParameters();

    expect(params.flowToken).toBeNull();
    expect(params.sessionTypeId).toBeNull();
  });
});

describe("Form Handler - Data Collection", () => {
  let formHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Mock DOM elements for form data collection
    const mockElements = {
      flowToken: { value: "test-token" },
      telegramId: { value: "12345" },
      sessionTypeId: { value: "session-1" },
      appointmentDateTimeISO: { value: "2025-06-01T10:00:00.000Z" },
      firstName: { value: "John" },
      lastName: { value: "Doe" },
      email: { value: "john@example.com" },
      phone: { value: "1234567890" },
      dob: { value: "1990-01-01" },
      signature: { value: "data:image/png;base64,test" },
    };

    document.getElementById.mockImplementation(
      (id) => mockElements[id] || null,
    );

    // Mock querySelectorAll for contraindications
    document.querySelectorAll.mockImplementation((selector) => {
      if (selector === 'input[name="contraindications"]:checked') {
        return []; // No contraindications selected
      }
      return [];
    });

    formHandler = require("../../public/form-handler.js");
  });

  test("should collect form data correctly", () => {
    const formData = formHandler.collectFormData();

    expect(formData.flowToken).toBe("test-token");
    expect(formData.telegramId).toBe("12345");
    expect(formData.stepId).toBe("waiver_submission");
    expect(formData.stepData.firstName).toBe("John");
    expect(formData.stepData.lastName).toBe("Doe");
    expect(formData.stepData.email).toBe("john@example.com");
    expect(formData.stepData.signature).toBe("data:image/png;base64,test");
  });

  test("should handle missing form elements gracefully", () => {
    // Override mock to return null for some elements
    document.getElementById.mockImplementation((id) => {
      if (id === "firstName" || id === "lastName") return null;
      return { value: "test-value" };
    });

    const formData = formHandler.collectFormData();

    expect(formData.stepData.firstName).toBeUndefined();
    expect(formData.stepData.lastName).toBeUndefined();
  });
});

describe("Form Handler - API Integration", () => {
  let formHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    formHandler = require("../../public/form-handler.js");
  });

  test("should check slot availability for primary bookers", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ success: true, status: "AVAILABLE" }),
    };

    global.fetch.mockResolvedValue(mockResponse);

    const params = {
      placeholderId: "placeholder-123",
      appointmentDateTimeISO: "2025-06-01T10:00:00.000Z",
      sessionTypeId: "session-1",
    };

    const result = await formHandler.checkSlotAvailability(params);

    expect(fetch).toHaveBeenCalledWith(
      "/api/slot-check",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining('"placeholderId":"placeholder-123"'),
      }),
    );

    expect(result).toBe(true);
  });

  test("should return false when slot is no longer available", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ success: true, status: "TAKEN" }),
    };

    global.fetch.mockResolvedValue(mockResponse);

    const params = {
      placeholderId: "placeholder-123",
      appointmentDateTimeISO: "2025-06-01T10:00:00.000Z",
      sessionTypeId: "session-1",
    };

    const result = await formHandler.checkSlotAvailability(params);
    expect(result).toBe(false);
  });

  test("should handle API errors gracefully", async () => {
    global.fetch.mockRejectedValue(new Error("Network error"));

    const params = {
      placeholderId: "placeholder-123",
      appointmentDateTimeISO: "2025-06-01T10:00:00.000Z",
      sessionTypeId: "session-1",
    };

    const result = await formHandler.checkSlotAvailability(params);
    expect(result).toBe(false);
  });
});

describe("Form Handler - Form Validation Logic", () => {
  let formHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    formHandler = require("../../public/form-handler.js");
  });

  test("should validate email format correctly", () => {
    // Test valid emails
    expect(formHandler.validateEmail("john@example.com")).toBe(true);
    expect(formHandler.validateEmail("user.name+tag@domain.co.uk")).toBe(true);

    // Test invalid emails
    expect(formHandler.validateEmail("invalid-email")).toBe(false);
    expect(formHandler.validateEmail("user@")).toBe(false);
    expect(formHandler.validateEmail("@domain.com")).toBe(false);
  });

  test("should validate required fields", () => {
    const mockElements = {
      firstName: {
        value: "John",
        required: true,
        type: "text",
        classList: { add: jest.fn() },
      },
      lastName: {
        value: "",
        required: true,
        type: "text",
        classList: { add: jest.fn() },
      },
      email: {
        value: "john@example.com",
        required: true,
        type: "email",
        classList: { add: jest.fn() },
      },
    };

    document.getElementById.mockImplementation(
      (id) => mockElements[id] || null,
    );

    // Mock querySelectorAll for required fields and error cleanup
    document.querySelectorAll.mockImplementation((selector) => {
      if (selector === "#waiverForm [required], #genericForm [required]") {
        return [
          mockElements.firstName,
          mockElements.lastName,
          mockElements.email,
        ];
      }
      if (
        selector === ".error-outline" ||
        selector === ".error-message.visible"
      ) {
        return []; // No existing errors
      }
      return [];
    });

    const result = formHandler.validateForm();
    expect(result).toBe(false); // Should fail because lastName is empty
  });
});

describe("Form Handler - Response Handling Logic", () => {
  let formHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    formHandler = require("../../public/form-handler.js");
  });

  test("should handle redirect response correctly", () => {
    const response = {
      success: true,
      nextStep: {
        type: "REDIRECT",
        url: "/booking-confirmation",
      },
    };

    // Mock window.location.href setter
    let capturedUrl = "";
    Object.defineProperty(global.window.location, "href", {
      set: (url) => {
        capturedUrl = url;
      },
      get: () => capturedUrl,
      configurable: true,
    });

    formHandler.handleSubmissionResponse(response);

    expect(Telegram.WebApp.BackButton.hide).toHaveBeenCalled();
    expect(capturedUrl).toBe("/booking-confirmation");
  });

  test("should handle completion response correctly", () => {
    const response = {
      success: true,
      nextStep: {
        type: "COMPLETE",
        message: "Form submitted successfully!",
        closeWebApp: true,
      },
    };

    // Mock DOM elements that showSuccess might use
    const mockSuccessMessage = {
      textContent: "",
      classList: { remove: jest.fn() },
    };
    const mockForm = { classList: { add: jest.fn() } };
    const mockLoadingIndicator = {
      innerHTML: "",
      classList: { remove: jest.fn() },
    };

    document.getElementById.mockImplementation((id) => {
      if (id === "successMessage") return mockSuccessMessage;
      if (id === "waiverForm" || id === "genericForm") return mockForm;
      if (id === "loadingIndicator" || id === "loadingSpinner")
        return mockLoadingIndicator;
      return null;
    });

    formHandler.handleSubmissionResponse(response);

    expect(Telegram.WebApp.BackButton.hide).toHaveBeenCalled();
    // Test that the success message was set
    expect(mockSuccessMessage.textContent).toBe("Form submitted successfully!");
    expect(mockSuccessMessage.classList.remove).toHaveBeenCalledWith("hidden");
  });

  test("should handle error response correctly", () => {
    const response = {
      success: false,
      message: "Validation error occurred",
    };

    // Mock DOM elements that showError might use
    const mockErrorMessage = { textContent: "" };
    const mockErrorDisplay = {
      classList: { remove: jest.fn(), add: jest.fn() },
      scrollIntoView: jest.fn(),
    };
    const mockSubmitButton = { disabled: false };

    document.getElementById.mockImplementation((id) => {
      if (id === "errorMessage") return mockErrorMessage;
      if (id === "errorDisplay") return mockErrorDisplay;
      if (id === "submitButton") return mockSubmitButton;
      return null;
    });

    formHandler.handleSubmissionResponse(response);

    // Test that the error message was set
    expect(mockErrorMessage.textContent).toBe("Validation error occurred");
    expect(mockErrorDisplay.classList.remove).toHaveBeenCalledWith("hidden");
  });
});

describe("Form Handler - Integration Tests", () => {
  let formHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Mock complete form elements
    const mockElements = {
      flowToken: { value: "test-token" },
      telegramId: { value: "12345" },
      sessionTypeId: { value: "session-1" },
      firstName: {
        value: "John",
        required: true,
        type: "text",
        classList: { add: jest.fn() },
      },
      lastName: {
        value: "Doe",
        required: true,
        type: "text",
        classList: { add: jest.fn() },
      },
      email: {
        value: "john@example.com",
        required: true,
        type: "email",
        classList: { add: jest.fn() },
      },
      signature: {
        value: "data:image/png;base64,test",
        required: true,
        type: "hidden",
        id: "signature",
        classList: { add: jest.fn() },
      },
      submitButton: { disabled: false },
      errorMessage: { textContent: "" },
      errorDisplay: {
        classList: { remove: jest.fn(), add: jest.fn() },
        scrollIntoView: jest.fn(),
      },
    };

    document.getElementById.mockImplementation(
      (id) => mockElements[id] || null,
    );

    // Mock querySelectorAll for various selectors
    document.querySelectorAll.mockImplementation((selector) => {
      if (selector === "#waiverForm [required], #genericForm [required]") {
        return [
          mockElements.firstName,
          mockElements.lastName,
          mockElements.email,
          mockElements.signature,
        ];
      }
      if (
        selector === ".error-outline" ||
        selector === ".error-message.visible"
      ) {
        return []; // No existing errors
      }
      if (selector === 'input[name="contraindications"]:checked') {
        return []; // No contraindications selected
      }
      return [];
    });

    formHandler = require("../../public/form-handler.js");
  });

  test("should complete full form submission flow for primary booker", async () => {
    // Mock successful slot check
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, status: "AVAILABLE" }),
      })
      // Mock successful form submission
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          nextStep: { type: "REDIRECT", url: "/invite-friends" },
        }),
      });

    const params = {
      placeholderId: "placeholder-123",
      appointmentDateTimeISO: "2025-06-01T10:00:00.000Z",
      sessionTypeId: "session-1",
      flowToken: "test-token",
      telegramId: "12345",
    };

    const mockEvent = { preventDefault: jest.fn() };
    await formHandler.handleFormSubmit(mockEvent, params);

    expect(fetch).toHaveBeenCalledTimes(2); // Slot check + form submission
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/slot-check",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/booking-flow/continue",
      expect.any(Object),
    );
  });

  test("should handle slot unavailable scenario", async () => {
    // Mock slot no longer available
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, status: "TAKEN" }),
    });

    const params = {
      placeholderId: "placeholder-123",
      appointmentDateTimeISO: "2025-06-01T10:00:00.000Z",
      sessionTypeId: "session-1",
    };

    const mockEvent = { preventDefault: jest.fn() };
    await formHandler.handleFormSubmit(mockEvent, params);

    expect(fetch).toHaveBeenCalledTimes(1); // Only slot check, no form submission
  });
});
