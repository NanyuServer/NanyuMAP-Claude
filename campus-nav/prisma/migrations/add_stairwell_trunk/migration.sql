-- Add is_trunk column to stairwells table
ALTER TABLE "stairwells" ADD COLUMN IF NOT EXISTS "is_trunk" BOOLEAN NOT NULL DEFAULT false;
