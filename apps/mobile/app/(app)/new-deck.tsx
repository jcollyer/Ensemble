import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { CategoryCreateInput } from '@flipflow/types';

import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { trpc } from '../../src/lib/trpc';

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

/**
 * Modal for creating a deck. Same palette as the web app so a deck's
 * color shows up consistently across clients.
 */
export default function NewDeckScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(PALETTE[0]!);
  const [nameError, setNameError] = useState<string | undefined>();

  const create = trpc.categories.create.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      router.back();
    },
    onError: (err) => Alert.alert('Could not create deck', err.message),
  });

  function handleSubmit() {
    setNameError(undefined);
    const parsed = CategoryCreateInput.safeParse({ name, color });
    if (!parsed.success) {
      const msg = parsed.error.issues.find((i) => i.path[0] === 'name')?.message ?? 'Invalid input';
      setNameError(msg);
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
          Group related flashcards into a deck. You can change the name and color later.
        </Text>

        <View className="gap-5">
          <TextField
            label="Name"
            placeholder="e.g. Spanish verbs"
            value={name}
            onChangeText={setName}
            error={nameError}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <View className="gap-2">
            <Text className="text-sm font-medium text-slate-700">Color</Text>
            <View className="flex-row flex-wrap gap-3">
              {PALETTE.map((c) => {
                const selected = c === color;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    className="h-10 w-10 rounded-md"
                    style={{
                      backgroundColor: c,
                      borderWidth: selected ? 3 : 0,
                      borderColor: '#0f172a',
                    }}
                    accessibilityLabel={`Color ${c}`}
                  />
                );
              })}
            </View>
          </View>
        </View>

        <View className="mt-8 flex-row gap-3">
          <View className="flex-1">
            <Button variant="ghost" onPress={() => router.back()}>
              Cancel
            </Button>
          </View>
          <View className="flex-1">
            <Button onPress={handleSubmit} loading={create.isPending}>
              Create deck
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
