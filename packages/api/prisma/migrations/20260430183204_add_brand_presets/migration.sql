-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "defaultPlatforms" TEXT[] DEFAULT ARRAY['INSTAGRAM']::TEXT[],
ADD COLUMN     "stylePrompt" TEXT,
ADD COLUMN     "tonePrompt" TEXT;
