import { describe, expect, it } from 'vitest';
import { ResendError, createResendClient } from '../src/resend.ts';
import { fakeFetch, jsonResponse } from './helpers.ts';
import type { Call } from './helpers.ts';

function setup(handler: (call: Call) => Response | Promise<Response>) {
  const { fetch, calls } = fakeFetch(handler);
  const sleeps: number[] = [];
  const resend = createResendClient({
    apiKey: 're_key',
    fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { resend, calls, sleeps };
}

const EMAIL = { from: 'A <a@news.example>', to: 'r@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };

describe('createResendClient', () => {
  it('sends JSON with a bearer key', async () => {
    const { resend, calls } = setup(() => jsonResponse({ id: 'em_1' }));
    expect(await resend.sendEmail(EMAIL)).toEqual({ id: 'em_1' });
    expect(calls[0].url).toBe('https://api.resend.com/emails');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].headers.authorization).toBe('Bearer re_key');
    expect(calls[0].headers['content-type']).toBe('application/json');
    expect(JSON.parse(calls[0].body!)).toEqual(EMAIL);
  });

  it('returns null for a contact that does not exist, and encodes the address', async () => {
    const { resend, calls } = setup(() => jsonResponse({ message: 'Contact not found' }, 404));
    expect(await resend.getContact('r+x@example.com')).toBeNull();
    expect(calls[0].url).toBe('https://api.resend.com/contacts/r%2Bx%40example.com');
  });

  it('returns an existing contact', async () => {
    const { resend } = setup(() => jsonResponse({ id: 'c_1', email: 'r@example.com', unsubscribed: true }));
    expect(await resend.getContact('r@example.com')).toMatchObject({ id: 'c_1', unsubscribed: true });
  });

  it('retries a 429, honouring Retry-After', async () => {
    let n = 0;
    const { resend, calls, sleeps } = setup(() =>
      ++n === 1 ? jsonResponse({ message: 'slow down' }, 429, { 'Retry-After': '2' }) : jsonResponse({ id: 'em_1' }),
    );
    expect(await resend.sendEmail(EMAIL)).toEqual({ id: 'em_1' });
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
  });

  it('gives up after four attempts', async () => {
    const { resend, calls } = setup(() => jsonResponse({ message: 'slow down' }, 429));
    await expect(resend.sendEmail(EMAIL)).rejects.toMatchObject({ status: 429 });
    expect(calls).toHaveLength(4);
  });

  it('throws ResendError carrying the API message', async () => {
    const { resend } = setup(() => jsonResponse({ message: 'Invalid `from` field' }, 422));
    const err = await resend.sendEmail(EMAIL).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ResendError);
    expect(err).toMatchObject({ status: 422, message: 'Invalid `from` field' });
  });

  it('creates a contact with segments and topics', async () => {
    const { resend, calls } = setup(() => jsonResponse({ id: 'c_new' }));
    const input = {
      email: 'r@example.com',
      unsubscribed: false,
      segments: [{ id: 'seg' }],
      topics: [{ id: 't1', subscription: 'opt_in' as const }],
    };
    expect(await resend.createContact(input)).toEqual({ id: 'c_new' });
    expect(calls[0].url).toBe('https://api.resend.com/contacts');
    expect(JSON.parse(calls[0].body!)).toEqual(input);
  });

  it('sends topic updates as a bare array', async () => {
    const { resend, calls } = setup(() => jsonResponse({ id: 'c_1' }));
    await resend.updateContactTopics('r@example.com', [{ id: 't1', subscription: 'opt_in' }]);
    expect(calls[0]).toMatchObject({ method: 'PATCH', url: 'https://api.resend.com/contacts/r%40example.com/topics' });
    expect(JSON.parse(calls[0].body!)).toEqual([{ id: 't1', subscription: 'opt_in' }]);
  });

  it('adds a contact to a segment, treating "already there" (409) as success', async () => {
    const { resend, calls } = setup(() => jsonResponse({ message: 'already exists' }, 409));
    await expect(resend.addContactToSegment('r@example.com', 'seg')).resolves.toBeUndefined();
    expect(calls[0]).toMatchObject({ method: 'POST', url: 'https://api.resend.com/contacts/r%40example.com/segments/seg' });
  });

  it("lists a contact's segment ids", async () => {
    const { resend, calls } = setup(() =>
      jsonResponse({ object: 'list', has_more: false, data: [{ id: 'seg', name: 'Readers', created_at: 'x' }] }),
    );
    expect(await resend.listContactSegmentIds('r@example.com')).toEqual(['seg']);
    expect(calls[0]).toMatchObject({ method: 'GET', url: 'https://api.resend.com/contacts/r%40example.com/segments?limit=100' });
  });

  it("reads a contact's topic subscriptions", async () => {
    const { resend, calls } = setup(() =>
      jsonResponse({
        object: 'list',
        has_more: false,
        data: [{ id: 't1', name: 'New posts', description: 'x', subscription: 'opt_in' }],
      }),
    );
    expect(await resend.getContactTopics('r@example.com')).toEqual([{ id: 't1', subscription: 'opt_in' }]);
    expect(calls[0]).toMatchObject({ method: 'GET', url: 'https://api.resend.com/contacts/r%40example.com/topics?limit=100' });
  });

  it('pages through every broadcast', async () => {
    const { resend, calls } = setup((call) =>
      call.url.includes('after=b2')
        ? jsonResponse({ object: 'list', has_more: false, data: [{ id: 'b3', name: 'post:ccc' }] })
        : jsonResponse({ object: 'list', has_more: true, data: [{ id: 'b1', name: 'post:aaa' }, { id: 'b2', name: null }] }),
    );
    expect((await resend.listBroadcasts()).map((b) => b.name)).toEqual(['post:aaa', null, 'post:ccc']);
    expect(calls[0].url).toBe('https://api.resend.com/broadcasts?limit=100');
    expect(calls[1].url).toBe('https://api.resend.com/broadcasts?limit=100&after=b2');
  });

  it('passes a timeout signal on every call', async () => {
    const { resend, calls } = setup(() => jsonResponse({ id: 'em_1' }));
    await resend.sendEmail(EMAIL);
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
  });

  it('caps a long Retry-After at 5 seconds', async () => {
    let n = 0;
    const { resend, sleeps } = setup(() =>
      ++n === 1 ? jsonResponse({ message: 'slow down' }, 429, { 'Retry-After': '120' }) : jsonResponse({ id: 'em_1' }),
    );
    await resend.sendEmail(EMAIL);
    expect(sleeps).toEqual([5000]);
  });

  it('reads Retry-After given as an HTTP date', async () => {
    let n = 0;
    const when = new Date(Date.now() + 3000).toUTCString();
    const { resend, sleeps } = setup(() =>
      ++n === 1 ? jsonResponse({ message: 'slow down' }, 429, { 'Retry-After': when }) : jsonResponse({ id: 'em_1' }),
    );
    await resend.sendEmail(EMAIL);
    expect(sleeps[0]).toBeGreaterThan(1000);
    expect(sleeps[0]).toBeLessThanOrEqual(3000);
  });

  it('falls back to 1 second when Retry-After is missing or unreadable', async () => {
    let n = 0;
    const { resend, sleeps } = setup(() => {
      n++;
      if (n === 1) return jsonResponse({ message: 'slow down' }, 429);
      if (n === 2) return jsonResponse({ message: 'slow down' }, 429, { 'Retry-After': 'soon' });
      return jsonResponse({ id: 'em_1' });
    });
    await resend.sendEmail(EMAIL);
    expect(sleeps).toEqual([1000, 1000]);
  });

  it('does not retry a quota error, and reports its code', async () => {
    const { resend, calls } = setup(() =>
      jsonResponse({ name: 'daily_quota_exceeded', message: 'You have reached your daily email sending quota.' }, 429),
    );
    await expect(resend.sendEmail(EMAIL)).rejects.toMatchObject({ status: 429, code: 'daily_quota_exceeded' });
    expect(calls).toHaveLength(1);
  });

  it("carries Resend's error name as the error code", async () => {
    const { resend } = setup(() => jsonResponse({ name: 'validation_error', message: 'Invalid `to` field.' }, 422));
    await expect(resend.sendEmail(EMAIL)).rejects.toMatchObject({ status: 422, code: 'validation_error' });
  });

  it('treats only 404 as "no such contact"; a server error throws', async () => {
    const { resend } = setup(() => jsonResponse({ message: 'boom' }, 500));
    await expect(resend.getContact('r@example.com')).rejects.toMatchObject({ status: 500 });
  });

  it('rejects a contact response without an unsubscribed flag', async () => {
    const { resend } = setup(() => jsonResponse({ id: 'c_1', email: 'r@example.com' }));
    await expect(resend.getContact('r@example.com')).rejects.toThrow(/unsubscribed/);
  });

  it('rejects topic subscription values it does not understand', async () => {
    const { resend } = setup(() =>
      jsonResponse({ object: 'list', has_more: false, data: [{ id: 't1', subscription: 'pending' }] }),
    );
    await expect(resend.getContactTopics('r@example.com')).rejects.toThrow(/subscription/);
  });

  it('keeps each broadcast status from the listing', async () => {
    const { resend } = setup(() =>
      jsonResponse({ object: 'list', has_more: false, data: [{ id: 'b1', name: 'post:aaa', status: 'sent' }] }),
    );
    expect(await resend.listBroadcasts()).toEqual([{ id: 'b1', name: 'post:aaa', status: 'sent' }]);
  });

  it('stops paging on an empty page even if has_more says otherwise', async () => {
    const { resend, calls } = setup(() => jsonResponse({ object: 'list', has_more: true, data: [] }));
    expect(await resend.listBroadcasts()).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('creates a broadcast', async () => {
    const { resend, calls } = setup(() => jsonResponse({ id: 'b_new' }));
    const input = {
      segment_id: 'seg', topic_id: 't1', from: 'A <a@news.example>', reply_to: 'me@example.net',
      subject: 'Post', name: 'post:abc', html: '<p>x</p>', text: 'x', send: true as const, scheduled_at: 'in 2 hours',
    };
    expect(await resend.createBroadcast(input)).toEqual({ id: 'b_new' });
    expect(calls[0].url).toBe('https://api.resend.com/broadcasts');
    expect(JSON.parse(calls[0].body!)).toEqual(input);
  });
});
