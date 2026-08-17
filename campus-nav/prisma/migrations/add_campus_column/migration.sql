-- AddColumn campus to locations table
ALTER TABLE "locations" ADD COLUMN "campus" TEXT NOT NULL DEFAULT 'junior';
