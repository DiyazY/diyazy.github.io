import { describe, expect, it } from 'vitest';
import { escapeHtml, renderEmail } from '../src/email/layout.ts';
import { renderConfirmationEmail } from '../src/email/confirmation.ts';
import { confirmPage, errorPage, expiredPage, retryPage } from '../src/pages.ts';

const URL_ = 'https://subscribe.diyaz.dev/confirm?t=abc_DEF-123';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">Q&A 'n'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Q&amp;A &#39;n&#39;&lt;/a&gt;');
  });
});

describe('renderEmail', () => {
  it('wraps body and footer in both parts, with no images', () => {
    const { html, text } = renderEmail({ bodyHtml: '<p>Body</p>', bodyText: 'Body', footerHtml: 'Foot', footerText: 'Foot' });
    expect(html).toContain('<p>Body</p>');
    expect(html).toContain('Foot');
    expect(html).not.toMatch(/<img/i);
    expect(text).toBe('Body\n\n--\nFoot\n');
  });
});

describe('renderConfirmationEmail', () => {
  it('carries the confirm link in both parts and says how long it lasts', () => {
    const email = renderConfirmationEmail(URL_);
    expect(email.subject).toBe('Confirm your subscription to diyaz.dev');
    expect(email.html).toContain(`href="${URL_}"`);
    expect(email.text).toContain(URL_);
    expect(email.text).toContain('48 hours');
  });

  it('has no unsubscribe placeholder (it is transactional, not a broadcast)', () => {
    const email = renderConfirmationEmail(URL_);
    expect(email.html + email.text).not.toContain('RESEND_UNSUBSCRIBE_URL');
  });
});

describe('pages', () => {
  const all = { confirm: confirmPage('tok'), expired: expiredPage(), retry: retryPage('tok'), error: errorPage() };

  it('each has exactly one h1 and is not indexed', () => {
    for (const html of Object.values(all)) {
      expect(html.match(/<h1/g)).toHaveLength(1);
      expect(html).toContain('<meta name="robots" content="noindex">');
    }
  });

  it('confirm page POSTs the token back', () => {
    expect(all.confirm).toContain('<form method="post" action="/confirm">');
    expect(all.confirm).toContain('<input type="hidden" name="t" value="tok">');
  });

  it('escapes the token it echoes', () => {
    expect(confirmPage('"><script>')).toContain('value="&quot;&gt;&lt;script&gt;"');
    expect(retryPage('"><script>')).toContain('value="&quot;&gt;&lt;script&gt;"');
  });

  it('expired page links back to the form', () => {
    expect(all.expired).toContain('href="https://diyaz.dev/subscribe/"');
  });

  it('retry page resubmits the same token', () => {
    expect(all.retry).toContain('<input type="hidden" name="t" value="tok">');
  });
});
