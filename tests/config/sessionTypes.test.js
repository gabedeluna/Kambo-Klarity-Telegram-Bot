/**
 * Test suite for sessionTypes configuration
 */

// Mock database response from Prisma
const mockSessionTypes = [
  {
    id: 1,
    label: '1hr-kambo',
    durationMinutes: 60,
    description: 'One hour Kambo session',
    price: 100,
    active: true,
  },
  {
    id: 2,
    label: '2hr-kambo',
    durationMinutes: 120,
    description: 'Two hour Kambo session',
    price: 175,
    active: true,
  },
  {
    id: 3,
    label: '3hr-kambo',
    durationMinutes: 180,
    description: 'Three hour Kambo session (3x3 points)',
    price: 250,
    active: true,
  },
];

// Mock the Prisma client
jest.mock('../../src/core/prisma', () => ({
  sessionType: {
    findMany: jest.fn().mockResolvedValue(mockSessionTypes),
    findUnique: jest.fn().mockImplementation(({ where }) => {
      const sessionType = mockSessionTypes.find(type => type.id === where.id);
      return Promise.resolve(sessionType);
    }),
  },
}));

// Mock logger
jest.mock('../../src/core/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
  })),
}));

// Import the module under test
const { 
  getAll, 
  getById,
  // Other functions as needed 
} = require('../../src/core/sessionTypes');

describe('sessionTypes module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    test('should return all active session types', async () => {
      // Act
      const result = await getAll();

      // Assert
      expect(result).toEqual(mockSessionTypes);
      // Snapshot testing - this will create a snapshot file on first run
      // and compare against it on subsequent runs
      expect(result).toMatchSnapshot();
    });
  });

  describe('getById', () => {
    test('should return session type by ID', async () => {
      // Act
      const result = await getById(2);

      // Assert
      expect(result).toEqual(mockSessionTypes[1]);
      expect(result.label).toBe('2hr-kambo');
    });

    test('should return null for non-existent ID', async () => {
      // Act
      const result = await getById(999);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('session type objects', () => {
    test('should have the correct shape', async () => {
      // Act
      const types = await getAll();

      // Assert
      types.forEach(type => {
        // Check that each session type has the required properties
        expect(type).toHaveProperty('id');
        expect(type).toHaveProperty('label');
        expect(type).toHaveProperty('durationMinutes');
        expect(type).toHaveProperty('description');
        expect(type).toHaveProperty('price');
        expect(type).toHaveProperty('active');
        
        // Check property types
        expect(typeof type.id).toBe('number');
        expect(typeof type.label).toBe('string');
        expect(typeof type.durationMinutes).toBe('number');
        expect(typeof type.description).toBe('string');
        expect(typeof type.price).toBe('number');
        expect(typeof type.active).toBe('boolean');
      });
    });
  });
});