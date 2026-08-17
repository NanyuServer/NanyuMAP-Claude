-- Add custom_checkpoints field to visit_routes
ALTER TABLE "visit_routes" ADD COLUMN IF NOT EXISTS "custom_checkpoints" TEXT NOT NULL DEFAULT '[]';
