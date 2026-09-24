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

export async function selectCandidates(
  posts: PostEntry[],
  announced: ReadonlySet<string>,
  options: { since: string | undefined; now: Date },
): Promise<PostEntry[]> {
  const since = options.since ? Date.parse(options.since) : Number.NaN;
  if (Number.isNaN(since)) {
    throw new Error('ANNOUNCE_SINCE is not set to a valid date; refusing to guess which posts are new');
  }
  const now = options.now.getTime();

  const fresh: PostEntry[] = [];
  for (const post of posts) {
    const published = Date.parse(post.date);
    if (Number.isNaN(published) || published < since || published > now) continue;
    if (announced.has(await broadcastName(post))) continue;
    fresh.push(post);
  }
  fresh.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  if (fresh.length > MAX_PER_RUN) {
    throw new FuseError(`${fresh.length} posts qualify (max ${MAX_PER_RUN}); refusing to send. Check ANNOUNCE_SINCE.`);
  }
  return fresh;
}
