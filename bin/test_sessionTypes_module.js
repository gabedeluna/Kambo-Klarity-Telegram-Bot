// bin/test_sessionTypes_module.js
// Temporary script for manually testing the refactored sessionTypes.js

// Set NODE_ENV to 'test' to ensure standard logging and disable pino-pretty
process.env.NODE_ENV = "test";

// Ensure environment variables are loaded if your prisma client depends on them
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const sessionTypes = require("../src/core/sessionTypes");
const prisma = require("../src/core/prisma"); // To disconnect
const { Decimal } = require("@prisma/client/runtime/library"); // For asserting price

async function runTests() {
  console.log("--- Starting Manual Test for sessionTypes.js (Full CRUD) ---");
  let testsPassed = 0;
  let testsFailed = 0;
  const testTypeId = `test-session-${Date.now()}`;
  let createdTestType;

  async function testWrapper(description, testFn) {
    console.log(`\n[TESTING] ${description}...`);
    try {
      await testFn();
      console.log(`[SUCCESS] ${description}`);
      testsPassed++;
    } catch (e) {
      console.error(`[FAILED] ${description}`);
      console.error("Error details:", e.message);
      if (e.stack)
        console.error("Stack:", e.stack.split("\n").slice(1, 5).join("\n")); // Log first few lines of stack
      testsFailed++;
    }
  }

  // 0. Initial getAll (optional, to see state before)
  await testWrapper("Initial sessionTypes.getAll()", async () => {
    const allTypes = await sessionTypes.getAll();
    console.log("Initial active types count:", allTypes.length);
    if (!Array.isArray(allTypes))
      throw new Error("getAll did not return an array.");
  });

  // 1. Create Type
  const newTypeData = {
    id: testTypeId,
    label: "Test Kambo Session",
    durationMinutes: 90,
    description: "A test session for Kambo, 90 minutes long.",
    price: "120.50", // Prisma Decimal, provide as string
  };
  await testWrapper("1. sessionTypes.createType()", async () => {
    createdTestType = await sessionTypes.createType(newTypeData);
    console.log(
      "Create result:",
      createdTestType
        ? {
            id: createdTestType.id,
            label: createdTestType.label,
            price: createdTestType.price.toString(),
          }
        : "null",
    );
    if (!createdTestType) throw new Error("createType returned null");
    if (createdTestType.id !== newTypeData.id)
      throw new Error(
        `ID mismatch: expected ${newTypeData.id}, got ${createdTestType.id}`,
      );
    if (createdTestType.label !== newTypeData.label)
      throw new Error("Label mismatch");
    if (!createdTestType.price.equals(new Decimal(newTypeData.price)))
      throw new Error("Price mismatch");
  });

  // 2. Read Type (getById)
  await testWrapper(
    `2. sessionTypes.getById("${testTypeId}") after create`,
    async () => {
      if (!createdTestType) {
        console.log("Skipping read as create failed.");
        throw new Error("Create step failed, cannot read");
      }
      const fetchedType = await sessionTypes.getById(testTypeId);
      console.log(
        "Fetched after create:",
        fetchedType
          ? {
              id: fetchedType.id,
              label: fetchedType.label,
              price: fetchedType.price.toString(),
            }
          : "null",
      );
      if (!fetchedType)
        throw new Error("getById returned null for newly created type");
      if (fetchedType.id !== newTypeData.id)
        throw new Error("ID mismatch on read");
      if (fetchedType.description !== newTypeData.description)
        throw new Error("Description mismatch on read");
      if (!fetchedType.price.equals(new Decimal(newTypeData.price)))
        throw new Error("Price mismatch on read");
      if (fetchedType.active !== true)
        throw new Error("Newly created type should be active");
    },
  );

  // 3. Update Type
  const updateData = {
    description: "An updated test session for Kambo, now with more details.",
    price: "130.75",
  };
  await testWrapper(`3. sessionTypes.updateType("${testTypeId}")`, async () => {
    if (!createdTestType) {
      console.log("Skipping update as create failed.");
      throw new Error("Create step failed, cannot update");
    }
    const updatedType = await sessionTypes.updateType(testTypeId, updateData);
    console.log(
      "Update result:",
      updatedType
        ? {
            id: updatedType.id,
            description: updatedType.description,
            price: updatedType.price.toString(),
          }
        : "null",
    );
    if (!updatedType) throw new Error("updateType returned null");
    if (updatedType.description !== updateData.description)
      throw new Error("Description mismatch on update");
    if (!updatedType.price.equals(new Decimal(updateData.price)))
      throw new Error("Price mismatch on update");
    // Check original fields not changed
    if (updatedType.label !== newTypeData.label)
      throw new Error("Label changed during update unexpectedly");
  });

  // 4. Read Type (getById) after update
  await testWrapper(
    `4. sessionTypes.getById("${testTypeId}") after update`,
    async () => {
      if (!createdTestType) {
        console.log("Skipping read post-update as create failed.");
        throw new Error("Create step failed, cannot read post-update");
      }
      const fetchedAfterUpdate = await sessionTypes.getById(testTypeId);
      console.log(
        "Fetched after update:",
        fetchedAfterUpdate
          ? {
              id: fetchedAfterUpdate.id,
              description: fetchedAfterUpdate.description,
              price: fetchedAfterUpdate.price.toString(),
            }
          : "null",
      );
      if (!fetchedAfterUpdate)
        throw new Error("getById returned null after update");
      if (fetchedAfterUpdate.description !== updateData.description)
        throw new Error("Updated description not found");
      if (!fetchedAfterUpdate.price.equals(new Decimal(updateData.price)))
        throw new Error("Updated price not found");
    },
  );

  // 5. Deactivate Type
  await testWrapper(
    `5. sessionTypes.deactivateType("${testTypeId}")`,
    async () => {
      if (!createdTestType) {
        console.log("Skipping deactivate as create failed.");
        throw new Error("Create step failed, cannot deactivate");
      }
      const deactivatedType = await sessionTypes.deactivateType(testTypeId);
      console.log(
        "Deactivate result:",
        deactivatedType
          ? { id: deactivatedType.id, active: deactivatedType.active }
          : "null",
      );
      if (!deactivatedType) throw new Error("deactivateType returned null");
      if (deactivatedType.active !== false)
        throw new Error("Type was not deactivated (active is not false)");
    },
  );

  // 6. Read Type (getById) after deactivate
  await testWrapper(
    `6. sessionTypes.getById("${testTypeId}") after deactivate`,
    async () => {
      if (!createdTestType) {
        console.log("Skipping read post-deactivate as create failed.");
        throw new Error("Create step failed, cannot read post-deactivate");
      }
      const fetchedAfterDeactivate = await sessionTypes.getById(testTypeId);
      console.log(
        "Fetched after deactivate:",
        fetchedAfterDeactivate
          ? {
              id: fetchedAfterDeactivate.id,
              active: fetchedAfterDeactivate.active,
            }
          : "null",
      );
      if (!fetchedAfterDeactivate)
        throw new Error(
          "Type should still be findable by ID after deactivation, even if inactive.",
        );
      if (fetchedAfterDeactivate.active !== false)
        throw new Error("Type should be inactive after deactivation");
    },
  );

  // 7. getAll after deactivate (to confirm it's not in active list)
  await testWrapper("7. sessionTypes.getAll() after deactivate", async () => {
    if (!createdTestType) {
      console.log("Skipping getAll post-deactivate as create failed.");
      throw new Error("Create step failed, cannot check getAll");
    }
    const allActiveTypes = await sessionTypes.getAll();
    const stillExistsInActiveList = allActiveTypes.find(
      (type) => type.id === testTypeId,
    );
    console.log(
      `getAll after deactivate - Count: ${allActiveTypes.length}. Test type ${testTypeId} found in active list: ${!!stillExistsInActiveList}`,
    );
    if (stillExistsInActiveList)
      throw new Error(
        `Deactivated type ${testTypeId} should not be in getAll() results`,
      );
  });

  // 8. Reactivate Type
  await testWrapper(
    `8. sessionTypes.reactivateType("${testTypeId}")`,
    async () => {
      if (!createdTestType) {
        console.log("Skipping reactivate as create failed.");
        throw new Error("Create step failed, cannot reactivate");
      }
      const reactivatedType = await sessionTypes.reactivateType(testTypeId);
      console.log(
        "Reactivate result:",
        reactivatedType
          ? { id: reactivatedType.id, active: reactivatedType.active }
          : "null",
      );
      if (!reactivatedType) throw new Error("reactivateType returned null");
      if (reactivatedType.active !== true)
        throw new Error("Type was not reactivated (active is not true)");
    },
  );

  // 9. Read Type (getById) after reactivate
  await testWrapper(
    `9. sessionTypes.getById("${testTypeId}") after reactivate`,
    async () => {
      if (!createdTestType) {
        console.log("Skipping read post-reactivate as create failed.");
        throw new Error("Create step failed, cannot read post-reactivate");
      }
      const fetchedAfterReactivate = await sessionTypes.getById(testTypeId);
      console.log(
        "Fetched after reactivate:",
        fetchedAfterReactivate
          ? {
              id: fetchedAfterReactivate.id,
              active: fetchedAfterReactivate.active,
            }
          : "null",
      );
      if (!fetchedAfterReactivate)
        throw new Error("getById returned null after reactivation");
      if (fetchedAfterReactivate.active !== true)
        throw new Error("Type should be active after reactivation");
    },
  );

  // 10. getAll after reactivate (to confirm it's back in active list)
  await testWrapper("10. sessionTypes.getAll() after reactivate", async () => {
    if (!createdTestType) {
      console.log("Skipping getAll post-reactivate as create failed.");
      throw new Error("Create step failed, cannot check getAll");
    }
    const allActiveTypes = await sessionTypes.getAll();
    const existsInActiveList = allActiveTypes.find(
      (type) => type.id === testTypeId,
    );
    console.log(
      `getAll after reactivate - Count: ${allActiveTypes.length}. Test type ${testTypeId} found in active list: ${!!existsInActiveList}`,
    );
    if (!existsInActiveList)
      throw new Error(
        `Reactivated type ${testTypeId} should be in getAll() results`,
      );
  });

  // 11. Delete Type (Hard Delete)
  await testWrapper(
    `11. sessionTypes.deleteType("${testTypeId}") (hard delete)`,
    async () => {
      if (!createdTestType) {
        console.log("Skipping hard delete as create failed.");
        throw new Error("Create step failed, cannot hard delete");
      }
      const deleteResult = await sessionTypes.deleteType(testTypeId);
      console.log(
        "Hard delete result:",
        deleteResult ? { id: deleteResult.id } : "null",
      );
      if (!deleteResult)
        throw new Error("deleteType (hard delete) returned null");
      if (deleteResult.id !== testTypeId)
        throw new Error("Hard delete returned wrong ID");
    },
  );

  // 12. Read Type (getById) after hard delete
  await testWrapper(
    `12. sessionTypes.getById("${testTypeId}") after hard delete`,
    async () => {
      if (!createdTestType) {
        console.log("Skipping read post-hard-delete as create failed.");
        throw new Error("Create step failed, cannot read post-hard-delete");
      }
      const fetchedAfterHardDelete = await sessionTypes.getById(testTypeId);
      console.log("Fetched after hard delete:", fetchedAfterHardDelete);
      if (fetchedAfterHardDelete !== null)
        throw new Error(
          "Type should NOT be findable by ID after hard delete (should be null)",
        );
    },
  );

  // --- Original Tests (can be kept or removed if redundant) ---
  const existingId = "1hr-kambo"; // Assuming this ID exists
  await testWrapper(
    `sessionTypes.getById("${existingId}") (existing record)`,
    async () => {
      const type1 = await sessionTypes.getById(existingId);
      console.log(`Expected: Object for ID "${existingId}".`);
      console.log(
        `Actual Result (getById - "${existingId}"):`,
        type1 ? `ID: ${type1.id}, Label: ${type1.label}` : "null",
      );
      if (!type1 && existingId === "1hr-kambo")
        console.warn(
          "WARN: '1hr-kambo' not found, ensure it exists for this test to be meaningful.",
        );
      // if (!type1 && existingId === "1hr-kambo") throw new Error(`getById failed for existing ID: ${existingId}`); // Make this strict if '1hr-kambo' MUST exist
    },
  );

  const nonExistentId = "non-existent-id-really";
  await testWrapper(
    `sessionTypes.getById("${nonExistentId}") (non-existent record)`,
    async () => {
      const typeNotFound = await sessionTypes.getById(nonExistentId);
      console.log(`Expected: null (for ID "${nonExistentId}").`);
      console.log(
        `Actual Result (getById - "${nonExistentId}"):`,
        typeNotFound,
      );
      if (typeNotFound !== null)
        throw new Error(
          `getById did not return null for non-existent ID: ${nonExistentId}`,
        );
    },
  );

  const invalidId = 12345; // Number instead of string
  await testWrapper(
    `sessionTypes.getById(${invalidId}) (invalid format)`,
    async () => {
      const typeInvalid = await sessionTypes.getById(invalidId);
      console.log(`Expected: null (for invalid ID ${invalidId}).`);
      console.log(`Actual Result (getById - ${invalidId}):`, typeInvalid);
      if (typeInvalid !== null)
        throw new Error(
          `getById did not return null for invalid ID: ${invalidId}`,
        );
    },
  );

  console.log("\n--- Manual Test Finished ---");
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);

  try {
    await prisma.$disconnect();
    console.log("Prisma client disconnected successfully.");
  } catch (disconnectError) {
    console.error("Error disconnecting Prisma client:", disconnectError);
  }

  if (testsFailed > 0) {
    console.error("\nSome tests failed. Exiting with error code 1.");
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Unhandled error in runTests:", e.message);
  if (e.stack)
    console.error("Stack:", e.stack.split("\n").slice(1, 5).join("\n"));
  process.exit(1);
});
