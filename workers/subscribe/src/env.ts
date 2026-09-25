// Everything the Worker reads from its environment, plus the side-effecting
// functions handlers receive as `deps` so tests can replace them.
import { isValidTokenKey } from './token.ts';

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

// Log lines are fixed-vocabulary: where it happened, the status, and a code
// (an error class, a Resend error name, a Siteverify code, a request origin).
// Never an email address, a token, or a free-text error message.
export interface LogEntry {
  step: string;
  status: number;
  call?: string;
  reason?: string;
}

export interface Deps {
  fetch: Fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  log: (entry: LogEntry) => void;
}

export function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

type StringSetting = { [K in keyof Env]: Env[K] extends string ? K : never }[keyof Env];

// A Record over every string key of Env: adding a setting to Env without
// listing it here is a compile error, so no setting can be silently unchecked.
const REQUIRED: Record<StringSetting, true> = {
  ALLOWED_ORIGINS: true,
  RESEND_SEGMENT_ID: true,
  TOPIC_NEW_POSTS_ID: true,
  TOPIC_PROGRAMMES_ID: true,
  RESEND_API_KEY: true,
  TOKEN_KEY: true,
  TURNSTILE_SECRET: true,
  REPLY_TO: true,
};

function isBareOrigin(origin: string): boolean {
  try {
    return new URL(origin).origin === origin;
  } catch {
    return false;
  }
}

// Names of settings that are unset, blank or malformed. Handlers fail closed
// (and log the step) on any of these rather than half-working or throwing
// mid-request.
export function configProblems(env: Env): string[] {
  const problems: string[] = (Object.keys(REQUIRED) as StringSetting[]).filter(
    (name) => typeof env[name] !== 'string' || env[name].trim() === '',
  );
  if (!problems.includes('TOKEN_KEY') && !isValidTokenKey(env.TOKEN_KEY)) problems.push('TOKEN_KEY');
  if (!problems.includes('ALLOWED_ORIGINS') && !allowedOrigins(env).every(isBareOrigin)) problems.push('ALLOWED_ORIGINS');
  for (const binding of ['RL_IP', 'RL_EMAIL'] as const) {
    if (typeof env[binding]?.limit !== 'function') problems.push(binding);
  }
  return problems;
}
