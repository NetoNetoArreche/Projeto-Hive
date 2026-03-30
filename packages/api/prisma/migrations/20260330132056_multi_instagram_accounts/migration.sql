-- DropIndex
DROP INDEX "InstagramToken_userId_key";

-- AlterTable
ALTER TABLE "InstagramToken" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE INDEX "InstagramToken_userId_idx" ON "InstagramToken"("userId");
