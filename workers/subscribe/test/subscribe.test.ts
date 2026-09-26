import { describe, expect, it } from 'vitest';
import worker, { route } from '../src/index.ts';
import { decryptToken } from '../src/token.ts';
import { FROM } from '../src/config.ts';
import { sha256Hex } from '../src/hash.ts';
import { NOW, TEST_KEY, fakeFetch, jsonResponse, limiter, makeDeps, makeEnv } from './helpers.ts';

const ORIGIN = 'https://diyaz.dev';
const VALID = { email: 'Reader@Example.com', programmes: '1', hp: '', 'cf-turnstile-response': 'tok' };

function subscribeRequest(fields: Record<string, string>, origin: string | null = ORIGIN): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'CF-Connecting-IP': '203.0.113.7',
  };
  if (origin) headers.Origin = origin;
  return new Request('https://subscribe.diyaz.dev/subscribe', {
    method: 'POST',
    headers,
    body: new URLSearchParams(fields).toString(),
  });
}

function services(options: { turnstile?: unknown; emailStatus?: number; emailBody?: unknown } = {}) {
  return fakeFetch((call) => {
    if (call.url.endsWith('/turnstile/v0/siteverify')) {
      return jsonResponse(options.turnstile ?? { success: true, hostname: 'diyaz.dev', action: 'subscribe' });
    }
    if (call.url === 'https://api.resend.com/emails') {
      const status = options.emailStatus ?? 200;
      return jsonResponse(status < 400 ? { id: 'em_1' } : (options.emailBody ?? { message: 'boom' }), status);
    }
    throw new Error(`unexpected ${call.method} ${call.url}`);
  });
}

const sentEmail = (calls: { url: string; body: string | null }[]) =>
  JSON.parse(calls.find((c) => c.url === 'https://api.resend.com/emails')!.body!);
const confirmToken = (email: { text: string }) => /confirm\?t=([A-Za-z0-9_-]+)/.exec(email.text)![1];

describe('POST /subscribe', () => {
  it('rejects an origin that is not allowed, before doing any work', async () => {
    const { fetch, calls } = services();
    const res = await route(subscribeRequest(VALID, 'https://evil.example'), makeEnv(), makeDeps(fetch));
    expect(res.status).toBe(403);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('pretends success when the honeypot is filled, and sends nothing', async () => {
    const { fetch, calls } = services();
    const res = await route(subscribeRequest({ ...VALID, hp: 'http://spam.example' }), makeEnv(), makeDeps(fetch));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(calls).toHaveLength(0);
  });

  it('rejects an invalid email before calling Turnstile', async () => {
    const { fetch, calls } = services();
    const res = await route(subscribeRequest({ ...VALID, email: 'nope' }), makeEnv(), makeDeps(fetch));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'validation' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(calls).toHaveLength(0);
  });

  it('rejects a failed Turnstile check and sends no email', async () => {
    const { fetch, calls } = services({ turnstile: { success: false } });
    const res = await route(subscribeRequest(VALID), makeEnv(), makeDeps(fetch));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: 'turnstile' });
    expect(calls.some((c) => c.url.includes('api.resend.com'))).toBe(false);
  });

  it('accepts Turnstile hostnames from every allowed origin (localhost during the E2E test)', async () => {
    const { fetch } = services({ turnstile: { success: true, hostname: 'localhost', action: 'subscribe' } });
    const env = makeEnv({ ALLOWED_ORIGINS: 'https://diyaz.dev, http://localhost:4000' });
    const res = await route(subscribeRequest(VALID, 'http://localhost:4000'), env, makeDeps(fetch));
    expect(res.status).toBe(200);
  });

  it('returns 429 when the per-IP limit is hit, without touching the per-address limit', async () => {
    const { fetch } = services();
    const byAddress = limiter();
    const res = await route(subscribeRequest(VALID), makeEnv({ RL_IP: limiter(false), RL_EMAIL: byAddress }), makeDeps(fetch));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, error: 'rate_limit' });
    expect(byAddress.keys).toHaveLength(0);
  });

  it('returns 429 when the per-address limit is hit', async () => {
    const { fetch, calls } = services();
    const res = await route(subscribeRequest(VALID), makeEnv({ RL_EMAIL: limiter(false) }), makeDeps(fetch));
    expect(res.status).toBe(429);
    expect(calls.some((c) => c.url.includes('api.resend.com'))).toBe(false);
  });

  it('keys the limits on the IP and on a hash of the address, never the raw address', async () => {
    const { fetch } = services();
    const byIp = limiter();
    const byAddress = limiter();
    await route(subscribeRequest(VALID), makeEnv({ RL_IP: byIp, RL_EMAIL: byAddress }), makeDeps(fetch));
    expect(byIp.keys).toEqual(['ip:203.0.113.7']);
    expect(byAddress.keys[0]).toMatch(/^email:[0-9a-f]{64}$/);
  });

  it('sends a confirmation email carrying an encrypted 48-hour token', async () => {
    const { fetch, calls } = services();
    const res = await route(subscribeRequest(VALID), makeEnv(), makeDeps(fetch));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);

    const email = sentEmail(calls);
    expect(email.to).toBe('reader@example.com');
    expect(email.from).toBe(FROM);
    expect(email.reply_to).toBe('owner@example.net');
    const token = confirmToken(email);
    expect(email.html).toContain(`https://subscribe.diyaz.dev/confirm?t=${token}`);
    expect(await decryptToken(token, TEST_KEY)).toEqual({
      email: 'reader@example.com',
      programmes: true,
      exp: NOW + 48 * 60 * 60 * 1000,
    });
  });

  it('normalises mixed case but keeps plus-addressing all the way into the token', async () => {
    const { fetch, calls } = services();
    await route(subscribeRequest({ ...VALID, email: 'Reader+News@Example.COM' }), makeEnv(), makeDeps(fetch));
    const email = sentEmail(calls);
    expect(email.to).toBe('reader+news@example.com');
    const token = confirmToken(email);
    expect((await decryptToken(token, TEST_KEY))!.email).toBe('reader+news@example.com');
  });

  it('records programmes=false when the box is unticked', async () => {
    const { fetch, calls } = services();
    await route(subscribeRequest({ ...VALID, programmes: '' }), makeEnv(), makeDeps(fetch));
    const token = confirmToken(sentEmail(calls));
    expect((await decryptToken(token, TEST_KEY))!.programmes).toBe(false);
  });

  it('never looks up contacts, so the reply cannot reveal who is subscribed', async () => {
    const a = services();
    const b = services();
    const resA = await route(subscribeRequest(VALID), makeEnv(), makeDeps(a.fetch));
    const resB = await route(subscribeRequest({ ...VALID, email: 'other@example.org' }), makeEnv(), makeDeps(b.fetch));
    expect(await resA.text()).toBe(await resB.text());
    expect([...a.calls, ...b.calls].some((c) => c.url.includes('/contacts'))).toBe(false);
  });

  it('returns 502 when Resend fails to send', async () => {
    const { fetch } = services({ emailStatus: 500 });
    const res = await route(subscribeRequest(VALID), makeEnv(), makeDeps(fetch));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, error: 'server' });
  });

  it('fails closed when configuration is missing', async () => {
    const { fetch, calls } = services();
    const res = await route(subscribeRequest(VALID), makeEnv({ RESEND_SEGMENT_ID: '' }), makeDeps(fetch));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'server' });
    expect(calls).toHaveLength(0);
  });

  it('never writes an email address to the logs', async () => {
    const ok = services();
    const okDeps = makeDeps(ok.fetch);
    await route(subscribeRequest(VALID), makeEnv(), okDeps);
    const failing = services({ emailStatus: 500 });
    const failingDeps = makeDeps(failing.fetch);
    await route(subscribeRequest(VALID), makeEnv(), failingDeps);
    expect(JSON.stringify([...okDeps.logs, ...failingDeps.logs])).not.toContain('@');
  });
});

describe('POST /subscribe: order, CORS and diagnostics', () => {
  it('puts CORS headers on every JSON answer to an allowed origin', async () => {
    const cases: [Record<string, string>, Parameters<typeof makeEnv>[0], ReturnType<typeof services>, number][] = [
      [{ ...VALID, email: 'nope' }, {}, services(), 400],
      [VALID, {}, services({ turnstile: { success: false } }), 403],
      [VALID, { RL_IP: limiter(false) }, services(), 429],
      [VALID, { TOKEN_KEY: '' }, services(), 500],
      [VALID, {}, services({ emailStatus: 500 }), 502],
    ];
    for (const [fields, env, svc, status] of cases) {
      const res = await route(subscribeRequest(fields), makeEnv(env), makeDeps(svc.fetch));
      expect(res.status).toBe(status);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
      expect(res.headers.get('Vary')).toBe('Origin');
    }
  });

  it('keys the per-address limit on the hash of the normalised address', async () => {
    const byAddress = limiter();
    await route(subscribeRequest({ ...VALID, email: '  READER@example.COM ' }), makeEnv({ RL_EMAIL: byAddress }), makeDeps(services().fetch));
    expect(byAddress.keys).toEqual([`email:${await sha256Hex('reader@example.com')}`]);
  });

  it('spends no rate-limit budget on a request that fails Turnstile', async () => {
    const byIp = limiter();
    const byAddress = limiter();
    const svc = services({ turnstile: { success: false } });
    await route(subscribeRequest(VALID), makeEnv({ RL_IP: byIp, RL_EMAIL: byAddress }), makeDeps(svc.fetch));
    expect([...byIp.keys, ...byAddress.keys]).toEqual([]);
  });

  it('checks the honeypot before validating the address', async () => {
    const { fetch, calls } = services();
    const res = await route(subscribeRequest({ ...VALID, email: 'nope', hp: 'x' }), makeEnv(), makeDeps(fetch));
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(0);
  });

  it('fails closed on a malformed TOKEN_KEY before spending Turnstile or rate-limit budget', async () => {
    const byIp = limiter();
    const { fetch, calls } = services();
    const res = await route(subscribeRequest(VALID), makeEnv({ TOKEN_KEY: 'a'.repeat(64), RL_IP: byIp }), makeDeps(fetch));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'server' });
    expect(calls).toHaveLength(0);
    expect(byIp.keys).toEqual([]);
  });

  it('turns an unexpected throw into a logged JSON 500 that the browser can read', async () => {
    const broken = { limit: async () => { throw new TypeError('binding exploded'); } };
    const deps = makeDeps(services().fetch);
    const res = await route(subscribeRequest(VALID), makeEnv({ RL_IP: broken }), deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'server' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(deps.logs).toContainEqual({ step: 'subscribe.unhandled', status: 500, reason: 'TypeError' });
  });

  it('logs the rejected origin', async () => {
    const deps = makeDeps(services().fetch);
    await route(subscribeRequest(VALID, 'https://evil.example'), makeEnv(), deps);
    expect(deps.logs).toContainEqual({ step: 'subscribe.origin', status: 403, reason: 'https://evil.example' });
  });

  it('logs why Turnstile said no', async () => {
    const deps = makeDeps(services({ turnstile: { success: false, 'error-codes': ['invalid-input-secret'] } }).fetch);
    await route(subscribeRequest(VALID), makeEnv(), deps);
    expect(deps.logs).toContainEqual({ step: 'subscribe.turnstile', status: 403, reason: 'invalid-input-secret' });
  });

  it("logs Resend's error code when the confirmation email fails", async () => {
    const svc = services({ emailStatus: 422, emailBody: { name: 'validation_error', message: 'Invalid `to` for r@example.com' } });
    const deps = makeDeps(svc.fetch);
    await route(subscribeRequest(VALID), makeEnv(), deps);
    expect(deps.logs).toContainEqual({ step: 'subscribe.send', status: 422, reason: 'validation_error' });
    expect(JSON.stringify(deps.logs)).not.toContain('@');
  });

  it('mentions the Programmes opt-in in the confirmation email only when ticked', async () => {
    const ticked = services();
    await route(subscribeRequest(VALID), makeEnv(), makeDeps(ticked.fetch));
    expect(sentEmail(ticked.calls).text).toContain('coaching programmes');
    const unticked = services();
    await route(subscribeRequest({ ...VALID, programmes: '' }), makeEnv(), makeDeps(unticked.fetch));
    expect(sentEmail(unticked.calls).text).not.toContain('coaching programmes');
  });
});

describe('routing', () => {
  it('serves requests through the real Worker entry point', async () => {
    const res = await worker.fetch(new Request('https://subscribe.diyaz.dev/'), makeEnv());
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://diyaz.dev/subscribe/');
    const confirm = await worker.fetch(new Request('https://subscribe.diyaz.dev/confirm?t=abc'), makeEnv());
    expect(await confirm.text()).toContain('value="abc"');
  });

  it('lists the allowed request headers in the CORS preflight answer', async () => {
    const req = new Request('https://subscribe.diyaz.dev/subscribe', { method: 'OPTIONS', headers: { Origin: ORIGIN } });
    const res = await route(req, makeEnv(), makeDeps(services().fetch));
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
  });

  it('answers CORS preflight for an allowed origin', async () => {
    const req = new Request('https://subscribe.diyaz.dev/subscribe', { method: 'OPTIONS', headers: { Origin: ORIGIN } });
    const res = await route(req, makeEnv(), makeDeps(services().fetch));
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('refuses preflight from other origins', async () => {
    const req = new Request('https://subscribe.diyaz.dev/subscribe', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
    const res = await route(req, makeEnv(), makeDeps(services().fetch));
    expect(res.status).toBe(403);
  });

  it('rejects GET /subscribe', async () => {
    const res = await route(new Request('https://subscribe.diyaz.dev/subscribe'), makeEnv(), makeDeps(services().fetch));
    expect(res.status).toBe(405);
  });

  it('sends the bare host to the site form', async () => {
    const res = await route(new Request('https://subscribe.diyaz.dev/'), makeEnv(), makeDeps(services().fetch));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://diyaz.dev/subscribe/');
  });

  it('404s unknown paths', async () => {
    const res = await route(new Request('https://subscribe.diyaz.dev/nope'), makeEnv(), makeDeps(services().fetch));
    expect(res.status).toBe(404);
  });
});
