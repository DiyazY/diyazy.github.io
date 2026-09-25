import { describe, expect, it } from 'vitest';
import { verifyTurnstile } from '../src/turnstile.ts';
import { fakeFetch, jsonResponse } from './helpers.ts';

const BASE = { secret: 's3cret', token: 'tok', ip: '203.0.113.7', allowedHostnames: ['diyaz.dev'] };
const PASS = { success: true, hostname: 'diyaz.dev', action: 'subscribe' };

describe('verifyTurnstile', () => {
  it('accepts a success for our hostname and action, sending secret, token and IP', async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse(PASS));
    expect(await verifyTurnstile({ ...BASE, fetch })).toEqual({ ok: true });
    expect(calls[0].url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const body = new URLSearchParams(calls[0].body!);
    expect(body.get('secret')).toBe('s3cret');
    expect(body.get('response')).toBe('tok');
    expect(body.get('remoteip')).toBe('203.0.113.7');
  });

  it('rejects success:false, another hostname, or another action, and says which', async () => {
    const cases: [unknown, string][] = [
      [{ ...PASS, success: false, 'error-codes': ['invalid-input-secret'] }, 'invalid-input-secret'],
      [{ ...PASS, success: false, 'error-codes': ['timeout-or-duplicate', 'bad-request'] }, 'timeout-or-duplicate+bad-request'],
      [{ ...PASS, success: false }, 'not_success'],
      [{ ...PASS, hostname: 'evil.example' }, 'hostname'],
      [{ ...PASS, action: 'login' }, 'action'],
    ];
    for (const [answer, reason] of cases) {
      const { fetch } = fakeFetch(() => jsonResponse(answer));
      expect(await verifyTurnstile({ ...BASE, fetch })).toEqual({ ok: false, reason });
    }
  });

  it('rejects without calling out when the token is empty or oversized', async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse(PASS));
    expect(await verifyTurnstile({ ...BASE, token: '', fetch })).toEqual({ ok: false, reason: 'no_token' });
    expect(await verifyTurnstile({ ...BASE, token: 'x'.repeat(2049), fetch })).toEqual({ ok: false, reason: 'token_too_long' });
    expect(calls).toHaveLength(0);
  });

  it('fails closed when Siteverify errors or is unreachable', async () => {
    const down = fakeFetch(() => jsonResponse({}, 500));
    expect(await verifyTurnstile({ ...BASE, fetch: down.fetch })).toEqual({ ok: false, reason: 'http_500' });
    const unreachable = fakeFetch(() => {
      throw new TypeError('fetch failed');
    });
    expect(await verifyTurnstile({ ...BASE, fetch: unreachable.fetch })).toEqual({ ok: false, reason: 'TypeError' });
    const garbled = fakeFetch(() => new Response('<html>', { status: 200 }));
    expect(await verifyTurnstile({ ...BASE, fetch: garbled.fetch })).toEqual({ ok: false, reason: 'SyntaxError' });
  });
});
