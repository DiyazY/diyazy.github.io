// Orchestrates one notify run. Output (log lines, job summary) is public in
// GitHub Actions, so it carries post titles and broadcast IDs only.
import { FROM } from '../config.ts';
import type { Fetch } from '../env.ts';
import type { ResendClient } from '../resend.ts';
import { renderHeadsUpEmail, renderPostEmail } from './emails.ts';
import type { PostEntry } from './posts.ts';
import { broadcastName, selectCandidates } from './select.ts';

const DELAY_MS = 2 * 60 * 60 * 1000; // must match scheduled_at below

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
    const sendAt = new Date(deps.now().getTime() + DELAY_MS);
    await deps.resend.sendEmail({ from: FROM, to: config.replyTo, ...renderHeadsUpEmail(post, sendAt, id) });
    deps.log(`scheduled: ${post.title} (${id})`);
    deps.summary(`- **${post.title}**: sends ~${sendAt.toISOString().slice(11, 16)} UTC, broadcast \`${id}\``);
    scheduled++;
  }
  return { scheduled };
}
