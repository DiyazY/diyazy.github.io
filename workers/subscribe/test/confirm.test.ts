import { describe, expect, it } from 'vitest';
import { route } from '../src/index.ts';
import { encryptToken } from '../src/token.ts';
import { NOW, TEST_KEY, fakeFetch, jsonResponse, makeDeps, makeEnv } from './helpers.ts';
import type { Call } from './helpers.ts';

const ADDR = 'reader@example.com';
const ENC = 'reader%40example.com';

const tokenFor = (programmes: boolean, exp = NOW + 60_000) => encryptToken({ email: ADDR, programmes, exp }, TEST_KEY);

function confirmPost(token: string): Request {
  return new Request('https://subscribe.diyaz.dev/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ t: token }).toString(),
  });
}

// Resend stand-in. `existing` answers GET /contacts with a contact;
// `failOn` makes any call whose "METHOD /path" starts with it return 500.
function resend(options: { existing?: boolean; failOn?: string; segment409?: boolean; first429?: boolean } = {}) {
  let throttled = false;
  return fakeFetch((call: Call) => {
    const key = `${call.method} ${call.url.replace('https://api.resend.com', '')}`;
    if (options.first429 && !throttled) {
      throttled = true;
      return jsonResponse({ message: 'slow down' }, 429, { 'Retry-After': '1' });
    }
    if (options.failOn && key.startsWith(options.failOn)) return jsonResponse({ message: 'boom' }, 500);
    if (key === `GET /contacts/${ENC}`) {
      return options.existing
        ? jsonResponse({ id: 'c_1', email: ADDR, unsubscribed: true })
        : jsonResponse({ message: 'not found' }, 404);
    }
    if (key === 'POST /contacts') return jsonResponse({ id: 'c_new' });
    if (key === `PATCH /contacts/${ENC}`) return jsonResponse({ id: 'c_1' });
    if (key === `POST /contacts/${ENC}/segments/seg_readers`) {
      return options.segment409 ? jsonResponse({ message: 'already exists' }, 409) : jsonResponse({ id: 'seg_readers' });
    }
    if (key === `PATCH /contacts/${ENC}/topics`) return jsonResponse({ id: 'c_1' });
    throw new Error(`unexpected ${key}`);
  });
}

const bodyOf = (calls: Call[], key: string) =>
  JSON.parse(calls.find((c) => `${c.method} ${c.url.replace('https://api.resend.com', '')}` === key)!.body!);

describe('GET /confirm', () => {
  it('shows a button that POSTs the token, and touches nothing', async () => {
    const { fetch, calls } = resend();
    const res = await route(new Request('https://subscribe.diyaz.dev/confirm?t=abc'), makeEnv(), makeDeps(fetch));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    const page = await res.text();
    expect(page).toContain('<form method="post" action="/confirm">');
    expect(page).toContain('value="abc"');
    expect(calls).toHaveLength(0);
  });

  it('treats a missing token as expired', async () => {
    const res = await route(new Request('https://subscribe.diyaz.dev/confirm'), makeEnv(), makeDeps(resend().fetch));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('This link has expired');
  });
});

describe('POST /confirm', () => {
  it('creates a new contact with both topics when programmes was ticked', async () => {
    const { fetch, calls } = resend();
    const res = await route(confirmPost(await tokenFor(true)), makeEnv(), makeDeps(fetch));
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('https://diyaz.dev/subscribed/');
    expect(bodyOf(calls, 'POST /contacts')).toEqual({
      email: ADDR,
      unsubscribed: false,
      segments: [{ id: 'seg_readers' }],
      topics: [
        { id: 'topic_posts', subscription: 'opt_in' },
        { id: 'topic_programmes', subscription: 'opt_in' },
      ],
    });
  });

  it('creates a new contact with only New posts when programmes was not ticked', async () => {
    const { fetch, calls } = resend();
    await route(confirmPost(await tokenFor(false)), makeEnv(), makeDeps(fetch));
    expect(bodyOf(calls, 'POST /contacts').topics).toEqual([{ id: 'topic_posts', subscription: 'opt_in' }]);
  });

  it('re-subscribes an existing contact without touching Programmes when unticked', async () => {
    const { fetch, calls } = resend({ existing: true });
    const res = await route(confirmPost(await tokenFor(false)), makeEnv(), makeDeps(fetch));
    expect(res.status).toBe(303);
    expect(calls.some((c) => c.method === 'POST' && c.url === 'https://api.resend.com/contacts')).toBe(false);
    expect(bodyOf(calls, `PATCH /contacts/${ENC}`)).toEqual({ unsubscribed: false });
    expect(calls.some((c) => c.url.endsWith(`/contacts/${ENC}/segments/seg_readers`))).toBe(true);
    expect(bodyOf(calls, `PATCH /contacts/${ENC}/topics`)).toEqual([{ id: 'topic_posts', subscription: 'opt_in' }]);
  });

  it('lands on /subscribed/ when the same link is confirmed twice', async () => {
    const token = await tokenFor(true);
    const first = await route(confirmPost(token), makeEnv(), makeDeps(resend().fetch));
    const second = await route(confirmPost(token), makeEnv(), makeDeps(resend({ existing: true, segment409: true }).fetch));
    expect([first.status, second.status]).toEqual([303, 303]);
    expect(second.headers.get('Location')).toBe('https://diyaz.dev/subscribed/');
  });

  it('rejects an expired token without calling Resend', async () => {
    const { fetch, calls } = resend();
    const res = await route(confirmPost(await tokenFor(true, NOW - 1)), makeEnv(), makeDeps(fetch));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('This link has expired');
    expect(calls).toHaveLength(0);
  });

  it('rejects a tampered or missing token', async () => {
    const token = await tokenFor(true);
    const tampered = token.slice(0, -2) + (token.at(-2) === 'A' ? 'B' : 'A') + token.at(-1);
    for (const t of [tampered, '']) {
      const res = await route(confirmPost(t), makeEnv(), makeDeps(resend().fetch));
      expect(res.status).toBe(400);
    }
  });

  it('offers a retry with the same token when Resend fails', async () => {
    const token = await tokenFor(true);
    const res = await route(confirmPost(token), makeEnv(), makeDeps(resend({ failOn: 'POST /contacts' }).fetch));
    expect(res.status).toBe(502);
    const page = await res.text();
    expect(page).toContain("That didn't go through");
    expect(page).toContain(`value="${token}"`);
  });

  it('waits out a 429 and still succeeds', async () => {
    const { fetch } = resend({ first429: true });
    const deps = makeDeps(fetch);
    const res = await route(confirmPost(await tokenFor(true)), makeEnv(), deps);
    expect(res.status).toBe(303);
    expect(deps.sleeps).toEqual([1000]);
  });

  it('fails closed with an error page when configuration is missing', async () => {
    const { fetch, calls } = resend();
    const res = await route(confirmPost(await tokenFor(true)), makeEnv({ TOPIC_NEW_POSTS_ID: '' }), makeDeps(fetch));
    expect(res.status).toBe(500);
    expect(calls).toHaveLength(0);
  });

  it('never writes an email address to the logs', async () => {
    const deps = makeDeps(resend({ failOn: 'POST /contacts' }).fetch);
    await route(confirmPost(await tokenFor(true)), makeEnv(), deps);
    expect(deps.logs.length).toBeGreaterThan(0); // the failure path must log something...
    expect(JSON.stringify(deps.logs)).not.toContain('@'); // ...and never the address
  });
});
