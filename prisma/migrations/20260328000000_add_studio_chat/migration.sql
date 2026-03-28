-- CreateTable
CREATE TABLE "StudioChat" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Slideshow',
    "status" TEXT NOT NULL DEFAULT 'active',
    "slug" TEXT,
    "slides" JSONB,
    "manifest" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudioChat_createdAt_idx" ON "StudioChat"("createdAt");

-- CreateIndex
CREATE INDEX "StudioMessage_chatId_createdAt_idx" ON "StudioMessage"("chatId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudioMessage" ADD CONSTRAINT "StudioMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "StudioChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
