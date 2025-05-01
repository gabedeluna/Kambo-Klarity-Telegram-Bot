// ======================================================================
// [NODE_TYPE: SERVER_INITIALIZATION]
// ======================================================================
// Purpose: Initialize the form server and load dependencies
// Input: Environment variables
// Output: Configured Express server

// Load environment variables
require("dotenv").config();

// Import required modules
const express = require("express");
const path = require("path");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ======================================================================
// [NODE_TYPE: EXPRESS_CONFIGURATION]
// ======================================================================
// Purpose: Configure Express middleware and settings
// Input: Express app
// Output: Configured middleware

// Create Express app
const app = express();

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Parse JSON bodies
app.use(express.json());

// ======================================================================
// [NODE_TYPE: ROUTE_HANDLERS]
// ======================================================================
// Purpose: Define API routes and handlers
// Input: HTTP requests
// Output: HTTP responses

// Health check endpoint
app.get("/", (req, res) => {
  console.log(`🔄 [server/healthCheck] Health check request received`);
  res.status(200).send("Kambo Klarity Server is running!");
});

// Route to serve the registration form
app.get("/registration", (req, res) => {
  console.log(`🔄 [server/registration] Serving registration form`);
  res.sendFile(path.join(__dirname, "public", "registration-form.html"));
});

// Route to serve the waiver form
app.get("/booking-form.html", (req, res) => {
  console.log(`🔄 [server/bookingForm] Serving booking form`);
  res.sendFile(path.join(__dirname, "public", "waiver-form.html"));
});

// ======================================================================
// [NODE_TYPE: API_USER_DATA]
// ======================================================================
// Purpose: Fetch user data for pre-filling the waiver form
// Input: Telegram ID
// Output: User data JSON

app.get("/api/user-data", async (req, res) => {
  const telegramId = req.query.telegramId;
  console.log(
    `🔄 [server/userData] Fetching user data for telegramId: ${telegramId}`,
  );

  try {
    // Find user in database
    const user = await prisma.users.findUnique({
      where: { telegram_id: BigInt(telegramId) },
    });

    if (!user) {
      console.error(`❌ [server/userData] User not found: ${telegramId}`);
      return res.status(404).json({ error: "User not found" });
    }

    // Always display appointment date/time as the string stored (from AI)
    let formattedDateTime = user.booking_slot || "Not scheduled";

    // Return user data
    // Format appointment date for display
    let formattedAppointmentDate = formattedDateTime;
    if (formattedDateTime && formattedDateTime !== "Not scheduled") {
      try {
        // Use date-fns for formatting if available
        const { format, parseISO } = require("date-fns");
        // Format: 'Tuesday, April 22, 2025 - 10:00 AM'
        const datePart = format(
          parseISO(formattedDateTime),
          "EEEE, MMMM d, yyyy",
        );
        const timePart = format(parseISO(formattedDateTime), "h:mm aaaa");
        formattedAppointmentDate = `${datePart} - ${timePart}`;
      } catch (err) {
        // Fallback: use toLocaleString and add dash manually
        const dateObj = new Date(formattedDateTime);
        const datePartFallback = dateObj.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const timePartFallback = dateObj.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
        formattedAppointmentDate = `${datePartFallback} - ${timePartFallback}`;
      }
    }

    // ======================================================================
    // [NODE_TYPE: USER_DATA_ASSEMBLY_NODE]
    // ======================================================================
    // Purpose: Assemble user data including emergency contact info for form
    // Input: User record from database
    // Output: Structured user data object for form

    console.log(
      `🔄 [server/userData/assembly] Assembling user data with emergency contact info`,
    );
    const userData = {
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email || "",
      phone: user.phone_number || "",
      dob: user.date_of_birth
        ? new Date(user.date_of_birth).toISOString().split("T")[0]
        : "",
      appointmentDateTime: formattedAppointmentDate, // for display on form
      rawAppointmentDateTime: user.booking_slot, // for submission to DB

      // Include emergency contact information if available
      emergencyFirstName: user.em_first_name || "",
      emergencyLastName: user.em_last_name || "",
      emergencyPhone: user.em_phone_number || "",
    };

    // Log emergency contact info availability
    if (user.em_first_name || user.em_last_name || user.em_phone_number) {
      console.log(
        `✅ [server/userData/assembly] Found emergency contact info to auto-populate`,
      );
    }

    console.log(
      `🔄 [server/userData] Appointment data being sent: "${formattedDateTime}"`,
    );
    console.log(
      `🔄 [server/userData] Phone field being sent: "${user.phone_number || "none"}"`,
    );

    console.log(`✅ [server/userData] Successfully retrieved user data`);
    res.json(userData);
  } catch (error) {
    console.error(`❌ [server/userData] Error fetching user data:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ======================================================================
// [NODE_TYPE: API_SUBMIT_WAIVER]
// ======================================================================
// Purpose: Accept waiver form submission and forward to workflow
// Input: Form data JSON
// Output: Success/error response

const { processWaiverSubmission } = require("./workflows/waiverWorkflow");

app.post("/api/submit-waiver", async (req, res) => {
  console.log(`🔄 [server/submitWaiver] Processing waiver submission`);
  try {
    const formData = req.body;
    const telegramId = formData.telegramId;
    if (!telegramId || !formData.signature) {
      console.error(`❌ [server/submitWaiver] Missing required fields`);
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }
    // Forward to workflow (returns {success, message, ...})
    const result = await processWaiverSubmission(formData);

    // ======================================================================
    // [NODE_TYPE: BOT_NOTIFICATION_NODE]
    // ======================================================================
    // Purpose: Notify the bot about successful waiver submission
    // Input: Session ID from workflow result
    // Output: Webhook call to bot server
    if (result.success && result.sessionId) {
      console.log(
        `🔄 [server/submitWaiver/notification] Notifying bot about session ${result.sessionId}`,
      );

      // ======================================================================
      // [NODE_TYPE: USER_LOOKUP_NODE]
      // ======================================================================
      // Purpose: Retrieve user data including message ID for notification
      // Input: Telegram ID
      // Output: User data with message tracking information
      console.log(
        `🔄 [server/submitWaiver/user-lookup] Looking up user data for telegramId: ${telegramId}`,
      );

      try {
        // ======================================================================
        // [NODE_TYPE: MESSAGE_TRACKING_RETRIEVAL_NODE]
        // ======================================================================
        // Purpose: Retrieve message ID from edit_msg_id field
        // Input: Telegram ID
        // Output: Chat ID and message ID for Telegram message update

        // Look up the user to get the message ID from edit_msg_id
        const user = await prisma.users.findUnique({
          where: { telegram_id: BigInt(telegramId) },
          select: {
            telegram_id: true,
            edit_msg_id: true,
          },
        });

        let chatId = telegramId;
        let messageId = null;

        if (user && user.edit_msg_id) {
          console.log(
            `🔄 [server/submitWaiver/tracking] Found message ID: ${user.edit_msg_id} for user: ${telegramId}`,
          );
          messageId = user.edit_msg_id;

          // ======================================================================
          // [NODE_TYPE: MESSAGE_TRACKING_CLEANUP_NODE]
          // ======================================================================
          // Purpose: Clear the message ID after retrieval
          // Input: Telegram ID
          // Output: Updated user record with cleared message tracking info
          console.log(
            `🔄 [server/submitWaiver/tracking/cleanup] Clearing message ID for user: ${telegramId}`,
          );

          try {
            await prisma.users.update({
              where: { telegram_id: BigInt(telegramId) },
              data: { edit_msg_id: null },
            });
            console.log(
              `✅ [server/submitWaiver/tracking/cleanup] Successfully cleared message ID`,
            );
          } catch (cleanupError) {
            console.error(
              `❌ [server/submitWaiver/tracking/cleanup] Error clearing message ID:`,
              cleanupError,
            );
          }
        } else {
          console.warn(
            `⚠️ [server/submitWaiver/tracking] No message ID found for user: ${telegramId}`,
          );
        }

        // Send webhook to bot server
        const botServerUrl =
          process.env.BOT_SERVER_URL || "http://localhost:3000";
        const notificationEndpoint = `${botServerUrl}/waiver-completed`;

        // Make the request to the bot server with message tracking info
        const notifyResponse = await fetch(notificationEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telegramId: telegramId,
            sessionId: result.sessionId,
            messageId: messageId,
            chatId: chatId || telegramId,
            timestamp: new Date().toISOString(),
          }),
        });

        if (notifyResponse.ok) {
          console.log(
            `✅ [server/submitWaiver/notification] Bot notification successful`,
          );
        } else {
          console.error(
            `❌ [server/submitWaiver/notification] Bot notification failed:`,
            await notifyResponse.text(),
          );
        }
      } catch (notifyError) {
        // Don't fail the submission if notification fails
        console.error(
          `❌ [server/submitWaiver/notification] Error notifying bot:`,
          notifyError,
        );
      }
    }

    // Return result to client regardless of notification status
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error(
      `❌ [server/submitWaiver] Error forwarding to workflow:`,
      error,
    );
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ======================================================================
// [NODE_TYPE: SERVER_STARTUP]
// ======================================================================
// Purpose: Start the Express server
// Input: Port number
// Output: Running server

// const PORT = process.env.FORM_SERVER_PORT || 3001;
// app.listen(PORT, () => {
//   console.log(`🚀 [server/startup] Form server is running on port ${PORT}`);
//   console.log(`📋 [server/startup] Form URL: ${process.env.FORM_SERVER_URL || `http://localhost:${PORT}`}`);
// });

module.exports = app;
