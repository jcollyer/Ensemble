-- Phase 2 of the SM-2 → free-form difficulty rating migration.
--
-- Drops the five legacy SM-2 columns from Flashcard. They were left in
-- place by 20260511000000_add_difficulty_level_to_flashcard so historical
-- data could be inspected (and optionally backfilled into difficultyLevel)
-- before being deleted. By the time this migration runs the application
-- has been fully off SM-2 for one release, so it's safe to drop them.
--
-- Recovery note: this is a destructive change. If you need the historical
-- ratings later, take a database snapshot before applying.
--
-- The two `nextReview`-based indexes were already removed in the previous
-- migration; nothing to drop here.

ALTER TABLE "Flashcard"
  DROP COLUMN "confidence",
  DROP COLUMN "easeFactor",
  DROP COLUMN "interval",
  DROP COLUMN "repetitions",
  DROP COLUMN "nextReview";
