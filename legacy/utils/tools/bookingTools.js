// ======================================================================
// UTILITY: Booking Tools
// ======================================================================
// Purpose: Define tools that the booking AI agent can use
// Input: Tool parameters from AI
// Output: Tool execution results

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ======================================================================
// NODE: Reset State Tool
// ======================================================================
// Purpose: Reset user state to NONE and clear session type and conversation history
// Input: telegramId
// Output: Success/failure status

const resetState = async (telegramId) => {
  try {
    console.log(
      `🔄 [bookingTools/resetState] Resetting state for user: ${telegramId}`,
    );

    await prisma.users.update({
      where: { telegram_id: BigInt(telegramId) },
      data: {
        state: "NONE",
        session_type: null,
        conversation_history: null,
      },
    });

    console.log(
      `✅ [bookingTools/resetState] Successfully reset state for user: ${telegramId}`,
    );
    return { success: true };
  } catch (error) {
    console.error(`❌ [bookingTools/resetState] Error resetting state:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// ======================================================================
// NODE: Send Form Tool
// ======================================================================
// Purpose: Send booking form to user and reset state
// Input: telegramId, sessionType
// Output: Success/failure status

// ======================================================================
// [NODE_TYPE: SEND_FORM_NODE]
// ======================================================================
// Purpose: Send booking form to user and store message ID for later updates
// Input: telegramId, sessionType, telegram instance
// Output: Message with booking button and stored message ID
const sendForm = async (telegramId, sessionType, telegram) => {
  try {
    console.log(
      `🔄 [bookingTools/sendForm] Sending booking form for ${sessionType} to user: ${telegramId}`,
    );

    // Store the booking details in the database and clear session state
    await prisma.users.update({
      where: { telegram_id: BigInt(telegramId) },
      data: {
        state: "NONE",
        session_type: null, // Clear the session type
        conversation_history: null, // Clear conversation history
      },
    });

    // Send confirmation message with booking button
    const message = `Great! Let's get you scheduled for your ${sessionType} session 🐸`;

    // Generate the waiver form URL with query parameters
    const formUrl = `${process.env.FORM_SERVER_URL}/booking-form.html?telegramId=${telegramId}&sessionType=${encodeURIComponent(sessionType)}`;

    // ======================================================================
    // [NODE_TYPE: MESSAGE_TRACKING_NODE]
    // ======================================================================
    // Purpose: Send message and store its ID for future reference
    // Input: telegramId, message, reply markup
    // Output: Sent message and stored message ID in database
    console.log(
      `🔄 [bookingTools/sendForm/message] Sending booking message and tracking ID`,
    );

    const sentMessage = await telegram.sendMessage(telegramId, message, {
      reply_markup: {
        inline_keyboard: [[{ text: "Book Now", web_app: { url: formUrl } }]],
      },
    });

    // Store the message ID in the user record for later updates
    if (sentMessage && sentMessage.message_id) {
      console.log(
        `🔄 [bookingTools/sendForm/tracking] Storing message ID: ${sentMessage.message_id} for user: ${telegramId}`,
      );

      // ======================================================================
      // [NODE_TYPE: MESSAGE_ID_STORAGE_NODE]
      // ======================================================================
      // Purpose: Store message ID in edit_msg_id field for later retrieval
      // Input: Message ID and Telegram ID
      // Output: Updated user record with message tracking info

      // Format: "MSG_ID:chatId:messageId"
      const trackingData = `MSG_ID:${telegramId}:${sentMessage.message_id}`;

      await prisma.users.update({
        where: { telegram_id: BigInt(telegramId) },
        data: {
          // Store message tracking info in edit_msg_id field
          edit_msg_id: sentMessage.message_id,
        },
      });

      console.log(
        `✅ [bookingTools/sendForm/tracking] Successfully stored message ID: ${sentMessage.message_id} for user: ${telegramId}`,
      );
    } else {
      console.warn(
        `⚠️ [bookingTools/sendForm/tracking] Could not get message ID from sent message`,
      );
    }

    console.log(
      `✅ [bookingTools/sendForm] Successfully sent booking form to user: ${telegramId}`,
    );
    return { success: true };
  } catch (error) {
    console.error(
      `❌ [bookingTools/sendForm] Error sending booking form:`,
      error,
    );
    return {
      success: false,
      error: error.message,
    };
  }
};

// ======================================================================
// NODE: Store Confirmed Slot
// ======================================================================
// Purpose: Store the confirmed booking slot in the database
// Input: telegramId, confirmedSlot
// Output: Success/failure status

const storeConfirmedSlot = async (telegramId, confirmedSlot) => {
  try {
    console.log(
      `🔄 [bookingTools/storeConfirmedSlot] Storing confirmed slot for user: ${telegramId}`,
    );

    await prisma.users.update({
      where: { telegram_id: BigInt(telegramId) },
      data: {
        booking_slot: confirmedSlot,
      },
    });

    console.log(
      `✅ [bookingTools/storeConfirmedSlot] Successfully stored confirmed slot for user: ${telegramId}`,
    );
    return { success: true };
  } catch (error) {
    console.error(
      `❌ [bookingTools/storeConfirmedSlot] Error storing confirmed slot:`,
      error,
    );
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  resetState,
  sendForm,
  storeConfirmedSlot,
};
