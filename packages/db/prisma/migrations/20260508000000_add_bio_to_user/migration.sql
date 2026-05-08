-- Add an optional free-form bio to the User table. Stored as TEXT so it can
-- hold longer content without the 255-char varchar limit.
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
