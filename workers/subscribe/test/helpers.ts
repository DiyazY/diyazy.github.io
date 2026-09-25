import type { Deps, Env, Fetch, RateLimit } from '../src/env.ts';

export const NOW = Date.parse('2026-09-26T12:00:00Z');
export const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

export interface Call {
  url: string;
  method: string;
  body: string | null;
  headers: Record<string, string>; // lowercase keys
  signal: AbortSignal | null;
}

// A fetch stand-in that records every call and answers via `handler`.
export function fakeFetch(handler: (call: Call) => Response | Promise<Response>): { fetch: Fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: Fetch = async (input, init = {}) => {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const call: Call = {
      url: input,
      method: init.method ?? 'GET',
      body: init.body == null ? null : String(init.body),
      headers,
      signal: init.signal ?? null,
    };
    calls.push(call);
    return handler(call);
  };
  return { fetch, calls };
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function limiter(success = true): RateLimit & { keys: string[] } {
  const keys: string[] = [];
  return {
    keys,
    limit: async ({ key }) => {
      keys.push(key);
      return { success };
    },
  };
}

export function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ALLOWED_ORIGINS: 'https://diyaz.dev',
    RESEND_SEGMENT_ID: 'seg_readers',
    TOPIC_NEW_POSTS_ID: 'topic_posts',
    TOPIC_PROGRAMMES_ID: 'topic_programmes',
    RESEND_API_KEY: 're_test',
    TOKEN_KEY: TEST_KEY,
    TURNSTILE_SECRET: 'turnstile_secret',
    REPLY_TO: 'owner@example.net',
    RL_IP: limiter(),
    RL_EMAIL: limiter(),
    ...overrides,
  };
}

export function makeDeps(fetch: Fetch): Deps & { logs: Record<string, string | number>[]; sleeps: number[] } {
  const logs: Record<string, string | number>[] = [];
  const sleeps: number[] = [];
  return {
    fetch,
    now: () => NOW,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    log: (entry) => {
      logs.push(entry);
    },
    logs,
    sleeps,
  };
}
