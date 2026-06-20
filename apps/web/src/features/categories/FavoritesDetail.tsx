'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, GripVertical, Grid2x2, Heart, List, Play, Pencil } from 'lucide-react';

import { genderLabel } from '@ensemble/types';
import type { BackLanguageValue } from '@ensemble/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { ClassBadge } from '@/features/cards/ClassBadge';
import { FlashcardPreviewModal, type PreviewCard } from '@/features/practice/FlashcardPreviewModal';
import { PlayFlashcardsDialog } from '@/features/practice/PlayFlashcardsDialog';
import { EditCardDialog } from './CategoryDetail';

type CardListViewMode = 'grid' | 'list';

/**
 * Sort options for the favorites list.
 *   - custom: the user's manual drag order (CardProgress.favoriteSortOrder).
 *     The only mode where drag-and-drop is enabled.
 *   - The rest are non-destructive view transforms applied client-side; they
 *     never write to the server, so switching back to "custom" restores the
 *     saved manual order untouched.
 */
type SortMode = 'custom' | 'front' | 'rating' | 'favorited' | 'deck' | 'category';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'custom', label: 'Custom order' },
  { value: 'front', label: 'Front (A–Z)' },
  { value: 'rating', label: 'Rating' },
  { value: 'favorited', label: 'Date favorited' },
  { value: 'deck', label: 'Deck' },
  { value: 'category', label: 'Category' },
];

// Lower rank sorts first: hardest cards surface at the top, unrated last.
const RATING_RANK: Record<string, number> = {
  challenging: 0,
  good: 1,
  easy: 2,
};
const RATING_RANK_UNRATED = 3;

interface FavoriteCardData {
  id: string;
  front: string;
  back: string;
  class?: string | null;
  gender?: string | null;
  deckName?: string | null;
}

// ---------------------------------------------------------------------------
// SortableFavoriteCard — one draggable favorite row. A separate component is
// required because useSortable is a hook and can't run inside a .map callback.
// ---------------------------------------------------------------------------

interface SortableFavoriteCardProps {
  card: FavoriteCardData;
  cardListViewMode: CardListViewMode;
  /** When false the drag handle is hidden and reordering is disabled (used
   *  by every field-based sort, where the displayed order is derived). */
  draggable: boolean;
  /** Show the card's home deck inline. Enabled in the "Deck" sort so the
   *  grouping is legible. */
  showDeck: boolean;
  onPreview: () => void;
  onUnfavorite: () => void;
}

function SortableFavoriteCard({
  card,
  cardListViewMode,
  draggable,
  showDeck,
  onPreview,
  onUnfavorite,
}: SortableFavoriteCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: !draggable,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 1 : undefined,
  };

  const gender = card.gender ?? null;
  const deckName = card.deckName ?? null;

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={onPreview}>
        <CardContent
          className={cn(
            'flex justify-between gap-3 p-4',
            cardListViewMode === 'list' ? 'items-center' : 'flex-wrap items-start',
          )}
        >
          {draggable ? (
            <div
              {...attributes}
              {...listeners}
              className="text-muted-foreground/50 hover:text-muted-foreground shrink-0 cursor-grab touch-none active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          ) : null}
          <div className={cn('min-w-0 flex-1', cardListViewMode === 'list' ? '' : 'space-y-1')}>
            {cardListViewMode === 'list' ? (
              <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-sm">
                <span className="truncate font-medium">{card.front}</span>
                {card.class !== 'note' ? (
                  <>
                    <span className="text-muted-foreground shrink-0">-</span>
                    <span className="text-muted-foreground truncate">{card.back}</span>
                  </>
                ) : null}
                {card.class ? (
                  <>
                    <span className="text-muted-foreground shrink-0">-</span>
                    <span className="text-muted-foreground shrink-0 capitalize">
                      {String(card.class).replace(/_/g, ' ')}
                    </span>
                  </>
                ) : null}
                {gender ? (
                  <>
                    <span className="text-muted-foreground shrink-0">-</span>
                    <span className="text-muted-foreground shrink-0">{genderLabel(gender)}</span>
                  </>
                ) : null}
                {showDeck && deckName ? (
                  <>
                    <span className="text-muted-foreground shrink-0">-</span>
                    <span className="text-muted-foreground shrink-0 truncate">{deckName}</span>
                  </>
                ) : null}
              </div>
            ) : (
              <>
                <div className="line-clamp-2 font-medium">{card.front}</div>
                {card.class !== 'note' ? (
                  <div className="text-muted-foreground line-clamp-2 text-sm">{card.back}</div>
                ) : null}
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
                  {card.class ? <ClassBadge value={card.class} /> : null}
                  {gender ? <span>{genderLabel(gender)}</span> : null}
                  {showDeck && deckName ? <span className="truncate">{deckName}</span> : null}
                </div>
              </>
            )}
          </div>
          <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onUnfavorite}
              aria-pressed
              aria-label="Unfavorite"
              title="Unfavorite"
              className="text-rose-500 hover:text-rose-600"
            >
              <Heart className="h-4 w-4 fill-current" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Favorites view — reads like a Category detail page, but the card list is
 * sourced from the user's per-user favorite flag (across every deck) rather
 * than a single category. Cards can be manually reordered via drag-and-drop;
 * the order persists in CardProgress.favoriteSortOrder, which is independent
 * of each card's position inside its home deck.
 *
 * Newly favorited cards (favorited from another view) land at the BOTTOM —
 * the API sorts un-ordered favorites last, by when they were favorited.
 */
export function FavoritesDetail() {
  const utils = trpc.useUtils();
  const { data: cards, isLoading } = trpc.flashcards.listFavorites.useQuery();

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [cardListViewMode, setCardListViewMode] = useState<CardListViewMode>('grid');
  const [playOpen, setPlayOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('custom');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Local ordering state for drag-and-drop, seeded from the server query and
  // updated optimistically on drag so the row doesn't snap back before the
  // mutation settles.
  const [orderedCards, setOrderedCards] = useState<NonNullable<typeof cards>>([]);

  useEffect(() => {
    setOrderedCards(cards ?? []);
  }, [cards]);

  const reorder = trpc.flashcards.reorderFavorites.useMutation({
    onError: () => {
      // Roll back to the last server-confirmed order on failure.
      setOrderedCards(cards ?? []);
    },
  });

  const dndSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedCards((prev) => {
      if (!prev) return prev;
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      reorder.mutate({ orderedIds: next.map((c) => c.id) });
      return next;
    });
  }

  // Un-favorite from a list row. Optimistically drops the card from both the
  // local order and the query cache so it disappears immediately.
  const setFavorite = trpc.practice.setFavorite.useMutation({
    onMutate: async ({ cardId }) => {
      await utils.flashcards.listFavorites.cancel();
      const previous = utils.flashcards.listFavorites.getData();
      if (previous) {
        utils.flashcards.listFavorites.setData(
          undefined,
          previous.filter((c) => c.id !== cardId),
        );
      }
      setOrderedCards((prev) => prev.filter((c) => c.id !== cardId));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) utils.flashcards.listFavorites.setData(undefined, ctx.previous);
    },
    onSettled: () => {
      utils.flashcards.listFavorites.invalidate();
    },
  });

  // The list the user actually sees. "custom" is the manual drag order
  // (orderedCards, kept in optimistic sync); every other mode is a
  // non-destructive client-side sort layered on top of that same array, so
  // unfavoriting still works and switching back to "custom" restores the
  // saved order. Sorts are stable — ties keep their custom-order position.
  const displayCards = useMemo(() => {
    const base = orderedCards ?? [];
    if (sortMode === 'custom') return base;

    const withIndex = base.map((card, index) => ({ card, index }));
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

    withIndex.sort((a, b) => {
      let cmp = 0;
      if (sortMode === 'front') {
        cmp = collator.compare(a.card.front, b.card.front);
      } else if (sortMode === 'rating') {
        const rank = (c: (typeof base)[number]) =>
          RATING_RANK[(c as { difficultyLevel?: string | null }).difficultyLevel ?? ''] ??
          RATING_RANK_UNRATED;
        cmp = rank(a.card) - rank(b.card);
      } else if (sortMode === 'favorited') {
        const ts = (c: (typeof base)[number]) => {
          const v = (c as { favoritedAt?: string | Date | null }).favoritedAt;
          return v ? new Date(v).getTime() : 0;
        };
        cmp = ts(a.card) - ts(b.card);
      } else if (sortMode === 'deck') {
        cmp = collator.compare(
          (a.card as { deckName?: string | null }).deckName ?? '',
          (b.card as { deckName?: string | null }).deckName ?? '',
        );
      } else if (sortMode === 'category') {
        cmp = collator.compare(a.card.class ?? '', b.card.class ?? '');
      }
      // Stable tiebreak on the original custom-order index.
      return cmp !== 0 ? cmp : a.index - b.index;
    });

    return withIndex.map((w) => w.card);
  }, [orderedCards, sortMode]);

  const previewCards: PreviewCard[] = (displayCards ?? []).map((card) => ({
    id: card.id,
    front: card.front,
    back: card.back,
    frontExamples: card.frontExamples,
    backExamples: card.backExamples,
    class: card.class ?? null,
    gender: (card as { gender?: string | null }).gender ?? null,
    pronunciation: (card as { pronunciation?: string | null }).pronunciation ?? null,
    // Favorites span multiple decks, so each card carries its own deck-level
    // back language (surfaced by listFavorites) rather than a shared one.
    backLanguage: ((card as { backLanguage?: string | null }).backLanguage ??
      null) as BackLanguageValue | null,
    advancedDifficultyLevel:
      (card as { advancedDifficultyLevel?: string | null }).advancedDifficultyLevel ?? null,
    difficultyLevel:
      ((card as { difficultyLevel?: string | null }).difficultyLevel as
        | import('@ensemble/types').DifficultyLevel
        | null) ?? null,
    favorite: true,
    categoryId: (card as { categoryId?: string | null }).categoryId ?? '',
  }));

  // Cards shaped for the Play modal's client-side filter/count.
  const playCards = (displayCards ?? []).map((card) => ({
    categoryId: (card as { categoryId?: string | null }).categoryId ?? null,
    class: card.class ?? null,
    difficultyLevel: (card as { difficultyLevel?: string | null }).difficultyLevel ?? null,
    advancedDifficultyLevel:
      (card as { advancedDifficultyLevel?: string | null }).advancedDifficultyLevel ?? null,
    favorite: true,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/app">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-100 text-rose-500"
            >
              <Heart className="h-5 w-5 fill-current" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Favorites</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Every card you&rsquo;ve favorited, from across all your decks. Drag to reorder.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setPlayOpen(true)} disabled={(orderedCards?.length ?? 0) === 0}>
            <Play className="h-4 w-4" />
            Play {(orderedCards?.length ?? 0) > 0 ? `(${orderedCards.length})` : ''}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="bg-muted h-6 w-1/3 animate-pulse rounded-md" />
                  <div className="bg-muted h-5 w-1/4 animate-pulse rounded-md" />
                </div>
                <div className="bg-muted h-9 w-9 animate-pulse rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : orderedCards && orderedCards.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Sort</span>
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <SelectTrigger className="h-9 w-[170px]" aria-label="Sort favorites">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  cardListViewMode === 'grid' && 'bg-accent text-accent-foreground border-primary',
                )}
                aria-pressed={cardListViewMode === 'grid'}
                aria-label="Grid view"
                onClick={() => setCardListViewMode('grid')}
              >
                <Grid2x2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  cardListViewMode === 'list' && 'bg-accent text-accent-foreground border-primary',
                )}
                aria-pressed={cardListViewMode === 'list'}
                aria-label="List view"
                onClick={() => setCardListViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {sortMode !== 'custom' ? (
            <p className="text-muted-foreground text-xs">
              Showing a sorted view. Switch to <span className="font-medium">Custom order</span> to
              drag cards and save your own arrangement.
            </p>
          ) : null}
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayCards.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {displayCards.map((card, cardIdx) => (
                  <SortableFavoriteCard
                    key={card.id}
                    card={card}
                    cardListViewMode={cardListViewMode}
                    draggable={sortMode === 'custom'}
                    showDeck={sortMode === 'deck'}
                    onPreview={() => setPreviewIndex(cardIdx)}
                    onUnfavorite={() => setFavorite.mutate({ cardId: card.id, favorite: false })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="text-lg font-semibold">No favorites yet</div>
            <p className="text-muted-foreground max-w-sm text-sm">
              Tap the heart on any card to add it here for quick access and focused practice.
            </p>
            <Button asChild variant="outline">
              <Link href="/app">Browse your decks</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <PlayFlashcardsDialog
        open={playOpen}
        onOpenChange={setPlayOpen}
        practicePath="/app/all-categories/practice"
        cards={playCards}
        lockFavorites
      />

      {editingId && (
        <EditCardDialog
          cardId={editingId}
          categoryId={
            (cards?.find((c) => c.id === editingId) as { categoryId?: string | null })
              ?.categoryId ?? ''
          }
          onClose={() => setEditingId(null)}
          onSaved={() => {
            utils.flashcards.listFavorites.invalidate();
            setEditingId(null);
          }}
        />
      )}

      <FlashcardPreviewModal
        cards={previewCards}
        initialIndex={previewIndex ?? 0}
        open={previewIndex !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewIndex(null);
        }}
        canRate
        onRated={() => {
          utils.flashcards.listFavorites.invalidate();
          utils.practice.stats.invalidate();
        }}
        onEdit={(cardId) => {
          setPreviewIndex(null);
          setEditingId(cardId);
        }}
        onFavoriteToggled={(cardId, favorite) => {
          // Unfavoriting from inside the preview should drop the card from
          // this list too. Favoriting again (favorite === true) is a no-op
          // here since the card is already present.
          if (!favorite) {
            setOrderedCards((prev) => prev.filter((c) => c.id !== cardId));
            const previous = utils.flashcards.listFavorites.getData();
            if (previous) {
              utils.flashcards.listFavorites.setData(
                undefined,
                previous.filter((c) => c.id !== cardId),
              );
            }
          }
        }}
      />
    </div>
  );
}
