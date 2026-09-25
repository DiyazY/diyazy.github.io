// POST /subscribe: validate, prove human, rate-limit, then email a
// confirmation link. No subscriber record is created here; the only trace is
// Resend's log of the confirmation email. The subscriber exists only after the
// reader confirms (handlers/confirm.ts).
import { FROM, WORKER_URL } from '../config.ts';
import type { Deps, Env } from '../env.ts';
import { allowedOrigins, configProblems } from '../env.ts';
import { renderConfirmationEmail } from '../email/confirmation.ts';
import { sha256Hex } from '../hash.ts';
import { corsHeaders, json } from '../http.ts';
import { createResendClient, errorLogFields } from '../resend.ts';
import { issueToken } from '../token.ts';
import { verifyTurnstile } from '../turnstile.ts';
import { normalizeEmail } from '../validate.ts';

// The wire contract with assets/js/subscribe.js (its SERVER_REASONS list must
// match SubscribeError).
export type SubscribeError = 'validation' | 'turnstile' | 'rate_limit' | 'server';
export type SubscribeBody = { ok: true } | { ok: false; error: SubscribeError };

export function subscribeReply(body: SubscribeBody, status: number, origin: string): Response {
  return json(body, status, corsHeaders(origin));
}

export async function handleSubscribe(request: Request, env: Env, deps: Deps): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  const origins = allowedOrigins(env);
  if (!origins.includes(origin)) {
    // An origin is not personal data; logging it makes an ALLOWED_ORIGINS typo visible.
    deps.log({ step: 'subscribe.origin', status: 403, reason: origin.slice(0, 100) || '(none)' });
    return new Response('Forbidden', { status: 403 });
  }
  const reply = (body: SubscribeBody, status: number) => subscribeReply(body, status, origin);

  const problems = configProblems(env);
  if (problems.length > 0) {
    deps.log({ step: 'subscribe.config', status: 500, reason: problems.join('+') });
    return reply({ ok: false, error: 'server' }, 500);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply({ ok: false, error: 'validation' }, 400);
  }

  // Honeypot: hidden from people, filled by naive bots. Pretend success so a
  // bot learns nothing, and send nothing.
  const honeypot = form.get('hp');
  if (typeof honeypot === 'string' && honeypot !== '') {
    deps.log({ step: 'subscribe.honeypot', status: 200 });
    return reply({ ok: true }, 200);
  }

  const email = normalizeEmail(form.get('email'));
  if (!email) return reply({ ok: false, error: 'validation' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  const turnstile = await verifyTurnstile({
    secret: env.TURNSTILE_SECRET,
    token: String(form.get('cf-turnstile-response') ?? ''),
    ip,
    allowedHostnames: origins.map((o) => new URL(o).hostname),
    fetch: deps.fetch,
  });
  if (!turnstile.ok) {
    deps.log({ step: 'subscribe.turnstile', status: 403, reason: turnstile.reason });
    return reply({ ok: false, error: 'turnstile' }, 403);
  }

  // Per-IP stops one source spraying many addresses; per-address stops one
  // victim's inbox being flooded with confirmations. Keyed on a hash so the
  // raw address never becomes a rate-limit key.
  const ipOk = (await env.RL_IP.limit({ key: `ip:${ip}` })).success;
  const addressOk = ipOk && (await env.RL_EMAIL.limit({ key: `email:${await sha256Hex(email)}` })).success;
  if (!ipOk || !addressOk) {
    deps.log({ step: 'subscribe.rate_limit', status: 429, reason: ipOk ? 'address' : 'ip' });
    return reply({ ok: false, error: 'rate_limit' }, 429);
  }

  const programmes = form.get('programmes') === '1';
  const token = await issueToken({ email, programmes }, env.TOKEN_KEY, deps.now());
  const message = renderConfirmationEmail(`${WORKER_URL}/confirm?t=${token}`, programmes);
  try {
    await createResendClient({ apiKey: env.RESEND_API_KEY, fetch: deps.fetch, sleep: deps.sleep }).sendEmail({
      from: FROM,
      to: email,
      reply_to: env.REPLY_TO,
      ...message,
    });
  } catch (err) {
    deps.log({ step: 'subscribe.send', ...errorLogFields(err) });
    return reply({ ok: false, error: 'server' }, 502);
  }

  deps.log({ step: 'subscribe.sent', status: 200 });
  // Same body whether or not the address is already subscribed.
  return reply({ ok: true }, 200);
}
