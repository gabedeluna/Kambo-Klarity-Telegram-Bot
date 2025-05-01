-- Add is_veteran_or_responder to users table manually
ALTER TABLE "users" ADD COLUMN "is_veteran_or_responder" BOOLEAN NOT NULL DEFAULT false;
