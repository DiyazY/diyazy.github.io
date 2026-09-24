// Everything the Worker reads from its environment, plus the side-effecting
// functions handlers receive as `deps` so tests can replace them.

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  ALLOWED_ORIGINS: string; // comma-separated, e.g. "https://diyaz.dev"
  RESEND_SEGMENT_ID: string;
  TOPIC_NEW_POSTS_ID: string;
  TOPIC_PROGRAMMES_ID: string;
  RESEND_API_KEY: string; // secret
  TOKEN_KEY: string; // secret, base64 of 32 random bytes
  TURNSTILE_SECRET: string; // secret
  REPLY_TO: string; // secret: keeps the address out of the public repo
  RL_IP: RateLimit;
  RL_EMAIL: RateLimit;
}

export interface Deps {
  fetch: Fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  log: (entry: Record<string, string | number>) => void;
}

export function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const REQUIRED = [
  'ALLOWED_ORIGINS',
  'RESEND_SEGMENT_ID',
  'TOPIC_NEW_POSTS_ID',
  'TOPIC_PROGRAMMES_ID',
  'RESEND_API_KEY',
  'TOKEN_KEY',
  'TURNSTILE_SECRET',
  'REPLY_TO',
] as const;

// Names of required settings that are unset or blank. Handlers fail closed
// on any of these rather than half-working with a missing ID or key.
export function missingConfig(env: Env): string[] {
  return REQUIRED.filter((name) => typeof env[name] !== 'string' || env[name].trim() === '');
}
