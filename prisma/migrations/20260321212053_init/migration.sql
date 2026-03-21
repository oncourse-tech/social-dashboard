-- CreateEnum
CREATE TYPE "VideoFormat" AS ENUM ('UGC_REACTION', 'UGC_VOICEOVER', 'TALKING_HEAD', 'CAROUSEL_SLIDESHOW', 'SCREEN_RECORDING', 'SKIT_COMEDY', 'GREEN_SCREEN', 'TEXT_ON_SCREEN', 'INTERVIEW_PODCAST', 'WHITEBOARD', 'BEFORE_AFTER', 'ASMR_AESTHETIC', 'OTHER');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "App" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedAccount" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "tiktokId" TEXT,
    "displayName" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "totalLikes" INTEGER NOT NULL DEFAULT 0,
    "totalVideos" INTEGER NOT NULL DEFAULT 0,
    "trackingSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "lastPostedAt" TIMESTAMP(3),
    "appId" TEXT NOT NULL,

    CONSTRAINT "TrackedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "tiktokVideoId" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "hashtags" TEXT[],
    "thumbnailUrl" TEXT,
    "videoUrl" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "isCarousel" BOOLEAN NOT NULL DEFAULT false,
    "musicName" TEXT,
    "format" "VideoFormat" NOT NULL DEFAULT 'OTHER',
    "accountId" TEXT NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountSnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "followers" INTEGER NOT NULL,
    "totalLikes" INTEGER NOT NULL,
    "totalVideos" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoSnapshot" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "views" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL,
    "comments" INTEGER NOT NULL,
    "shares" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "accountsSynced" INTEGER NOT NULL DEFAULT 0,
    "videosSynced" INTEGER NOT NULL DEFAULT 0,
    "newVideos" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "viralThreshold1" INTEGER NOT NULL DEFAULT 5000,
    "viralThreshold2" INTEGER NOT NULL DEFAULT 50000,
    "apifyApiKey" TEXT NOT NULL DEFAULT '',
    "apifyActorId" TEXT NOT NULL DEFAULT '',
    "geminiApiKey" TEXT NOT NULL DEFAULT '',
    "syncCron" TEXT NOT NULL DEFAULT '0 6 * * *',

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_provider_providerAccountId_key" ON "auth_accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "App_name_key" ON "App"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedAccount_username_key" ON "TrackedAccount"("username");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedAccount_tiktokId_key" ON "TrackedAccount"("tiktokId");

-- CreateIndex
CREATE INDEX "TrackedAccount_appId_idx" ON "TrackedAccount"("appId");

-- CreateIndex
CREATE INDEX "TrackedAccount_username_idx" ON "TrackedAccount"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Video_tiktokVideoId_key" ON "Video"("tiktokVideoId");

-- CreateIndex
CREATE INDEX "Video_accountId_idx" ON "Video"("accountId");

-- CreateIndex
CREATE INDEX "Video_postedAt_idx" ON "Video"("postedAt");

-- CreateIndex
CREATE INDEX "Video_views_idx" ON "Video"("views");

-- CreateIndex
CREATE INDEX "Video_format_idx" ON "Video"("format");

-- CreateIndex
CREATE INDEX "Video_tiktokVideoId_idx" ON "Video"("tiktokVideoId");

-- CreateIndex
CREATE INDEX "AccountSnapshot_accountId_recordedAt_idx" ON "AccountSnapshot"("accountId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountSnapshot_accountId_recordedAt_key" ON "AccountSnapshot"("accountId", "recordedAt");

-- CreateIndex
CREATE INDEX "VideoSnapshot_videoId_recordedAt_idx" ON "VideoSnapshot"("videoId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VideoSnapshot_videoId_recordedAt_key" ON "VideoSnapshot"("videoId", "recordedAt");

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedAccount" ADD CONSTRAINT "TrackedAccount_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TrackedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSnapshot" ADD CONSTRAINT "AccountSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TrackedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoSnapshot" ADD CONSTRAINT "VideoSnapshot_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
