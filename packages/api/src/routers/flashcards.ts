import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { FlashcardCreateInput, FlashcardUpdateInput } from '@ensemble/types';

import { protectedProcedure, router } from '../trpc';

export const flashcardsRouter = router({
  /** All cards in a category, oldest first. */
  listByCategory: protectedProcedure
    .input(z.object({ categoryId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.prisma.category.findFirst({
        where: { id: input.categoryId },
        select: {
          id: true,
          userId: true,
          private: true,
          user: { select: { private: true } },
        },
      });
      if (!category) throw new TRPCError({ code: 'NOT_FOUND' });

      const isOwner = category.userId === ctx.userId;
      const isPubliclyVisible = category.private === false && category.user.private === false;
      if (!isOwner && !isPubliclyVisible) throw new TRPCError({ code: 'NOT_FOUND' });

      const cards = await ctx.prisma.flashcard.findMany({
        where: { categoryId: input.categoryId },
        orderBy: [{ sortOrder: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      });

      if (isOwner) return cards;

      // Strip the viewer-specific difficulty rating for non-owners so a
      // public deck looks the same to everyone regardless of who's looking.
      return cards.map((card) => ({
        ...card,
        difficultyLevel: null,
      }));
    }),

  /**
   * Every card the user owns, across all decks plus uncategorized cards.
   * Powers the "All decks" view at /app/all-categories.
   */
  listAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.flashcard.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
    });
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      // Card belongs to the user either directly (uncategorized) or via its
      // deck. We use the direct userId pointer — it works for both cases.
      const card = await ctx.prisma.flashcard.findFirst({
        where: { id: input.id, userId: ctx.userId },
      });
      if (!card) throw new TRPCError({ code: 'NOT_FOUND' });
      return card;
    }),

  create: protectedProcedure.input(FlashcardCreateInput).mutation(async ({ ctx, input }) => {
    // Only validate ownership of the deck if one was supplied. A null/missing
    // categoryId means the card is uncategorized — the user always owns those.
    if (input.categoryId) {
      const category = await ctx.prisma.category.findFirst({
        where: { id: input.categoryId, userId: ctx.userId },
        select: { id: true },
      });
      if (!category) throw new TRPCError({ code: 'NOT_FOUND' });
    }

    return ctx.prisma.flashcard.create({
      data: {
        front: input.front,
        back: input.back,
        frontExamples: input.frontExamples,
        backExamples: input.backExamples,
        class: input.class ?? null,
        gender: input.gender ?? null,
        verb_type: input.verb_type ?? null,
        pronunciation: input.pronunciation ?? null,
        categoryId: input.categoryId ?? null,
        userId: ctx.userId,
      },
    });
  }),

  update: protectedProcedure.input(FlashcardUpdateInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.flashcard.findFirst({
      where: { id: input.id, userId: ctx.userId },
      select: { id: true },
    });
    if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

    // If the caller is assigning a deck, verify they own it before linking.
    if (input.categoryId !== undefined) {
      const target = await ctx.prisma.category.findFirst({
        where: { id: input.categoryId, userId: ctx.userId },
        select: { id: true },
      });
      if (!target) throw new TRPCError({ code: 'NOT_FOUND' });
    }

    return ctx.prisma.flashcard.update({
      where: { id: input.id },
      data: {
        ...(input.front !== undefined ? { front: input.front } : {}),
        ...(input.back !== undefined ? { back: input.back } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.frontExamples !== undefined ? { frontExamples: input.frontExamples } : {}),
        ...(input.backExamples !== undefined ? { backExamples: input.backExamples } : {}),
        ...(input.class !== undefined ? { class: input.class } : {}),
        ...(input.gender !== undefined ? { gender: input.gender } : {}),
        ...(input.verb_type !== undefined ? { verb_type: input.verb_type } : {}),
        ...(input.pronunciation !== undefined ? { pronunciation: input.pronunciation } : {}),
      },
    });
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.flashcard.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.prisma.flashcard.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  /**
   * Persist a user-defined card ordering for a deck.
   * Accepts the full ordered list of card IDs and writes sortOrder 0, 1, 2…
   * to each card in a single transaction. Only the deck owner may call this.
   */
  reorder: protectedProcedure
    .input(
      z.object({
        categoryId: z.string().cuid(),
        orderedIds: z.array(z.string().cuid()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the caller owns the deck.
      const category = await ctx.prisma.category.findFirst({
        where: { id: input.categoryId, userId: ctx.userId },
        select: { id: true },
      });
      if (!category) throw new TRPCError({ code: 'NOT_FOUND' });

      // Write the new positions in a single transaction.
      await ctx.prisma.$transaction(
        input.orderedIds.map((id, index) =>
          ctx.prisma.flashcard.updateMany({
            where: { id, categoryId: input.categoryId, userId: ctx.userId },
            data: { sortOrder: index },
          }),
        ),
      );

      return { ok: true };
    }),
});
