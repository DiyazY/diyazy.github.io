// Server-side Turnstile check. Fails closed: an outage blocks signups rather
// than letting bots through (the public form is the only way outsiders can
// make this Resend team send email).
import { TURNSTILE_ACTION } from './config.ts';
import type { Fetch } from './env.ts';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(input: {
  secret: string;
  token: string;
  ip: string;
  allowedHostnames: string[];
  fetch: Fetch;
}): Promise<boolean> {
  if (!input.token || input.token.length > 2048) return false;
  try {
    const res = await input.fetch(SITEVERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: input.secret, response: input.token, remoteip: input.ip }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean; hostname?: string; action?: string };
    return (
      data.success === true &&
      data.action === TURNSTILE_ACTION &&
      typeof data.hostname === 'string' &&
      input.allowedHostnames.includes(data.hostname)
    );
  } catch {
    return false;
  }
}
