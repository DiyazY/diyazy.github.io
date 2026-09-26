// Which posts to announce this run. Two guards: the broadcast name makes
// re-runs safe; the fuse catches logic mistakes before anything is sent.
import { sha256Hex } from '../hash.ts';
import type { PostEntry } from './posts.ts';

export const MAX_PER_RUN = 3;

export class FuseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FuseError';
  }
}

// Keyed on the path (not the title) so a retitled post is not re-sent, and
// hashed so the name stays short whatever Resend's name length limit is.
export async function broadcastName(post: PostEntry): Promise<string> {
  return `post:${(await sha256Hex(post.path)).slice(0, 12)}`;
}

// `announced` maps broadcast name → a label for the log (e.g. "b_1 (sent)").
// Every skipped post is reported through onSkip, so a green run that sends
// nothing still says why.
export async function selectCandidates(
  posts: PostEntry[],
  announced: ReadonlyMap<string, string>,
  options: { since: string | undefined; now: Date; onSkip?: (post: PostEntry, reason: string) => void },
): Promise<PostEntry[]> {
  const since = options.since ? Date.parse(options.since) : Number.NaN;
  if (Number.isNaN(since)) {
    throw new Error('ANNOUNCE_SINCE is not set to a valid date; refusing to guess which posts are new');
  }
  const now = options.now.getTime();

  const skip = (post: PostEntry, reason: string) => options.onSkip?.(post, reason);
  const fresh: PostEntry[] = [];
  for (const post of posts) {
    const published = Date.parse(post.date);
    if (Number.isNaN(published)) {
      skip(post, 'date is not readable');
      continue;
    }
    if (published < since) {
      skip(post, 'before ANNOUNCE_SINCE');
      continue;
    }
    if (published > now) {
      skip(post, 'dated in the future');
      continue;
    }
    const earlier = announced.get(await broadcastName(post));
    if (earlier !== undefined) {
      skip(post, `already announced as ${earlier}`);
      continue;
    }
    fresh.push(post);
  }
  fresh.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  if (fresh.length > MAX_PER_RUN) {
    throw new FuseError(`${fresh.length} posts qualify (max ${MAX_PER_RUN}); refusing to send. Check ANNOUNCE_SINCE.`);
  }
  return fresh;
}
