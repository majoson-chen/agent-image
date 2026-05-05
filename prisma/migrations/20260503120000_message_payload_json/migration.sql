-- Prisma SQLite: 重建 Message，backfill payload，去掉 content/parts/usage/FK
PRAGMA foreign_keys=OFF;

CREATE TABLE "Message_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_new_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "Message_new" ("id", "conversationId", "role", "payload", "createdAt")
SELECT
    m."id",
    m."conversationId",
    m."role",
    json_patch(
        json_object(
            'role', CASE m."role"
                WHEN 'USER' THEN 'user'
                WHEN 'ASSISTANT' THEN 'assistant'
                WHEN 'SYSTEM' THEN 'system'
            END,
            'parts', COALESCE(
                m."parts",
                json_array(json_object('type', 'text', 'text', m."content"))
            )
        ),
        json_object(
            'metadata', json_object(
                'usage', CASE
                    WHEN m."usageTotalTokens" IS NOT NULL THEN json_object(
                        'inputTokens', COALESCE(m."usageInputTokens", 0),
                        'outputTokens', COALESCE(m."usageOutputTokens", 0),
                        'totalTokens', m."usageTotalTokens"
                    )
                END,
                'modelIdAtTime', m."modelIdAtTime"
            )
        )
    ),
    m."createdAt"
FROM "Message" AS m;

DROP TABLE "Message";
ALTER TABLE "Message_new" RENAME TO "Message";

CREATE INDEX IF NOT EXISTS "Message_conversationId_idx" ON "Message"("conversationId");

PRAGMA foreign_keys=ON;
