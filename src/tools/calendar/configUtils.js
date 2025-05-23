/**
 * Configuration utilities for calendar availability rules
 */
class ConfigUtils {
  constructor(prisma, logger) {
    this.prisma = prisma;
    this.logger = logger;
  }

  /**
   * Helper method to fetch the availability rule from the database
   * @returns {Promise<object>} The availability rule from the database or a default rule
   */
  async getAvailabilityRule() {
    // Helper to fetch the single AvailabilityRule record
    try {
      if (this.prisma) {
        const rule = await this.prisma.availabilityRule.findFirst({
          where: { is_default: true },
        });

        if (rule) {
          // Parse JSON if weekly_availability is stored as JSON string
          if (typeof rule.weekly_availability === "string") {
            try {
              rule.weekly_availability = JSON.parse(rule.weekly_availability);
            } catch (e) {
              this.logger.error(
                { err: e, ruleId: rule.id },
                "Failed to parse weekly_availability JSON from DB.",
              );
              rule.weekly_availability = {}; // Fallback to empty
            }
          }
          return rule;
        }
      }

      // If prisma is not available or no rule was found, use default values
      this.logger.warn(
        "[getAvailabilityRule] Prisma access not implemented in tool or no rule found. Using placeholder rules.",
      );
      return {
        // Placeholder
        weekly_availability: JSON.parse(
          process.env.TEMP_WEEKLY_AVAILABILITY_JSON || "{}",
        ), // Store example in .env
        practitioner_timezone:
          process.env.PRACTITIONER_TIMEZONE || "America/Chicago",
        max_advance_days: parseInt(process.env.TEMP_MAX_ADVANCE_DAYS || "60"),
        min_notice_hours: parseInt(process.env.TEMP_MIN_NOTICE_HOURS || "24"),
        buffer_time_minutes: parseInt(
          process.env.TEMP_BUFFER_TIME_MINUTES || "30",
        ),
        max_bookings_per_day: parseInt(
          process.env.TEMP_MAX_BOOKINGS_PER_DAY || "4",
        ),
        slot_increment_minutes: parseInt(
          process.env.TEMP_SLOT_INCREMENT_MINUTES || "15",
        ),
      };
    } catch (error) {
      this.logger.error(
        { error },
        "[getAvailabilityRule] Error fetching availability rule",
      );
      throw error;
    }
  }
}

module.exports = ConfigUtils;
