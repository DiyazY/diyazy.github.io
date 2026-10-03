import { describe, expect, it } from 'vitest';
import { allowedOrigins, configProblems } from '../src/env.ts';
import type { Env } from '../src/env.ts';
import { makeEnv } from './helpers.ts';

describe('configProblems', () => {
  it('is empty for a complete configuration', () => {
    expect(configProblems(makeEnv())).toEqual([]);
  });

  it('names blank settings', () => {
    expect(configProblems(makeEnv({ RESEND_SEGMENT_ID: ' ', REPLY_TO: '' }))).toEqual(['RESEND_SEGMENT_ID', 'REPLY_TO']);
  });

  it('rejects a TOKEN_KEY that is not 32 bytes of base64', () => {
    expect(configProblems(makeEnv({ TOKEN_KEY: 'a'.repeat(64) }))).toEqual(['TOKEN_KEY']);
  });

  it('rejects ALLOWED_ORIGINS entries that are not bare origins', () => {
    expect(configProblems(makeEnv({ ALLOWED_ORIGINS: 'diyaz.dev' }))).toEqual(['ALLOWED_ORIGINS']);
    expect(configProblems(makeEnv({ ALLOWED_ORIGINS: 'https://diyaz.dev/path' }))).toEqual(['ALLOWED_ORIGINS']);
    expect(configProblems(makeEnv({ ALLOWED_ORIGINS: 'https://diyaz.dev/' }))).toEqual([]);
  });

  it('names a missing rate-limit binding', () => {
    const env = makeEnv() as Partial<Env>;
    delete env.RL_IP;
    expect(configProblems(env as Env)).toEqual(['RL_IP']);
  });
});

describe('allowedOrigins', () => {
  it('trims entries and drops trailing slashes', () => {
    expect(allowedOrigins(makeEnv({ ALLOWED_ORIGINS: ' https://diyaz.dev/ , http://localhost:4000' }))).toEqual([
      'https://diyaz.dev',
      'http://localhost:4000',
    ]);
  });
});
