'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  FlashcardUpdateInput,
  GENDER_OPTIONS,
  type GenderValue,
  VERB_TYPE_OPTIONS,
  type VerbTypeValue,
} from '@ensemble/types';
import { Loader2, Plus, Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc/client';
import { ClassSelect } from '@/features/cards/ClassSelect';

const KEEP_UNCATEGORIZED = '__none__';
const NO_GENDER = '__no_gender__';
const NO_VERB_TYPE = '__no_verb_type__';

function readDictionaryTarget(categoryId: string | null): 'en' | 'fr' | 'es' | 'de' {
  if (typeof window === 'undefined') return 'en';
  try {
    const scope = categoryId ?? '__dashboard__';
    const raw = window.localStorage.getItem(`ensemble:translate:${scope}`);
    if (!raw) return 'en';
    const parsed = JSON.parse(raw) as { target?: string };
    if (parsed.target === 'fr' || parsed.target === 'es' || parsed.target === 'de') {
      return parsed.target;
    }
  } catch {
    // Corrupt/quota — fall through to English.
  }
  return 'en';
}

export function EditCardDialog({
  cardId,
  decks,
  onClose,
  onSaved,
}: {
  cardId: string;
  decks: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: card } = trpc.flashcards.byId.useQuery({ id: cardId });
  const update = trpc.flashcards.update.useMutation({
    onSuccess: (updatedCard) => {
      utils.flashcards.byId.setData({ id: updatedCard.id }, updatedCard);
      void utils.flashcards.byId.invalidate({ id: updatedCard.id });
      onSaved();
    },
  });

  const [assignDeck, setAssignDeck] = useState<string>(KEEP_UNCATEGORIZED);
  const [frontExamples, setFrontExamples] = useState<string[]>([]);
  const [backExamples, setBackExamples] = useState<string[]>([]);
  const [wordClass, setWordClass] = useState<string | null>(null);
  const [gender, setGender] = useState<GenderValue | null>(null);
  const [verbType, setVerbType] = useState<VerbTypeValue | null>(null);
  const [pronunciation, setPronunciation] = useState('');

  useEffect(() => {
    if (card) {
      setFrontExamples(card.frontExamples);
      setBackExamples(card.backExamples);
      setWordClass(card.class ?? null);
      setGender(((card as { gender?: string | null }).gender as GenderValue | null) ?? null);
      setVerbType(
        ((card as { verb_type?: string | null }).verb_type as VerbTypeValue | null) ?? null,
      );
      setPronunciation((card as { pronunciation?: string | null }).pronunciation ?? '');
    }
  }, [card]);

  const form = useForm<FlashcardUpdateInput>({
    resolver: zodResolver(FlashcardUpdateInput),
    values: { id: cardId, front: card?.front ?? '', back: card?.back ?? '' },
  });

  const showAssign = Boolean(card && !card.categoryId && decks.length > 0);

  const [genderLookupMsg, setGenderLookupMsg] = useState<{
    tone: 'error' | 'info';
    text: string;
  } | null>(null);
  const [pronLookupMsg, setPronLookupMsg] = useState<{
    tone: 'error' | 'info';
    text: string;
  } | null>(null);
  const [classLookupMsg, setClassLookupMsg] = useState<{
    tone: 'error' | 'info';
    text: string;
  } | null>(null);
  const lookupGender = trpc.dictionary.getGender.useMutation();
  const lookupPronunciation = trpc.dictionary.getPronunciation.useMutation();
  const lookupCategory = trpc.dictionary.getCategory.useMutation();

  const back = useWatch({ control: form.control, name: 'back' }) ?? '';
  const trimmedBack = back.trim();
  const canLookup = trimmedBack.length > 0;
  const dictionaryTarget = readDictionaryTarget(card?.categoryId ?? null);

  function describeMiss(kind: 'no_value' | 'not_in_dictionary' | 'multiple_words') {
    if (kind === 'multiple_words') return 'Cannot access multiple words';
    if (kind === 'not_in_dictionary') return 'Word not found in dictionary';
    return 'No value returned';
  }

  function handleGetGender() {
    if (!canLookup) return;
    setGenderLookupMsg(null);
    lookupGender.mutate(
      { word: trimmedBack, target: dictionaryTarget },
      {
        onSuccess: (res) => {
          if (res.kind === 'ok') {
            setGender(res.gender);
            setGenderLookupMsg(null);
          } else {
            setGenderLookupMsg({ tone: 'info', text: describeMiss(res.kind) });
          }
        },
        onError: (err) => setGenderLookupMsg({ tone: 'error', text: err.message }),
      },
    );
  }

  function handleGetCategory() {
    if (!canLookup) return;
    setClassLookupMsg(null);
    lookupCategory.mutate(
      { word: trimmedBack, target: dictionaryTarget },
      {
        onSuccess: (res) => {
          if (res.kind === 'ok') {
            setWordClass(res.category);
            setClassLookupMsg(null);
          } else {
            setClassLookupMsg({ tone: 'info', text: describeMiss(res.kind) });
          }
        },
        onError: (err) => setClassLookupMsg({ tone: 'error', text: err.message }),
      },
    );
  }

  function handleGetPronunciation() {
    if (!canLookup) return;
    setPronLookupMsg(null);
    lookupPronunciation.mutate(
      { word: trimmedBack, target: dictionaryTarget },
      {
        onSuccess: (res) => {
          if (res.kind === 'ok') {
            setPronunciation(res.pronunciation);
            setPronLookupMsg(null);
          } else {
            setPronLookupMsg({ tone: 'info', text: describeMiss(res.kind) });
          }
        },
        onError: (err) => setPronLookupMsg({ tone: 'error', text: err.message }),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[80dvh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Edit card</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => {
            const categoryId =
              showAssign && assignDeck !== KEEP_UNCATEGORIZED ? assignDeck : undefined;
            update.mutate({
              ...values,
              categoryId,
              frontExamples,
              backExamples,
              class: wordClass,
              gender,
              verb_type: wordClass === 'verb' ? verbType : null,
              pronunciation: pronunciation.trim() ? pronunciation.trim() : null,
            });
          })}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label htmlFor="front">Front</Label>
            <Textarea id="front" rows={2} {...form.register('front')} />
            {frontExamples.length > 0 ? (
              <div className="space-y-2">
                {frontExamples.map((val, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="Example..."
                      value={val}
                      onChange={(e) =>
                        setFrontExamples((prev) => {
                          const next = [...prev];
                          next[i] = e.target.value;
                          return next;
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setFrontExamples((prev) => prev.filter((_, j) => j !== i));
                        setBackExamples((prev) => prev.filter((_, j) => j !== i));
                      }}
                      aria-label="Remove example"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            {frontExamples.length < 20 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground -ml-1 h-7 text-xs"
                onClick={() => {
                  setFrontExamples((prev) => [...prev, '']);
                  setBackExamples((prev) => [...prev, '']);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add example
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-card-pronunciation">Pronunciation (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="edit-card-pronunciation"
                value={pronunciation}
                onChange={(e) => setPronunciation(e.target.value)}
                placeholder="e.g. /bɔ̃.ʒuʁ/ or bohn-zhoor"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGetPronunciation}
                disabled={!canLookup || lookupPronunciation.isPending}
                title="Look up IPA from the dictionary using the Back word"
              >
                {lookupPronunciation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Get pronunciation
              </Button>
            </div>
            {pronLookupMsg ? (
              <p
                className={
                  pronLookupMsg.tone === 'error'
                    ? 'text-destructive text-xs'
                    : 'text-muted-foreground text-xs'
                }
              >
                {pronLookupMsg.text}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="back">Back</Label>
            <Textarea id="back" rows={3} {...form.register('back')} />
            {backExamples.length > 0 ? (
              <div className="space-y-2">
                {backExamples.map((val, i) => (
                  <Input
                    key={i}
                    placeholder="Example..."
                    value={val}
                    onChange={(e) =>
                      setBackExamples((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-card-class">Category (optional)</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <ClassSelect id="edit-card-class" value={wordClass} onChange={setWordClass} />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGetCategory}
                disabled={!canLookup || lookupCategory.isPending}
                title="Look up part of speech from the dictionary using the Back word"
              >
                {lookupCategory.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Get category
              </Button>
            </div>
            {classLookupMsg ? (
              <p
                className={
                  classLookupMsg.tone === 'error'
                    ? 'text-destructive text-xs'
                    : 'text-muted-foreground text-xs'
                }
              >
                {classLookupMsg.text}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-card-gender">Gender (optional)</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select
                  value={gender ?? NO_GENDER}
                  onValueChange={(value) =>
                    setGender(value === NO_GENDER ? null : (value as GenderValue))
                  }
                >
                  <SelectTrigger id="edit-card-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_GENDER}>None</SelectItem>
                    {GENDER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGetGender}
                disabled={!canLookup || lookupGender.isPending}
                title="Look up gender from the dictionary using the Back word"
              >
                {lookupGender.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Get gender
              </Button>
            </div>
            {genderLookupMsg ? (
              <p
                className={
                  genderLookupMsg.tone === 'error'
                    ? 'text-destructive text-xs'
                    : 'text-muted-foreground text-xs'
                }
              >
                {genderLookupMsg.text}
              </p>
            ) : null}
          </div>

          {wordClass === 'verb' ? (
            <div className="space-y-2">
              <Label htmlFor="edit-card-verb-type">Verb type (optional)</Label>
              <Select
                value={verbType ?? NO_VERB_TYPE}
                onValueChange={(value) =>
                  setVerbType(value === NO_VERB_TYPE ? null : (value as VerbTypeValue))
                }
              >
                <SelectTrigger id="edit-card-verb-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VERB_TYPE}>None</SelectItem>
                  {VERB_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {showAssign ? (
            <div className="space-y-2">
              <Label htmlFor="assign-deck">Assign to deck</Label>
              <Select value={assignDeck} onValueChange={setAssignDeck}>
                <SelectTrigger id="assign-deck">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP_UNCATEGORIZED}>Leave uncategorized</SelectItem>
                  {decks.map((deck) => (
                    <SelectItem key={deck.id} value={deck.id}>
                      {deck.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Move this card into one of your decks. You can&#39;t move it back to uncategorized
                once assigned.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}