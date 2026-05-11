-- Phase 1 of the SM-2 → free-form difficulty rating migration.
--
-- Adds a new `difficultyLevel` column on Flashcard (nullable text). The app
-- will write one of 'challenging' | 'good' | 'easy' here whenever the user
-- rates a card during practice; brand-new cards keep NULL until they're
-- rated for the first time.
--
-- The legacy SM-2 columns (confidence, easeFactor, interval, repetitions,
-- nextReview) intentionally remain — they're no longer read or written by
-- the application but we leave them in place for one release so historical
-- data isn't lost. They will be dropped in a follow-up migration.
--
-- We do drop the two `nextReview`-based indexes here. They were only useful
-- for the SM-2 due-date filter on practice.queue, which is gone, so keeping
-- them around just slows writes.

ALTER TABLE "Flashcard" ADD COLUMN "difficultyLevel" TEXT;

DROP INDEX IF EXISTS "Flashcard_categoryId_nextReview_idx";
DROP INDEX IF EXISTS "Flashcard_userId_nextReview_idx";
