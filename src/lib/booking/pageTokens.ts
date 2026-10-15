import { csrfFor, isWellFormedSid, renewTimeToken } from '@/lib/formTokens';

/**
 * Tokens the booking and emergency pages render for the no-JS post, from the sid the proxy hands
 * over in `x-sefid-form-sid`. After a 419 (flash `renewTs`) the time token is renewed pre-aged,
 * so the visitor's next press is not flagged (D-K5); otherwise it is fresh. Null without a sid.
 */
export function pageFormTokens(input: {
  sid: string | null | undefined;
  secrets: readonly string[];
  nowMs: number;
  ttlMs: number;
  renewTs?: string;
}): { csrf: string; ts: string } | null {
  const { sid, secrets } = input;
  if (!isWellFormedSid(sid ?? undefined)) return null;
  const [current] = secrets;
  if (!current) throw new Error('pageFormTokens: FORM_TOKEN_SECRET is not configured');
  return {
    csrf: csrfFor(current, sid as string),
    ts: renewTimeToken({
      secrets,
      sid: sid as string,
      oldTs: input.renewTs,
      nowMs: input.nowMs,
      ttlMs: input.ttlMs,
    }),
  };
}
