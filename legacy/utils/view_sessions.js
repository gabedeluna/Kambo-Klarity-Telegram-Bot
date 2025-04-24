// ======================================================================
// [UTILITY_NODE: VIEW_SESSIONS_SCRIPT]
// ======================================================================
// Purpose: Pull and display all records from the sessions table
// Input: None (run as: node utils/view_sessions.js)
// Output: Console log of all session records

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async function viewSessions() {
  try {
    console.log(
      "🔄 [VIEW_SESSIONS_NODE] Fetching all sessions from the database...",
    );
    const sessions = await prisma.sessions.findMany({
      orderBy: { created_at: "desc" },
    });
    if (sessions.length === 0) {
      console.log("⚠️  No sessions found.");
    } else {
      console.log(`✅ Found ${sessions.length} session(s):\n`);
      sessions.forEach((session, idx) => {
        console.log(`--- SESSION ${idx + 1} ---`);
        Object.entries(session).forEach(([key, value]) => {
          console.log(`${key}:`, value);
        });
        console.log("----------------------\n");
      });
    }
  } catch (err) {
    console.error("❌ [VIEW_SESSIONS_NODE] Error fetching sessions:", err);
  } finally {
    await prisma.$disconnect();
    console.log("🔌 [VIEW_SESSIONS_NODE] Disconnected from database.");
  }
})();
