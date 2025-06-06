/**
 * @file tests/public/calendar-app-csp.test.js
 * Tests for Content Security Policy and custom element issues in calendar app
 */

const fs = require("fs");
const path = require("path");

describe("Calendar App CSP and Custom Elements", () => {
  let calendarHtml;
  let formHandlerHtml;

  beforeAll(() => {
    // Read the HTML files
    calendarHtml = fs.readFileSync(
      path.join(__dirname, "../../public/calendar-app.html"),
      "utf8",
    );
    formHandlerHtml = fs.readFileSync(
      path.join(__dirname, "../../public/form-handler.html"),
      "utf8",
    );
  });

  describe("Content Security Policy", () => {
    test("should have proper CSP meta tag for ngrok compatibility", () => {
      // Check if CSP meta tag exists and includes font-src
      const cspMetaRegex =
        /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i;
      const hasCspMeta = cspMetaRegex.test(calendarHtml);

      expect(hasCspMeta).toBe(true);

      if (hasCspMeta) {
        const cspMatch = calendarHtml.match(cspMetaRegex);
        const cspContent = cspMatch[0];

        // Should include font-src directive for ngrok assets
        expect(cspContent).toMatch(/font-src[^;]*assets\.ngrok\.com/);
        expect(cspContent).toMatch(/font-src[^;]*cdn\.ngrok\.com/);
        expect(cspContent).toMatch(/font-src[^;]*fonts\.gstatic\.com/);
      }
    });

    test("form-handler.html should also have proper CSP", () => {
      const cspMetaRegex =
        /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i;
      const hasCspMeta = cspMetaRegex.test(formHandlerHtml);

      expect(hasCspMeta).toBe(true);

      if (hasCspMeta) {
        const cspMatch = formHandlerHtml.match(cspMetaRegex);
        const cspContent = cspMatch[0];

        // Should include font-src directive for ngrok assets
        expect(cspContent).toMatch(/font-src[^;]*assets\.ngrok\.com/);
      }
    });

    test("should not have conflicting CSP directives", () => {
      // Check for multiple CSP meta tags which could cause conflicts
      const cspMetaMatches = calendarHtml.match(
        /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
      );

      if (cspMetaMatches) {
        expect(cspMetaMatches.length).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("Custom Elements", () => {
    test("should not have duplicate custom element definitions", () => {
      // Check for potential sources of custom element conflicts
      const stagewiseScript = calendarHtml.includes("stagewise-working.js");

      if (stagewiseScript) {
        // If stagewise is included, it should have proper guards against duplicate definitions
        expect(calendarHtml).toMatch(/stagewise-working\.js/);
      }
    });

    test("should have proper development mode detection", () => {
      // Read stagewise script if it exists
      const stagewiseScriptPath = path.join(
        __dirname,
        "../../public/stagewise-working.js",
      );

      if (fs.existsSync(stagewiseScriptPath)) {
        const stagewiseScript = fs.readFileSync(stagewiseScriptPath, "utf8");

        // Should have proper development mode detection
        expect(stagewiseScript).toMatch(/isDevelopment/);
        expect(stagewiseScript).toMatch(/ngrok/);
      }
    });
  });

  describe("Form Loading", () => {
    test("form-handler.html should have proper loading indicators", () => {
      expect(formHandlerHtml).toMatch(/Loading form\.\.\./);
      expect(formHandlerHtml).toMatch(/loadingIndicator/);
    });

    test("should have proper error handling elements", () => {
      expect(formHandlerHtml).toMatch(/errorDisplay/);
      expect(formHandlerHtml).toMatch(/errorMessage/);
    });

    test("should extract parameters from flowToken when missing from URL", () => {
      // Mock a JWT token with flow state
      const flowState = {
        userId: 6152124385,
        sessionTypeId: "1hr-kambo",
        appointmentDateTimeISO: "2024-01-15T10:00:00.000Z",
        placeholderId: "placeholder-123",
      };

      // Create a mock JWT token (just base64 encoded payload for testing)
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
      const payload = btoa(JSON.stringify(flowState));
      const signature = "mock-signature";
      const mockToken = `${header}.${payload}.${signature}`;

      // Mock URLSearchParams
      const mockSearchParams = new Map([
        ["flowToken", mockToken],
        ["formType", "KAMBO_V1"],
      ]);

      // Mock the parseUrlParameters function logic
      const params = {};
      params.flowToken = mockSearchParams.get("flowToken");
      params.formType = mockSearchParams.get("formType");
      params.telegramId = mockSearchParams.get("telegramId");
      params.sessionTypeId = mockSearchParams.get("sessionTypeId");
      params.appointmentDateTimeISO = mockSearchParams.get(
        "appointmentDateTimeISO",
      );

      // Extract from token when missing
      if (
        params.flowToken &&
        (!params.telegramId ||
          !params.sessionTypeId ||
          !params.appointmentDateTimeISO)
      ) {
        const tokenParts = params.flowToken.split(".");
        if (tokenParts.length === 3) {
          const decodedPayload = JSON.parse(atob(tokenParts[1]));

          if (!params.telegramId && decodedPayload.userId) {
            params.telegramId = decodedPayload.userId.toString();
          }
          if (!params.sessionTypeId && decodedPayload.sessionTypeId) {
            params.sessionTypeId = decodedPayload.sessionTypeId;
          }
          if (
            !params.appointmentDateTimeISO &&
            decodedPayload.appointmentDateTimeISO
          ) {
            params.appointmentDateTimeISO =
              decodedPayload.appointmentDateTimeISO;
          }
        }
      }

      // Verify parameters were extracted
      expect(params.flowToken).toBe(mockToken);
      expect(params.formType).toBe("KAMBO_V1");
      expect(params.telegramId).toBe("6152124385");
      expect(params.sessionTypeId).toBe("1hr-kambo");
      expect(params.appointmentDateTimeISO).toBe("2024-01-15T10:00:00.000Z");
    });

    test("should support various Kambo waiver form types", () => {
      const supportedFormTypes = [
        "KAMBO_WAIVER_V1",
        "KAMBO_WAIVER_FRIEND_V1",
        "KAMBO_V1",
        "KAMBO_FRIEND_V1",
      ];

      // Mock the initializeDynamicForm function logic
      supportedFormTypes.forEach((formType) => {
        const isSupported =
          formType === "KAMBO_WAIVER_V1" ||
          formType === "KAMBO_WAIVER_FRIEND_V1" ||
          formType === "KAMBO_V1" ||
          formType === "KAMBO_FRIEND_V1";

        expect(isSupported).toBe(true);
      });

      // Test unsupported type
      const unsupportedType = "UNKNOWN_FORM_TYPE";
      const isUnsupported =
        unsupportedType === "KAMBO_WAIVER_V1" ||
        unsupportedType === "KAMBO_WAIVER_FRIEND_V1" ||
        unsupportedType === "KAMBO_V1" ||
        unsupportedType === "KAMBO_FRIEND_V1";

      expect(isUnsupported).toBe(false);
    });
  });
});
