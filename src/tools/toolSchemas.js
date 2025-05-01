/**
 * @fileoverview Defines Zod schemas for validating the input arguments of tool functions.
 * These schemas ensure that data passed to tools (potentially from LLM outputs)
 * conforms to the expected structure and types, improving robustness.
 */

const { z } = require("zod");

// --- stateManager.js Schemas ---
const resetUserStateSchema = z
  .object({
    telegramId: z.string().min(1, { message: "Telegram ID is required" }),
  })
  .describe("Input schema for resetting a user's state.");

const updateUserStateSchema = z
  .object({
    telegramId: z.string().min(1),
    updates: z
      .object({
        state: z.string().optional(),
        session_type: z.string().nullable().optional(),
        conversation_history: z.string().nullable().optional(),
        booking_slot: z
          .string()
          .datetime({ offset: true })
          .nullable()
          .optional(), // ISO 8601
        edit_msg_id: z.number().int().nullable().optional(),
        // Add other user fields as needed
      })
      .refine((updates) => Object.keys(updates).length > 0, {
        message: "At least one update field is required",
      }),
  })
  .describe("Input schema for updating specific fields in a user's state.");

const storeBookingDataSchema = z
  .object({
    telegramId: z.string().min(1),
    bookingSlot: z.string().datetime({ offset: true }), // Require ISO 8601 format
    sessionType: z.string().min(1), // Should likely match IDs from sessionTypes
  })
  .describe("Input schema for storing confirmed booking data.");

const setActiveSessionIdSchema = z
  .object({
    telegramId: z.string().min(1, { message: "Telegram ID is required" }),
    sessionId: z.string().min(1, { message: "Session ID is required" }),
  })
  .describe("Input schema for setting the active session ID for a user.");

const clearActiveSessionIdSchema = z
  .object({
    telegramId: z.string().min(1, { message: "Telegram ID is required" }),
  })
  .describe("Input schema for clearing the active session ID for a user.");

// --- telegramNotifier.js Schemas ---
const sendWaiverLinkSchema = z
  .object({
    telegramId: z.string().min(1),
    sessionType: z.string().min(1),
    messageText: z.string().optional(),
  })
  .describe("Input schema for sending the waiver link message.");

const sendTextMessageSchema = z
  .object({
    telegramId: z.string().min(1),
    text: z.string().min(1, { message: "Message text cannot be empty" }),
  })
  .describe("Input schema for sending a simple text message.");

// --- googleCalendar.js Schemas (for stub inputs) ---
const findFreeSlotsSchema = z
  .object({
    startDate: z.string().datetime({ offset: true }).optional(),
    endDate: z.string().datetime({ offset: true }).optional(),
    durationMinutes: z.number().int().positive().optional(),
  })
  .describe("Input schema for finding free calendar slots (stub).");

const createCalendarEventSchema = z
  .object({
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    summary: z.string().min(1),
    description: z.string().optional(),
    attendeeEmail: z.string().email().optional(), // Example attendee field
  })
  .describe("Input schema for creating a calendar event (stub).");

// --- NEW SCHEMAS --- //

const getUserProfileDataSchema = z
  .object({
    telegramId: z.string().min(1),
  })
  .describe("Input schema for retrieving basic user profile data.");

const getUserPastSessionsSchema = z
  .object({
    telegramId: z.string().min(1),
  })
  .describe("Input schema for retrieving dates of past completed sessions.");

const sendSessionTypeSelectorSchema = z
  .object({
    telegramId: z.string().min(1),
  })
  .describe("Input schema for sending the session type selection buttons.");

// --- Export all schemas ---
module.exports = {
  resetUserStateSchema,
  updateUserStateSchema,
  storeBookingDataSchema,
  sendWaiverLinkSchema,
  sendTextMessageSchema,
  findFreeSlotsSchema,
  createCalendarEventSchema,
  setActiveSessionIdSchema,
  clearActiveSessionIdSchema,
  getUserProfileDataSchema,
  getUserPastSessionsSchema,
  sendSessionTypeSelectorSchema,
};
