import { describe, expect, it } from 'vitest';
import { configFromEnv } from '../src/notify/config.ts';

const ENV = {
  RESEND_API_KEY: 're_x',
  NOTIFY_REPLY_TO: 'owner@example.net',
  RESEND_SEGMENT_ID: 'seg',
  TOPIC_NEW_POSTS_ID: 'topic',
  ANNOUNCE_SINCE: '2026-09-26',
};

describe('configFromEnv', () => {
  it('reads the notify settings the workflow passes', () => {
    expect(configFromEnv(ENV)).toEqual({
      apiKey: 're_x',
      config: { since: '2026-09-26', segmentId: 'seg', topicId: 'topic', replyTo: 'owner@example.net', dryRun: false },
    });
  });

  it("treats only DRY_RUN='1' as a dry run, matching the workflow's `inputs.dry_run && '1' || ''`", () => {
    expect(configFromEnv({ ...ENV, DRY_RUN: '1' }).config.dryRun).toBe(true);
    expect(configFromEnv({ ...ENV, DRY_RUN: '' }).config.dryRun).toBe(false);
    expect(configFromEnv({ ...ENV, DRY_RUN: 'true' }).config.dryRun).toBe(false);
  });

  it('names every missing variable, without printing any values', () => {
    expect(() => configFromEnv({ ANNOUNCE_SINCE: 'x' })).toThrow(
      'Missing environment variables: RESEND_API_KEY, NOTIFY_REPLY_TO, RESEND_SEGMENT_ID, TOPIC_NEW_POSTS_ID',
    );
  });

  it('leaves ANNOUNCE_SINCE to selectCandidates, which refuses to guess', () => {
    const { ANNOUNCE_SINCE: _, ...rest } = ENV;
    expect(configFromEnv(rest).config.since).toBeUndefined();
  });
});
