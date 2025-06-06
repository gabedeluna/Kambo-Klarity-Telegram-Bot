-- Migration for Feature 6: Enhance sessions model and add SessionInvite
-- Generated on: 2025-01-06

-- AlterTable: Add new fields to existing sessions table
ALTER TABLE "sessions" ADD COLUMN "googleEventId" TEXT;
ALTER TABLE "sessions" ADD COLUMN "session_type_id_fk" TEXT;

-- CreateTable: SessionInvite for friend invitation system
CREATE TABLE "SessionInvite" (
    "id" TEXT NOT NULL,
    "parentSessionId" INTEGER NOT NULL,
    "inviteToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "friendTelegramId" BIGINT,
    "friendNameOnWaiver" TEXT,
    "friendLiabilityFormData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Performance indexes for SessionInvite
CREATE UNIQUE INDEX "SessionInvite_inviteToken_key" ON "SessionInvite"("inviteToken");
CREATE INDEX "SessionInvite_inviteToken_idx" ON "SessionInvite"("inviteToken");
CREATE INDEX "SessionInvite_parentSessionId_status_idx" ON "SessionInvite"("parentSessionId", "status");
CREATE INDEX "SessionInvite_friendTelegramId_idx" ON "SessionInvite"("friendTelegramId");

-- CreateIndex: Performance indexes for sessions table
CREATE INDEX "sessions_telegram_id_idx" ON "sessions"("telegram_id");
CREATE INDEX "sessions_session_type_id_fk_idx" ON "sessions"("session_type_id_fk");
CREATE INDEX "sessions_appointment_datetime_idx" ON "sessions"("appointment_datetime");

-- AddForeignKey: Relations
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_session_type_id_fk_fkey" FOREIGN KEY ("session_type_id_fk") REFERENCES "SessionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SessionInvite" ADD CONSTRAINT "SessionInvite_parentSessionId_fkey" FOREIGN KEY ("parentSessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;