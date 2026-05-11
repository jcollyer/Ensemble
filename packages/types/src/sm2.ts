// Intentionally empty.
//
// The SM-2 spaced-repetition algorithm previously lived here. The app moved
// off SM-2 in favour of a free-form difficulty rating
// (challenging / good / easy) stored on Flashcard.difficultyLevel; see
// packages/types/src/schemas.ts for the new SubmitReviewInput and
// DifficultyLevelSchema.
//
// This file is kept (empty) for one release cycle so any stale imports from
// in-flight branches fail with an obvious "no exports" error rather than a
// missing-module error. It can be deleted in the same change that drops the
// legacy SM-2 columns from the Flashcard table.
export {};
