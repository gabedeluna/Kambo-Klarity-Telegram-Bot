-- AlterTable
ALTER TABLE "AvailabilityRule" ADD COLUMN     "slot_increment_minutes" INTEGER NOT NULL DEFAULT 15,
ALTER COLUMN "max_advance_days" SET DEFAULT 30,
ALTER COLUMN "buffer_time_minutes" SET DEFAULT 30,
ALTER COLUMN "max_bookings_per_day" SET DEFAULT 3;
