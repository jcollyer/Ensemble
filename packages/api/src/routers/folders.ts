import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { FolderCreateInput, FolderUpdateInput } from '@ensemble/types';

import { protectedProcedure, router } from '../trpc';

/**
 * Folders are user-defined groupings of decks. The membership list lives on
 * the folder itself as a `String[]` of category ids — we don't model it as a
 * relation. That means a deck can be in many folders at once, and deleting a
 * deck just leaves a dangling id which we filter out at read time.
 *
 * Folder _membership_ (which decks are in the folder) lives on the Folder
 * row. The _display order_ of those decks for a given viewer lives in
 * FolderDeckOrder, keyed on (userId, folderId). This separation means that
 * when folders become shareable each viewer can have their own arrangement
 * without overwriting the others'.
 */

/**
 * Combine the canonical membership set with the viewer's saved drag-and-drop
 * order. Returns the ids in the order the viewer should see them.
 *
 *  - `validIds` is the set of category ids that still exist and belong to the
 *    deck owner. Anything in `membership` outside `validIds` is dropped
 *    (cleans up dangling ids from deleted decks).
 *  - Any membership id missing from the saved order is appended to the end so
 *    newly added decks always show up, just not at the front.
 *  - Any id in the saved order that's no longer in membership is dropped.
 */
function resolveOrderedDeckIds(
  membership: string[],
  savedOrder: string[] | null,
  validIds: Set<string>,
): string[] {
  const membershipSet = new Set(membership.filter((id) => validIds.has(id)));
  const seen = new Set<string>();
  const out: string[] = [];
  if (savedOrder) {
    for (const id of savedOrder) {
      if (membershipSet.has(id) && !seen.has(id)) {
        out.push(id);
        seen.add(id);
      }
    }
  }
  // Append any membership ids the saved order didn't cover (new additions).
  for (const id of membership) {
    if (membershipSet.has(id) && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  return out;
}

export const foldersRouter = router({
  /** All folders owned by the current user. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const folders = await ctx.prisma.folder.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
    });

    // Each folder reports a deckCount that excludes any ids whose Category no
    // longer exists / no longer belongs to this user. Cheaper than a join per
    // folder: one query for the user's category ids, then a Set-intersect.
    const validIds = new Set(
      (
        await ctx.prisma.category.findMany({
          where: { userId: ctx.userId },
          select: { id: true },
        })
      ).map((c) => c.id),
    );

    // Pull the current viewer's saved orderings in one round-trip and index
    // them by folderId. Folders without a saved order fall back to the
    // membership-array order from the Folder row.
    const savedOrders = await ctx.prisma.folderDeckOrder.findMany({
      where: {
        userId: ctx.userId,
        folderId: { in: folders.map((f) => f.id) },
      },
      select: { folderId: true, orderedCategoryIds: true },
    });
    const orderByFolderId = new Map(savedOrders.map((o) => [o.folderId, o.orderedCategoryIds]));

    return folders.map((f) => {
      const ordered = resolveOrderedDeckIds(
        f.includedCategoryIds,
        orderByFolderId.get(f.id) ?? null,
        validIds,
      );
      return {
        id: f.id,
        name: f.name,
        color: f.color,
        description: f.description,
        includedCategoryIds: ordered,
        deckCount: ordered.length,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      };
    });
  }),

  /** Single folder (with ownership check) plus the included decks inlined. */
  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const folder = await ctx.prisma.folder.findFirst({
        where: { id: input.id, userId: ctx.userId },
      });
      if (!folder) throw new TRPCError({ code: 'NOT_FOUND' });

      // Fetch the user's full deck list once and split it into "in this folder"
      // (with card counts) and "not in this folder" so the detail page has
      // everything it needs without a second round-trip.
      const categories = await ctx.prisma.category.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { cards: true } } },
      });

      // Apply the viewer's saved drag-and-drop order, if any.
      const savedOrder = await ctx.prisma.folderDeckOrder.findUnique({
        where: { userId_folderId: { userId: ctx.userId, folderId: folder.id } },
        select: { orderedCategoryIds: true },
      });

      const validIds = new Set(categories.map((c) => c.id));
      const orderedIds = resolveOrderedDeckIds(
        folder.includedCategoryIds,
        savedOrder?.orderedCategoryIds ?? null,
        validIds,
      );

      const byId = new Map(categories.map((c) => [c.id, c]));
      const includedDecks = orderedIds
        .map((id) => byId.get(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          cardCount: c._count.cards,
        }));

      return {
        id: folder.id,
        name: folder.name,
        color: folder.color,
        description: folder.description,
        includedCategoryIds: orderedIds,
        includedDecks,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      };
    }),

  create: protectedProcedure.input(FolderCreateInput).mutation(async ({ ctx, input }) => {
    // If the caller passed includedCategoryIds, make sure every id actually
    // belongs to them — otherwise the array could be used to enumerate ids.
    if (input.includedCategoryIds && input.includedCategoryIds.length > 0) {
      const owned = await ctx.prisma.category.findMany({
        where: { userId: ctx.userId, id: { in: input.includedCategoryIds } },
        select: { id: true },
      });
      if (owned.length !== input.includedCategoryIds.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unknown category id' });
      }
    }

    return ctx.prisma.folder.create({
      data: {
        name: input.name,
        color: input.color ?? null,
        description: input.description ?? null,
        includedCategoryIds: input.includedCategoryIds ?? [],
        userId: ctx.userId,
      },
    });
  }),

  update: protectedProcedure.input(FolderUpdateInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.folder.findFirst({
      where: { id: input.id, userId: ctx.userId },
      select: { id: true },
    });
    if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

    if (input.includedCategoryIds && input.includedCategoryIds.length > 0) {
      const owned = await ctx.prisma.category.findMany({
        where: { userId: ctx.userId, id: { in: input.includedCategoryIds } },
        select: { id: true },
      });
      if (owned.length !== input.includedCategoryIds.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unknown category id' });
      }
    }

    return ctx.prisma.folder.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color ?? null } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.includedCategoryIds !== undefined
          ? { includedCategoryIds: input.includedCategoryIds }
          : {}),
      },
    });
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.folder.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.prisma.folder.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  /**
   * Toggle a deck's membership in a folder. Used by both the folder-detail
   * page (the "+ Add deck" dropdown) and the deck modals (folders dropdown
   * with checkboxes). The server is the source of truth for whether the id
   * is currently included; the client just sends the desired direction.
   */
  toggleDeck: protectedProcedure
    .input(
      z.object({
        folderId: z.string().cuid(),
        categoryId: z.string().cuid(),
        // true = ensure included, false = ensure removed.
        included: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [folder, category] = await Promise.all([
        ctx.prisma.folder.findFirst({
          where: { id: input.folderId, userId: ctx.userId },
        }),
        ctx.prisma.category.findFirst({
          where: { id: input.categoryId, userId: ctx.userId },
          select: { id: true },
        }),
      ]);
      if (!folder) throw new TRPCError({ code: 'NOT_FOUND', message: 'Folder not found' });
      if (!category) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deck not found' });

      const current = new Set(folder.includedCategoryIds);
      if (input.included) current.add(input.categoryId);
      else current.delete(input.categoryId);

      return ctx.prisma.folder.update({
        where: { id: input.folderId },
        data: { includedCategoryIds: Array.from(current) },
      });
    }),

  /**
   * Set the full folder-membership for a single deck across all the user's
   * folders in one round trip. Powers the "Folders" checkbox dropdown in the
   * deck create/edit modals — `folderIds` is the set of folders the deck
   * should belong to after this call.
   */
  setDeckFolders: protectedProcedure
    .input(
      z.object({
        categoryId: z.string().cuid(),
        folderIds: z.array(z.string().cuid()).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.prisma.category.findFirst({
        where: { id: input.categoryId, userId: ctx.userId },
        select: { id: true },
      });
      if (!category) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deck not found' });

      const target = new Set(input.folderIds);
      const folders = await ctx.prisma.folder.findMany({
        where: { userId: ctx.userId },
      });

      // Verify every requested folder id belongs to this user.
      const ownedIds = new Set(folders.map((f) => f.id));
      for (const id of target) {
        if (!ownedIds.has(id)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unknown folder id' });
        }
      }

      // Diff per-folder: only update folders whose membership actually changes.
      await ctx.prisma.$transaction(
        folders
          .map((folder) => {
            const has = folder.includedCategoryIds.includes(input.categoryId);
            const want = target.has(folder.id);
            if (has === want) return null;
            const next = want
              ? [...folder.includedCategoryIds, input.categoryId]
              : folder.includedCategoryIds.filter((id) => id !== input.categoryId);
            return ctx.prisma.folder.update({
              where: { id: folder.id },
              data: { includedCategoryIds: next },
            });
          })
          .filter((p): p is NonNullable<typeof p> => p !== null),
      );

      return { ok: true };
    }),

  /**
   * Persist the current viewer's drag-and-drop order for the decks inside a
   * folder. The order is stored per-(user, folder) in FolderDeckOrder so
   * different viewers of a (future) shared folder can each have their own
   * arrangement.
   *
   * `orderedCategoryIds` must be exactly the current membership set — same
   * ids, no extras, no missing. That keeps the client honest and avoids the
   * mutation being used to sneakily add/remove decks.
   */
  reorderDecks: protectedProcedure
    .input(
      z.object({
        folderId: z.string().cuid(),
        orderedCategoryIds: z.array(z.string().cuid()).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const folder = await ctx.prisma.folder.findFirst({
        where: { id: input.folderId, userId: ctx.userId },
        select: { id: true, includedCategoryIds: true },
      });
      if (!folder) throw new TRPCError({ code: 'NOT_FOUND', message: 'Folder not found' });

      // Validate the incoming order against current membership (after
      // dropping any dangling ids whose Category no longer exists).
      const validIds = new Set(
        (
          await ctx.prisma.category.findMany({
            where: { userId: ctx.userId, id: { in: folder.includedCategoryIds } },
            select: { id: true },
          })
        ).map((c) => c.id),
      );
      const currentMembership = folder.includedCategoryIds.filter((id) => validIds.has(id));

      const incoming = input.orderedCategoryIds;
      const incomingSet = new Set(incoming);
      if (incoming.length !== incomingSet.size) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Duplicate ids in order' });
      }
      if (incoming.length !== currentMembership.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Order must match folder membership exactly',
        });
      }
      for (const id of incoming) {
        if (!validIds.has(id)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unknown deck id in order' });
        }
      }

      await ctx.prisma.folderDeckOrder.upsert({
        where: { userId_folderId: { userId: ctx.userId, folderId: folder.id } },
        create: {
          userId: ctx.userId,
          folderId: folder.id,
          orderedCategoryIds: incoming,
        },
        update: {
          orderedCategoryIds: incoming,
        },
      });

      return { ok: true };
    }),

  /**
   * Returns the ids of folders that contain a specific deck. Used by the
   * deck edit modal to pre-check the right boxes when it opens.
   */
  forDeck: protectedProcedure
    .input(z.object({ categoryId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const folders = await ctx.prisma.folder.findMany({
        where: { userId: ctx.userId, includedCategoryIds: { has: input.categoryId } },
        select: { id: true },
      });
      return folders.map((f) => f.id);
    }),
});
