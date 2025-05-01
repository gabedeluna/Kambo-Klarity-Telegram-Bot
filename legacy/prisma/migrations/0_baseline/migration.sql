-- CreateTable
CREATE TABLE "annotation_tag_entity" (
    "id" VARCHAR(16) NOT NULL,
    "name" VARCHAR(24) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT "PK_69dfa041592c30bbc0d4b84aa00" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identity" (
    "userId" UUID,
    "providerId" VARCHAR(64) NOT NULL,
    "providerType" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT "auth_identity_pkey" PRIMARY KEY ("providerId","providerType")
);

-- CreateTable
CREATE TABLE "auth_provider_sync_history" (
    "id" SERIAL NOT NULL,
    "providerType" VARCHAR(32) NOT NULL,
    "runMode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanned" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "updated" INTEGER NOT NULL,
    "disabled" INTEGER NOT NULL,
    "error" TEXT,

    CONSTRAINT "auth_provider_sync_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials_entity" (
    "name" VARCHAR(128) NOT NULL,
    "data" TEXT NOT NULL,
    "type" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "id" VARCHAR(36) NOT NULL,
    "isManaged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "credentials_entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_destinations" (
    "id" UUID NOT NULL,
    "destination" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT "event_destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_annotation_tags" (
    "annotationId" INTEGER NOT NULL,
    "tagId" VARCHAR(24) NOT NULL,

    CONSTRAINT "PK_979ec03d31294cca484be65d11f" PRIMARY KEY ("annotationId","tagId")
);

-- CreateTable
CREATE TABLE "execution_annotations" (
    "id" SERIAL NOT NULL,
    "executionId" INTEGER NOT NULL,
    "vote" VARCHAR(6),
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT "PK_7afcf93ffa20c4252869a7c6a23" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_data" (
    "executionId" INTEGER NOT NULL,
    "workflowData" JSON NOT NULL,
    "data" TEXT NOT NULL,

    CONSTRAINT "execution_data_pkey" PRIMARY KEY ("executionId")
);

-- CreateTable
CREATE TABLE "execution_entity" (
    "id" SERIAL NOT NULL,
    "finished" BOOLEAN NOT NULL,
    "mode" VARCHAR NOT NULL,
    "retryOf" VARCHAR,
    "retrySuccessId" VARCHAR,
    "startedAt" TIMESTAMPTZ(3),
    "stoppedAt" TIMESTAMPTZ(3),
    "waitTill" TIMESTAMPTZ(3),
    "status" VARCHAR NOT NULL,
    "workflowId" VARCHAR(36) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT "pk_e3e63bbf986767844bbe1166d4e" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_metadata" (
    "id" SERIAL NOT NULL,
    "executionId" INTEGER NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "PK_17a0b6284f8d626aae88e1c16e4" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "parentFolderId" VARCHAR(36),
    "projectId" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT "PK_6278a41a706740c94c02e288df8" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder_tag" (
    "folderId" VARCHAR(36) NOT NULL,
    "tagId" VARCHAR(36) NOT NULL,

    CONSTRAINT "PK_27e4e00852f6b06a925a4d83a3e" PRIMARY KEY ("folderId","tagId")
);

-- CreateTable
CREATE TABLE "insights_by_period" (
    "id" SERIAL NOT NULL,
    "metaId" INTEGER NOT NULL,
    "type" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "periodUnit" INTEGER NOT NULL,
    "periodStart" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_b606942249b90cc39b0265f0575" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insights_metadata" (
    "metaId" SERIAL NOT NULL,
    "workflowId" VARCHAR(16),
    "projectId" VARCHAR(36),
    "workflowName" VARCHAR(128) NOT NULL,
    "projectName" VARCHAR(255) NOT NULL,

    CONSTRAINT "PK_f448a94c35218b6208ce20cf5a1" PRIMARY KEY ("metaId")
);

-- CreateTable
CREATE TABLE "insights_raw" (
    "id" SERIAL NOT NULL,
    "metaId" INTEGER NOT NULL,
    "type" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "timestamp" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_ec15125755151e3a7e00e00014f" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installed_nodes" (
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(200) NOT NULL,
    "latestVersion" INTEGER NOT NULL DEFAULT 1,
    "package" VARCHAR(241) NOT NULL,

    CONSTRAINT "PK_8ebd28194e4f792f96b5933423fc439df97d9689" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "installed_packages" (
    "packageName" VARCHAR(214) NOT NULL,
    "installedVersion" VARCHAR(50) NOT NULL,
    "authorName" VARCHAR(70),
    "authorEmail" VARCHAR(70),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT "PK_08cc9197c39b028c1e9beca225940576fd1a5804" PRIMARY KEY ("packageName")
);

-- CreateTable
CREATE TABLE "invalid_auth_token" (
    "token" VARCHAR(512) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PK_5779069b7235b256d91f7af1a15" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "migrations" (
    "id" SERIAL NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "name" VARCHAR NOT NULL,

    CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "n8n_chat_histories" (
    "id" SERIAL NOT NULL,
    "session_id" VARCHAR(255) NOT NULL,
    "message" JSONB NOT NULL,

    CONSTRAINT "n8n_chat_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_data" (
    "workflowId" VARCHAR(36) NOT NULL,
    "context" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "value" TEXT NOT NULL,

    CONSTRAINT "PK_ca04b9d8dc72de268fe07a65773" PRIMARY KEY ("workflowId","context")
);

-- CreateTable
CREATE TABLE "project" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "icon" JSON,

    CONSTRAINT "PK_4d68b1358bb5b766d3e78f32f57" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_relation" (
    "projectId" VARCHAR(36) NOT NULL,
    "userId" UUID NOT NULL,
    "role" VARCHAR NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT "PK_1caaa312a5d7184a003be0f0cb6" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "role" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "scope" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT "PK_e853ce24e8200abe5721d2c6ac552b73" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "first_name" VARCHAR,
    "last_name" VARCHAR,
    "telegram_id" BIGINT,
    "appointment_datetime" TIMESTAMPTZ(6),
    "liability_form_data" JSONB,
    "session_notes" TEXT,
    "session_status" VARCHAR,
    "created_at" TIMESTAMPTZ(6),
    "id" SERIAL NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,
    "loadOnStartup" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PK_dc0fe14e6d9943f268e7b119f69ab8bd" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "shared_credentials" (
    "credentialsId" VARCHAR(36) NOT NULL,
    "projectId" VARCHAR(36) NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT "PK_8ef3a59796a228913f251779cff" PRIMARY KEY ("credentialsId","projectId")
);

-- CreateTable
CREATE TABLE "shared_workflow" (
    "workflowId" VARCHAR(36) NOT NULL,
    "projectId" VARCHAR(36) NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT "PK_5ba87620386b847201c9531c58f" PRIMARY KEY ("workflowId","projectId")
);

-- CreateTable
CREATE TABLE "tag_entity" (
    "name" VARCHAR(24) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "id" VARCHAR(36) NOT NULL,

    CONSTRAINT "tag_entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_execution" (
    "id" VARCHAR(36) NOT NULL,
    "testRunId" VARCHAR(36) NOT NULL,
    "pastExecutionId" INTEGER,
    "executionId" INTEGER,
    "evaluationExecutionId" INTEGER,
    "status" VARCHAR NOT NULL,
    "runAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "errorCode" VARCHAR,
    "errorDetails" JSON,
    "metrics" JSON,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT "PK_90c121f77a78a6580e94b794bce" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_definition" (
    "name" VARCHAR(255) NOT NULL,
    "workflowId" VARCHAR(36) NOT NULL,
    "evaluationWorkflowId" VARCHAR(36),
    "annotationTagId" VARCHAR(16),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "description" TEXT,
    "id" VARCHAR(36) NOT NULL,
    "mockedNodes" JSON NOT NULL DEFAULT '[]',

    CONSTRAINT "test_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_metric" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "testDefinitionId" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT "PK_3e98b8e20acc19c5030a8644142" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_run" (
    "id" VARCHAR(36) NOT NULL,
    "testDefinitionId" VARCHAR(36) NOT NULL,
    "status" VARCHAR NOT NULL,
    "runAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "metrics" JSON,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "totalCases" INTEGER,
    "passedCases" INTEGER,
    "failedCases" INTEGER,
    "errorCode" VARCHAR(255),
    "errorDetails" TEXT,

    CONSTRAINT "PK_011c050f566e9db509a0fadb9b9" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT uuid_in((OVERLAY(OVERLAY(md5((((random())::text || ':'::text) || (clock_timestamp())::text)) PLACING '4'::text FROM 13) PLACING to_hex((floor(((random() * (((11 - 8) + 1))::double precision) + (8)::double precision)))::integer) FROM 17))::cstring),
    "email" VARCHAR(255),
    "firstName" VARCHAR(32),
    "lastName" VARCHAR(32),
    "password" VARCHAR(255),
    "personalizationAnswers" JSON,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "settings" JSON,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "mfaRecoveryCodes" TEXT,
    "role" TEXT NOT NULL,

    CONSTRAINT "PK_ea8f538c94b6e352418254ed6474a81f" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_api_keys" (
    "id" VARCHAR(36) NOT NULL,
    "userId" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "apiKey" VARCHAR NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT "PK_978fa5caa3468f463dac9d92e69" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "client_id" SERIAL NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "first_name" VARCHAR(255),
    "last_name" VARCHAR(255),
    "phone_number" VARCHAR(50),
    "email" VARCHAR(255),
    "date_of_birth" DATE,
    "reason_for_seeking" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "state" VARCHAR DEFAULT 'NONE',
    "role" VARCHAR DEFAULT 'client',
    "session_type" VARCHAR,
    "conversation_history" TEXT,
    "booking_slot" VARCHAR(255),
    "em_first_name" VARCHAR,
    "em_last_name" VARCHAR,
    "em_phone_number" VARCHAR,
    "edit_msg_id" INTEGER,

    CONSTRAINT "client_users_pkey" PRIMARY KEY ("client_id")
);

-- CreateTable
CREATE TABLE "variables" (
    "key" VARCHAR(50) NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'string',
    "value" VARCHAR(255),
    "id" VARCHAR(36) NOT NULL,

    CONSTRAINT "variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_entity" (
    "webhookPath" VARCHAR NOT NULL,
    "method" VARCHAR NOT NULL,
    "node" VARCHAR NOT NULL,
    "webhookId" VARCHAR,
    "pathLength" INTEGER,
    "workflowId" VARCHAR(36) NOT NULL,

    CONSTRAINT "PK_b21ace2e13596ccd87dc9bf4ea6" PRIMARY KEY ("webhookPath","method")
);

-- CreateTable
CREATE TABLE "workflow_entity" (
    "name" VARCHAR(128) NOT NULL,
    "active" BOOLEAN NOT NULL,
    "nodes" JSON NOT NULL,
    "connections" JSON NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "settings" JSON,
    "staticData" JSON,
    "pinData" JSON,
    "versionId" CHAR(36),
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "id" VARCHAR(36) NOT NULL,
    "meta" JSON,
    "parentFolderId" VARCHAR(36),

    CONSTRAINT "workflow_entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_history" (
    "versionId" VARCHAR(36) NOT NULL,
    "workflowId" VARCHAR(36) NOT NULL,
    "authors" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "nodes" JSON NOT NULL,
    "connections" JSON NOT NULL,

    CONSTRAINT "PK_b6572dd6173e4cd06fe79937b58" PRIMARY KEY ("versionId")
);

-- CreateTable
CREATE TABLE "workflow_statistics" (
    "count" INTEGER DEFAULT 0,
    "latestEvent" TIMESTAMPTZ(3),
    "name" VARCHAR(128) NOT NULL,
    "workflowId" VARCHAR(36) NOT NULL,

    CONSTRAINT "pk_workflow_statistics" PRIMARY KEY ("workflowId","name")
);

-- CreateTable
CREATE TABLE "workflows_tags" (
    "workflowId" VARCHAR(36) NOT NULL,
    "tagId" VARCHAR(36) NOT NULL,

    CONSTRAINT "pk_workflows_tags" PRIMARY KEY ("workflowId","tagId")
);

-- CreateTable
CREATE TABLE "test_user" (
    "id" BIGINT NOT NULL,
    "firstName" VARCHAR,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IDX_ae51b54c4bb430cf92f48b623f" ON "annotation_tag_entity"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pk_credentials_entity_id" ON "credentials_entity"("id");

-- CreateIndex
CREATE INDEX "idx_07fde106c0b471d8cc80a64fc8" ON "credentials_entity"("type");

-- CreateIndex
CREATE INDEX "IDX_a3697779b366e131b2bbdae297" ON "execution_annotation_tags"("tagId");

-- CreateIndex
CREATE INDEX "IDX_c1519757391996eb06064f0e7c" ON "execution_annotation_tags"("annotationId");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_97f863fa83c4786f1956508496" ON "execution_annotations"("executionId");

-- CreateIndex
CREATE INDEX "IDX_execution_entity_deletedAt" ON "execution_entity"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_cec8eea3bf49551482ccb4933e" ON "execution_metadata"("executionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_14f68deffaf858465715995508" ON "folder"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_60b6a84299eeb3f671dfec7693" ON "insights_by_period"("periodStart", "type", "periodUnit", "metaId");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_1d8ab99d5861c9388d2dc1cf73" ON "insights_metadata"("workflowId");

-- CreateIndex
CREATE INDEX "IDX_5f0643f6717905a05164090dde" ON "project_relation"("userId");

-- CreateIndex
CREATE INDEX "IDX_61448d56d61802b5dfde5cdb00" ON "project_relation"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_5b49d0f504f7ef31045a1fb2eb8" ON "role"("scope", "name");

-- CreateIndex
CREATE UNIQUE INDEX "idx_812eb05f7451ca757fb98444ce" ON "tag_entity"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pk_tag_entity_id" ON "tag_entity"("id");

-- CreateIndex
CREATE INDEX "IDX_8e4b4774db42f1e6dda3452b2a" ON "test_case_execution"("testRunId");

-- CreateIndex
CREATE UNIQUE INDEX "pk_test_definition_id" ON "test_definition"("id");

-- CreateIndex
CREATE INDEX "IDX_9ec1ce6fbf82305f489adb971d" ON "test_definition"("evaluationWorkflowId");

-- CreateIndex
CREATE INDEX "IDX_b0dd0087fe3da02b0ffa4b9c5b" ON "test_definition"("workflowId");

-- CreateIndex
CREATE INDEX "IDX_3a4e9cf37111ac3270e2469b47" ON "test_metric"("testDefinitionId");

-- CreateIndex
CREATE INDEX "IDX_3a81713a76f2295b12b46cdfca" ON "test_run"("testDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_e12875dfb3b1d92d7d7c5377e2" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_1ef35bac35d20bdae979d917a3" ON "user_api_keys"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_63d7bbae72c767cf162d459fcc" ON "user_api_keys"("userId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "client_users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "idx_client_users_telegram_id" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "variables_key_key" ON "variables"("key");

-- CreateIndex
CREATE UNIQUE INDEX "pk_variables_id" ON "variables"("id");

-- CreateIndex
CREATE INDEX "idx_16f4436789e804e3e1c9eeb240" ON "webhook_entity"("webhookId", "method", "pathLength");

-- CreateIndex
CREATE UNIQUE INDEX "pk_workflow_entity_id" ON "workflow_entity"("id");

-- CreateIndex
CREATE INDEX "IDX_workflow_entity_name" ON "workflow_entity"("name");

-- CreateIndex
CREATE INDEX "IDX_1e31657f5fe46816c34be7c1b4" ON "workflow_history"("workflowId");

-- CreateIndex
CREATE INDEX "idx_workflows_tags_workflow_id" ON "workflows_tags"("workflowId");

-- AddForeignKey
ALTER TABLE "auth_identity" ADD CONSTRAINT "FK_5f0643f6717905a05164090dde7" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "execution_annotation_tags" ADD CONSTRAINT "FK_a3697779b366e131b2bbdae2976" FOREIGN KEY ("tagId") REFERENCES "annotation_tag_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "execution_annotation_tags" ADD CONSTRAINT "FK_c1519757391996eb06064f0e7c8" FOREIGN KEY ("annotationId") REFERENCES "execution_annotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "execution_annotations" ADD CONSTRAINT "FK_97f863fa83c4786f19565084960" FOREIGN KEY ("executionId") REFERENCES "execution_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "execution_data" ADD CONSTRAINT "execution_data_fk" FOREIGN KEY ("executionId") REFERENCES "execution_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "execution_entity" ADD CONSTRAINT "fk_execution_entity_workflow_id" FOREIGN KEY ("workflowId") REFERENCES "workflow_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "execution_metadata" ADD CONSTRAINT "FK_31d0b4c93fb85ced26f6005cda3" FOREIGN KEY ("executionId") REFERENCES "execution_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "folder" ADD CONSTRAINT "FK_804ea52f6729e3940498bd54d78" FOREIGN KEY ("parentFolderId") REFERENCES "folder"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "folder" ADD CONSTRAINT "FK_a8260b0b36939c6247f385b8221" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "folder_tag" ADD CONSTRAINT "FK_94a60854e06f2897b2e0d39edba" FOREIGN KEY ("folderId") REFERENCES "folder"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "folder_tag" ADD CONSTRAINT "FK_dc88164176283de80af47621746" FOREIGN KEY ("tagId") REFERENCES "tag_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "insights_by_period" ADD CONSTRAINT "FK_6414cfed98daabbfdd61a1cfbc0" FOREIGN KEY ("metaId") REFERENCES "insights_metadata"("metaId") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "insights_metadata" ADD CONSTRAINT "FK_1d8ab99d5861c9388d2dc1cf733" FOREIGN KEY ("workflowId") REFERENCES "workflow_entity"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "insights_metadata" ADD CONSTRAINT "FK_2375a1eda085adb16b24615b69c" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "insights_raw" ADD CONSTRAINT "FK_6e2e33741adef2a7c5d66befa4e" FOREIGN KEY ("metaId") REFERENCES "insights_metadata"("metaId") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "installed_nodes" ADD CONSTRAINT "FK_73f857fc5dce682cef8a99c11dbddbc969618951" FOREIGN KEY ("package") REFERENCES "installed_packages"("packageName") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_data" ADD CONSTRAINT "FK_06a69a7032c97a763c2c7599464" FOREIGN KEY ("workflowId") REFERENCES "workflow_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_relation" ADD CONSTRAINT "FK_5f0643f6717905a05164090dde7" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_relation" ADD CONSTRAINT "FK_61448d56d61802b5dfde5cdb002" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shared_credentials" ADD CONSTRAINT "FK_416f66fc846c7c442970c094ccf" FOREIGN KEY ("credentialsId") REFERENCES "credentials_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shared_credentials" ADD CONSTRAINT "FK_812c2852270da1247756e77f5a4" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shared_workflow" ADD CONSTRAINT "FK_a45ea5f27bcfdc21af9b4188560" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shared_workflow" ADD CONSTRAINT "FK_daa206a04983d47d0a9c34649ce" FOREIGN KEY ("workflowId") REFERENCES "workflow_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "test_case_execution" ADD CONSTRAINT "FK_258d954733841d51edd826a562b" FOREIGN KEY ("pastExecutionId") REFERENCES "execution_entity"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "test_case_execution" ADD CONSTRAINT "FK_8e4b4774db42f1e6dda3452b2af" FOREIGN KEY ("testRunId") REFERENCES "test_run"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "test_case_execution" ADD CONSTRAINT "FK_dfbe194e3ebdfe49a87bc4692ca" FOREIGN KEY ("evaluationExecutionId") REFERENCES "execution_entity"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "test_case_execution" ADD CONSTRAINT "FK_e48965fac35d0f5b9e7f51d8c44" FOREIGN KEY ("executionId") REFERENCES "execution_entity"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "test_definition" ADD CONSTRAINT "FK_9ec1ce6fbf82305f489adb971d3" FOREIGN KEY ("evaluationWorkflowId") REFERENCES "workflow_entity"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "test_definition" ADD CONSTRAINT "FK_b0dd0087fe3da02b0ffa4b9c5bb" FOREIGN KEY ("workflowId") REFERENCES "workflow_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "test_definition" ADD CONSTRAINT "FK_d5d7ea64662dbc62f5e266fbeb0" FOREIGN KEY ("annotationTagId") REFERENCES "annotation_tag_entity"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "test_metric" ADD CONSTRAINT "FK_3a4e9cf37111ac3270e2469b475" FOREIGN KEY ("testDefinitionId") REFERENCES "test_definition"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "test_run" ADD CONSTRAINT "FK_3a81713a76f2295b12b46cdfcab" FOREIGN KEY ("testDefinitionId") REFERENCES "test_definition"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_api_keys" ADD CONSTRAINT "FK_e131705cbbc8fb589889b02d457" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "webhook_entity" ADD CONSTRAINT "fk_webhook_entity_workflow_id" FOREIGN KEY ("workflowId") REFERENCES "workflow_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workflow_entity" ADD CONSTRAINT "fk_workflow_parent_folder" FOREIGN KEY ("parentFolderId") REFERENCES "folder"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workflow_history" ADD CONSTRAINT "FK_1e31657f5fe46816c34be7c1b4b" FOREIGN KEY ("workflowId") REFERENCES "workflow_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workflow_statistics" ADD CONSTRAINT "fk_workflow_statistics_workflow_id" FOREIGN KEY ("workflowId") REFERENCES "workflow_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workflows_tags" ADD CONSTRAINT "fk_workflows_tags_tag_id" FOREIGN KEY ("tagId") REFERENCES "tag_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workflows_tags" ADD CONSTRAINT "fk_workflows_tags_workflow_id" FOREIGN KEY ("workflowId") REFERENCES "workflow_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

