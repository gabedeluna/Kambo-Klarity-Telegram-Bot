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
 * Processes waiver form submission
 * @param {object} flowState - Current flow state
 * @param {object} waiverData - Waiver form data
 * @returns {Promise<object>} Updated flow token and next step information
 */
async function processWaiverSubmission(flowState, waiverData) {
  logger.info(
    { userId: flowState.userId, flowType: flowState.flowType },
    "[FlowStepHandlers] Processing waiver submission",
  );

  try {
    // Fetch session type configuration
    const sessionType = await sessionTypesCore.getById(flowState.sessionTypeId);
    if (!sessionType) {
      throw new Error("Session type not found");
    }

    let response;

    if (flowState.flowType === "primary_booking") {
      // Process primary booker waiver
      response = await handlePrimaryWaiver(flowState, waiverData, sessionType);
    } else if (flowState.flowType === "friend_invite") {
      // Process friend waiver
      response = await handleFriendWaiver(flowState, waiverData, sessionType);
    } else {
      throw new Error(`Invalid flow type: ${flowState.flowType}`);
    }

    logger.info(
      { userId: flowState.userId, nextStep: response.nextStep.type },
      "[FlowStepHandlers] Waiver submission processed",
    );
    return response;
  } catch (error) {
    logger.error(
      { error, userId: flowState.userId },
      "[FlowStepHandlers] Error processing waiver submission",
    );
    throw new Error("Failed to process waiver submission");
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

module.exports = {
  determineNextStep,
  processWaiverSubmission,
  processFriendInviteAcceptance,
  handleFriendDecline,
};
