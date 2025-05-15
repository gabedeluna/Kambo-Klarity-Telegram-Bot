/*
  Warnings:

  - You are about to drop the column `conversation_history` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "conversation_history";
