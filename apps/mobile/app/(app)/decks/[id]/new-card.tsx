import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { FlashcardCreateInput } from '@flipflow/types';

import { Button } from '../../../../src/components/Button';
import { TextField } from '../../../../src/components/TextField';
import { trpc } from '../../../../src/lib/trpc';

/**
 * Modal for adding a card to a deck. Two multi-line text fields + a
 * submit. Cancels back to the deck.
 */
export default function NewCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const categoryId = id as string;
  const router = useRouter();
  const utils = trpc.useUtils();

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [frontError, setFrontError] = useState<string | undefined>();
  const [backError, setBackError] = useState<string | undefined>();

  const create = trpc.flashcards.create.useMutation({
    onSuccess: () => {
      utils.flashcards.listByCategory.invalidate({ categoryId });
      utils.practice.stats.invalidate({ categoryId });
      utils.categories.list.invalidate();
      router.back();
    },
    onError: (err) => Alert.alert('Could not add card', err.message),
  });

  function handleSubmit() {
    setFrontError(undefined);
    setBackError(undefined);
    const parsed = FlashcardCreateInput.safeParse({ front, back, categoryId });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'front') setFrontError(issue.message);
        if (issue.path[0] === 'back') setBackError(issue.message);
      }
      return;
    }
    create.mutate(parsed.data);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text className="mb-6 text-base text-slate-500">
          The front is the prompt, the back is the answer.
        </Text>

        <View className="gap-5">
          <TextField
            label="Front"
            placeholder="What's on the prompt side?"
            value={front}
            onChangeText={setFront}
            error={frontError}
            autoFocus
            multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
          <TextField
            label="Back"
            placeholder="What's the answer?"
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
            <Button onPress={handleSubmit} loading={create.isPending}>
              Add card
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
