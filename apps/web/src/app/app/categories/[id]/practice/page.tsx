import { PracticeSession } from '@/features/practice/PracticeSession';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ classes?: string; difficultyLevels?: string }>;
}

export default async function PracticePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const classes = sp.classes?.split(',').filter(Boolean);
  const difficultyLevels = sp.difficultyLevels?.split(',').filter(Boolean);

  return (
    <PracticeSession
      categoryId={id}
      classes={classes?.length ? classes : undefined}
      difficultyLevels={difficultyLevels?.length ? difficultyLevels : undefined}
    />
  );
}
