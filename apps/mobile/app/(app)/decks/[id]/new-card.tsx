import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FlashcardCreateInput } from '@flipflow/types';

import { Button } from '../../../../src/components/Button';
import { TextField } from '../../../../src/components/TextField';
import { useDebouncedValue } from '../../../../src/lib/hooks';
import { trpc } from '../../../../src/lib/trpc';

/** Languages exposed in the translation segmented control. Must match the server enum. */
const TRANSLATE_TARGETS = [
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
] as const;
type TranslateTargetValue = (typeof TRANSLATE_TARGETS)[number]['value'];

interface TranslatePrefs {
  v: 1;
  enabled: boolean;
  target: TranslateTargetValue;
}

const prefsKey = (categoryId: string) => `flipflow:translate:${categoryId}`;

async function readPrefs(categoryId: string): Promise<TranslatePrefs | null> {
  try {
    const raw = await AsyncStorage.getItem(prefsKey(categoryId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TranslatePrefs>;
    if (
      parsed.v === 1 &&
      typeof parsed.enabled === 'boolean' &&
      TRANSLATE_TARGETS.some((t) => t.value === parsed.target)
    ) {
      return parsed as TranslatePrefs;
    }
  } catch {
    // Ignore corrupt entries — the user just gets defaults.
  }
  return null;
}

async function writePrefs(categoryId: string, prefs: TranslatePrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(prefsKey(categoryId), JSON.stringify(prefs));
  } catch {
    // AsyncStorage can throw on quota exhaustion — non-fatal.
  }
}

/**
 * Modal for adding a card to a deck. Two multi-line text fields + a submit.
 *
 * Optional translation mode: when the server has Google Translate configured,
 * a toggle + language picker appear. Typing in the front debounces a call to
 * the translate.translate procedure and writes the result into the back. The
 * toggle and chosen language are remembered per deck (AsyncStorage), so a
 * "French Vocab" deck always opens in French mode.
 *
 * Auto-fill behavior: every debounced front change overwrites the back with
 * the latest translation, even if the user manually edited it. Parity with
 * the web client.
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

  // Translation state. `hydrated` gates the persist effect so the initial
  // defaults don't clobber stored prefs before the read completes.
  const [translateOn, setTranslateOn] = useState(false);
  const [target, setTarget] = useState<TranslateTargetValue>('fr');
  const [hydrated, setHydrated] = useState(false);

  const { data: availability } = trpc.translate.isAvailable.useQuery(undefined, {
    staleTime: Infinity,
  });
  const translateAvailable = !!availability?.available;

  const create = trpc.flashcards.create.useMutation({
    onSuccess: () => {
      utils.flashcards.listByCategory.invalidate({ categoryId });
      utils.practice.stats.invalidate({ categoryId });
      utils.categories.list.invalidate();
      router.back();
    },
    onError: (err) => Alert.alert('Could not add card', err.message),
  });

  const translate = trpc.translate.translate.useMutation();

  // Object-identity guard against out-of-order responses. See the web client
  // for the detailed rationale — same race, same fix.
  const lastTranslatedRef = useRef<{ text: string; target: string } | null>(null);

  // Hydrate per-deck prefs once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readPrefs(categoryId);
      if (cancelled) return;
      if (stored) {
        setTranslateOn(stored.enabled);
        setTarget(stored.target);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  // Persist changes — only after hydration to avoid wiping stored prefs on
  // first render with the defaults.
  useEffect(() => {
    if (!hydrated) return;
    writePrefs(categoryId, { v: 1, enabled: translateOn, target });
  }, [hydrated, categoryId, translateOn, target]);

  // Debounced translation on front-text change.
  const debouncedFront = useDebouncedValue(front.trim(), 500);

  useEffect(() => {
    if (!translateOn || !translateAvailable) return;

    if (!debouncedFront) {
      setBack('');
      lastTranslatedRef.current = null;
      return;
    }

    const last = lastTranslatedRef.current;
    if (last && last.text === debouncedFront && last.target === target) return;

    const request = { text: debouncedFront, target };
    lastTranslatedRef.current = request;

    translate.mutate(
      { text: debouncedFront, target },
      {
        onSuccess: ({ translation }) => {
          if (lastTranslatedRef.current !== request) return;
          setBack(translation);
          setBackError(undefined);
        },
      },
    );
    // `translate` from useMutation isn't referentially stable; including it
    // would re-run the effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFront, target, translateOn, translateAvailable]);

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
          {translateAvailable ? (
            <View className="gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-base font-semibold text-slate-900">Translation card</Text>
                  <Text className="mt-0.5 text-sm text-slate-500">
                    Auto-translate the front into the chosen language.
                  </Text>
                </View>
                <Switch value={translateOn} onValueChange={setTranslateOn} />
              </View>
              {translateOn ? (
                <View className="flex-row gap-2">
                  {TRANSLATE_TARGETS.map((opt) => {
                    const active = target === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setTarget(opt.value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        className={`flex-1 rounded-md border px-3 py-2 active:opacity-80 ${
                          active ? 'border-primary bg-primary' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <Text
                          className={`text-center text-sm font-semibold ${
                            active ? 'text-white' : 'text-slate-700'
                          }`}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : null}

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

          {/* Back: render label + optional spinner ourselves instead of using
              TextField's `label` prop, so we can show "Translating…" inline. */}
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-slate-700">Back</Text>
              {translateOn && translate.isPending ? (
                <View className="flex-row items-center gap-1.5">
                  <ActivityIndicator size="small" color="#64748b" />
                  <Text className="text-xs text-slate-500">Translating…</Text>
                </View>
              ) : null}
            </View>
            <TextField
              placeholder="What's the answer?"
              value={back}
              onChangeText={(v) => {
                setBack(v);
                if (backError) setBackError(undefined);
              }}
              error={backError}
              multiline
              style={{ minHeight: 120, textAlignVertical: 'top' }}
            />
            {translate.error ? (
              <Text className="text-xs text-destructive">{translate.error.message}</Text>
            ) : null}
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
              Add card
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
