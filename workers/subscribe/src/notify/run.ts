// Orchestrates one notify run. Output (log lines, job summary) is public in
// GitHub Actions, so it carries post titles and broadcast IDs only.
import { FROM } from '../config.ts';
import type { Fetch } from '../env.ts';
import { ResendError } from '../resend.ts';
import type { ResendClient } from '../resend.ts';
import { renderHeadsUpEmail, renderPostEmail } from './emails.ts';
import type { PostEntry } from './posts.ts';
import { broadcastName, selectCandidates } from './select.ts';

const DELAY_MS = 2 * 60 * 60 * 1000; // must match scheduled_at below
const ADDRESS = /[^\s@()<>,;"']+@[^\s@()<>,;"']+/g;

// Everything the notify script prints lands in public GitHub Actions logs, and
// Resend's error messages can quote an address (e.g. its unverified-domain
// rejection names the account's own address).
export function publicErrorMessage(err: unknown): string {
  const text =
    err instanceof ResendError
      ? `Resend HTTP ${err.status}: ${err.message}`
      : err instanceof Error
        ? err.message
        : String(err);
  return text.replace(ADDRESS, '[redacted]');
}

export interface NotifyConfig {
  since: string | undefined;
  segmentId: string;
  topicId: string;
  replyTo: string;
  dryRun: boolean;
}

export interface NotifyDeps {
  resend: ResendClient;
  fetch: Fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
  log: (line: string) => void;
  summary: (markdown: string) => void;
}

// GitHub Pages can take a minute or two to serve a fresh deploy. Never email
// a link that 404s.
export async function waitUntilLive(
  url: string,
  deps: Pick<NotifyDeps, 'fetch' | 'sleep' | 'log'>,
  attempts = 10,
  intervalMs = 30_000,
): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await deps.fetch(url, { method: 'GET', redirect: 'follow' });
      if (res.status === 200) return;
      deps.log(`not live yet (${res.status}): ${url}`);
    } catch {
      deps.log(`not reachable yet: ${url}`);
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
  const announced = new Set((await deps.resend.listBroadcasts()).map((b) => b.name ?? ''));
  const candidates = await selectCandidates(posts, announced, { since: config.since, now: deps.now() });
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
    const { id } = await deps.resend.createBroadcast({
      segment_id: config.segmentId,
      topic_id: config.topicId,
      from: FROM,
      reply_to: config.replyTo,
      name: await broadcastName(post),
      ...renderPostEmail(post),
      send: true,
      scheduled_at: 'in 2 hours',
    });
    scheduled++;
    // Record the broadcast before anything else can fail: a re-run skips this
    // post (its name now exists), so this line is the only place its ID shows.
    const sendAt = new Date(deps.now().getTime() + DELAY_MS);
    deps.log(`scheduled: ${post.title} (${id})`);
    deps.summary(`- **${post.title}**: sends ~${sendAt.toISOString().slice(11, 16)} UTC, broadcast \`${id}\``);
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
