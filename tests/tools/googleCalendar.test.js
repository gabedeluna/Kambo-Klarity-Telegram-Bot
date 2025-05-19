/**
 * Test suite for googleCalendar.js module
 * 
 * Note: This test focuses on the core functionality without schema validation
 * as toolSchemas.js has been removed from the project.
 */

// Mock Google APIs
const mockCalendar = {
  events: {
    list: jest.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: 'event1',
            summary: 'Existing appointment',
            start: { dateTime: '2025-05-20T10:00:00Z' },
            end: { dateTime: '2025-05-20T11:00:00Z' }
          }
        ]
      }
    }),
    insert: jest.fn().mockResolvedValue({
      data: {
        id: 'new-event-id',
        htmlLink: 'https://calendar.google.com/event?id=new-event-id'
      }
    }),
    delete: jest.fn().mockResolvedValue({})
  },
  freebusy: {
    query: jest.fn().mockResolvedValue({
      data: {
        calendars: {
          'primary': {
            busy: [
              {
                start: '2025-05-20T10:00:00Z',
                end: '2025-05-20T11:00:00Z'
              }
            ]
          }
        }
      }
    })
  }
};

const mockGoogleAuth = {
  getClient: jest.fn().mockResolvedValue({})
};

const mockGoogle = {
  calendar: jest.fn().mockReturnValue(mockCalendar),
  auth: {
    GoogleAuth: jest.fn().mockReturnValue(mockGoogleAuth)
  }
};

jest.mock('googleapis', () => ({
  google: mockGoogle
}));

// Mock Prisma
const mockAvailabilityRules = [
  {
    id: 1,
    day_of_week: 1, // Monday
    start_time: '09:00',
    end_time: '17:00',
    timezone: 'America/Los_Angeles',
    max_bookings_per_day: 3,
    buffer_time_minutes: 30,
    slot_increment_minutes: 30
  }
];

jest.mock('../../src/core/prisma', () => ({
  availabilityRule: {
    findMany: jest.fn().mockResolvedValue(mockAvailabilityRules)
  }
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
};

jest.mock('../../src/core/logger', () => mockLogger);

// Import module under test
const { 
  findFreeSlots,
  createCalendarEvent,
  deleteCalendarEvent 
} = require('../../src/tools/googleCalendar');

describe('googleCalendar.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('findFreeSlots', () => {
    test('should return available time slots', async () => {
      // Arrange
      const startDate = '2025-05-20';
      const endDate = '2025-05-21';
      const sessionDurationMinutes = 60;
      
      // Act
      const result = await findFreeSlots(startDate, endDate, sessionDurationMinutes);
      
      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalled();
    });
    
    test('should handle errors when fetching availability', async () => {
      // Arrange
      const startDate = '2025-05-20';
      const endDate = '2025-05-21';
      const sessionDurationMinutes = 60;
      const error = new Error('API error');
      
      mockCalendar.freebusy.query.mockRejectedValueOnce(error);
      
      // Act & Assert
      await expect(findFreeSlots(startDate, endDate, sessionDurationMinutes))
        .rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(error, expect.any(String));
    });
  });
  
  describe('createCalendarEvent', () => {
    test('should create a calendar event successfully', async () => {
      // Arrange
      const eventDetails = {
        summary: 'Kambo Session',
        description: 'Client appointment',
        start: '2025-05-20T15:00:00Z',
        end: '2025-05-20T16:00:00Z',
        clientName: 'Test Client',
        clientEmail: 'test@example.com'
      };
      
      // Act
      const result = await createCalendarEvent(eventDetails);
      
      // Assert
      expect(result).toHaveProperty('eventId', 'new-event-id');
      expect(result).toHaveProperty('eventLink');
      expect(mockCalendar.events.insert).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalled();
    });
    
    test('should handle errors when creating an event', async () => {
      // Arrange
      const eventDetails = {
        summary: 'Kambo Session',
        start: '2025-05-20T15:00:00Z',
        end: '2025-05-20T16:00:00Z'
      };
      const error = new Error('API error');
      
      mockCalendar.events.insert.mockRejectedValueOnce(error);
      
      // Act & Assert
      await expect(createCalendarEvent(eventDetails))
        .rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(error, expect.any(String));
    });
  });
  
  describe('deleteCalendarEvent', () => {
    test('should delete a calendar event successfully', async () => {
      // Arrange
      const eventId = 'event-to-delete';
      
      // Act
      const result = await deleteCalendarEvent(eventId);
      
      // Assert
      expect(result).toBe(true);
      expect(mockCalendar.events.delete).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId
      });
      expect(mockLogger.info).toHaveBeenCalled();
    });
    
    test('should handle errors when deleting an event', async () => {
      // Arrange
      const eventId = 'event-to-delete';
      const error = new Error('API error');
      
      mockCalendar.events.delete.mockRejectedValueOnce(error);
      
      // Act & Assert
      await expect(deleteCalendarEvent(eventId))
        .rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(error, expect.any(String));
    });
  });
});