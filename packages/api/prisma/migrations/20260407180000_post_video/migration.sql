-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'CAROUSEL');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE',
ADD COLUMN "videoUrl" TEXT,
ADD COLUMN "videoMinioKey" TEXT,
ADD COLUMN "videoDurationSec" INTEGER,
ADD COLUMN "videoSizeBytes" INTEGER,
ADD COLUMN "keepMedia" BOOLEAN NOT NULL DEFAULT false;
