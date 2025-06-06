/**
 * @file prisma/seed.js
 * @description Seed script to populate initial SessionType data with enhanced dynamic flow fields
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Define session types with the new dynamic flow fields
  const currentTime = new Date();
  const sessionTypes = [
    {
      id: "kambo_individual_standard",
      label: "Individual Kambo Session",
      description:
        "Standard individual Kambo ceremony with full waiver process",
      durationMinutes: 120,
      price: 150.0,
      active: true,
      waiverType: "KAMBO_V1",
      allowsGroupInvites: false,
      maxGroupSize: 1,
      customFormDefinitions: null,
      updatedAt: currentTime,
    },
    {
      id: "kambo_group_ceremony",
      label: "Group Kambo Ceremony",
      description:
        "Group Kambo ceremony allowing up to 4 participants with friend invites",
      durationMinutes: 180,
      price: 200.0,
      active: true,
      waiverType: "KAMBO_V1",
      allowsGroupInvites: true,
      maxGroupSize: 4,
      customFormDefinitions: null,
      updatedAt: currentTime,
    },
    {
      id: "consultation_session",
      label: "Consultation Session",
      description: "Initial consultation session with no waiver required",
      durationMinutes: 60,
      price: 75.0,
      active: true,
      waiverType: "NONE",
      allowsGroupInvites: false,
      maxGroupSize: 1,
      customFormDefinitions: null,
      updatedAt: currentTime,
    },
    {
      id: "kambo_advanced_ceremony",
      label: "Advanced Kambo Ceremony",
      description:
        "Advanced ceremony for experienced participants with group option",
      durationMinutes: 240,
      price: 300.0,
      active: true,
      waiverType: "KAMBO_ADVANCED_V1",
      allowsGroupInvites: true,
      maxGroupSize: 6,
      customFormDefinitions: {
        formType: "KAMBO_ADVANCED_V1",
        additionalRequirements: [
          "Previous Kambo experience verification",
          "Advanced medical screening",
          "Emergency contact verification",
        ],
      },
      updatedAt: currentTime,
    },
    {
      id: "integration_session",
      label: "Integration Session",
      description: "Post-ceremony integration session with custom form flow",
      durationMinutes: 90,
      price: 100.0,
      active: true,
      waiverType: "CUSTOM_FORM_INTEGRATION",
      allowsGroupInvites: true,
      maxGroupSize: 3,
      customFormDefinitions: {
        formType: "CUSTOM_FORM_INTEGRATION",
        steps: [
          { type: "integration_questionnaire", formId: "integration_form_1" },
          { type: "consent", formId: "integration_consent_1" },
        ],
      },
      updatedAt: currentTime,
    },
  ];

  console.log("📝 Creating SessionType records...");

  for (const sessionType of sessionTypes) {
    try {
      const existing = await prisma.sessionType.findUnique({
        where: { id: sessionType.id },
      });

      if (existing) {
        console.log(
          `⚠️  SessionType '${sessionType.id}' already exists, updating...`,
        );
        await prisma.sessionType.update({
          where: { id: sessionType.id },
          data: sessionType,
        });
        console.log(`✅ Updated SessionType: ${sessionType.label}`);
      } else {
        await prisma.sessionType.create({
          data: sessionType,
        });
        console.log(`✅ Created SessionType: ${sessionType.label}`);
      }
    } catch (error) {
      console.error(
        `❌ Error processing SessionType '${sessionType.id}':`,
        error.message,
      );
    }
  }

  // Verify the seeded data
  const allSessionTypes = await prisma.sessionType.findMany({
    where: { active: true },
    orderBy: { label: "asc" },
  });

  console.log(
    `\n📊 Seeding completed! Created/updated ${allSessionTypes.length} active session types:`,
  );
  allSessionTypes.forEach((st) => {
    console.log(`  - ${st.label} (${st.id})`);
    console.log(
      `    Waiver: ${st.waiverType}, Group Invites: ${st.allowsGroupInvites}, Max Size: ${st.maxGroupSize}`,
    );
  });
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("🔌 Database connection closed");
  });
