// POST /subscribe: validate, prove human, rate-limit, then email a
// confirmation link. Nothing is stored; the subscriber exists only after the
// reader confirms (handlers/confirm.ts).
import { FROM, WORKER_URL } from '../config.ts';
import type { Deps, Env } from '../env.ts';
import { allowedOrigins, configProblems } from '../env.ts';
import { renderConfirmationEmail } from '../email/confirmation.ts';
import { sha256Hex } from '../hash.ts';
import { corsHeaders, json } from '../http.ts';
import { ResendError, createResendClient } from '../resend.ts';
import { issueToken } from '../token.ts';
import { verifyTurnstile } from '../turnstile.ts';
import { normalizeEmail } from '../validate.ts';

export async function handleSubscribe(request: Request, env: Env, deps: Deps): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  const origins = allowedOrigins(env);
  if (!origins.includes(origin)) {
    deps.log({ step: 'subscribe.origin', status: 403 });
    return new Response('Forbidden', { status: 403 });
  }
  const cors = corsHeaders(origin);

  if (configProblems(env).length > 0) {
    deps.log({ step: 'subscribe.config', status: 500 });
    return json({ ok: false, error: 'server' }, 500, cors);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'validation' }, 400, cors);
  }

  // Honeypot: hidden from people, filled by naive bots. Pretend success so a
  // bot learns nothing, and send nothing.
  const honeypot = form.get('hp');
  if (typeof honeypot === 'string' && honeypot !== '') {
    deps.log({ step: 'subscribe.honeypot', status: 200 });
    return json({ ok: true }, 200, cors);
  }

  const email = normalizeEmail(form.get('email'));
  if (!email) return json({ ok: false, error: 'validation' }, 400, cors);

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
    return json({ ok: false, error: 'turnstile' }, 403, cors);
  }

  // Per-IP stops one source spraying many addresses; per-address stops one
  // victim's inbox being flooded with confirmations. Keyed on a hash so the
  // raw address never becomes a rate-limit key.
  const ipOk = (await env.RL_IP.limit({ key: `ip:${ip}` })).success;
  const addressOk = ipOk && (await env.RL_EMAIL.limit({ key: `email:${await sha256Hex(email)}` })).success;
  if (!ipOk || !addressOk) {
    deps.log({ step: 'subscribe.rate_limit', status: 429 });
    return json({ ok: false, error: 'rate_limit' }, 429, cors);
  }

  const token = await issueToken({ email, programmes: form.get('programmes') === '1' }, env.TOKEN_KEY, deps.now());
  const message = renderConfirmationEmail(`${WORKER_URL}/confirm?t=${token}`);
  try {
    await createResendClient({ apiKey: env.RESEND_API_KEY, fetch: deps.fetch, sleep: deps.sleep }).sendEmail({
      from: FROM,
      to: email,
      reply_to: env.REPLY_TO,
      ...message,
    });
  } catch (err) {
    deps.log({ step: 'subscribe.send', status: err instanceof ResendError ? err.status : 0 });
    return json({ ok: false, error: 'server' }, 502, cors);
  }

  deps.log({ step: 'subscribe.sent', status: 200 });
  // Same body whether or not the address is already subscribed.
  return json({ ok: true }, 200, cors);
}
