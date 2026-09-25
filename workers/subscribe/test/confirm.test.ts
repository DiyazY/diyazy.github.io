import { describe, expect, it } from 'vitest';
import { route } from '../src/index.ts';
import { encryptToken } from '../src/token.ts';
import { NOW, TEST_KEY, fakeFetch, jsonResponse, makeDeps, makeEnv } from './helpers.ts';
import { statefulResend } from './resend-fake.ts';
import type { FakeContact } from './resend-fake.ts';

const ADDR = 'reader@example.com';
const ENC = 'reader%40example.com';
const POSTS = 'topic_posts';
const PROGRAMMES = 'topic_programmes';

const tokenFor = (programmes: boolean, exp = NOW + 60_000) => encryptToken({ email: ADDR, programmes, exp }, TEST_KEY);

function confirmPost(token: string): Request {
  return new Request('https://subscribe.diyaz.dev/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ t: token }).toString(),
  });
}

// A reader as Resend would hold them after an earlier confirmation.
function reader(overrides: Partial<FakeContact> = {}): FakeContact {
  return {
    email: ADDR,
    unsubscribed: false,
    segments: ['seg_readers'],
    topics: { [POSTS]: 'opt_in', [PROGRAMMES]: 'opt_out' },
    ...overrides,
  };
}

const keyOf = (c: { method: string; url: string }) => `${c.method} ${c.url.replace('https://api.resend.com', '')}`;

describe('GET /confirm', () => {
  it('shows a button that POSTs the token, and touches nothing', async () => {
    const { fetch, calls } = statefulResend();
    const res = await route(new Request('https://subscribe.diyaz.dev/confirm?t=abc'), makeEnv(), makeDeps(fetch));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    const page = await res.text();
    expect(page).toContain('<form method="post" action="/confirm"');
    expect(page).toContain('value="abc"');
    expect(calls).toHaveLength(0);
  });

  it('treats a missing token as not valid', async () => {
    const res = await route(new Request('https://subscribe.diyaz.dev/confirm'), makeEnv(), makeDeps(statefulResend().fetch));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("This link has expired or isn't valid");
  });
});

describe('POST /confirm: new subscribers', () => {
  it('creates the contact with both topics when Programmes was ticked', async () => {
    const resend = statefulResend();
    const res = await route(confirmPost(await tokenFor(true)), makeEnv(), makeDeps(resend.fetch));
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('https://diyaz.dev/subscribed/');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(resend.contacts.get(ADDR)).toMatchObject({ unsubscribed: false, segments: ['seg_readers'] });
    expect(resend.topicOf(ADDR, POSTS)).toBe('opt_in');
    expect(resend.topicOf(ADDR, PROGRAMMES)).toBe('opt_in');
  });

  it('leaves Programmes at its opt-out default when the box was not ticked', async () => {
    const resend = statefulResend();
    await route(confirmPost(await tokenFor(false)), makeEnv(), makeDeps(resend.fetch));
    const create = resend.calls.find((c) => keyOf(c) === 'POST /contacts')!;
    expect(JSON.parse(create.body!).topics).toEqual([{ id: POSTS, subscription: 'opt_in' }]);
    expect(resend.topicOf(ADDR, PROGRAMMES)).toBe('opt_out');
  });

  it('recovers when a parallel confirm created the contact first (double click)', async () => {
    const resend = statefulResend({ createRace: true });
    const res = await route(confirmPost(await tokenFor(true)), makeEnv(), makeDeps(resend.fetch));
    expect(res.status).toBe(303);
    expect(resend.contacts.size).toBe(1);
    expect(resend.topicOf(ADDR, PROGRAMMES)).toBe('opt_in');
  });
});

for (const topicsPatch of ['merge', 'replace'] as const) {
  describe(`POST /confirm: existing contacts (topics PATCH ${topicsPatch}s)`, () => {
    it('keeps a subscribed reader’s Programmes opt-in when the box is left unticked', async () => {
      const resend = statefulResend({ topicsPatch, contacts: [reader({ topics: { [POSTS]: 'opt_in', [PROGRAMMES]: 'opt_in' } })] });
      await route(confirmPost(await tokenFor(false)), makeEnv(), makeDeps(resend.fetch));
      expect(resend.topicOf(ADDR, PROGRAMMES)).toBe('opt_in');
    });

    it('does not opt a subscribed reader into Programmes when the box is left unticked', async () => {
      const resend = statefulResend({ topicsPatch, contacts: [reader()] });
      await route(confirmPost(await tokenFor(false)), makeEnv(), makeDeps(resend.fetch));
      expect(resend.topicOf(ADDR, PROGRAMMES)).toBe('opt_out');
      expect(resend.topicOf(ADDR, POSTS)).toBe('opt_in');
    });

    it('opts an existing reader into Programmes when the box is ticked', async () => {
      const resend = statefulResend({ topicsPatch, contacts: [reader()] });
      await route(confirmPost(await tokenFor(true)), makeEnv(), makeDeps(resend.fetch));
      expect(resend.topicOf(ADDR, PROGRAMMES)).toBe('opt_in');
    });

    it('does not bring back a Programmes opt-in after "unsubscribe from all"', async () => {
      const resend = statefulResend({
        topicsPatch,
        contacts: [reader({ unsubscribed: true, topics: { [POSTS]: 'opt_in', [PROGRAMMES]: 'opt_in' } })],
      });
      const res = await route(confirmPost(await tokenFor(false)), makeEnv(), makeDeps(resend.fetch));
      expect(res.status).toBe(303);
      expect(resend.contacts.get(ADDR)!.unsubscribed).toBe(false);
      expect(resend.topicOf(ADDR, POSTS)).toBe('opt_in');
      expect(resend.topicOf(ADDR, PROGRAMMES)).toBe('opt_out');
    });

    it('re-subscribes an unsubscribed reader to Programmes only when ticked again', async () => {
      const resend = statefulResend({ topicsPatch, contacts: [reader({ unsubscribed: true })] });
      await route(confirmPost(await tokenFor(true)), makeEnv(), makeDeps(resend.fetch));
      expect(resend.contacts.get(ADDR)!.unsubscribed).toBe(false);
      expect(resend.topicOf(ADDR, PROGRAMMES)).toBe('opt_in');
    });

    it('confirming the same link twice ends on /subscribed/ both times with one contact', async () => {
      const resend = statefulResend({ topicsPatch });
      const token = await tokenFor(true);
      const first = await route(confirmPost(token), makeEnv(), makeDeps(resend.fetch));
      const second = await route(confirmPost(token), makeEnv(), makeDeps(resend.fetch));
      expect([first.status, second.status]).toEqual([303, 303]);
      expect(resend.contacts.size).toBe(1);
      expect(resend.topicOf(ADDR, POSTS)).toBe('opt_in');
      expect(resend.topicOf(ADDR, PROGRAMMES)).toBe('opt_in');
    });
  });
}

describe('POST /confirm: write order and failures', () => {
  it('clears the global unsubscribe only after the segment and topics are written', async () => {
    const resend = statefulResend({ contacts: [reader({ unsubscribed: true, segments: [] })] });
    await route(confirmPost(await tokenFor(false)), makeEnv(), makeDeps(resend.fetch));
    const writes = resend.calls.filter((c) => c.method !== 'GET').map(keyOf);
    expect(writes).toEqual([
      `POST /contacts/${ENC}/segments/seg_readers`,
      `PATCH /contacts/${ENC}/topics`,
      `PATCH /contacts/${ENC}`,
    ]);
  });

  it('leaves an unsubscribed contact unsubscribed if the topics write fails', async () => {
    const resend = statefulResend({ contacts: [reader({ unsubscribed: true })], failOn: `PATCH /contacts/${ENC}/topics` });
    const res = await route(confirmPost(await tokenFor(false)), makeEnv(), makeDeps(resend.fetch));
    expect(res.status).toBe(502);
    expect(resend.contacts.get(ADDR)!.unsubscribed).toBe(true);
  });

  it('does not re-add a contact that is already in the segment', async () => {
    const resend = statefulResend({ contacts: [reader()] });
    await route(confirmPost(await tokenFor(false)), makeEnv(), makeDeps(resend.fetch));
    expect(resend.calls.some((c) => c.method === 'POST' && c.url.includes('/segments/'))).toBe(false);
  });

  it('writes nothing after a failed step and offers the retry page', async () => {
    const steps: [string, FakeContact][] = [
      [`GET /contacts/${ENC}/segments`, reader()],
      [`POST /contacts/${ENC}/segments/seg_readers`, reader({ segments: [] })],
      [`GET /contacts/${ENC}/topics`, reader()],
      [`PATCH /contacts/${ENC}/topics`, reader()],
      [`PATCH /contacts/${ENC}`, reader({ unsubscribed: true })],
    ];
    for (const [failOn, contact] of steps) {
      const resend = statefulResend({ contacts: [contact], failOn });
      const token = await tokenFor(true);
      const res = await route(confirmPost(token), makeEnv(), makeDeps(resend.fetch));
      expect(res.status, failOn).toBe(502);
      const page = await res.text();
      expect(page).toContain("That didn't go through");
      expect(page).toContain(`value="${token}"`);
      expect(keyOf(resend.calls.at(-1)!).startsWith(failOn), failOn).toBe(true);
    }
  });

  it('keeps a contact unsubscribed when only the final re-subscribe write fails', async () => {
    const resend = statefulResend({ contacts: [reader({ unsubscribed: true })], failOn: `PATCH /contacts/${ENC}` });
    const deps = makeDeps(resend.fetch);
    const res = await route(confirmPost(await tokenFor(false)), makeEnv(), deps);
    expect(res.status).toBe(502);
    expect(resend.topicOf(ADDR, PROGRAMMES)).toBe('opt_out'); // topics were written first
    expect(resend.contacts.get(ADDR)!.unsubscribed).toBe(true);
    expect(deps.logs).toContainEqual({ step: 'confirm.save', status: 500, call: 'updateContact', reason: 'application_error' });
  });

  it('names createContact in the log when the create fails with a 4xx that is not a race', async () => {
    const resend = statefulResend({ failOn: 'POST /contacts', failStatus: 422 });
    const deps = makeDeps(resend.fetch);
    const res = await route(confirmPost(await tokenFor(true)), makeEnv(), deps);
    expect(res.status).toBe(502);
    expect(deps.logs).toContainEqual({ step: 'confirm.save', status: 422, call: 'createContact', reason: 'validation_error' });
  });

  it('fails closed when the contact lookup errors (only 404 means "new")', async () => {
    const resend = statefulResend({ failOn: `GET /contacts/${ENC}` });
    const res = await route(confirmPost(await tokenFor(true)), makeEnv(), makeDeps(resend.fetch));
    expect(res.status).toBe(502);
    expect(resend.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('offers a retry with the same token when creating the contact fails', async () => {
    const token = await tokenFor(true);
    const resend = statefulResend({ failOn: 'POST /contacts' });
    const res = await route(confirmPost(token), makeEnv(), makeDeps(resend.fetch));
    expect(res.status).toBe(502);
    expect(await res.text()).toContain(`value="${token}"`);
  });

  it('waits out a 429 and still succeeds', async () => {
    const resend = statefulResend({ first429: true });
    const deps = makeDeps(resend.fetch);
    const res = await route(confirmPost(await tokenFor(true)), makeEnv(), deps);
    expect(res.status).toBe(303);
    expect(deps.sleeps).toEqual([1000]);
  });
});

describe('POST /confirm: tokens, config and logs', () => {
  it('rejects an expired token without calling Resend', async () => {
    const resend = statefulResend();
    const res = await route(confirmPost(await tokenFor(true, NOW - 1)), makeEnv(), makeDeps(resend.fetch));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("This link has expired or isn't valid");
    expect(resend.calls).toHaveLength(0);
  });

  it('logs whether a token was missing, invalid or expired', async () => {
    const token = await tokenFor(true);
    const tampered = token.slice(0, -2) + (token.at(-2) === 'A' ? 'B' : 'A') + token.at(-1);
    const cases: [string, string][] = [
      ['', 'missing'],
      [tampered, 'invalid'],
      [await tokenFor(true, NOW - 1), 'expired'],
    ];
    for (const [t, reason] of cases) {
      const deps = makeDeps(statefulResend().fetch);
      const res = await route(confirmPost(t), makeEnv(), deps);
      expect(res.status).toBe(400);
      expect(deps.logs).toContainEqual({ step: 'confirm.token', status: 400, reason });
    }
  });

  it('fails closed with an error page when configuration is missing or malformed', async () => {
    for (const env of [makeEnv({ TOPIC_NEW_POSTS_ID: '' }), makeEnv({ TOKEN_KEY: 'a'.repeat(64) })]) {
      const resend = statefulResend();
      const res = await route(confirmPost(await tokenFor(true)), env, makeDeps(resend.fetch));
      expect(res.status).toBe(500);
      expect(resend.calls).toHaveLength(0);
    }
  });

  it('logs which Resend call failed and its error code', async () => {
    const resend = statefulResend({ contacts: [reader()], failOn: `PATCH /contacts/${ENC}/topics` });
    const deps = makeDeps(resend.fetch);
    await route(confirmPost(await tokenFor(true)), makeEnv(), deps);
    expect(deps.logs).toContainEqual({
      step: 'confirm.save',
      status: 500,
      call: 'updateContactTopics',
      reason: 'application_error',
    });
  });

  it('turns an unexpected throw into a logged error page', async () => {
    const deps = makeDeps(statefulResend().fetch);
    deps.now = () => {
      throw new RangeError('clock');
    };
    const res = await route(confirmPost(await tokenFor(true)), makeEnv(), deps);
    expect(res.status).toBe(500);
    expect(await res.text()).toContain('Something went wrong');
    expect(deps.logs).toContainEqual({ step: 'confirm.unhandled', status: 500, reason: 'RangeError' });
  });

  it('never writes an email address or the token to the logs', async () => {
    const token = await tokenFor(true);
    const deps = makeDeps(statefulResend({ failOn: 'POST /contacts' }).fetch);
    await route(confirmPost(token), makeEnv(), deps);
    expect(deps.logs.length).toBeGreaterThan(0); // the failure path must log something...
    const logged = JSON.stringify(deps.logs);
    expect(logged).not.toContain('@'); // ...and never the address
    expect(logged).not.toContain(token);
  });

  it('keeps the stateless fake’s contract: a lookup error other than 404 is not "new"', async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse({ message: 'boom' }, 503));
    const res = await route(confirmPost(await tokenFor(true)), makeEnv(), makeDeps(fetch));
    expect(res.status).toBe(502);
    expect(calls.map(keyOf)).toEqual([`GET /contacts/${ENC}`]);
  });
});
