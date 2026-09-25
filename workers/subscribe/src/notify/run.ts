// Orchestrates one notify run. Output (log lines, job summary) is public in
// GitHub Actions: it carries post titles, post URLs, broadcast IDs and
// address-redacted errors, never keys or addresses.
import { FROM } from '../config.ts';
import type { Fetch } from '../env.ts';
import { ResendError } from '../resend.ts';
import type { ResendClient } from '../resend.ts';
import { renderHeadsUpEmail, renderPostEmail, utcTime } from './emails.ts';
import type { PostEntry } from './posts.ts';
import { broadcastName, selectCandidates } from './select.ts';

// How long a broadcast waits before sending: the author's window to cancel.
// The heads-up email and scheduled_at both derive from this one value.
const SEND_DELAY_MS = 2 * 60 * 60 * 1000;
const ADDRESS = /[^\s@()<>,;"'/]+(?:@|%40)[^\s@()<>,;"'/]+/gi;

export function redact(text: string): string {
  return text.replace(ADDRESS, '[redacted]');
}

// Everything the notify script prints lands in public GitHub Actions logs, and
// Resend's error messages can quote an address (e.g. its unverified-domain
// rejection names the account's own address). Node's fetch puts the real
// network reason (ENOTFOUND, ECONNRESET, ...) in err.cause.code.
export function publicErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return redact(String(err));
  let text = err.message;
  if (err instanceof ResendError) text = `Resend HTTP ${err.status}${err.code ? ` ${err.code}` : ''}: ${text}`;
  const cause = err.cause as { code?: unknown } | undefined;
  if (typeof cause?.code === 'string') text += ` [${cause.code}]`;
  return redact(text);
}

export interface NotifyConfig {
  since: string | undefined;
  segmentId: string;
  topicId: string;
  replyTo: string;
  dryRun: boolean;
}

export interface NotifyDeps {
  resend: Pick<ResendClient, 'listBroadcasts' | 'createBroadcast' | 'sendEmail'>;
  fetch: Fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
  log: (line: string) => void;
  summary: (markdown: string) => void;
}

// GitHub Pages can take a minute or two to serve a fresh deploy. Never email
// a link that 404s. The probe parameter keeps a 404 cached at the CDN edge
// (from before the post existed) from answering every attempt.
export async function waitUntilLive(
  url: string,
  deps: Pick<NotifyDeps, 'fetch' | 'sleep' | 'log' | 'now'>,
  attempts = 10,
  intervalMs = 30_000,
): Promise<void> {
  const probe = `${url}${url.includes('?') ? '&' : '?'}probe=${deps.now().getTime()}`;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await deps.fetch(probe, { method: 'GET', redirect: 'follow' });
      if (res.status === 200) return;
      deps.log(`not live yet (${res.status}): ${url}`);
    } catch (err) {
      deps.log(`not reachable yet (${publicErrorMessage(err)}): ${url}`);
    }
    if (i < attempts) await deps.sleep(intervalMs);
  }
  throw new Error(`Post not live after ${attempts} checks: ${url}`);
}

export async function runNotify(
  posts: PostEntry[],
  config: NotifyConfig,
  deps: NotifyDeps,
): Promise<{ scheduled: number }> {
  const broadcasts = await deps.resend.listBroadcasts();
  if (broadcasts.length > 0 && broadcasts.every((b) => !b.name)) {
    // The duplicate check keys on names; without them it would fail open and
    // re-send every recent post on each deploy.
    throw new Error('Resend listed broadcasts without names; refusing to send (cannot tell what was announced)');
  }
  const announced = new Map(
    broadcasts.filter((b) => b.name).map((b) => [b.name as string, `${b.id} (${b.status ?? 'unknown status'})`]),
  );
  const candidates = await selectCandidates(posts, announced, {
    since: config.since,
    now: deps.now(),
    onSkip: (post, reason) => deps.log(`skipped ${post.title}: ${reason}`),
  });
  deps.log(`${candidates.length} post(s) to announce`);
  if (candidates.length === 0) return { scheduled: 0 };

  // Every candidate must be live before the first send, so a half-finished
  // deploy sends nothing rather than some of it.
  for (const post of candidates) await waitUntilLive(post.url, deps);

  if (config.dryRun) {
    for (const post of candidates) {
      deps.log(`[dry run] would announce: ${post.title}`);
      deps.summary(`- [dry run] would announce **${post.title}**`);
    }
    return { scheduled: 0 };
  }

  let scheduled = 0;
  const headsUpFailed: string[] = [];
  for (const post of candidates) {
    const sendAt = new Date(deps.now().getTime() + SEND_DELAY_MS);
    const { id } = await deps.resend.createBroadcast({
      segment_id: config.segmentId,
      topic_id: config.topicId,
      from: FROM,
      reply_to: config.replyTo,
      name: await broadcastName(post),
      ...renderPostEmail(post),
      send: true,
      scheduled_at: sendAt.toISOString(),
    });
    scheduled++;
    // Print the ID before the heads-up send, which can fail: a re-run skips
    // this post (its broadcast name now exists) and won't print it again, so
    // this run's log and summary are the only CI record (Resend's Broadcasts
    // list has it too).
    deps.log(`scheduled: ${post.title} (${id})`);
    deps.summary(`- **${post.title}**: sends ~${utcTime(sendAt)}, broadcast \`${id}\``);
    try {
      await deps.resend.sendEmail({ from: FROM, to: config.replyTo, ...renderHeadsUpEmail(post, sendAt, id) });
    } catch (err) {
      deps.log(`heads-up failed for ${post.title}: ${publicErrorMessage(err)}`);
      headsUpFailed.push(post.title);
    }
  }
  if (headsUpFailed.length > 0) {
    // Broadcasts are scheduled regardless; fail the job so the missing cancel
    // notice is noticed.
    throw new Error(`heads-up email failed for: ${headsUpFailed.join(', ')} (broadcasts are still scheduled; see IDs above)`);
  }
  return { scheduled };
}
