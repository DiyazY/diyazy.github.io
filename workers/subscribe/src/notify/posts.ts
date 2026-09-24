// One entry of /posts.json (built by Jekyll from posts.json at the repo root).
export interface PostEntry {
  url: string; // absolute
  path: string; // site-relative, e.g. /2026/09/30/Slug.html
  title: string;
  description: string;
  date: string; // ISO 8601
}

const KEYS = ['url', 'path', 'title', 'description', 'date'] as const;

export function parsePosts(data: unknown): PostEntry[] {
  if (!Array.isArray(data)) throw new Error('posts.json: expected an array');
  return data.map((raw: unknown, i) => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    for (const key of KEYS) {
      const value = entry[key];
      if (typeof value !== 'string' || value.trim() === '') throw new Error(`posts.json: entry ${i} has no ${key}`);
    }
    return {
      url: entry.url as string,
      path: entry.path as string,
      title: entry.title as string,
      description: entry.description as string,
      date: entry.date as string,
    };
  });
}
