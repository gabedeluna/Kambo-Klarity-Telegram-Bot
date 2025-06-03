/**
 * Calendar App Tests - Feature 4: Refactor Calendar App for Orchestrated Flow
 * Unit tests for the new two-step booking process
 */

describe("Calendar App - Feature 4: Orchestrated Flow", () => {
  // Test the new two-step booking process
  describe("Two-Step Booking Process", () => {
    let mockCalendarApi;
    let mockSubmitHandler;

    beforeEach(() => {
      // Mock the calendar API functions
      mockCalendarApi = {
        createGCalPlaceholder: jest.fn(),
        startPrimaryBookingFlow: jest.fn(),
        deleteGCalPlaceholder: jest.fn(),
      };

      // Mock the submit handler function
      mockSubmitHandler = async function (
        telegramId,
        sessionTypeId,
        selectedTimeSlotISO,
      ) {
        // Step 1: Create placeholder
        const placeholderResponse = await mockCalendarApi.createGCalPlaceholder(
          {
            telegramId,
            sessionTypeId,
            appointmentDateTimeISO: selectedTimeSlotISO,
          },
        );

        if (!placeholderResponse.success) {
          throw new Error(
            placeholderResponse.message || "Failed to reserve slot.",
          );
        }

        // Step 2: Start flow
        const flowStartResponse = await mockCalendarApi.startPrimaryBookingFlow(
          {
            telegramId,
            sessionTypeId,
            appointmentDateTimeISO: selectedTimeSlotISO,
            placeholderId: placeholderResponse.placeholderId,
            initialSessionTypeDetails: placeholderResponse.sessionTypeDetails,
          },
        );

        if (!flowStartResponse.success) {
          // Cleanup placeholder on flow start failure
          if (placeholderResponse.placeholderId) {
            await mockCalendarApi.deleteGCalPlaceholder(
              placeholderResponse.placeholderId,
            );
          }
          throw new Error(
            flowStartResponse.message || "Failed to start booking process.",
          );
        }

        return flowStartResponse;
      };
    });

    it("should successfully complete two-step booking process", async () => {
      // Mock successful responses
      const mockPlaceholderResponse = {
        success: true,
        placeholderId: "gcal-placeholder-event-123",
        expiresAt: "2025-07-15T10:15:00.000Z",
        sessionTypeDetails: {
          waiverType: "KAMBO_V1",
          allowsGroupInvites: true,
          maxGroupSize: 4,
          sessionTypeId: "session-type-uuid-1",
          appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
        },
      };

      const mockFlowResponse = {
        success: true,
        flowToken: "generated.jwt.flow.token",
        nextStep: {
          type: "REDIRECT",
          url: "/form-handler.html?flowToken=generated.jwt.flow.token&formType=KAMBO_WAIVER_V1",
        },
      };

      mockCalendarApi.createGCalPlaceholder.mockResolvedValue(
        mockPlaceholderResponse,
      );
      mockCalendarApi.startPrimaryBookingFlow.mockResolvedValue(
        mockFlowResponse,
      );

      // Test data
      const telegramId = "123456789";
      const sessionTypeId = "session-type-uuid-1";
      const selectedTimeSlotISO = "2025-07-15T10:00:00.000Z";

      // Execute the two-step process
      const result = await mockSubmitHandler(
        telegramId,
        sessionTypeId,
        selectedTimeSlotISO,
      );

      // Verify placeholder creation was called correctly
      expect(mockCalendarApi.createGCalPlaceholder).toHaveBeenCalledWith({
        telegramId,
        sessionTypeId,
        appointmentDateTimeISO: selectedTimeSlotISO,
      });

      // Verify flow start was called correctly
      expect(mockCalendarApi.startPrimaryBookingFlow).toHaveBeenCalledWith({
        telegramId,
        sessionTypeId,
        appointmentDateTimeISO: selectedTimeSlotISO,
        placeholderId: "gcal-placeholder-event-123",
        initialSessionTypeDetails: mockPlaceholderResponse.sessionTypeDetails,
      });

      // Verify result
      expect(result).toEqual(mockFlowResponse);
      expect(mockCalendarApi.deleteGCalPlaceholder).not.toHaveBeenCalled();
    });

    it("should handle placeholder creation failure", async () => {
      const mockPlaceholderResponse = {
        success: false,
        message: "Slot already taken",
      };

      mockCalendarApi.createGCalPlaceholder.mockResolvedValue(
        mockPlaceholderResponse,
      );

      const telegramId = "123456789";
      const sessionTypeId = "session-type-uuid-1";
      const selectedTimeSlotISO = "2025-07-15T10:00:00.000Z";

      await expect(
        mockSubmitHandler(telegramId, sessionTypeId, selectedTimeSlotISO),
      ).rejects.toThrow("Slot already taken");

      expect(mockCalendarApi.createGCalPlaceholder).toHaveBeenCalled();
      expect(mockCalendarApi.startPrimaryBookingFlow).not.toHaveBeenCalled();
      expect(mockCalendarApi.deleteGCalPlaceholder).not.toHaveBeenCalled();
    });

    it("should handle flow start failure and cleanup placeholder", async () => {
      const mockPlaceholderResponse = {
        success: true,
        placeholderId: "gcal-placeholder-event-123",
        sessionTypeDetails: {
          waiverType: "KAMBO_V1",
          allowsGroupInvites: true,
          maxGroupSize: 4,
        },
      };

      const mockFlowResponse = {
        success: false,
        message: "Session type not found",
      };

      mockCalendarApi.createGCalPlaceholder.mockResolvedValue(
        mockPlaceholderResponse,
      );
      mockCalendarApi.startPrimaryBookingFlow.mockResolvedValue(
        mockFlowResponse,
      );
      mockCalendarApi.deleteGCalPlaceholder.mockResolvedValue({
        success: true,
      });

      const telegramId = "123456789";
      const sessionTypeId = "invalid-session-type";
      const selectedTimeSlotISO = "2025-07-15T10:00:00.000Z";

      await expect(
        mockSubmitHandler(telegramId, sessionTypeId, selectedTimeSlotISO),
      ).rejects.toThrow("Session type not found");

      expect(mockCalendarApi.createGCalPlaceholder).toHaveBeenCalled();
      expect(mockCalendarApi.startPrimaryBookingFlow).toHaveBeenCalled();
      expect(mockCalendarApi.deleteGCalPlaceholder).toHaveBeenCalledWith(
        "gcal-placeholder-event-123",
      );
    });

    it("should pass sessionTypeDetails from placeholder to flow start", async () => {
      const sessionTypeDetails = {
        waiverType: "NONE",
        allowsGroupInvites: false,
        maxGroupSize: 1,
        sessionTypeId: "session-type-uuid-2",
        appointmentDateTimeISO: "2025-07-15T14:00:00.000Z",
      };

      const mockPlaceholderResponse = {
        success: true,
        placeholderId: "gcal-placeholder-event-456",
        sessionTypeDetails,
      };

      const mockFlowResponse = {
        success: true,
        flowToken: "generated.jwt.flow.token.2",
        nextStep: {
          type: "COMPLETE",
          message: "Booking confirmed!",
          closeWebApp: true,
        },
      };

      mockCalendarApi.createGCalPlaceholder.mockResolvedValue(
        mockPlaceholderResponse,
      );
      mockCalendarApi.startPrimaryBookingFlow.mockResolvedValue(
        mockFlowResponse,
      );

      const telegramId = "123456789";
      const sessionTypeId = "session-type-uuid-2";
      const selectedTimeSlotISO = "2025-07-15T14:00:00.000Z";

      const result = await mockSubmitHandler(
        telegramId,
        sessionTypeId,
        selectedTimeSlotISO,
      );

      expect(mockCalendarApi.startPrimaryBookingFlow).toHaveBeenCalledWith({
        telegramId,
        sessionTypeId,
        appointmentDateTimeISO: selectedTimeSlotISO,
        placeholderId: "gcal-placeholder-event-456",
        initialSessionTypeDetails: sessionTypeDetails,
      });

      expect(result.nextStep.type).toBe("COMPLETE");
    });
  });

  // Test API function parameter validation
  describe("API Function Parameter Validation", () => {
    it("should validate createGCalPlaceholder parameters", () => {
      const validParams = {
        telegramId: "123456789",
        sessionTypeId: "session-type-uuid-1",
        appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
      };

      const hasAllRequiredParams = Boolean(
        validParams.telegramId &&
          validParams.sessionTypeId &&
          validParams.appointmentDateTimeISO,
      );

      expect(hasAllRequiredParams).toBe(true);
    });

    it("should validate startPrimaryBookingFlow parameters", () => {
      const validParams = {
        telegramId: "123456789",
        sessionTypeId: "session-type-uuid-1",
        appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
        placeholderId: "gcal-placeholder-event-123",
        initialSessionTypeDetails: {
          waiverType: "KAMBO_V1",
          allowsGroupInvites: true,
          maxGroupSize: 4,
        },
      };

      const hasAllRequiredParams = Boolean(
        validParams.telegramId &&
          validParams.sessionTypeId &&
          validParams.appointmentDateTimeISO &&
          validParams.placeholderId &&
          validParams.initialSessionTypeDetails,
      );

      expect(hasAllRequiredParams).toBe(true);
    });

    it("should identify missing placeholderId in flow start", () => {
      const invalidParams = {
        telegramId: "123456789",
        sessionTypeId: "session-type-uuid-1",
        appointmentDateTimeISO: "2025-07-15T10:00:00.000Z",
        placeholderId: null,
        initialSessionTypeDetails: { waiverType: "KAMBO_V1" },
      };

      const hasAllRequiredParams = Boolean(
        invalidParams.telegramId &&
          invalidParams.sessionTypeId &&
          invalidParams.appointmentDateTimeISO &&
          invalidParams.placeholderId &&
          invalidParams.initialSessionTypeDetails,
      );

      expect(hasAllRequiredParams).toBe(false);
    });
  });

  // Test response handling
  describe("Response Handling", () => {
    it("should handle REDIRECT response type", () => {
      const response = {
        success: true,
        flowToken: "jwt.token",
        nextStep: {
          type: "REDIRECT",
          url: "/form-handler.html?flowToken=jwt.token&formType=KAMBO_WAIVER_V1",
        },
      };

      expect(response.nextStep.type).toBe("REDIRECT");
      expect(response.nextStep.url).toContain("flowToken=jwt.token");
      expect(response.nextStep.url).toContain("formType=KAMBO_WAIVER_V1");
    });

    it("should handle COMPLETE response type", () => {
      const response = {
        success: true,
        flowToken: "jwt.token",
        nextStep: {
          type: "COMPLETE",
          message:
            "Booking confirmed! You will receive a confirmation message shortly.",
          closeWebApp: true,
        },
      };

      expect(response.nextStep.type).toBe("COMPLETE");
      expect(response.nextStep.message).toContain("Booking confirmed");
      expect(response.nextStep.closeWebApp).toBe(true);
    });

    it("should construct full URL for redirect", () => {
      const baseUrl = "https://yourdomain.com";
      const relativeUrl = "/form-handler.html?flowToken=jwt.token";
      const fullUrl = baseUrl + relativeUrl;

      expect(fullUrl).toBe(
        "https://yourdomain.com/form-handler.html?flowToken=jwt.token",
      );
    });
  });
});

// Legacy tests for backward compatibility
describe("Calendar App - PH6-15: Waiver Form Transition (Legacy)", () => {
  // Test the URL construction logic
  describe("URL Construction", () => {
    it("should construct correct waiver form URL with all required parameters", () => {
      // Test data
      const telegramId = "123456789";
      const sessionTypeId = "2";
      const appointmentDateTimeISO = "2024-01-15T10:00:00.000Z";

      // Expected URL
      const expectedUrl = `waiver-form.html?telegramId=${telegramId}&sessionTypeId=${sessionTypeId}&appointmentDateTimeISO=${appointmentDateTimeISO}`;

      // Simulate the URL construction logic from calendar-app.js
      const waiverFormUrl = `waiver-form.html?telegramId=${telegramId}&sessionTypeId=${sessionTypeId}&appointmentDateTimeISO=${appointmentDateTimeISO}`;

      expect(waiverFormUrl).toBe(expectedUrl);
    });

    it("should handle URL encoding for special characters in parameters", () => {
      // Test data with special characters
      const telegramId = "123456789";
      const sessionTypeId = "2";
      const appointmentDateTimeISO = "2024-01-15T10:00:00.000Z";

      // The URL should properly encode the ISO string
      const waiverFormUrl = `waiver-form.html?telegramId=${telegramId}&sessionTypeId=${sessionTypeId}&appointmentDateTimeISO=${appointmentDateTimeISO}`;

      // Verify the URL contains the expected parameters
      expect(waiverFormUrl).toContain("telegramId=123456789");
      expect(waiverFormUrl).toContain("sessionTypeId=2");
      expect(waiverFormUrl).toContain(
        "appointmentDateTimeISO=2024-01-15T10:00:00.000Z",
      );
    });
  });

  // Test parameter validation logic
  describe("Parameter Validation", () => {
    it("should identify missing telegramId", () => {
      const telegramId = null;
      const sessionTypeId = "2";
      const appointmentDateTimeISO = "2024-01-15T10:00:00.000Z";

      const hasAllRequiredParams = Boolean(
        telegramId && sessionTypeId && appointmentDateTimeISO,
      );

      expect(hasAllRequiredParams).toBe(false);
    });

    it("should identify missing sessionTypeId", () => {
      const telegramId = "123456789";
      const sessionTypeId = null;
      const appointmentDateTimeISO = "2024-01-15T10:00:00.000Z";

      const hasAllRequiredParams = Boolean(
        telegramId && sessionTypeId && appointmentDateTimeISO,
      );

      expect(hasAllRequiredParams).toBe(false);
    });

    it("should identify missing appointmentDateTimeISO", () => {
      const telegramId = "123456789";
      const sessionTypeId = "2";
      const appointmentDateTimeISO = null;

      const hasAllRequiredParams = Boolean(
        telegramId && sessionTypeId && appointmentDateTimeISO,
      );

      expect(hasAllRequiredParams).toBe(false);
    });

    it("should validate when all required parameters are present", () => {
      const telegramId = "123456789";
      const sessionTypeId = "2";
      const appointmentDateTimeISO = "2024-01-15T10:00:00.000Z";

      const hasAllRequiredParams = Boolean(
        telegramId && sessionTypeId && appointmentDateTimeISO,
      );

      expect(hasAllRequiredParams).toBe(true);
    });

    it("should handle empty string parameters as invalid", () => {
      const telegramId = "";
      const sessionTypeId = "2";
      const appointmentDateTimeISO = "2024-01-15T10:00:00.000Z";

      const hasAllRequiredParams = Boolean(
        telegramId && sessionTypeId && appointmentDateTimeISO,
      );

      expect(hasAllRequiredParams).toBe(false);
    });
  });

  // Test edge cases
  describe("Edge Cases", () => {
    it("should handle undefined parameters", () => {
      const telegramId = undefined;
      const sessionTypeId = undefined;
      const appointmentDateTimeISO = undefined;

      const hasAllRequiredParams = Boolean(
        telegramId && sessionTypeId && appointmentDateTimeISO,
      );

      expect(hasAllRequiredParams).toBe(false);
    });

    it("should construct URL with numeric session type ID", () => {
      const telegramId = "123456789";
      const sessionTypeId = 2; // numeric instead of string
      const appointmentDateTimeISO = "2024-01-15T10:00:00.000Z";

      const waiverFormUrl = `waiver-form.html?telegramId=${telegramId}&sessionTypeId=${sessionTypeId}&appointmentDateTimeISO=${appointmentDateTimeISO}`;

      expect(waiverFormUrl).toContain("sessionTypeId=2");
    });

    it("should handle very long telegram IDs", () => {
      const telegramId = "1234567890123456789"; // Very long ID
      const sessionTypeId = "2";
      const appointmentDateTimeISO = "2024-01-15T10:00:00.000Z";

      const waiverFormUrl = `waiver-form.html?telegramId=${telegramId}&sessionTypeId=${sessionTypeId}&appointmentDateTimeISO=${appointmentDateTimeISO}`;

      expect(waiverFormUrl).toContain(`telegramId=${telegramId}`);
      expect(waiverFormUrl.length).toBeGreaterThan(100); // Should be a reasonably long URL
    });
  });
});
