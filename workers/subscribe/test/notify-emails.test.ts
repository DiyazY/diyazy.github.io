import { describe, expect, it } from 'vitest';
import type { PostEntry } from '../src/notify/posts.ts';
import { postLink, renderHeadsUpEmail, renderPostEmail } from '../src/notify/emails.ts';

const POST: PostEntry = {
  url: 'https://diyaz.dev/2026/09/30/After-the-Feed-Part-2.html',
  path: '/2026/09/30/After-the-Feed-Part-2.html',
  title: 'After the Feed | How the last three takeovers happened',
  description: 'WhatsApp, Instagram and Telegram each caught an overlooked shift.',
  date: '2026-09-30T08:00:00+00:00',
};
const LINK =
  'https://diyaz.dev/2026/09/30/After-the-Feed-Part-2.html?utm_source=newsletter&utm_medium=email&utm_campaign=After-the-Feed-Part-2';

describe('renderPostEmail', () => {
  it('links to the post with newsletter UTM tags', () => {
    expect(postLink(POST)).toBe(LINK);
  });

  it('uses the title as subject and carries description and link in both parts', () => {
    const email = renderPostEmail(POST);
    expect(email.subject).toBe(POST.title);
    expect(email.text).toContain(POST.description);
    expect(email.text).toContain(LINK);
    expect(email.html).toContain(`href="${LINK.replace(/&/g, '&amp;')}"`);
  });

  it('includes the unsubscribe placeholder in both parts', () => {
    const email = renderPostEmail(POST);
    expect(email.html).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}');
    expect(email.text).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}');
  });

  it('has no images', () => {
    expect(renderPostEmail(POST).html).not.toMatch(/<img/i);
  });

  it('escapes titles and descriptions in HTML but keeps them verbatim in subject and text', () => {
    const tricky = { ...POST, title: 'Q&A | <draft> "quotes"', description: 'Tom & Jerry <3' };
    const email = renderPostEmail(tricky);
    expect(email.subject).toBe('Q&A | <draft> "quotes"');
    expect(email.text).toContain('Q&A | <draft> "quotes"');
    expect(email.html).toContain('Q&amp;A | &lt;draft&gt; &quot;quotes&quot;');
    expect(email.html).toContain('Tom &amp; Jerry &lt;3');
    expect(email.html).not.toContain('<draft>');
  });
});

describe('renderHeadsUpEmail', () => {
  it('names the post, the UTC send time and the broadcast id', () => {
    const email = renderHeadsUpEmail(POST, new Date('2026-09-30T16:05:00Z'), 'b_123');
    expect(email.subject).toBe(`Scheduled ~16:05 UTC: ${POST.title}`);
    expect(email.text).toContain('b_123');
    expect(email.text).toContain('https://resend.com/broadcasts');
    expect(email.html).not.toContain('RESEND_UNSUBSCRIBE_URL');
  });
});
