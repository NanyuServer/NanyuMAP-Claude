-- Migration: 001_init
-- Run this SQL directly in Neon PostgreSQL if needed

CREATE TABLE IF NOT EXISTS "locations" (
  "id" SERIAL PRIMARY KEY,
  "category" TEXT NOT NULL,
  "detail_info" TEXT NOT NULL,
  "extra_info" TEXT,
  "x" DOUBLE PRECISION NOT NULL,
  "y" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "road_nodes" (
  "id" SERIAL PRIMARY KEY,
  "x" DOUBLE PRECISION NOT NULL,
  "y" DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS "road_edges" (
  "id" SERIAL PRIMARY KEY,
  "from_node" INTEGER NOT NULL,
  "to_node" INTEGER NOT NULL,
  "distance" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "road_edges_from_node_fkey" FOREIGN KEY ("from_node") REFERENCES "road_nodes"("id") ON DELETE CASCADE,
  CONSTRAINT "road_edges_to_node_fkey" FOREIGN KEY ("to_node") REFERENCES "road_nodes"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" SERIAL PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL
);

-- Create indexes for search performance
CREATE INDEX IF NOT EXISTS "locations_category_idx" ON "locations"("category");
CREATE INDEX IF NOT EXISTS "road_edges_from_node_idx" ON "road_edges"("from_node");
CREATE INDEX IF NOT EXISTS "road_edges_to_node_idx" ON "road_edges"("to_node");
