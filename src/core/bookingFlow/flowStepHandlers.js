/**
 * @module core/bookingFlow/flowStepHandlers
 * @description Step handlers for booking flow processing
 */

const prisma = require("../prisma");
const sessionTypesCore = require("../sessionTypes");
const googleCalendarTool = require("../../tools/googleCalendar");
const telegramNotifier = require("../../tools/telegramNotifier");
const logger = require("../logger");
const { generateFlowToken } = require("./flowTokenManager");

/**
 * Determines the next step in a booking flow based on current state and session type configuration
 * @param {object} flowState - Current flow state
 * @param {object} sessionType - Session type configuration
 * @returns {object} Next step information with action details
 */
function determineNextStep(flowState, sessionType) {
  logger.debug(
    { flowState, sessionTypeId: sessionType.id },
    "[FlowStepHandlers] Determining next step",
  );

  const { currentStep, flowType } = flowState;

  // Primary booking flow logic
  if (flowType === "primary_booking") {
    if (currentStep === "initial") {
      if (sessionType.waiverType && sessionType.waiverType !== "NONE") {
        return {
          nextStep: "awaiting_waiver",
          action: {
            type: "REDIRECT",
            url: `/form-handler.html?formType=${sessionType.waiverType}&flowToken=`,
          },
        };
      } else if (sessionType.allowsGroupInvites) {
        return {
          nextStep: "awaiting_friend_invites",
          action: {
            type: "REDIRECT",
            url: "/invite-friends.html?flowToken=",
          },
        };
      } else {
        return {
          nextStep: "completed",
          action: { type: "COMPLETE" },
        };
      }
    } else if (currentStep === "waiver_completed") {
      if (sessionType.allowsGroupInvites) {
        return {
          nextStep: "awaiting_friend_invites",
          action: {
            type: "REDIRECT",
            url: "/invite-friends.html?flowToken=",
          },
        };
      } else {
        return {
          nextStep: "completed",
          action: { type: "COMPLETE" },
        };
      }
    }
  }

  // Friend invite flow logic
  if (flowType === "friend_invite") {
    if (currentStep === "awaiting_join_decision") {
      if (sessionType.waiverType && sessionType.waiverType !== "NONE") {
        return {
          nextStep: "awaiting_friend_waiver",
          action: {
            type: "REDIRECT",
            url: `/form-handler.html?formType=${sessionType.waiverType}&flowToken=`,
          },
        };
      } else {
        return {
          nextStep: "completed",
          action: { type: "COMPLETE" },
        };
      }
    }
  }

  // Default completion
  return {
    nextStep: "completed",
    action: { type: "COMPLETE" },
  };
}

/**
 * Processes waiver form submission according to Feature 6 specification
 * @param {object} flowState - Current flow state from JWT token
 * @param {object} waiverData - Waiver form data submitted
 * @returns {Promise<object>} Next step information
 */
async function processWaiverSubmission(flowState, waiverData) {
  logger.info(
    { userId: flowState.userId, flowType: flowState.flowType },
    "[FlowStepHandlers] Processing waiver submission",
  );

  try {
    // Validate input data
    if (!flowState || !waiverData) {
      logger.error(
        { flowState, waiverData },
        "[FlowStepHandlers] Missing required data",
      );
      return {
        nextStep: {
          type: "ERROR",
          message: "Missing required data for waiver processing",
        },
      };
    }

    if (!waiverData.liability_form_data) {
      logger.error(
        { waiverData },
        "[FlowStepHandlers] Missing liability form data",
      );
      return {
        nextStep: {
          type: "ERROR",
          message: "Missing liability form data",
        },
      };
    }

    // Validate flow context
    if (
      !flowState.userId ||
      !flowState.sessionTypeId ||
      !flowState.appointmentDateTimeISO
    ) {
      logger.error({ flowState }, "[FlowStepHandlers] Invalid flow context");
      return {
        nextStep: {
          type: "ERROR",
          message: "Invalid flow context",
        },
      };
    }

    // Determine flow type based on presence of activeInviteToken
    const isInvitedFriend =
      flowState.activeInviteToken || flowState.inviteToken;

    if (isInvitedFriend) {
      return await _processFriendWaiver(flowState, waiverData);
    } else {
      return await _processPrimaryBookerWaiver(flowState, waiverData);
    }
  } catch (error) {
    logger.error(
      { error, userId: flowState?.userId },
      "[FlowStepHandlers] Error processing waiver submission",
    );
    return {
      nextStep: {
        type: "ERROR",
        message:
          "An error occurred while processing your waiver. Please try again.",
      },
    };
  }
}

/**
 * Processes friend invite acceptance
 * @param {object} flowState - Current flow state
 * @returns {Promise<object>} Updated flow token and next step information
 */
async function processFriendInviteAcceptance(flowState) {
  logger.info(
    { userId: flowState.userId, inviteToken: flowState.inviteToken },
    "[FlowStepHandlers] Processing friend invite acceptance",
  );

  try {
    // Fetch session type configuration
    const sessionType = await sessionTypesCore.getById(flowState.sessionTypeId);

    // Determine next step based on session type
    const { nextStep, action } = determineNextStep(flowState, sessionType);

    if (nextStep === "awaiting_friend_waiver") {
      // Redirect to waiver form
      const updatedFlowState = { ...flowState, currentStep: nextStep };
      const flowToken = generateFlowToken(updatedFlowState);

      return {
        flowToken,
        nextStep: {
          type: action.type,
          url: action.url + flowToken,
        },
      };
    } else {
      // Complete acceptance without waiver
      await prisma.sessionInvite.update({
        where: { inviteToken: flowState.inviteToken },
        data: { status: "ACCEPTED" },
      });

      // Update Google Calendar event
      await googleCalendarTool.updateEvent(/* event details */);

      // Send notifications
      await telegramNotifier.sendTextMessage(/* notification details */);

      const updatedFlowState = { ...flowState, currentStep: "completed" };
      const flowToken = generateFlowToken(updatedFlowState);

      return {
        flowToken,
        nextStep: { type: "COMPLETE" },
      };
    }
  } catch (error) {
    logger.error(
      { error, userId: flowState.userId },
      "[FlowStepHandlers] Error processing friend invite acceptance",
    );
    throw error;
  }
}

/**
 * Handles friend invite decline
 * @param {object} flowState - Current flow state
 * @returns {Promise<object>} Updated flow token and completion
 */
async function handleFriendDecline(flowState) {
  logger.info(
    { userId: flowState.userId, inviteToken: flowState.inviteToken },
    "[FlowStepHandlers] Handling friend decline",
  );

  try {
    // Update invite status to declined
    await prisma.sessionInvite.update({
      where: { inviteToken: flowState.inviteToken },
      data: { status: "DECLINED" },
    });

    // Send notification to primary booker
    await telegramNotifier.sendTextMessage(/* notification details */);

    const updatedFlowState = { ...flowState, currentStep: "completed" };
    const flowToken = generateFlowToken(updatedFlowState);

    logger.info(
      { userId: flowState.userId },
      "[FlowStepHandlers] Friend decline processed",
    );
    return {
      flowToken,
      nextStep: { type: "COMPLETE" },
    };
  } catch (error) {
    logger.error(
      { error, userId: flowState.userId },
      "[FlowStepHandlers] Error handling friend decline",
    );
    throw error;
  }
}

/**
 * Handles primary booker waiver submission
 * @private
 */
async function handlePrimaryWaiver(flowState, waiverData, sessionType) {
  logger.debug(
    { userId: flowState.userId },
    "[FlowStepHandlers] Handling primary waiver",
  );

  // Create session record
  const session = await prisma.session.create({
    data: {
      userId: flowState.userId,
      sessionTypeId: flowState.sessionTypeId,
      appointmentDateTime: new Date(flowState.appointmentDateTimeISO),
      status: "CONFIRMED",
      waiverData: waiverData,
    },
  });

  // Delete placeholder event if exists
  if (flowState.placeholderId) {
    await googleCalendarTool.deleteEvent(flowState.placeholderId);
  }

  // Create actual Google Calendar event
  const _eventId = await googleCalendarTool.createEvent(/* event details */);

  // Send confirmation notification
  await telegramNotifier.sendTextMessage(/* notification details */);

  // Determine next step
  const updatedFlowState = {
    ...flowState,
    currentStep: "waiver_completed",
    sessionId: session.id,
  };
  const { nextStep, action } = determineNextStep(updatedFlowState, sessionType);

  updatedFlowState.currentStep = nextStep;
  const flowToken = generateFlowToken(updatedFlowState);

  return {
    flowToken,
    nextStep: {
      type: action.type,
      ...(action.url && { url: action.url + flowToken }),
    },
  };
}

/**
 * Handles friend waiver submission
 * @private
 */
async function handleFriendWaiver(flowState, waiverData, _sessionType) {
  logger.debug(
    { userId: flowState.userId },
    "[FlowStepHandlers] Handling friend waiver",
  );

  // Update session invite with waiver data
  await prisma.sessionInvite.update({
    where: { inviteToken: flowState.inviteToken },
    data: {
      status: "ACCEPTED",
      waiverData: waiverData,
    },
  });

  // Update Google Calendar event
  await googleCalendarTool.updateEvent(/* event details */);

  // Send notifications
  await telegramNotifier.sendTextMessage(/* notification details */);

  const updatedFlowState = { ...flowState, currentStep: "completed" };
  const flowToken = generateFlowToken(updatedFlowState);

  return {
    flowToken,
    nextStep: { type: "COMPLETE" },
  };
}

/**
 * Processes primary booker waiver submission according to Feature 6 specification
 * @private
 */
async function _processPrimaryBookerWaiver(flowState, waiverData) {
  logger.debug(
    { userId: flowState.userId },
    "[FlowStepHandlers] Processing primary booker waiver",
  );

  try {
    // Fetch session type configuration
    const sessionType = await sessionTypesCore.getById(flowState.sessionTypeId);
    if (!sessionType) {
      logger.error(
        { sessionTypeId: flowState.sessionTypeId },
        "Session type not found",
      );
      return {
        nextStep: {
          type: "ERROR",
          message: "Session type not found",
        },
      };
    }

    // Handle Google Calendar placeholder deletion if present
    if (flowState.placeholderId) {
      try {
        logger.debug(
          { placeholderId: flowState.placeholderId },
          "Deleting placeholder event",
        );
        await googleCalendarTool.deleteCalendarEvent(flowState.placeholderId);
        logger.debug(
          { placeholderId: flowState.placeholderId },
          "Placeholder event deleted successfully",
        );
      } catch (error) {
        logger.warn(
          { error, placeholderId: flowState.placeholderId },
          "Failed to delete placeholder event - continuing anyway",
        );
      }
    }

    // Final slot availability check (critical)
    const isAvailable = await googleCalendarTool.isSlotTrulyAvailable(
      flowState.appointmentDateTimeISO,
      sessionType.durationMinutes,
    );

    if (!isAvailable) {
      logger.warn(
        { appointmentDateTime: flowState.appointmentDateTimeISO },
        "Slot became unavailable during waiver completion",
      );
      return {
        nextStep: {
          type: "ERROR",
          message:
            "Sorry, the selected slot was taken while you were completing the waiver. Please return to the calendar and choose a new time.",
        },
      };
    }

    // Create Session record
    const sessionData = {
      telegram_id: flowState.userId,
      session_type_id_fk: flowState.sessionTypeId,
      appointment_datetime: new Date(flowState.appointmentDateTimeISO),
      session_status: "CONFIRMED",
      liability_form_data: waiverData.liability_form_data,
      first_name: waiverData.firstName,
      last_name: waiverData.lastName,
    };

    const session = await prisma.sessions.create({ data: sessionData });
    logger.debug({ sessionId: session.id }, "Session created successfully");

    // Create confirmed Google Calendar event
    const eventStartTime = new Date(flowState.appointmentDateTimeISO);
    const eventEndTime = new Date(
      eventStartTime.getTime() + sessionType.durationMinutes * 60000,
    );

    const eventData = {
      summary: `Client ${waiverData.firstName} ${waiverData.lastName} - ${sessionType.label}`,
      start: eventStartTime,
      end: eventEndTime,
      description: `${sessionType.label} session for ${waiverData.firstName} ${waiverData.lastName}\nBooking ID: ${session.id}`,
    };

    let googleEventId;
    try {
      googleEventId = await googleCalendarTool.createCalendarEvent(eventData);
      logger.debug(
        { googleEventId, sessionId: session.id },
        "Calendar event created successfully",
      );

      // Update session with Google Calendar event ID
      await prisma.sessions.update({
        where: { id: session.id },
        data: { googleEventId },
      });
    } catch (error) {
      logger.error(
        { error, sessionId: session.id },
        "Calendar event creation failed - session exists in DB but not on calendar",
      );

      // Notify admin about the critical inconsistency
      try {
        await telegramNotifier.sendAdminNotification(
          `CRITICAL: Session created in DB but Calendar event failed. Session ID: ${session.id}, User: ${waiverData.firstName} ${waiverData.lastName} (${flowState.userId}), Time: ${flowState.appointmentDateTimeISO}. Error: ${error.message}`,
        );
      } catch (notifError) {
        logger.error(
          { notifError },
          "Failed to send admin notification about calendar failure",
        );
      }

      return {
        nextStep: {
          type: "ERROR",
          message:
            "Session was created but calendar event failed. An admin has been notified.",
        },
      };
    }

    // Update bot message for primary booker
    try {
      const user = await prisma.users.findUnique({
        where: { telegram_id: flowState.userId },
      });

      if (user?.edit_msg_id) {
        const formattedDateTime = new Date(
          flowState.appointmentDateTimeISO,
        ).toLocaleString("en-US", {
          timeZone: "America/Chicago",
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

        let confirmationMessage = `✅ Your ${sessionType.label} session is confirmed for ${formattedDateTime}!`;
        let inlineKeyboard = null;

        // Add invite button if group invites are allowed
        if (sessionType.allowsGroupInvites && sessionType.maxGroupSize > 1) {
          const inviteUrl = `/invite-friends.html?sessionId=${session.id}&telegramId=${flowState.userId}&maxGroupSize=${sessionType.maxGroupSize}`;
          inlineKeyboard = {
            inline_keyboard: [
              [
                {
                  text: "Invite Friends",
                  web_app: { url: inviteUrl },
                },
              ],
            ],
          };
        }

        await telegramNotifier.editMessageText({
          telegramId: flowState.userId,
          messageId: user.edit_msg_id,
          text: confirmationMessage,
          reply_markup: inlineKeyboard,
        });

        // Clear edit_msg_id
        await prisma.users.update({
          where: { telegram_id: flowState.userId },
          data: { edit_msg_id: null },
        });
      }
    } catch (error) {
      logger.error(
        { error, userId: flowState.userId },
        "Failed to update bot message - continuing anyway",
      );
    }

    // Send admin notification
    try {
      const formattedDateTime = new Date(
        flowState.appointmentDateTimeISO,
      ).toLocaleString("en-US", {
        timeZone: "America/Chicago",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      await telegramNotifier.sendAdminNotification(
        `CONFIRMED BOOKING: Client ${waiverData.firstName} ${waiverData.lastName} (TGID: ${flowState.userId}) for ${sessionType.label} on ${formattedDateTime}. Waiver submitted.`,
      );
    } catch (error) {
      logger.error(
        { error, userId: flowState.userId },
        "Failed to send admin notification - continuing anyway",
      );
    }

    // Determine next step
    if (sessionType.allowsGroupInvites && sessionType.maxGroupSize > 1) {
      const inviteUrl = `/invite-friends.html?sessionId=${session.id}&telegramId=${flowState.userId}&maxGroupSize=${sessionType.maxGroupSize}&flowToken=`;
      return {
        nextStep: {
          type: "REDIRECT",
          url: inviteUrl,
        },
      };
    } else {
      return {
        nextStep: {
          type: "COMPLETE",
          message: "Booking Confirmed! You'll receive a message from the bot.",
          closeWebApp: true,
        },
      };
    }
  } catch (error) {
    logger.error(
      { error, userId: flowState.userId },
      "Error in primary booker waiver processing",
    );
    return {
      nextStep: {
        type: "ERROR",
        message:
          "An error occurred while processing your booking. Please try again.",
      },
    };
  }
}

/**
 * Processes friend waiver submission according to Feature 6 specification
 * @private
 */
async function _processFriendWaiver(flowState, waiverData) {
  logger.debug(
    { userId: flowState.userId },
    "[FlowStepHandlers] Processing friend waiver",
  );

  try {
    const activeInviteToken =
      flowState.activeInviteToken || flowState.inviteToken;

    // Validate invite token and fetch parent session details
    const sessionInvite = await prisma.sessionInvite.findUnique({
      where: { inviteToken: activeInviteToken },
      include: {
        sessions: {
          include: {
            SessionType: true,
          },
        },
      },
    });

    if (!sessionInvite) {
      logger.error(
        { inviteToken: activeInviteToken },
        "SessionInvite not found",
      );
      return {
        nextStep: {
          type: "ERROR",
          message: "Invite invalid or already processed",
        },
      };
    }

    if (!sessionInvite.sessions) {
      logger.error(
        { inviteToken: activeInviteToken },
        "Parent session not found",
      );
      return {
        nextStep: {
          type: "ERROR",
          message: "Parent session not found",
        },
      };
    }

    // Check if invite is in valid pre-waiver state
    const validPreWaiverStates = [
      "pending",
      "accepted_by_friend",
      "viewed_by_friend",
    ];
    if (!validPreWaiverStates.includes(sessionInvite.status)) {
      logger.error(
        { inviteToken: activeInviteToken, status: sessionInvite.status },
        "Invite in invalid state for waiver submission",
      );
      return {
        nextStep: {
          type: "ERROR",
          message: "Invite invalid or already processed",
        },
      };
    }

    // Update SessionInvite record
    const friendNameOnWaiver = `${waiverData.firstName} ${waiverData.lastName}`;
    await prisma.sessionInvite.update({
      where: { inviteToken: activeInviteToken },
      data: {
        status: "waiver_completed_by_friend",
        friendTelegramId: waiverData.telegramId,
        friendNameOnWaiver,
        friendLiabilityFormData: waiverData.liability_form_data,
      },
    });

    logger.debug(
      { inviteToken: activeInviteToken },
      "SessionInvite updated successfully",
    );

    // Update Google Calendar event if it exists
    if (sessionInvite.sessions.googleEventId) {
      try {
        // Update event description with friend name
        const existingEvent = await googleCalendarTool.getCalendarEvent(
          sessionInvite.sessions.googleEventId,
        );

        let updatedDescription = existingEvent.description || "";

        // Add or update Guests section
        if (!updatedDescription.includes("Guests:")) {
          updatedDescription += "\n\nGuests:\n";
        }

        if (!updatedDescription.includes(friendNameOnWaiver)) {
          updatedDescription += `- ${friendNameOnWaiver}\n`;
        }

        await googleCalendarTool.updateCalendarEventDescription(
          sessionInvite.sessions.googleEventId,
          updatedDescription,
        );

        // Update event title to GROUP format if this is the first friend
        const completedFriendsCount = await prisma.sessionInvite.count({
          where: {
            parentSessionId: sessionInvite.parentSessionId,
            status: "waiver_completed_by_friend",
          },
        });

        if (completedFriendsCount === 1) {
          // This is the first friend to complete waiver
          const currentEvent = await googleCalendarTool.getCalendarEvent(
            sessionInvite.sessions.googleEventId,
          );

          if (
            currentEvent.summary &&
            !currentEvent.summary.startsWith("GROUP - ")
          ) {
            const primaryBookerName = `${sessionInvite.sessions.first_name} ${sessionInvite.sessions.last_name}`;
            const newTitle = `GROUP - ${primaryBookerName} & Friend(s) - ${sessionInvite.sessions.SessionType.label}`;

            await googleCalendarTool.updateCalendarEventSummary(
              sessionInvite.sessions.googleEventId,
              newTitle,
            );
          }
        }
      } catch (error) {
        logger.error(
          { error, googleEventId: sessionInvite.sessions.googleEventId },
          "Failed to update calendar event for friend - continuing anyway",
        );
      }
    }

    // Send confirmation to friend
    try {
      const formattedDateTime = new Date(
        sessionInvite.sessions.appointment_datetime,
      ).toLocaleString("en-US", {
        timeZone: "America/Chicago",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      const primaryBookerName = `${sessionInvite.sessions.first_name} ${sessionInvite.sessions.last_name}`;

      await telegramNotifier.sendUserNotification(
        waiverData.telegramId,
        `✅ Your spot for the Kambo session with ${primaryBookerName} on ${formattedDateTime} is confirmed!`,
      );
    } catch (error) {
      logger.error(
        { error, friendTelegramId: waiverData.telegramId },
        "Failed to send confirmation to friend - continuing anyway",
      );
    }

    // Notify primary booker
    try {
      const formattedDateTime = new Date(
        sessionInvite.sessions.appointment_datetime,
      ).toLocaleString("en-US", {
        timeZone: "America/Chicago",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      await telegramNotifier.sendUserNotification(
        sessionInvite.sessions.telegram_id,
        `🎉 Good news! ${friendNameOnWaiver} has completed their waiver and will be joining your ${sessionInvite.sessions.SessionType.label} session on ${formattedDateTime}.`,
      );
    } catch (error) {
      logger.error(
        { error, primaryBookerTelegramId: sessionInvite.sessions.telegram_id },
        "Failed to notify primary booker - continuing anyway",
      );
    }

    // Notify admin
    try {
      const formattedDateTime = new Date(
        sessionInvite.sessions.appointment_datetime,
      ).toLocaleString("en-US", {
        timeZone: "America/Chicago",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      const primaryBookerName = `${sessionInvite.sessions.first_name} ${sessionInvite.sessions.last_name}`;

      await telegramNotifier.sendAdminNotification(
        `➕ INVITED GUEST CONFIRMED: ${friendNameOnWaiver} (TGID: ${waiverData.telegramId}) has completed waiver for ${primaryBookerName}'s session on ${formattedDateTime} (Invite Token: ${activeInviteToken}).`,
      );
    } catch (error) {
      logger.error(
        { error },
        "Failed to send admin notification - continuing anyway",
      );
    }

    return {
      nextStep: {
        type: "COMPLETE",
        message: "Waiver submitted successfully! Your spot is confirmed.",
        closeWebApp: true,
      },
    };
  } catch (error) {
    logger.error(
      { error, userId: flowState.userId },
      "Error in friend waiver processing",
    );
    return {
      nextStep: {
        type: "ERROR",
        message:
          "An error occurred while processing your waiver. Please try again.",
      },
    };
  }
}

module.exports = {
  determineNextStep,
  processWaiverSubmission,
  processFriendInviteAcceptance,
  handleFriendDecline,
};
