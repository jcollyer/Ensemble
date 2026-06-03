-- Adds a per-(user, card) manual ordering column for the dedicated
-- "/app/favorites" view. This is independent of Flashcard.sortOrder (the
-- global per-deck order): reordering favorites only writes this column, so a
-- user's favorites order never disturbs deck order and vice-versa.
--
-- Nullable on purpose. NULL means "never manually sorted from the favorites
-- view" — the listFavorites query sorts NULLs last (then by updatedAt), so
-- cards favorited from other views keep landing at the bottom of the list,
-- preserving the existing behavior. Existing CardProgress rows get NULL,
-- which is the desired default; no backfill is needed.

ALTER TABLE "CardProgress" ADD COLUMN "favoriteSortOrder" INTEGER;
