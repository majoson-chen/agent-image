-- AlterTable
ALTER TABLE "ConversationModelSelection" ADD COLUMN "params" JSONB;

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "modelIdAtTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Image_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Image_modelIdAtTime_fkey" FOREIGN KEY ("modelIdAtTime") REFERENCES "Model" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
