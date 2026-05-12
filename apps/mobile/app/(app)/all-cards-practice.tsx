import { useLocalSearchParams } from 'expo-router';

import { PracticeScreen } from '@/features/practice/PracticeScreen';

export default function AllCardsPracticeRoute() {
  const params = useLocalSearchParams<{
    categoryIds?: string;
    classes?: string;
    difficultyLevels?: string;
  }>();

  const categoryIds = params.categoryIds?.split(',').filter(Boolean);
  const classes = params.classes?.split(',').filter(Boolean);
  const difficultyLevels = params.difficultyLevels?.split(',').filter(Boolean);

  return (
    <PracticeScreen
      categoryIds={categoryIds?.length ? categoryIds : undefined}
      classes={classes?.length ? classes : undefined}
      difficultyLevels={difficultyLevels?.length ? difficultyLevels : undefined}
    />
  );
}
