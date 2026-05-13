-- CreateTable: per-viewer ordering of the decks inside a folder.
--
-- `Folder.included_category_ids` continues to define folder membership.
-- This new table stores a per-(user, folder) ordering of those ids so each
-- viewer can drag-and-drop decks into their preferred arrangement without
-- affecting other viewers. Today folders are owner-only so the only viewer
-- is the owner, but storing the order keyed on userId makes future sharing
-- straightforward.
CREATE TABLE "FolderDeckOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "ordered_category_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FolderDeckOrder_pkey" PRIMARY KEY ("id")
);

-- One ordering row per (user, folder).
CREATE UNIQUE INDEX "FolderDeckOrder_userId_folderId_key"
    ON "FolderDeckOrder"("userId", "folderId");

-- Lookup all orderings for a folder (useful when a folder is deleted/shared).
CREATE INDEX "FolderDeckOrder_folderId_idx" ON "FolderDeckOrder"("folderId");

ALTER TABLE "FolderDeckOrder" ADD CONSTRAINT "FolderDeckOrder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolderDeckOrder" ADD CONSTRAINT "FolderDeckOrder_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
