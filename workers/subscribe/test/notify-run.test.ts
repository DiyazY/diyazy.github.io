import { describe, expect, it } from 'vitest';
import { publicErrorMessage, redact, runNotify } from '../src/notify/run.ts';
import type { NotifyConfig } from '../src/notify/run.ts';
import type { PostEntry } from '../src/notify/posts.ts';
import { broadcastName } from '../src/notify/select.ts';
import { ResendError } from '../src/resend.ts';
import type { BroadcastInput, EmailInput, ResendClient } from '../src/resend.ts';
import { FROM } from '../src/config.ts';
import { fakeFetch } from './helpers.ts';

const NOW = new Date('2026-09-30T14:05:00Z');
const CONFIG: NotifyConfig = {
  since: '2026-09-26',
  segmentId: 'seg_readers',
  topicId: 'topic_posts',
  replyTo: 'owner@example.net',
  dryRun: false,
};
const post = (day: number): PostEntry => ({
  url: `https://diyaz.dev/2026/09/${day}/p${day}.html`,
  path: `/2026/09/${day}/p${day}.html`,
  title: `Post ${day}`,
  description: `About post ${day}.`,
  date: `2026-09-${day}T08:00:00+00:00`,
});

function fakeResend(existingNames: (string | null)[] = []) {
  const broadcasts: BroadcastInput[] = [];
  const emails: EmailInput[] = [];
  const client: Pick<ResendClient, 'listBroadcasts' | 'createBroadcast' | 'sendEmail'> = {
    listBroadcasts: async () => existingNames.map((name, i) => ({ id: `b_old_${i}`, name, status: 'sent' })),
    createBroadcast: async (input) => {
      broadcasts.push(input);
      return { id: `b_${broadcasts.length}` };
    },
    sendEmail: async (input) => {
      emails.push(input);
      return { id: `e_${emails.length}` };
    },
  };
  return { client, broadcasts, emails };
}

function setup(options: { existing?: (string | null)[]; status?: (url: string) => number } = {}) {
  const resend = fakeResend(options.existing);
  const site = fakeFetch((call) => new Response('', { status: options.status ? options.status(call.url) : 200 }));
  const logs: string[] = [];
  const summary: string[] = [];
  const deps = {
    resend: resend.client,
    fetch: site.fetch,
    sleep: async (_ms: number) => {},
    now: () => NOW,
    log: (line: string) => {
      logs.push(line);
    },
    summary: (md: string) => {
      summary.push(md);
    },
  };
  return { ...resend, deps, siteCalls: site.calls, logs, summary };
}

describe('runNotify', () => {
  it('does nothing when no post is new', async () => {
    const s = setup({ existing: [await broadcastName(post(30))] });
    expect(await runNotify([post(30)], CONFIG, s.deps)).toEqual({ scheduled: 0 });
    expect(s.siteCalls).toHaveLength(0);
    expect(s.broadcasts).toHaveLength(0);
  });

  it('checks the post is live, schedules one broadcast, and sends a heads-up', async () => {
    const s = setup();
    expect(await runNotify([post(30)], CONFIG, s.deps)).toEqual({ scheduled: 1 });
    expect(s.siteCalls.map((c) => c.url)).toEqual([`${post(30).url}?probe=${NOW.getTime()}`]);
    expect(s.broadcasts).toHaveLength(1);
    expect(s.broadcasts[0]).toMatchObject({
      segment_id: 'seg_readers',
      topic_id: 'topic_posts',
      from: FROM,
      reply_to: 'owner@example.net',
      subject: 'Post 30',
      name: await broadcastName(post(30)),
      send: true,
      scheduled_at: '2026-09-30T16:05:00.000Z',
    });
    expect(s.emails).toHaveLength(1);
    expect(s.emails[0]).toMatchObject({ from: FROM, to: 'owner@example.net', subject: 'Scheduled ~16:05 UTC: Post 30' });
    expect(s.summary.join('\n')).toContain('Post 30');
  });

  it('in a dry run, checks and reports but sends nothing', async () => {
    const s = setup();
    expect(await runNotify([post(30)], { ...CONFIG, dryRun: true }, s.deps)).toEqual({ scheduled: 0 });
    expect(s.siteCalls).toHaveLength(1);
    expect(s.broadcasts).toHaveLength(0);
    expect(s.emails).toHaveLength(0);
    expect(s.logs.join('\n')).toContain('[dry run] would announce: Post 30');
  });

  it('fails without sending when a post never goes live', async () => {
    const s = setup({ status: () => 404 });
    await expect(runNotify([post(30)], CONFIG, s.deps)).rejects.toThrow(/not live/);
    expect(s.siteCalls).toHaveLength(10);
    expect(s.broadcasts).toHaveLength(0);
  });

  it('checks every candidate is live before sending any', async () => {
    const s = setup({ status: (url) => (url === post(29).url ? 200 : 404) });
    await expect(runNotify([post(29), post(30)], CONFIG, s.deps)).rejects.toThrow(/not live/);
    expect(s.broadcasts).toHaveLength(0);
  });

  it('propagates the missing-ANNOUNCE_SINCE refusal', async () => {
    const s = setup();
    await expect(runNotify([post(30)], { ...CONFIG, since: undefined }, s.deps)).rejects.toThrow(/ANNOUNCE_SINCE/);
    expect(s.broadcasts).toHaveLength(0);
  });

  it('records a scheduled broadcast even when its heads-up fails, and fails the run at the end', async () => {
    const s = setup();
    s.deps.resend.sendEmail = async () => {
      throw new ResendError(500, 'heads-up boom');
    };
    await expect(runNotify([post(29), post(30)], CONFIG, s.deps)).rejects.toThrow(/heads-up email failed for: Post 29, Post 30/);
    expect(s.broadcasts).toHaveLength(2); // one failed heads-up doesn't stop the next post
    expect(s.logs.join('\n')).toContain('scheduled: Post 29 (b_1)');
    expect(s.summary.join('\n')).toContain('b_2');
  });

  it('refuses to send when existing broadcasts carry no names (the duplicate check would fail open)', async () => {
    const s = setup({ existing: [null, null] });
    await expect(runNotify([post(30)], CONFIG, s.deps)).rejects.toThrow(/without names/);
    expect(s.broadcasts).toHaveLength(0);
  });

  it('logs why posts were skipped', async () => {
    const s = setup({ existing: [await broadcastName(post(30))] });
    await runNotify([post(23), post(30)], CONFIG, s.deps);
    expect(s.logs).toContain('skipped Post 23: before ANNOUNCE_SINCE');
    expect(s.logs).toContain('skipped Post 30: already announced as b_old_0 (sent)');
  });

  it('propagates a failed broadcast after recording the ones already scheduled', async () => {
    const s = setup();
    let n = 0;
    const create = s.deps.resend.createBroadcast;
    s.deps.resend.createBroadcast = async (input) => {
      if (++n === 2) throw new ResendError(422, 'bad broadcast', 'validation_error');
      return create(input);
    };
    await expect(runNotify([post(29), post(30)], CONFIG, s.deps)).rejects.toMatchObject({ status: 422 });
    expect(s.logs.join('\n')).toContain('scheduled: Post 29 (b_1)');
  });

  it('redacts an address quoted in a heads-up failure', async () => {
    const s = setup();
    s.deps.resend.sendEmail = async () => {
      throw new ResendError(403, 'You can only send testing emails to your own email address (owner@example.net).');
    };
    await expect(runNotify([post(30)], CONFIG, s.deps)).rejects.toThrow(/heads-up/);
    expect([...s.logs, ...s.summary].join('\n')).not.toContain('@');
  });

  it('probes every 30 s and logs why a probe failed', async () => {
    const s = setup();
    const sleeps: number[] = [];
    s.deps.sleep = async (ms: number) => {
      sleeps.push(ms);
    };
    s.deps.fetch = async () => {
      throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
    };
    await expect(runNotify([post(30)], CONFIG, s.deps)).rejects.toThrow(/not live/);
    expect(sleeps).toEqual(Array(9).fill(30_000));
    expect(s.logs).toContain(`not reachable yet (fetch failed [ENOTFOUND]): ${post(30).url}`);
  });

  it('never puts the reply-to address in logs or the summary', async () => {
    const s = setup();
    await runNotify([post(30)], CONFIG, s.deps);
    expect([...s.logs, ...s.summary].join('\n')).not.toContain('owner@example.net');
  });
});

describe('publicErrorMessage', () => {
  it('reports Resend errors by status and redacts any address in the message', () => {
    const err = new ResendError(403, 'You can only send testing emails to your own email address (owner@example.net).');
    expect(publicErrorMessage(err)).toBe(
      'Resend HTTP 403: You can only send testing emails to your own email address ([redacted]).',
    );
  });

  it('redacts URL-encoded addresses and keeps the cause code', () => {
    expect(publicErrorMessage(new Error('GET /contacts/reader%40example.com failed'))).toBe('GET /contacts/[redacted] failed');
    expect(publicErrorMessage(new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } }))).toBe('fetch failed [ECONNRESET]');
    expect(redact('at x (/a/b.ts:1) owner@example.net')).toBe('at x (/a/b.ts:1) [redacted]');
  });

  it('redacts addresses in any other error', () => {
    expect(publicErrorMessage(new Error('bad reader+x@example.com here'))).toBe('bad [redacted] here');
    expect(publicErrorMessage('plain a@b.co')).toBe('plain [redacted]');
  });
});
