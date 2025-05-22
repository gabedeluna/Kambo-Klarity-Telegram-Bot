// tests/core/sessionTypes.test.js

// This mock will represent the prisma client instance, specifically its sessionType model
const mockPrismaSessionTypeModel = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// Mock the entire prisma module that sessionTypes.js imports
jest.mock('../../src/core/prisma', () => ({
  sessionType: mockPrismaSessionTypeModel,
  // If sessionTypes.js uses other models from prisma, mock them here too
  // e.g., user: { findUnique: jest.fn() }
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock("../../src/core/logger", () => mockLogger);

let sessionTypes; // Will be required in beforeEach

describe('Core Session Types (sessionTypes.js)', () => {
  beforeEach(() => {
    jest.resetModules(); // Clear module cache

    // Clear mock calls before each test
    // Clear mock calls before each test
    Object.values(mockPrismaSessionTypeModel).forEach(mockFn => mockFn.mockClear());
    Object.values(mockLogger).forEach(mockFn => mockFn.mockClear());
    
    // Require the module under test *after* resetting modules and clearing mocks
    sessionTypes = require('../../src/core/sessionTypes');
  });

  it('should have a getAll function', () => {
    expect(sessionTypes.getAll).toEqual(expect.any(Function));
  });

  it('should have a getById function', () => {
    expect(sessionTypes.getById).toEqual(expect.any(Function));
  });

  it('should have a createType function', () => {
    expect(sessionTypes.createType).toEqual(expect.any(Function));
  });

  it('should have an updateType function', () => {
    expect(sessionTypes.updateType).toEqual(expect.any(Function));
  });

  it('should have a deactivateType function', () => {
    expect(sessionTypes.deactivateType).toEqual(expect.any(Function));
  });

  it('should have a reactivateType function', () => {
    expect(sessionTypes.reactivateType).toEqual(expect.any(Function));
  });

  it('should have a deleteType function', () => {
    expect(sessionTypes.deleteType).toEqual(expect.any(Function));
  });

  describe('getAll', () => {
    it('should call prisma.sessionType.findMany with correct parameters for active types by default', async () => {
      const mockSessionTypes = [{ id: '1', label: 'Test Session 1', active: true }];
      mockPrismaSessionTypeModel.findMany.mockResolvedValueOnce(mockSessionTypes);

      const result = await sessionTypes.getAll();

      expect(mockPrismaSessionTypeModel.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaSessionTypeModel.findMany).toHaveBeenCalledWith({
        where: { active: true },
        orderBy: { label: 'asc' }, // Assuming default ordering by label
      });
      expect(result).toEqual(mockSessionTypes);
    });

    // This test was based on a misunderstanding of getAll's current implementation.
    // getAll currently *only* fetches active: true.
    // If functionality changes to allow fetching all, this test can be reinstated/modified.
    // it('should call prisma.sessionType.findMany allowing inactive types if specified', async () => { ... });

    it('should return an empty array and log error if prisma.sessionType.findMany throws an error', async () => {
      const dbError = new Error('DB connection error');
      mockPrismaSessionTypeModel.findMany.mockRejectedValueOnce(dbError);
      const result = await sessionTypes.getAll();
      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: dbError },
        "[sessionTypes] Error fetching active session types from DB.",
      );
    });

    // Test for findMany returning null is not typical for Prisma, it returns [] or throws.
    // The original test for null can be removed or adapted if there's a specific transformation.
    // For now, focusing on empty array and error cases.
    it('should return an empty array if prisma.sessionType.findMany returns an empty array', async () => {
      mockPrismaSessionTypeModel.findMany.mockResolvedValueOnce([]);
      const result = await sessionTypes.getAll();
      expect(result).toEqual([]);
    });
  });

  describe('getById', () => {
    it('should call prisma.sessionType.findUnique with the provided id', async () => {
      const testId = 'test-session-id';
      const mockSessionType = { id: testId, label: 'Specific Session' };
      mockPrismaSessionTypeModel.findUnique.mockResolvedValueOnce(mockSessionType);

      const result = await sessionTypes.getById(testId);

      expect(mockPrismaSessionTypeModel.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrismaSessionTypeModel.findUnique).toHaveBeenCalledWith({
        where: { id: testId },
      });
      expect(result).toEqual(mockSessionType);
    });

    it('should return null if prisma.sessionType.findUnique returns null (session not found)', async () => {
      const testId = 'non-existent-id';
      mockPrismaSessionTypeModel.findUnique.mockResolvedValueOnce(null);

      const result = await sessionTypes.getById(testId);

      expect(mockPrismaSessionTypeModel.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrismaSessionTypeModel.findUnique).toHaveBeenCalledWith({
        where: { id: testId },
      });
      expect(result).toBeNull();
    });

    it('should return null and log error if prisma.sessionType.findUnique throws an error', async () => {
      const testId = 'error-id';
      const dbError = new Error('DB findUnique error');
      mockPrismaSessionTypeModel.findUnique.mockRejectedValueOnce(dbError);
      const result = await sessionTypes.getById(testId);
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: dbError, id: testId },
        "[sessionTypes] Error fetching session type by ID from DB.",
      );
    });

    it('should return null and log warning for invalid ID types', async () => {
      let result = await sessionTypes.getById(null);
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith({ idReceived: null }, "[sessionTypes] getById called with invalid ID.");
      
      mockLogger.warn.mockClear();
      result = await sessionTypes.getById(123); // Number instead of string
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith({ idReceived: 123 }, "[sessionTypes] getById called with invalid ID.");
    });
  });

  describe('createType', () => {
    const newTypeData = { id: 'new-type', label: 'New Session', durationMinutes: 60, price: "50.00", active: true };
    
    it('should call prisma.sessionType.create with data and return new type', async () => {
      mockPrismaSessionTypeModel.create.mockResolvedValueOnce(newTypeData);
      const result = await sessionTypes.createType(newTypeData);
      expect(mockPrismaSessionTypeModel.create).toHaveBeenCalledWith({ data: newTypeData });
      expect(result).toEqual(newTypeData);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { data: newTypeData },
        "[sessionTypes] Successfully created new session type in DB.",
      );
    });

    it('should return null and log error if prisma.sessionType.create throws an error', async () => {
      const dbError = new Error('DB create error');
      mockPrismaSessionTypeModel.create.mockRejectedValueOnce(dbError);
      const result = await sessionTypes.createType(newTypeData);
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: dbError, data: newTypeData },
        "[sessionTypes] Error creating new session type in DB.",
      );
    });
  });

  describe('updateType', () => {
    const typeId = 'existing-type';
    const updateData = { label: 'Updated Label', price: "75.50" };
    const updatedType = { ...updateData, id: typeId };

    it('should call prisma.sessionType.update with id and data, return updated type', async () => {
      mockPrismaSessionTypeModel.update.mockResolvedValueOnce(updatedType);
      const result = await sessionTypes.updateType(typeId, updateData);
      expect(mockPrismaSessionTypeModel.update).toHaveBeenCalledWith({ where: { id: typeId }, data: updateData });
      expect(result).toEqual(updatedType);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { data: updatedType },
        "[sessionTypes] Successfully updated session type in DB.",
      );
    });

    it('should return null and log warning for invalid ID', async () => {
      const result = await sessionTypes.updateType(null, updateData);
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith({ idReceived: null, data: updateData }, "[sessionTypes] updateType called with invalid ID.");
    });

    it('should return null and log warning if type not found (P2025 error)', async () => {
      const dbError = new Error('Record not found');
      dbError.code = 'P2025';
      mockPrismaSessionTypeModel.update.mockRejectedValueOnce(dbError);
      const result = await sessionTypes.updateType(typeId, updateData);
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { err: dbError, id: typeId, data: updateData },
        "[sessionTypes] Session type not found for update.",
      );
    });

    it('should return null and log error for other prisma errors during update', async () => {
      const dbError = new Error('Other DB update error');
      mockPrismaSessionTypeModel.update.mockRejectedValueOnce(dbError);
      const result = await sessionTypes.updateType(typeId, updateData);
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: dbError, id: typeId, data: updateData },
        "[sessionTypes] Error updating session type in DB.",
      );
    });
  });

  describe('deactivateType', () => {
    const typeId = 'active-type';
    const deactivatedType = { id: typeId, active: false };

    it('should call prisma.sessionType.update to set active to false', async () => {
      mockPrismaSessionTypeModel.update.mockResolvedValueOnce(deactivatedType);
      const result = await sessionTypes.deactivateType(typeId);
      expect(mockPrismaSessionTypeModel.update).toHaveBeenCalledWith({ where: { id: typeId }, data: { active: false } });
      expect(result).toEqual(deactivatedType);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { data: deactivatedType },
        "[sessionTypes] Successfully deactivated session type in DB.",
      );
    });
    it('should return null and log warning for invalid ID', async () => {
      const result = await sessionTypes.deactivateType(null);
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith({ idReceived: null }, "[sessionTypes] deactivateType called with invalid ID.");
    });

    it('should return null and log warning if type not found (P2025 error) for deactivation', async () => {
      const dbError = new Error('Record not found');
      dbError.code = 'P2025';
      mockPrismaSessionTypeModel.update.mockRejectedValueOnce(dbError);
      const result = await sessionTypes.deactivateType(typeId);
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { err: dbError, id: typeId },
        "[sessionTypes] Session type not found for deactivation.",
      );
    });

    it('should return null and log error for other prisma errors during deactivation', async () => {
      const dbError = new Error('Other DB deactivate error');
      mockPrismaSessionTypeModel.update.mockRejectedValueOnce(dbError);
      const result = await sessionTypes.deactivateType(typeId);
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: dbError, id: typeId },
        "[sessionTypes] Error deactivating session type in DB.",
      );
    });
  });

  describe('reactivateType', () => {
    const typeId = 'inactive-type';
    const reactivatedType = { id: typeId, active: true };

    it('should call prisma.sessionType.update to set active to true', async () => {
      mockPrismaSessionTypeModel.update.mockResolvedValueOnce(reactivatedType);
      const result = await sessionTypes.reactivateType(typeId);
      expect(mockPrismaSessionTypeModel.update).toHaveBeenCalledWith({ where: { id: typeId }, data: { active: true } });
      expect(result).toEqual(reactivatedType);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { data: reactivatedType },
        "[sessionTypes] Successfully reactivated session type in DB.",
      );
    });
    it('should return null and log warning for invalid ID', async () => {
      const result = await sessionTypes.reactivateType(null);
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith({ idReceived: null }, "[sessionTypes] reactivateType called with invalid ID.");
    });

    it('should return null and log warning if type not found (P2025 error) for reactivation', async () => {
      const dbError = new Error('Record not found');
      dbError.code = 'P2025';
      mockPrismaSessionTypeModel.update.mockRejectedValueOnce(dbError);
      const result = await sessionTypes.reactivateType(typeId);
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { err: dbError, id: typeId },
        "[sessionTypes] Session type not found for reactivation.",
      );
    });

    it('should return null and log error for other prisma errors during reactivation', async () => {
      const dbError = new Error('Other DB reactivate error');
      mockPrismaSessionTypeModel.update.mockRejectedValueOnce(dbError);
      const result = await sessionTypes.reactivateType(typeId);
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: dbError, id: typeId },
        "[sessionTypes] Error reactivating session type in DB.",
      );
    });
  });

  describe('deleteType', () => {
    const typeId = 'type-to-delete';
    const deletedType = { id: typeId, label: 'Deleted Session' };

    it('should call prisma.sessionType.delete with id and return deleted type', async () => {
      mockPrismaSessionTypeModel.delete.mockResolvedValueOnce(deletedType);
      const result = await sessionTypes.deleteType(typeId);
      expect(mockPrismaSessionTypeModel.delete).toHaveBeenCalledWith({ where: { id: typeId } });
      expect(result).toEqual(deletedType);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { data: deletedType },
        "[sessionTypes] Successfully deleted session type from DB.",
      );
    });
    
    it('should return null and log warning for invalid ID', async () => {
      const result = await sessionTypes.deleteType(null);
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith({ idReceived: null }, "[sessionTypes] deleteType called with invalid ID.");
    });

    it('should return null and log warning if type not found (P2025 error)', async () => {
      const dbError = new Error('Record not found');
      dbError.code = 'P2025';
      mockPrismaSessionTypeModel.delete.mockRejectedValueOnce(dbError);
      const result = await sessionTypes.deleteType(typeId);
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { err: dbError, id: typeId },
        "[sessionTypes] Session type not found for deletion.",
      );
    });

    it('should return null and log error for other prisma errors during delete', async () => {
      const dbError = new Error('Other DB delete error');
      mockPrismaSessionTypeModel.delete.mockRejectedValueOnce(dbError);
      const result = await sessionTypes.deleteType(typeId);
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: dbError, id: typeId },
        "[sessionTypes] Error deleting session type from DB.",
      );
    });
  });
});