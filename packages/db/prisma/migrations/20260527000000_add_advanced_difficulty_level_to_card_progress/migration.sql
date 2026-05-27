-- Adds a per-(user, card) "advanced difficulty level" rating alongside the
-- existing coarse `difficultyLevel`. The advanced picker (Continuing /
-- Challenging / Good / Easy → split into seven detailed checkboxes) writes
-- a comma-separated list of values into this column while still maintaining
-- the matching coarse `difficultyLevel` for backwards compatibility with the
-- existing filters, snapshot tiles and stats queries.
--
-- The column is nullable so existing CardProgress rows continue to work
-- unchanged — they simply render as "No (advanced) rating" until the user
-- rates them with the advanced picker.

ALTER TABLE "CardProgress" ADD COLUMN "advancedDifficultyLevel" TEXT;
