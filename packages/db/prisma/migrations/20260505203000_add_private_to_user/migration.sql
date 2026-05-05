-- Add a `private` flag to User. Defaults to true so users remain private
-- unless they explicitly opt into being visible to others.
ALTER TABLE "User" ADD COLUMN "private" BOOLEAN NOT NULL DEFAULT true;