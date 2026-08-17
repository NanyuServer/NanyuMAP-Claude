-- Add is_navigable column to locations table
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "is_navigable" BOOLEAN NOT NULL DEFAULT true;

-- Set senior campus floor info locations to non-navigable by default
UPDATE "locations" SET "is_navigable" = false
WHERE "campus" = 'senior'
  AND ("detail_info" LIKE '%楼' OR "detail_info" IN ('一楼', '二楼', '三楼', '四楼', '五楼'))
  AND "detail_info" = "category";
