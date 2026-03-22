-- Update any videos using removed formats to OTHER
UPDATE "Video" SET "format" = 'OTHER' WHERE "format" NOT IN ('UGC_REACTION', 'UGC_VOICEOVER', 'CAROUSEL_SLIDESHOW', 'OTHER');

-- Drop the default on the format column first
ALTER TABLE "Video" ALTER COLUMN "format" DROP DEFAULT;

-- Create new enum type
CREATE TYPE "VideoFormat_new" AS ENUM ('UGC_REACTION', 'UGC_VOICEOVER', 'CAROUSEL_SLIDESHOW', 'OTHER');

-- Update the column to use the new enum
ALTER TABLE "Video" ALTER COLUMN "format" TYPE "VideoFormat_new" USING ("format"::text::"VideoFormat_new");

-- Drop old enum and rename new one
DROP TYPE "VideoFormat";
ALTER TYPE "VideoFormat_new" RENAME TO "VideoFormat";

-- Restore the default
ALTER TABLE "Video" ALTER COLUMN "format" SET DEFAULT 'OTHER'::"VideoFormat";
