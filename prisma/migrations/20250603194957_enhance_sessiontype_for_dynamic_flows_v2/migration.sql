-- AlterTable
ALTER TABLE "SessionType" ADD COLUMN     "allowsGroupInvites" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customFormDefinitions" JSONB,
ADD COLUMN     "maxGroupSize" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "waiverType" TEXT NOT NULL DEFAULT 'KAMBO_V1';
