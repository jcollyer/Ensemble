import { useLocalSearchParams } from 'expo-router';

import { PracticeScreen as PracticeSessionScreen } from '@/features/practice/PracticeScreen';

export default function PracticeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PracticeSessionScreen categoryId={id as string} />;
}
