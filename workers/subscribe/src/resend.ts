// Minimal Resend REST client: only the calls the Worker and notify script
// make. Every call has a timeout. A 429 is retried (the rate limit is per team,
// 10 requests/second on its plan, shared with Diyaz's other products) unless
// it is a quota error; a 429 still failing
// after 4 attempts, and any other non-2xx, becomes a ResendError. Exceptions:
// getContact maps 404 to null, and addContactToSegment accepts 409.
import type { Fetch } from './env.ts';

const API = 'https://api.resend.com';
const MAX_ATTEMPTS = 4;
const TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 5_000;

export class ResendError extends Error {
  readonly status: number;
  readonly code: string | undefined; // Resend's error `name`, e.g. "validation_error"
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ResendError';
    this.status = status;
    this.code = code;
  }
}

// What a Worker log line records about a failed call (see LogEntry in env.ts):
// Resend's status and error name, or 0 and the error class for anything else
// (a timeout, a network failure). Never the message, which can quote an address.
export function errorLogFields(err: unknown): { status: number; reason: string } {
  if (err instanceof ResendError) return { status: err.status, reason: err.code ?? 'unknown' };
  return { status: 0, reason: err instanceof Error ? err.name : 'unknown' };
}

export type Subscription = 'opt_in' | 'opt_out';

export interface TopicSubscription {
  id: string;
  subscription: Subscription;
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
  status?: string;
}

export interface ResendClient {
  sendEmail(input: EmailInput): Promise<{ id: string }>;
  getContact(email: string): Promise<Contact | null>;
  createContact(input: ContactInput): Promise<{ id: string }>;
  addContactToSegment(email: string, segmentId: string): Promise<void>;
  listContactSegmentIds(email: string): Promise<string[]>;
  getContactTopics(email: string): Promise<TopicSubscription[]>;
  updateContactTopics(email: string, topics: TopicSubscription[]): Promise<void>;
  listBroadcasts(): Promise<BroadcastSummary[]>;
  createBroadcast(input: BroadcastInput): Promise<{ id: string }>;
}

async function errorDetails(res: Response): Promise<{ message: string; code: string | undefined }> {
  try {
    const data = (await res.json()) as { message?: string; name?: string };
    return { message: data.message || data.name || `HTTP ${res.status}`, code: data.name };
  } catch {
    return { message: `HTTP ${res.status}`, code: undefined };
  }
}

// Retry-After is either seconds or an HTTP date. Capped so a Worker request
// never hangs on Resend's say-so; 1 s when the header is absent or unreadable.
function retryDelayMs(header: string | null): number {
  if (!header) return DEFAULT_RETRY_DELAY_MS;
  const seconds = Number(header); // a blank header reads as 0, caught below
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return DEFAULT_RETRY_DELAY_MS;
  return Math.min(ms, MAX_RETRY_DELAY_MS);
}

async function isQuotaError(res: Response): Promise<boolean> {
  try {
    const data = (await res.clone().json()) as { name?: string };
    return typeof data.name === 'string' && data.name.endsWith('_quota_exceeded');
  } catch {
    return false;
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
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status !== 429 || attempt >= MAX_ATTEMPTS || (await isQuotaError(res))) return res;
      await options.sleep(retryDelayMs(res.headers.get('Retry-After')));
    }
  }

  async function expectOk(res: Response, allow: number[] = []): Promise<Response> {
    if (res.ok || allow.includes(res.status)) return res;
    const { message, code } = await errorDetails(res);
    throw new ResendError(res.status, message, code);
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
      const data = (await res.json()) as Partial<Contact>;
      // confirm.ts branches on this flag, so never guess it.
      if (typeof data.unsubscribed !== 'boolean') throw new Error('Resend contact response has no unsubscribed flag');
      return data as Contact;
    },

    createContact: (input) => json('POST', '/contacts', input),

    async addContactToSegment(email, segmentId) {
      // The duplicate-add answer is undocumented; 409 is the likely one. confirm.ts
      // checks membership first, so this is only a fallback for races.
      await expectOk(await call('POST', `${contact(email)}/segments/${encodeURIComponent(segmentId)}`), [409]);
    },

    // Neither call paginates: limit=100 is far beyond this team's 1 segment and 2 topics.
    async listContactSegmentIds(email) {
      const page = await json<{ data: { id: string }[] }>('GET', `${contact(email)}/segments?limit=100`);
      return page.data.map((segment) => segment.id);
    },

    async getContactTopics(email) {
      const page = await json<{ data: { id: string; subscription: unknown }[] }>('GET', `${contact(email)}/topics?limit=100`);
      return page.data.map(({ id, subscription }) => {
        // confirm.ts decides whether to carry a Programmes opt-in on this value.
        if (subscription !== 'opt_in' && subscription !== 'opt_out') {
          throw new Error('Resend returned an unexpected topic subscription value');
        }
        return { id, subscription };
      });
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
