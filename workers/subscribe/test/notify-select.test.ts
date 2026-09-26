import { describe, expect, it } from 'vitest';
import { parsePosts } from '../src/notify/posts.ts';
import type { PostEntry } from '../src/notify/posts.ts';
import { FuseError, MAX_PER_RUN, broadcastName, selectCandidates } from '../src/notify/select.ts';

const NOW = new Date('2026-09-30T14:05:00Z');
const post = (path: string, date: string, title = 'A post'): PostEntry => ({
  url: `https://diyaz.dev${path}`,
  path,
  title,
  description: 'One line about it.',
  date,
});
const OLD = post('/2026/09/23/part-1.html', '2026-09-23T08:00:00+00:00');
const NEW = post('/2026/09/30/part-2.html', '2026-09-30T08:00:00+00:00');
const FUTURE = post('/2026/10/07/part-3.html', '2026-10-07T08:00:00+00:00');

describe('parsePosts', () => {
  it('accepts the shape posts.json produces', () => {
    expect(parsePosts([NEW])).toEqual([NEW]);
  });

  it('decodes the HTML entities Jekyll leaves in excerpts and titles', () => {
    const [entry] = parsePosts([{ ...NEW, title: 'Q&amp;A &#8212; part&nbsp;2', description: 'Tom &amp; Jerry &lt;3 &quot;hi&quot; &#39;x&#x27;' }]);
    expect(entry.title).toBe('Q&A \u2014 part\u00a02');
    expect(entry.description).toBe('Tom & Jerry <3 "hi" \'x\'');
  });

  it('rejects anything else', () => {
    expect(() => parsePosts({})).toThrow(/expected an array/);
    expect(() => parsePosts([{ ...NEW, title: '' }])).toThrow(/entry 0 has no title/);
    expect(() => parsePosts([null])).toThrow(/entry 0 has no url/);
  });
});

describe('broadcastName', () => {
  it('is post: plus 12 hex characters of the path hash', async () => {
    expect(await broadcastName(NEW)).toMatch(/^post:[0-9a-f]{12}$/);
    expect(await broadcastName(NEW)).not.toBe(await broadcastName(OLD));
  });
});

describe('selectCandidates', () => {
  it('refuses to run without a valid ANNOUNCE_SINCE', async () => {
    for (const since of [undefined, '', 'not-a-date']) {
      await expect(selectCandidates([NEW], new Map(), { since, now: NOW })).rejects.toThrow(/ANNOUNCE_SINCE/);
    }
  });

  it('skips posts before the cutoff and posts from the future', async () => {
    expect(await selectCandidates([OLD, NEW, FUTURE], new Map(), { since: '2026-09-26', now: NOW })).toEqual([NEW]);
  });

  it('skips posts already announced', async () => {
    const announced = new Map([[await broadcastName(NEW), 'b_1 (sent)']]);
    expect(await selectCandidates([NEW], announced, { since: '2026-09-26', now: NOW })).toEqual([]);
  });

  it('does not announce a post again after it is retitled', async () => {
    const announced = new Map([[await broadcastName(NEW), 'b_1 (sent)']]);
    const retitled = { ...NEW, title: 'A better title' };
    expect(await selectCandidates([retitled], announced, { since: '2026-09-26', now: NOW })).toEqual([]);
  });

  it('reports why each post was skipped', async () => {
    const skipped: string[] = [];
    const announced = new Map([[await broadcastName(NEW), 'b_1 (sent)']]);
    await selectCandidates([OLD, NEW, FUTURE, { ...NEW, path: '/x.html', date: 'soon' }], announced, {
      since: '2026-09-26',
      now: NOW,
      onSkip: (post, reason) => skipped.push(`${post.path}: ${reason}`),
    });
    expect(skipped).toEqual([
      '/2026/09/23/part-1.html: before ANNOUNCE_SINCE',
      '/2026/09/30/part-2.html: already announced as b_1 (sent)',
      '/2026/10/07/part-3.html: dated in the future',
      '/x.html: date is not readable',
    ]);
  });

  it('returns oldest first', async () => {
    const a = post('/2026/09/28/a.html', '2026-09-28T08:00:00+00:00');
    const b = post('/2026/09/29/b.html', '2026-09-29T08:00:00+00:00');
    expect(await selectCandidates([NEW, b, a], new Map(), { since: '2026-09-26', now: NOW })).toEqual([a, b, NEW]);
  });

  it(`allows ${MAX_PER_RUN}, refuses one more`, async () => {
    const many = [27, 28, 29, 30].map((d) => post(`/2026/09/${d}/p.html`, `2026-09-${d}T08:00:00+00:00`));
    await expect(selectCandidates(many.slice(0, 3), new Map(), { since: '2026-09-26', now: NOW })).resolves.toHaveLength(3);
    await expect(selectCandidates(many, new Map(), { since: '2026-09-26', now: NOW })).rejects.toBeInstanceOf(FuseError);
  });
});
