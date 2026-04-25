import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { protectedProcedure, publicProcedure, router } from '../trpc';

/**
 * Languages exposed in the UI today. Values are ISO 639-1 codes that the
 * Google Cloud Translation API accepts directly. Add to this list to surface
 * a new option in the dropdown — no other code changes needed.
 */
export const TranslateTarget = z.enum(['fr', 'es', 'de']);
export type TranslateTarget = z.infer<typeof TranslateTarget>;

const TRANSLATE_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

interface GoogleTranslateResponse {
  data?: {
    translations?: Array<{ translatedText?: string; detectedSourceLanguage?: string }>;
  };
  error?: { code: number; message: string };
}

export const translateRouter = router({
  /**
   * Lightweight feature-detect for the client. We don't expose the key, just
   * whether the server can perform translations. The web app uses this to
   * conditionally render the translation toggle so it never appears in a
   * broken state.
   */
  isAvailable: publicProcedure.query(() => {
    return { available: !!process.env.GOOGLE_TRANSLATE_API_KEY };
  }),

  /**
   * Translate `text` from English into the chosen target language. Source is
   * fixed to English for now — the new-card flow assumes the user types
   * prompts in English and wants the translation as the answer. We can lift
   * this restriction by accepting an optional `source` later.
   *
   * Errors map straight onto Google's response so the client can surface the
   * underlying problem (e.g. invalid key, quota exceeded) without us having
   * to bake in an exhaustive translation layer.
   */
  translate: protectedProcedure
    .input(
      z.object({
        text: z.string().trim().min(1).max(500),
        target: TranslateTarget,
      }),
    )
    .mutation(async ({ input }) => {
      const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
      if (!apiKey) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Translation is not configured on this server.',
        });
      }

      const url = `${TRANSLATE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          q: input.text,
          source: 'en',
          target: input.target,
          format: 'text',
        }),
      });

      const body = (await res.json().catch(() => null)) as GoogleTranslateResponse | null;

      if (!res.ok || !body || body.error) {
        const message = body?.error?.message ?? `Google Translate request failed (${res.status}).`;
        throw new TRPCError({
          // Most Google API errors that affect us are auth/quota/bad-request,
          // which are caller-fixable rather than runtime bugs. Surface them as
          // BAD_REQUEST so the UI can show the message verbatim.
          code: res.status === 401 || res.status === 403 ? 'UNAUTHORIZED' : 'BAD_REQUEST',
          message,
        });
      }

      const translation = body.data?.translations?.[0]?.translatedText;
      if (!translation) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Google Translate returned an empty response.',
        });
      }

      return { translation };
    }),
});
