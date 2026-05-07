-- Prisma SQLite: rebuild Model into registerId + config while preserving Model.id FKs.
PRAGMA foreign_keys=OFF;

CREATE TABLE "Model_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "Model_new" ("id", "type", "registerId", "name", "config", "createdAt", "updatedAt")
SELECT
    m."id",
    m."type",
    CASE
        WHEN m."type" = 'LLM' AND m."providerType" = 'OPENAI' THEN 'openai/official'
        WHEN m."type" = 'LLM' AND m."providerType" = 'OPENAI_COMPATIBLE' THEN 'openai-compatible/generic'
        WHEN m."type" = 'LLM' AND m."providerType" = 'ALIBABA' THEN 'alibaba/dashscope-llm'
        WHEN m."type" = 'SEARCH' AND m."providerType" = 'BRAVE_SEARCH' THEN 'brave/search'
        WHEN m."type" = 'IMAGE' AND m."providerType" = 'VOLCENGINE_SEEDREAM' THEN 'volcengine/seedream'
        WHEN m."type" = 'IMAGE' AND m."providerType" = 'DASHSCOPE_WAN_IMAGE' THEN 'dashscope/wan-image'
    END,
    m."name",
    CASE
        WHEN m."type" = 'LLM' AND m."providerType" = 'OPENAI' THEN json_object(
            'modelId', m."name",
            'apiKey', m."apiKey"
        )
        WHEN m."type" = 'LLM' AND m."providerType" = 'OPENAI_COMPATIBLE' THEN json_patch(
            json_object(
                'modelId', m."name",
                'baseURL', m."baseURL",
                'apiKey', m."apiKey"
            ),
            CASE
                WHEN m."extraHeaders" IS NOT NULL THEN json_object('extraHeaders', json(m."extraHeaders"))
                ELSE json_object()
            END
        )
        WHEN m."type" = 'LLM' AND m."providerType" = 'ALIBABA' THEN json_patch(
            json_patch(
                json_patch(
                    json_object(
                        'modelId', m."name",
                        'apiKey', m."apiKey"
                    ),
                    CASE
                        WHEN m."baseURL" IS NOT NULL THEN json_object('baseURL', m."baseURL")
                        ELSE json_object()
                    END
                ),
                CASE
                    WHEN m."extraHeaders" IS NOT NULL THEN json_object('extraHeaders', json(m."extraHeaders"))
                    ELSE json_object()
                END
            ),
            CASE
                WHEN m."capabilities" IS NOT NULL THEN json_object('capabilities', json(m."capabilities"))
                ELSE json_object()
            END
        )
        WHEN m."type" = 'SEARCH' AND m."providerType" = 'BRAVE_SEARCH' THEN json_object(
            'apiKey', m."apiKey"
        )
        WHEN m."type" = 'IMAGE' AND m."providerType" = 'VOLCENGINE_SEEDREAM' THEN json_patch(
            json_object(
                'requestModel', m."name",
                'apiKey', m."apiKey",
                'capabilities', json(m."capabilities")
            ),
            CASE
                WHEN m."baseURL" IS NOT NULL THEN json_object('baseURL', m."baseURL")
                ELSE json_object()
            END
        )
        WHEN m."type" = 'IMAGE' AND m."providerType" = 'DASHSCOPE_WAN_IMAGE' THEN json_patch(
            json_object(
                'requestModel', m."name",
                'apiKey', m."apiKey",
                'capabilities', json(m."capabilities")
            ),
            CASE
                WHEN m."baseURL" IS NOT NULL THEN json_object('baseURL', m."baseURL")
                ELSE json_object()
            END
        )
    END,
    m."createdAt",
    m."updatedAt"
FROM "Model" AS m;

DROP TABLE "Model";
ALTER TABLE "Model_new" RENAME TO "Model";

CREATE INDEX "Model_type_idx" ON "Model"("type");
CREATE INDEX "Model_registerId_idx" ON "Model"("registerId");

PRAGMA foreign_keys=ON;
