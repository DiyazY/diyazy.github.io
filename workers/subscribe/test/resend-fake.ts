// An in-memory Resend for the confirm tests: contacts keep their global
// `unsubscribed` flag, segments and topic choices across calls, so a test
// asserts the resulting state, not just the requests. Resend doesn't document
// whether PATCH /contacts/{e}/topics merges or replaces, so `topicsPatch`
// models both and consent tests run under each.
import { fakeFetch, jsonResponse } from './helpers.ts';

type Subscription = 'opt_in' | 'opt_out';

// Matches the Resend team setup in spec §5.
export const TOPIC_DEFAULTS: Record<string, Subscription> = { topic_posts: 'opt_in', topic_programmes: 'opt_out' };

export interface FakeContact {
  email: string;
  unsubscribed: boolean;
  segments: string[];
  topics: Record<string, Subscription>;
}

export function statefulResend(
  options: {
    contacts?: FakeContact[];
    topicsPatch?: 'merge' | 'replace';
    failOn?: string; // any call whose "METHOD /path" starts with this answers 500
    createRace?: boolean; // a parallel confirm creates the contact just before our POST /contacts
    first429?: boolean;
  } = {},
) {
  const contacts = new Map<string, FakeContact>();
  for (const c of options.contacts ?? []) contacts.set(c.email, structuredClone(c));
  let throttled = false;

  const api = fakeFetch((call) => {
    const path = call.url.replace('https://api.resend.com', '');
    const key = `${call.method} ${path}`;
    if (options.first429 && !throttled) {
      throttled = true;
      return jsonResponse({ message: 'slow down' }, 429, { 'Retry-After': '1' });
    }
    if (options.failOn && key.startsWith(options.failOn)) {
      return jsonResponse({ name: 'application_error', message: 'boom' }, 500);
    }

    const m = /^\/contacts(?:\/([^/?]+))?(?:\/(segments|topics))?(?:\/([^/?]+))?(?:\?.*)?$/.exec(path);
    if (!m) throw new Error(`unexpected ${key}`);
    const email = m[1] ? decodeURIComponent(m[1]) : undefined;
    const sub = m[2];
    const segmentId = m[3];

    if (!email && call.method === 'POST') {
      const body = JSON.parse(call.body!) as {
        email: string;
        unsubscribed: boolean;
        segments: { id: string }[];
        topics: { id: string; subscription: Subscription }[];
      };
      const created: FakeContact = {
        email: body.email,
        unsubscribed: body.unsubscribed,
        segments: body.segments.map((s) => s.id),
        topics: Object.fromEntries(body.topics.map((t) => [t.id, t.subscription])),
      };
      if (options.createRace && !contacts.has(body.email)) contacts.set(body.email, structuredClone(created));
      if (contacts.has(body.email)) return jsonResponse({ name: 'validation_error', message: 'Contact already exists' }, 409);
      contacts.set(body.email, created);
      return jsonResponse({ id: 'c_new' });
    }

    const contact = email ? contacts.get(email) : undefined;
    if (!contact) return jsonResponse({ name: 'not_found', message: 'Contact not found' }, 404);

    if (!sub && call.method === 'GET') {
      return jsonResponse({ id: 'c_1', email: contact.email, unsubscribed: contact.unsubscribed });
    }
    if (!sub && call.method === 'PATCH') {
      contact.unsubscribed = (JSON.parse(call.body!) as { unsubscribed: boolean }).unsubscribed;
      return jsonResponse({ id: 'c_1' });
    }
    if (sub === 'segments' && call.method === 'GET') {
      return jsonResponse({
        object: 'list',
        has_more: false,
        data: contact.segments.map((id) => ({ id, name: 'Readers', created_at: '2026-09-25' })),
      });
    }
    if (sub === 'segments' && call.method === 'POST' && segmentId) {
      if (contact.segments.includes(segmentId)) return jsonResponse({ message: 'already in segment' }, 409);
      contact.segments.push(segmentId);
      return jsonResponse({ id: segmentId });
    }
    if (sub === 'topics' && call.method === 'GET') {
      return jsonResponse({
        object: 'list',
        has_more: false,
        data: Object.keys(TOPIC_DEFAULTS).map((id) => ({
          id,
          name: id,
          description: '',
          subscription: contact.topics[id] ?? TOPIC_DEFAULTS[id],
        })),
      });
    }
    if (sub === 'topics' && call.method === 'PATCH') {
      const body = JSON.parse(call.body!) as { id: string; subscription: Subscription }[];
      if (options.topicsPatch === 'replace') contact.topics = {};
      for (const t of body) contact.topics[t.id] = t.subscription;
      return jsonResponse({ id: 'c_1' });
    }
    throw new Error(`unexpected ${key}`);
  });

  const topicOf = (address: string, topicId: string): Subscription => {
    const contact = contacts.get(address);
    if (!contact) throw new Error(`no contact ${address}`);
    return contact.topics[topicId] ?? TOPIC_DEFAULTS[topicId];
  };

  return { ...api, contacts, topicOf };
}
