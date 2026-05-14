import { useLocalSearchParams } from 'expo-router';

import { PracticeScreen as PracticeSessionScreen } from '@/features/practice/PracticeScreen';

export default function PracticeScreen() {
  const { id, shuffle } = useLocalSearchParams<{ id: string; shuffle?: string }>();
  const isShuffle = shuffle === '1' || shuffle === 'true';
  return <PracticeSessionScreen categoryId={id as string} shuffle={isShuffle} />;
}
