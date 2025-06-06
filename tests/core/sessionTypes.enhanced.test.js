/**
 * @file tests/core/sessionTypes.enhanced.test.js
 * @description Tests for enhanced SessionType model with dynamic flow fields
 */

const { PrismaClient } = require("@prisma/client");
const sessionTypes = require("../../src/core/sessionTypes");

// Use a test database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

describe("SessionType Enhanced Model Tests", () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.sessionType.deleteMany({
      where: {
        id: {
          startsWith: "test_",
        },
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.sessionType.deleteMany({
      where: {
        id: {
          startsWith: "test_",
        },
      },
    });
    await prisma.$disconnect();
  });

  describe("Schema Validation", () => {
    test("should create SessionType with new dynamic flow fields", async () => {
      const testSessionType = {
        id: "test_enhanced_session_1",
        label: "Test Enhanced Session",
        durationMinutes: 120,
        description: "Test session with enhanced fields",
        price: 150.0,
        active: true,
        waiverType: "KAMBO_V1",
        allowsGroupInvites: true,
        maxGroupSize: 4,
        customFormDefinitions: { testField: "testValue" },
        updatedAt: new Date(),
      };

      const created = await sessionTypes.createType(testSessionType);

      expect(created).toBeTruthy();
      expect(created.id).toBe(testSessionType.id);
      expect(created.waiverType).toBe("KAMBO_V1");
      expect(created.allowsGroupInvites).toBe(true);
      expect(created.maxGroupSize).toBe(4);
      expect(created.customFormDefinitions).toEqual({ testField: "testValue" });
      expect(created.updatedAt).toBeTruthy();
    });

    test("should use default values for new fields when not specified", async () => {
      const testSessionType = {
        id: "test_defaults_session",
        label: "Test Defaults Session",
        durationMinutes: 90,
        price: 100.0,
        updatedAt: new Date(),
      };

      const created = await sessionTypes.createType(testSessionType);

      expect(created).toBeTruthy();
      expect(created.waiverType).toBe("KAMBO_V1"); // Default
      expect(created.allowsGroupInvites).toBe(false); // Default
      expect(created.maxGroupSize).toBe(1); // Default
      expect(created.customFormDefinitions).toBeNull(); // Default
    });

    test("should handle NONE waiver type", async () => {
      const testSessionType = {
        id: "test_no_waiver_session",
        label: "Test No Waiver Session",
        durationMinutes: 60,
        price: 75.0,
        waiverType: "NONE",
        allowsGroupInvites: false,
        maxGroupSize: 1,
        updatedAt: new Date(),
      };

      const created = await sessionTypes.createType(testSessionType);

      expect(created).toBeTruthy();
      expect(created.waiverType).toBe("NONE");
      expect(created.allowsGroupInvites).toBe(false);
      expect(created.maxGroupSize).toBe(1);
    });

    test("should handle group session configuration", async () => {
      const testSessionType = {
        id: "test_group_session",
        label: "Test Group Session",
        durationMinutes: 180,
        price: 200.0,
        waiverType: "KAMBO_V1",
        allowsGroupInvites: true,
        maxGroupSize: 6,
        updatedAt: new Date(),
      };

      const created = await sessionTypes.createType(testSessionType);

      expect(created).toBeTruthy();
      expect(created.allowsGroupInvites).toBe(true);
      expect(created.maxGroupSize).toBe(6);
    });
  });

  describe("Data Retrieval", () => {
    test("getById should return enhanced fields", async () => {
      // First create a test session type
      const testSessionType = {
        id: "test_retrieval_session",
        label: "Test Retrieval Session",
        durationMinutes: 120,
        price: 150.0,
        waiverType: "KAMBO_ADVANCED_V1",
        allowsGroupInvites: true,
        maxGroupSize: 3,
        customFormDefinitions: { steps: ["waiver", "payment", "confirmation"] },
        updatedAt: new Date(),
      };

      await sessionTypes.createType(testSessionType);

      // Now retrieve it
      const retrieved = await sessionTypes.getById("test_retrieval_session");

      expect(retrieved).toBeTruthy();
      expect(retrieved.id).toBe("test_retrieval_session");
      expect(retrieved.waiverType).toBe("KAMBO_ADVANCED_V1");
      expect(retrieved.allowsGroupInvites).toBe(true);
      expect(retrieved.maxGroupSize).toBe(3);
      expect(retrieved.customFormDefinitions).toEqual({
        steps: ["waiver", "payment", "confirmation"],
      });
      expect(retrieved.updatedAt).toBeTruthy();
    });

    test("getAll should return enhanced fields for all active session types", async () => {
      // Create multiple test session types
      const testSessionTypes = [
        {
          id: "test_all_session_1",
          label: "Test All Session 1",
          durationMinutes: 90,
          price: 100.0,
          waiverType: "KAMBO_V1",
          allowsGroupInvites: false,
          maxGroupSize: 1,
          updatedAt: new Date(),
        },
        {
          id: "test_all_session_2",
          label: "Test All Session 2",
          durationMinutes: 120,
          price: 150.0,
          waiverType: "NONE",
          allowsGroupInvites: true,
          maxGroupSize: 4,
          updatedAt: new Date(),
        },
      ];

      for (const sessionType of testSessionTypes) {
        await sessionTypes.createType(sessionType);
      }

      const allTypes = await sessionTypes.getAll();

      expect(allTypes).toBeTruthy();
      expect(Array.isArray(allTypes)).toBe(true);

      // Find our test session types
      const testType1 = allTypes.find((st) => st.id === "test_all_session_1");
      const testType2 = allTypes.find((st) => st.id === "test_all_session_2");

      expect(testType1).toBeTruthy();
      expect(testType1.waiverType).toBe("KAMBO_V1");
      expect(testType1.allowsGroupInvites).toBe(false);
      expect(testType1.maxGroupSize).toBe(1);

      expect(testType2).toBeTruthy();
      expect(testType2.waiverType).toBe("NONE");
      expect(testType2.allowsGroupInvites).toBe(true);
      expect(testType2.maxGroupSize).toBe(4);
    });
  });

  describe("Update Operations", () => {
    test("should update enhanced fields", async () => {
      // Create initial session type
      const initialData = {
        id: "test_update_session",
        label: "Test Update Session",
        durationMinutes: 90,
        price: 100.0,
        waiverType: "KAMBO_V1",
        allowsGroupInvites: false,
        maxGroupSize: 1,
        updatedAt: new Date(),
      };

      await sessionTypes.createType(initialData);

      // Update with new values
      const updateData = {
        waiverType: "KAMBO_ADVANCED_V1",
        allowsGroupInvites: true,
        maxGroupSize: 5,
        customFormDefinitions: { newField: "newValue" },
      };

      const updated = await sessionTypes.updateType(
        "test_update_session",
        updateData,
      );

      expect(updated).toBeTruthy();
      expect(updated.waiverType).toBe("KAMBO_ADVANCED_V1");
      expect(updated.allowsGroupInvites).toBe(true);
      expect(updated.maxGroupSize).toBe(5);
      expect(updated.customFormDefinitions).toEqual({ newField: "newValue" });
      expect(updated.updatedAt).toBeTruthy();
    });
  });

  describe("Business Logic Validation", () => {
    test("should handle edge case: allowsGroupInvites true with maxGroupSize 1", async () => {
      // This is technically allowed by schema but might be logically inconsistent
      const testSessionType = {
        id: "test_edge_case_session",
        label: "Test Edge Case Session",
        durationMinutes: 90,
        price: 100.0,
        waiverType: "KAMBO_V1",
        allowsGroupInvites: true,
        maxGroupSize: 1, // Edge case: allows invites but max size is 1
        updatedAt: new Date(),
      };

      const created = await sessionTypes.createType(testSessionType);

      expect(created).toBeTruthy();
      expect(created.allowsGroupInvites).toBe(true);
      expect(created.maxGroupSize).toBe(1);

      // Note: Business logic validation should be handled in BookingFlowManager
      // This test just ensures the data can be stored
    });

    test("should handle custom waiver types", async () => {
      const testSessionType = {
        id: "test_custom_waiver_session",
        label: "Test Custom Waiver Session",
        durationMinutes: 120,
        price: 175.0,
        waiverType: "CUSTOM_FORM_XYZ",
        allowsGroupInvites: true,
        maxGroupSize: 3,
        customFormDefinitions: {
          formType: "CUSTOM_FORM_XYZ",
          steps: [
            { type: "waiver", formId: "custom_waiver_1" },
            { type: "medical_history", formId: "medical_form_1" },
            { type: "consent", formId: "consent_form_1" },
          ],
        },
        updatedAt: new Date(),
      };

      const created = await sessionTypes.createType(testSessionType);

      expect(created).toBeTruthy();
      expect(created.waiverType).toBe("CUSTOM_FORM_XYZ");
      expect(created.customFormDefinitions.formType).toBe("CUSTOM_FORM_XYZ");
      expect(created.customFormDefinitions.steps).toHaveLength(3);
    });
  });
});
