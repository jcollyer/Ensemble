import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';

import { FlashcardUpdateInput } from '@flipflow/types';

import { Button } from '../../../../src/components/Button';
import { TextField } from '../../../../src/components/TextField';
import { trpc } from '../../../../src/lib/trpc';

/**
 * Edit card modal. Loads the current card, hydrates the form fields once,
 * and sends a partial update on submit.
 */
export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cardId = id as string;
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: card, isLoading } = trpc.flashcards.byId.useQuery({ id: cardId });

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [frontError, setFrontError] = useState<string | undefined>();
  const [backError, setBackError] = useState<string | undefined>();
  const [hydrated, setHydrated] = useState(false);

  // Seed the form from the fetched card once; don't clobber edits on
  // subsequent background refetches.
  useEffect(() => {
    if (card && !hydrated) {
      setFront(card.front);
      setBack(card.back);
      setHydrated(true);
    }
  }, [card, hydrated]);

  const update = trpc.flashcards.update.useMutation({
    onSuccess: (updated) => {
      utils.flashcards.listByCategory.invalidate({ categoryId: updated.categoryId });
      utils.flashcards.byId.invalidate({ id: cardId });
      router.back();
    },
    onError: (err) => Alert.alert('Could not save card', err.message),
  });

  function handleSubmit() {
    setFrontError(undefined);
    setBackError(undefined);
    const parsed = FlashcardUpdateInput.safeParse({ id: cardId, front, back });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'front') setFrontError(issue.message);
        if (issue.path[0] === 'back') setBackError(issue.message);
      }
      return;
    }
    update.mutate(parsed.data);
  }

  if (isLoading || !card) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <View className="gap-5">
          <TextField
            label="Front"
            value={front}
            onChangeText={setFront}
            error={frontError}
            multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
          <TextField
            label="Back"
            value={back}
            onChangeText={setBack}
            error={backError}
            multiline
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
        </View>

        <View className="mt-8 flex-row gap-3">
          <View className="flex-1">
            <Button variant="ghost" onPress={() => router.back()}>
              Cancel
            </Button>
          </View>
          <View className="flex-1">
            <Button onPress={handleSubmit} loading={update.isPending}>
              Save
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
