-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" SERIAL NOT NULL,
    "weekly_availability" JSONB,
    "practitioner_timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "max_advance_days" INTEGER NOT NULL DEFAULT 60,
    "min_notice_hours" INTEGER NOT NULL DEFAULT 24,
    "buffer_time_minutes" INTEGER NOT NULL DEFAULT 0,
    "max_bookings_per_day" INTEGER NOT NULL DEFAULT 10,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityRule_is_default_key" ON "AvailabilityRule"("is_default");
