-- Add route_points and image_crop to visit_routes
ALTER TABLE "visit_routes" ADD COLUMN IF NOT EXISTS "route_points" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "visit_routes" ADD COLUMN IF NOT EXISTS "image_crop" TEXT NOT NULL DEFAULT '{}';
