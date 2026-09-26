// One entry of /posts.json (built by Jekyll from posts.json at the repo root).
export interface PostEntry {
  url: string; // absolute
  path: string; // site-relative, e.g. /2026/09/30/Slug.html
  title: string;
  description: string;
  date: string; // ISO 8601
}

const KEYS = ['url', 'path', 'title', 'description', 'date'] as const;

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

// posts.json falls back to the excerpt, which kramdown has already HTML-encoded
// and strip_html leaves encoded. Decode once here so emails don't show "&amp;"
// (their HTML part escapes again on the way out).
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return NAMED[body.toLowerCase()] ?? entity;
  });
}

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
      title: decodeEntities(entry.title as string),
      description: decodeEntities(entry.description as string),
      date: entry.date as string,
    };
  });
}
