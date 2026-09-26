// Server-side Turnstile check. Fails closed: an outage blocks signups rather
// than letting bots through (the public form is the only way outsiders can
// make this Resend team send email). The reason is a fixed code (Siteverify's
// error-codes, the check that failed, or the error class), safe to log, so a
// rotated secret or an outage doesn't look like ordinary bot traffic.
import { TURNSTILE_ACTION } from './config.ts';
import type { Fetch } from './env.ts';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult = { ok: true } | { ok: false; reason: string };

export async function verifyTurnstile(input: {
  secret: string;
  token: string;
  ip: string;
  allowedHostnames: string[];
  fetch: Fetch;
}): Promise<TurnstileResult> {
  if (!input.token) return { ok: false, reason: 'no_token' };
  if (input.token.length > 2048) return { ok: false, reason: 'token_too_long' };
  try {
    const res = await input.fetch(SITEVERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: input.secret, response: input.token, remoteip: input.ip }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const data = (await res.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
      'error-codes'?: string[];
    };
    if (data.success !== true) return { ok: false, reason: (data['error-codes'] ?? []).join('+') || 'not_success' };
    if (data.action !== TURNSTILE_ACTION) return { ok: false, reason: 'action' };
    if (typeof data.hostname !== 'string' || !input.allowedHostnames.includes(data.hostname)) {
      return { ok: false, reason: 'hostname' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.name : 'unknown' };
  }
}
