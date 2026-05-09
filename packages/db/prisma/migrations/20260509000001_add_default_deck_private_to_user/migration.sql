-- Add a global default-deck-privacy flag to User.
-- true  = new decks are created private by default (existing behaviour)
-- false = new decks are created public by default
ALTER TABLE "User" ADD COLUMN "defaultDeckPrivate" BOOLEAN NOT NULL DEFAULT true;
