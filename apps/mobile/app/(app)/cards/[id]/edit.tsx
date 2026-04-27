import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { FlashcardUpdateInput } from '@flipflow/types';

import { Button } from '../../../../src/components/Button';
import { TextField } from '../../../../src/components/TextField';
import { trpc } from '../../../../src/lib/trpc';

// Sentinel for "leave the card uncategorized" — we represent that as
// undefined in the payload (don't touch the field) but need a stable string
// key for the picker UI.
const KEEP_UNCATEGORIZED = '__none__';

/**
 * Edit card modal. Loads the current card, hydrates the form fields once,
 * and sends a partial update on submit.
 *
 * For uncategorized cards (categoryId === null), an "Assign to deck"
 * picker is shown so the user can move the card into a deck. Cards that
 * are already in a deck don't get a re-assign UI here — that wasn't asked
 * for and matches the web edit dialog's behavior.
 */
export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cardId = id as string;
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: card, isLoading } = trpc.flashcards.byId.useQuery({ id: cardId });
  const { data: categories } = trpc.categories.list.useQuery();

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [frontError, setFrontError] = useState<string | undefined>();
  const [backError, setBackError] = useState<string | undefined>();
  const [hydrated, setHydrated] = useState(false);

  // Tracks the deck-assignment picker. Only meaningful when the card is
  // currently uncategorized; a value other than KEEP_UNCATEGORIZED means
  // "move this card into this deck on save".
  const [assignDeck, setAssignDeck] = useState<string>(KEEP_UNCATEGORIZED);

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
      // categoryId can now be null (uncategorized) — only invalidate the
      // per-deck cache when the card actually belongs to a deck.
      if (updated.categoryId) {
        utils.flashcards.listByCategory.invalidate({ categoryId: updated.categoryId });
        utils.practice.stats.invalidate({ categoryId: updated.categoryId });
      }
      utils.flashcards.listAll.invalidate();
      utils.flashcards.byId.invalidate({ id: cardId });
      utils.practice.stats.invalidate({});
      utils.categories.list.invalidate();
      router.back();
    },
    onError: (err) => Alert.alert('Could not save card', err.message),
  });

  // Sorted decks for the picker. Stable order = predictable UI.
  const decks = useMemo(
    () =>
      (categories ?? [])
        .map((c) => ({ id: c.id, name: c.name, color: c.color }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  // Show the deck assigner only for uncategorized cards. Cards already in a
  // deck don't get a re-assign UI — keep that as a separate, explicit
  // action if it's ever needed.
  const showAssign = card != null && !card.categoryId && decks.length > 0;

  function handleSubmit() {
    setFrontError(undefined);
    setBackError(undefined);

    // Only include categoryId in the payload if the user explicitly picked
    // a deck for an uncategorized card. Leaving it out preserves the
    // "don't touch this field" semantics of the partial update.
    const categoryId =
      showAssign && assignDeck !== KEEP_UNCATEGORIZED ? assignDeck : undefined;

    const parsed = FlashcardUpdateInput.safeParse({
      id: cardId,
      front,
      back,
      ...(categoryId ? { categoryId } : {}),
    });
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

          {showAssign ? (
            <View className="gap-2">
              <Text className="text-sm font-medium text-slate-700">Assign to deck</Text>
              <View className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <DeckOption
                  label="Leave uncategorized"
                  selected={assignDeck === KEEP_UNCATEGORIZED}
                  onPress={() => setAssignDeck(KEEP_UNCATEGORIZED)}
                />
                {decks.map((d) => (
                  <DeckOption
                    key={d.id}
                    label={d.name}
                    color={d.color ?? undefined}
                    selected={assignDeck === d.id}
                    onPress={() => setAssignDeck(d.id)}
                  />
                ))}
              </View>
              <Text className="text-xs text-slate-500">
                Move this card into one of your decks. You can&apos;t move it back
                to uncategorized once assigned.
              </Text>
            </View>
          ) : null}
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

/**
 * Single row in the deck picker. Mirrors the picker on the new-card screen
 * for visual consistency.
 */
function DeckOption({
  label,
  color,
  selected,
  onPress,
}: {
  label: string;
  color?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 active:opacity-80 ${
        selected ? 'bg-primary/10' : ''
      }`}
    >
      {color ? (
        <View
          className="h-4 w-4 rounded-sm"
          style={{ backgroundColor: color }}
        />
      ) : (
        <View className="h-4 w-4 rounded-sm border border-dashed border-slate-300" />
      )}
      <Text
        className={`flex-1 text-base ${
          selected ? 'font-semibold text-primary' : 'text-slate-900'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
      {selected ? (
        <Text className="text-base font-bold text-primary">✓</Text>
      ) : null}
    </Pressable>
  );
}
