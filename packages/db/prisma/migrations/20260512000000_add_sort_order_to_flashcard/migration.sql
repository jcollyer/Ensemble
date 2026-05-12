-- AlterTable: add sort_order to Flashcard
-- Nullable integer so existing cards are unaffected until the user drags to
-- reorder. The API sorts by sort_order ASC NULLS LAST, created_at DESC so the
-- page continues to look the same as before until an explicit reorder happens.
ALTER TABLE "Flashcard" ADD COLUMN "sort_order" INTEGER;
