// Minimal Resend REST client: only the calls the Worker and notify script
// make. Retries 429s (the API allows 5 requests/second per team) and turns
// any other non-2xx into a ResendError carrying the status.
import type { Fetch } from './env.ts';

const API = 'https://api.resend.com';
const MAX_ATTEMPTS = 4;

export class ResendError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ResendError';
    this.status = status;
  }
}

export interface TopicSubscription {
  id: string;
  subscription: 'opt_in' | 'opt_out';
}

export interface EmailInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  reply_to?: string;
}

export interface ContactInput {
  email: string;
  unsubscribed: boolean;
  segments: { id: string }[];
  topics: TopicSubscription[];
}

export interface Contact {
  id: string;
  email: string;
  unsubscribed: boolean;
}

export interface BroadcastInput {
  segment_id: string;
  topic_id: string;
  from: string;
  reply_to: string;
  subject: string;
  name: string;
  html: string;
  text: string;
  send: true;
  scheduled_at: string;
}

export interface BroadcastSummary {
  id: string;
  name: string | null;
}

export interface ResendClient {
  sendEmail(input: EmailInput): Promise<{ id: string }>;
  getContact(email: string): Promise<Contact | null>;
  createContact(input: ContactInput): Promise<{ id: string }>;
  updateContact(email: string, patch: { unsubscribed: boolean }): Promise<void>;
  addContactToSegment(email: string, segmentId: string): Promise<void>;
  listContactSegmentIds(email: string): Promise<string[]>;
  getContactTopics(email: string): Promise<TopicSubscription[]>;
  updateContactTopics(email: string, topics: TopicSubscription[]): Promise<void>;
  listBroadcasts(): Promise<BroadcastSummary[]>;
  createBroadcast(input: BroadcastInput): Promise<{ id: string }>;
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; name?: string };
    return data.message || data.name || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export function createResendClient(options: {
  apiKey: string;
  fetch: Fetch;
  sleep: (ms: number) => Promise<void>;
}): ResendClient {
  async function call(method: string, path: string, body?: unknown): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      const res = await options.fetch(API + path, {
        method,
        headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status !== 429 || attempt >= MAX_ATTEMPTS) return res;
      const retryAfter = Number(res.headers.get('Retry-After'));
      await options.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000);
    }
  }

  async function expectOk(res: Response, allow: number[] = []): Promise<Response> {
    if (res.ok || allow.includes(res.status)) return res;
    throw new ResendError(res.status, await errorMessage(res));
  }

  async function json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await expectOk(await call(method, path, body));
    return (await res.json()) as T;
  }

  const contact = (email: string) => `/contacts/${encodeURIComponent(email)}`;

  return {
    sendEmail: (input) => json('POST', '/emails', input),

    async getContact(email) {
      const res = await call('GET', contact(email));
      if (res.status === 404) return null;
      await expectOk(res);
      return (await res.json()) as Contact;
    },

    createContact: (input) => json('POST', '/contacts', input),

    async updateContact(email, patch) {
      await expectOk(await call('PATCH', contact(email), patch));
    },

    async addContactToSegment(email, segmentId) {
      // 409 = already in the segment: re-confirming must stay idempotent.
      await expectOk(await call('POST', `${contact(email)}/segments/${encodeURIComponent(segmentId)}`), [409]);
    },

    // One page is enough: this team has one segment and two topics.
    async listContactSegmentIds(email) {
      const page = await json<{ data: { id: string }[] }>('GET', `${contact(email)}/segments?limit=100`);
      return page.data.map((segment) => segment.id);
    },

    async getContactTopics(email) {
      const page = await json<{ data: TopicSubscription[] }>('GET', `${contact(email)}/topics?limit=100`);
      return page.data.map(({ id, subscription }) => ({ id, subscription }));
    },

    async updateContactTopics(email, topics) {
      await expectOk(await call('PATCH', `${contact(email)}/topics`, topics));
    },

    async listBroadcasts() {
      const all: BroadcastSummary[] = [];
      let after: string | undefined;
      for (;;) {
        const query = new URLSearchParams({ limit: '100' });
        if (after) query.set('after', after);
        const page = await json<{ has_more: boolean; data: BroadcastSummary[] }>('GET', `/broadcasts?${query}`);
        all.push(...page.data);
        if (!page.has_more || page.data.length === 0) return all;
        after = page.data[page.data.length - 1].id;
      }
    },

    createBroadcast: (input) => json('POST', '/broadcasts', input),
  };
}
