import { PracticeSession } from '@/features/practice/PracticeSession';

interface Props {
  searchParams: Promise<{ categoryIds?: string; classes?: string; limit?: string }>;
}

export default async function AllCategoriesPracticePage({ searchParams }: Props) {
  const params = await searchParams;
  const categoryIds = params.categoryIds?.split(',').filter(Boolean);
  const classes = params.classes?.split(',').filter(Boolean);
  const limit = params.limit ? parseInt(params.limit, 10) : undefined;

  return (
    <PracticeSession
      categoryIds={categoryIds?.length ? categoryIds : undefined}
      classes={classes?.length ? classes : undefined}
      practiceLimit={limit}
    />
  );
}