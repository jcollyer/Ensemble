import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { SubmitReviewInput } from '@ensemble/types';

import { protectedProcedure, router } from '../trpc';

export const practiceRouter = router({
  /**
   * Returns every practiceable card in the requested scope. The practice UI
   * walks through the full list locally; the server doesn't paginate or
   * filter by any scheduling concept.
   *
   * Ordering mirrors the on-screen list the user just came from so in-order
   * practice walks cards in the visual top-to-bottom order they expect:
   *   - Deck practice (categoryId set): `sortOrder asc, createdAt asc`, same
   *     as `flashcards.listByCategory`. Honors the user's drag-and-drop
   *     reordering and falls back to "oldest first" for unsorted cards.
   *   - All-cards / multi-deck practice: `createdAt desc`, same as
   *     `flashcards.listAll` — newest first.
   *
   * The client applies its own shuffle on top of this ordering for
   * "Shuffle" mode, so the server is only responsible for the in-order case.
   */
  queue: protectedProcedure
    .input(
      z.object({
        categoryId: z.string().cuid().optional(),
        /** Filter to multiple categories. Ignored when `categoryId` is set. */
        categoryIds: z.string().cuid().array().optional(),
        /** Filter by word class (e.g. 'noun', 'verb'). Empty = all classes. */
        classes: z.string().array().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const category = input.categoryId
        ? await ctx.prisma.category.findFirst({
            where: { id: input.categoryId },
            // backLanguage powers the per-card audio button; the practice UI
            // hides the button entirely when it's null.
            select: {
              id: true,
              name: true,
              color: true,
              backLanguage: true,
              private: true,
              userId: true,
              user: { select: { private: true } },
            },
          })
        : null;
      if (input.categoryId && !category) throw new TRPCError({ code: 'NOT_FOUND' });

      const categoryIsOwner = category ? category.userId === ctx.userId : false;
      const categoryIsPublic = category
        ? category.private === false && category.user.private === false
        : false;
      if (input.categoryId && !categoryIsOwner && !categoryIsPublic) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      // Build category filter: single categoryId takes priority over the array.
      const categoryFilter = input.categoryId
        ? { categoryId: input.categoryId }
        : input.categoryIds?.length
          ? { categoryId: { in: input.categoryIds } }
          : {};

      // Build word-class filter.
      const classFilter = input.classes?.length ? { class: { in: input.classes } } : {};

      const cards = await ctx.prisma.flashcard.findMany({
        where: {
          ...(input.categoryId ? {} : { userId: ctx.userId }),
          ...categoryFilter,
          ...classFilter,
        },
        include: {
          category: {
            select: {
              backLanguage: true,
            },
          },
        },
        // Deck practice matches the deck-detail list ordering so in-order
        // play walks cards top→bottom from what the user sees on screen.
        // All-cards / multi-deck practice keeps newest-first to match
        // `flashcards.listAll`, which feeds the All-cards view.
        orderBy: input.categoryId
          ? [{ sortOrder: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }]
          : { createdAt: 'desc' },
      });

      return {
        category: category
          ? {
              id: category.id,
              name: category.name,
              color: category.color,
              backLanguage: category.backLanguage,
              isOwner: categoryIsOwner,
            }
          : null,
        cards,
      };
    }),

  /**
   * Persists the user's difficulty rating for a card. There is no longer any
   * scheduling computation here — we just store the latest rating so the UI
   * can render the per-deck breakdown (Challenging / Good / Easy tiles) and
   * so the value survives reloads.
   */
  submitReview: protectedProcedure.input(SubmitReviewInput).mutation(async ({ ctx, input }) => {
    const card = await ctx.prisma.flashcard.findFirst({
      where: { id: input.cardId, userId: ctx.userId },
      select: { id: true },
    });
    if (!card) throw new TRPCError({ code: 'NOT_FOUND' });

    return ctx.prisma.flashcard.update({
      where: { id: card.id },
      data: { difficultyLevel: input.difficultyLevel },
    });
  }),

  /**
   * Lightweight stats for the deck detail view.
   *
   * When `categoryId` is supplied, stats are scoped to that deck. Otherwise
   * we count every card the user owns — including uncategorized ones —
   * which is what the "All decks" view needs.
   *
   * `difficultyBreakdown` counts cards by their last-stored difficulty
   * rating. Cards that have never been rated (difficultyLevel = null) do
   * not appear in any of the three buckets.
   */
  stats: protectedProcedure
    .input(z.object({ categoryId: z.string().cuid().optional() }))
    .query(async ({ ctx, input }) => {
      // Filter by direct ownership so uncategorized cards (categoryId = null)
      // are still counted when no categoryId is supplied.
      const where = {
        userId: ctx.userId,
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      };

      const [total, challenging, good, easy] = await Promise.all([
        ctx.prisma.flashcard.count({ where }),
        ctx.prisma.flashcard.count({
          where: { ...where, difficultyLevel: 'challenging' },
        }),
        ctx.prisma.flashcard.count({
          where: { ...where, difficultyLevel: 'good' },
        }),
        ctx.prisma.flashcard.count({
          where: { ...where, difficultyLevel: 'easy' },
        }),
      ]);

      return {
        total,
        difficultyBreakdown: {
          challenging,
          good,
          easy,
        },
      };
    }),
});
