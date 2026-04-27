-- Make Flashcard.categoryId optional and add a direct Flashcard.userId pointer
-- so we can find a user's uncategorized cards without joining through Category.
--
-- Backfill plan: every existing Flashcard already belongs to a Category whose
-- userId we copy across before flipping userId to NOT NULL.

-- 1. Add userId nullable, then backfill from the row's category.
ALTER TABLE "Flashcard" ADD COLUMN "userId" TEXT;

UPDATE "Flashcard" AS f
SET "userId" = c."userId"
FROM "Category" AS c
WHERE f."categoryId" = c."id";

-- 2. Lock userId to NOT NULL now that every row has one.
ALTER TABLE "Flashcard" ALTER COLUMN "userId" SET NOT NULL;

-- 3. Make categoryId nullable.
ALTER TABLE "Flashcard" ALTER COLUMN "categoryId" DROP NOT NULL;

-- 4. Wire up the User foreign key.
ALTER TABLE "Flashcard"
  ADD CONSTRAINT "Flashcard_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Indexes for owner-scoped queries (the All decks view, due-card lookups).
CREATE INDEX "Flashcard_userId_idx" ON "Flashcard"("userId");
CREATE INDEX "Flashcard_userId_nextReview_idx" ON "Flashcard"("userId", "nextReview");
