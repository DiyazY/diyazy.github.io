import { describe, expect, it } from 'vitest';
import { verifyTurnstile } from '../src/turnstile.ts';
import { fakeFetch, jsonResponse } from './helpers.ts';

const BASE = { secret: 's3cret', token: 'tok', ip: '203.0.113.7', allowedHostnames: ['diyaz.dev'] };
const PASS = { success: true, hostname: 'diyaz.dev', action: 'subscribe' };

describe('verifyTurnstile', () => {
  it('accepts a success for our hostname and action, sending secret, token and IP', async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse(PASS));
    expect(await verifyTurnstile({ ...BASE, fetch })).toBe(true);
    expect(calls[0].url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const body = new URLSearchParams(calls[0].body!);
    expect(body.get('secret')).toBe('s3cret');
    expect(body.get('response')).toBe('tok');
    expect(body.get('remoteip')).toBe('203.0.113.7');
  });

  it('rejects success:false, another hostname, or another action', async () => {
    for (const answer of [{ ...PASS, success: false }, { ...PASS, hostname: 'evil.example' }, { ...PASS, action: 'login' }]) {
      const { fetch } = fakeFetch(() => jsonResponse(answer));
      expect(await verifyTurnstile({ ...BASE, fetch })).toBe(false);
    }
  });

  it('rejects without calling out when the token is empty or oversized', async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse(PASS));
    expect(await verifyTurnstile({ ...BASE, token: '', fetch })).toBe(false);
    expect(await verifyTurnstile({ ...BASE, token: 'x'.repeat(2049), fetch })).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('fails closed when Siteverify errors or is unreachable', async () => {
    const down = fakeFetch(() => jsonResponse({}, 500));
    expect(await verifyTurnstile({ ...BASE, fetch: down.fetch })).toBe(false);
    const unreachable = fakeFetch(() => {
      throw new Error('network');
    });
    expect(await verifyTurnstile({ ...BASE, fetch: unreachable.fetch })).toBe(false);
  });
});
