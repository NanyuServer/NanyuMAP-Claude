-- Visit Routes table for preset navigation routes
CREATE TABLE IF NOT EXISTS "visit_routes" (
    "id" SERIAL NOT NULL,
    "campus" TEXT NOT NULL DEFAULT 'junior',
    "name" TEXT NOT NULL,
    "location_ids" TEXT NOT NULL DEFAULT '[]',
    "checkpoints" TEXT NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "visit_routes_pkey" PRIMARY KEY ("id")
);
