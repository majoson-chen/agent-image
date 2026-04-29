-- AlterTable
ALTER TABLE "Message" ADD COLUMN "parts" JSONB;

-- CreateTable
CREATE TABLE "SearchToolBinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tool" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchToolBinding_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SearchToolBinding_tool_key" ON "SearchToolBinding"("tool");
