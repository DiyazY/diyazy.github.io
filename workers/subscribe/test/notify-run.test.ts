import { describe, expect, it } from 'vitest';
import { publicErrorMessage, runNotify } from '../src/notify/run.ts';
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

function fakeResend(existingNames: string[] = []) {
  const broadcasts: BroadcastInput[] = [];
  const emails: EmailInput[] = [];
  const client: ResendClient = {
    listBroadcasts: async () => existingNames.map((name, i) => ({ id: `b_old_${i}`, name })),
    createBroadcast: async (input) => {
      broadcasts.push(input);
      return { id: `b_${broadcasts.length}` };
    },
    sendEmail: async (input) => {
      emails.push(input);
      return { id: `e_${emails.length}` };
    },
    getContact: async () => null,
    createContact: async () => ({ id: 'unused' }),
    updateContact: async () => {},
    addContactToSegment: async () => {},
    updateContactTopics: async () => {},
  };
  return { client, broadcasts, emails };
}

function setup(options: { existing?: string[]; status?: (url: string) => number } = {}) {
  const resend = fakeResend(options.existing);
  const site = fakeFetch((call) => new Response('', { status: options.status ? options.status(call.url) : 200 }));
  const logs: string[] = [];
  const summary: string[] = [];
  const deps = {
    resend: resend.client,
    fetch: site.fetch,
    sleep: async () => {},
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
    expect(s.siteCalls.map((c) => c.url)).toEqual([post(30).url]);
    expect(s.broadcasts).toHaveLength(1);
    expect(s.broadcasts[0]).toMatchObject({
      segment_id: 'seg_readers',
      topic_id: 'topic_posts',
      from: FROM,
      reply_to: 'owner@example.net',
      subject: 'Post 30',
      name: await broadcastName(post(30)),
      send: true,
      scheduled_at: 'in 2 hours',
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

  it('redacts addresses in any other error', () => {
    expect(publicErrorMessage(new Error('bad reader+x@example.com here'))).toBe('bad [redacted] here');
    expect(publicErrorMessage('plain a@b.co')).toBe('plain [redacted]');
  });
});
