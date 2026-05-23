import { useLocalSearchParams } from 'expo-router';

import { PracticeScreen } from '@/features/practice/PracticeScreen';

export default function AllCardsPracticeRoute() {
  const params = useLocalSearchParams<{
    /**
     * Singular form set when practice is locked to exactly one deck (e.g. the
     * Play button on a deck detail page). Takes priority over `categoryIds`.
     * Routing through `categoryId` lets the server use its single-deck
     * `practice.queue` branch, which is the only branch guests can hit on a
     * public deck — passing the same deck as `categoryIds` 401s for guests.
     */
    categoryId?: string;
    categoryIds?: string;
    classes?: string;
    difficultyLevels?: string;
    shuffle?: string;
    origin?: string;
  }>();

  const categoryId = params.categoryId || undefined;
  const categoryIds = params.categoryIds?.split(',').filter(Boolean);
  const classes = params.classes?.split(',').filter(Boolean);
  const difficultyLevels = params.difficultyLevels?.split(',').filter(Boolean);
  const shuffle = params.shuffle === '1' || params.shuffle === 'true';
  const origin = params.origin === 'home' || params.origin === 'deck' ? params.origin : undefined;

  return (
    <PracticeScreen
      categoryId={categoryId}
      categoryIds={categoryIds?.length ? categoryIds : undefined}
      classes={classes?.length ? classes : undefined}
      difficultyLevels={difficultyLevels?.length ? difficultyLevels : undefined}
      shuffle={shuffle}
      origin={origin}
    />
  );
}
