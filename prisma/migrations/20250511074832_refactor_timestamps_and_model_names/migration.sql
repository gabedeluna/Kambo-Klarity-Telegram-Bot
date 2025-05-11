/*
  Warnings:

  - You are about to drop the `annotation_tag_entity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `auth_identity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `auth_provider_sync_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `credentials_entity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `event_destinations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `execution_annotation_tags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `execution_annotations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `execution_data` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `execution_entity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `execution_metadata` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `folder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `folder_tag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `insights_by_period` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `insights_metadata` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `insights_raw` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `installed_nodes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `installed_packages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `invalid_auth_token` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `migrations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `n8n_chat_histories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `processed_data` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_relation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `role` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `settings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shared_credentials` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shared_workflow` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tag_entity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `test_case_execution` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `test_definition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `test_metric` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `test_run` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_api_keys` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `variables` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `webhook_entity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflow_entity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflow_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflow_statistics` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflows_tags` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updated_at` to the `sessions` table without a default value. This is not possible if the table is not empty.
  - Made the column `created_at` on table `sessions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "auth_identity" DROP CONSTRAINT "FK_5f0643f6717905a05164090dde7";

-- DropForeignKey
ALTER TABLE "execution_annotation_tags" DROP CONSTRAINT "FK_a3697779b366e131b2bbdae2976";

-- DropForeignKey
ALTER TABLE "execution_annotation_tags" DROP CONSTRAINT "FK_c1519757391996eb06064f0e7c8";

-- DropForeignKey
ALTER TABLE "execution_annotations" DROP CONSTRAINT "FK_97f863fa83c4786f19565084960";

-- DropForeignKey
ALTER TABLE "execution_data" DROP CONSTRAINT "execution_data_fk";

-- DropForeignKey
ALTER TABLE "execution_entity" DROP CONSTRAINT "fk_execution_entity_workflow_id";

-- DropForeignKey
ALTER TABLE "execution_metadata" DROP CONSTRAINT "FK_31d0b4c93fb85ced26f6005cda3";

-- DropForeignKey
ALTER TABLE "folder" DROP CONSTRAINT "FK_804ea52f6729e3940498bd54d78";

-- DropForeignKey
ALTER TABLE "folder" DROP CONSTRAINT "FK_a8260b0b36939c6247f385b8221";

-- DropForeignKey
ALTER TABLE "folder_tag" DROP CONSTRAINT "FK_94a60854e06f2897b2e0d39edba";

-- DropForeignKey
ALTER TABLE "folder_tag" DROP CONSTRAINT "FK_dc88164176283de80af47621746";

-- DropForeignKey
ALTER TABLE "insights_by_period" DROP CONSTRAINT "FK_6414cfed98daabbfdd61a1cfbc0";

-- DropForeignKey
ALTER TABLE "insights_metadata" DROP CONSTRAINT "FK_1d8ab99d5861c9388d2dc1cf733";

-- DropForeignKey
ALTER TABLE "insights_metadata" DROP CONSTRAINT "FK_2375a1eda085adb16b24615b69c";

-- DropForeignKey
ALTER TABLE "insights_raw" DROP CONSTRAINT "FK_6e2e33741adef2a7c5d66befa4e";

-- DropForeignKey
ALTER TABLE "installed_nodes" DROP CONSTRAINT "FK_73f857fc5dce682cef8a99c11dbddbc969618951";

-- DropForeignKey
ALTER TABLE "processed_data" DROP CONSTRAINT "FK_06a69a7032c97a763c2c7599464";

-- DropForeignKey
ALTER TABLE "project_relation" DROP CONSTRAINT "FK_5f0643f6717905a05164090dde7";

-- DropForeignKey
ALTER TABLE "project_relation" DROP CONSTRAINT "FK_61448d56d61802b5dfde5cdb002";

-- DropForeignKey
ALTER TABLE "shared_credentials" DROP CONSTRAINT "FK_416f66fc846c7c442970c094ccf";

-- DropForeignKey
ALTER TABLE "shared_credentials" DROP CONSTRAINT "FK_812c2852270da1247756e77f5a4";

-- DropForeignKey
ALTER TABLE "shared_workflow" DROP CONSTRAINT "FK_a45ea5f27bcfdc21af9b4188560";

-- DropForeignKey
ALTER TABLE "shared_workflow" DROP CONSTRAINT "FK_daa206a04983d47d0a9c34649ce";

-- DropForeignKey
ALTER TABLE "test_case_execution" DROP CONSTRAINT "FK_258d954733841d51edd826a562b";

-- DropForeignKey
ALTER TABLE "test_case_execution" DROP CONSTRAINT "FK_8e4b4774db42f1e6dda3452b2af";

-- DropForeignKey
ALTER TABLE "test_case_execution" DROP CONSTRAINT "FK_dfbe194e3ebdfe49a87bc4692ca";

-- DropForeignKey
ALTER TABLE "test_case_execution" DROP CONSTRAINT "FK_e48965fac35d0f5b9e7f51d8c44";

-- DropForeignKey
ALTER TABLE "test_definition" DROP CONSTRAINT "FK_9ec1ce6fbf82305f489adb971d3";

-- DropForeignKey
ALTER TABLE "test_definition" DROP CONSTRAINT "FK_b0dd0087fe3da02b0ffa4b9c5bb";

-- DropForeignKey
ALTER TABLE "test_definition" DROP CONSTRAINT "FK_d5d7ea64662dbc62f5e266fbeb0";

-- DropForeignKey
ALTER TABLE "test_metric" DROP CONSTRAINT "FK_3a4e9cf37111ac3270e2469b475";

-- DropForeignKey
ALTER TABLE "test_run" DROP CONSTRAINT "FK_3a81713a76f2295b12b46cdfcab";

-- DropForeignKey
ALTER TABLE "user_api_keys" DROP CONSTRAINT "FK_e131705cbbc8fb589889b02d457";

-- DropForeignKey
ALTER TABLE "webhook_entity" DROP CONSTRAINT "fk_webhook_entity_workflow_id";

-- DropForeignKey
ALTER TABLE "workflow_entity" DROP CONSTRAINT "fk_workflow_parent_folder";

-- DropForeignKey
ALTER TABLE "workflow_history" DROP CONSTRAINT "FK_1e31657f5fe46816c34be7c1b4b";

-- DropForeignKey
ALTER TABLE "workflow_statistics" DROP CONSTRAINT "fk_workflow_statistics_workflow_id";

-- DropForeignKey
ALTER TABLE "workflows_tags" DROP CONSTRAINT "fk_workflows_tags_tag_id";

-- DropForeignKey
ALTER TABLE "workflows_tags" DROP CONSTRAINT "fk_workflows_tags_workflow_id";

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- DropTable
DROP TABLE "annotation_tag_entity";

-- DropTable
DROP TABLE "auth_identity";

-- DropTable
DROP TABLE "auth_provider_sync_history";

-- DropTable
DROP TABLE "credentials_entity";

-- DropTable
DROP TABLE "event_destinations";

-- DropTable
DROP TABLE "execution_annotation_tags";

-- DropTable
DROP TABLE "execution_annotations";

-- DropTable
DROP TABLE "execution_data";

-- DropTable
DROP TABLE "execution_entity";

-- DropTable
DROP TABLE "execution_metadata";

-- DropTable
DROP TABLE "folder";

-- DropTable
DROP TABLE "folder_tag";

-- DropTable
DROP TABLE "insights_by_period";

-- DropTable
DROP TABLE "insights_metadata";

-- DropTable
DROP TABLE "insights_raw";

-- DropTable
DROP TABLE "installed_nodes";

-- DropTable
DROP TABLE "installed_packages";

-- DropTable
DROP TABLE "invalid_auth_token";

-- DropTable
DROP TABLE "migrations";

-- DropTable
DROP TABLE "n8n_chat_histories";

-- DropTable
DROP TABLE "processed_data";

-- DropTable
DROP TABLE "project";

-- DropTable
DROP TABLE "project_relation";

-- DropTable
DROP TABLE "role";

-- DropTable
DROP TABLE "settings";

-- DropTable
DROP TABLE "shared_credentials";

-- DropTable
DROP TABLE "shared_workflow";

-- DropTable
DROP TABLE "tag_entity";

-- DropTable
DROP TABLE "test_case_execution";

-- DropTable
DROP TABLE "test_definition";

-- DropTable
DROP TABLE "test_metric";

-- DropTable
DROP TABLE "test_run";

-- DropTable
DROP TABLE "user";

-- DropTable
DROP TABLE "user_api_keys";

-- DropTable
DROP TABLE "variables";

-- DropTable
DROP TABLE "webhook_entity";

-- DropTable
DROP TABLE "workflow_entity";

-- DropTable
DROP TABLE "workflow_history";

-- DropTable
DROP TABLE "workflow_statistics";

-- DropTable
DROP TABLE "workflows_tags";
