import { button, escapeHtml, renderEmail } from '../email/layout.ts';
import type { PostEntry } from './posts.ts';

export function postLink(post: PostEntry): string {
  const slug = (post.path.split('/').filter(Boolean).pop() ?? 'post').replace(/\.html$/, '');
  const url = new URL(post.url);
  url.searchParams.set('utm_source', 'newsletter');
  url.searchParams.set('utm_medium', 'email');
  url.searchParams.set('utm_campaign', slug);
  return url.toString();
}

export function renderPostEmail(post: PostEntry): { subject: string; html: string; text: string } {
  const link = postLink(post);
  const why = "You're getting this because you subscribed on diyaz.dev. Just hit reply to reach me.";
  const { html, text } = renderEmail({
    bodyHtml:
      `<p style="margin:0 0 8px;font-size:13px;color:#888888;">New on diyaz.dev</p>` +
      `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${escapeHtml(post.title)}</h1>` +
      `<p>${escapeHtml(post.description)}</p>` +
      `<p>${button(link, 'Read it on diyaz.dev →')}</p>`,
    bodyText: `New on diyaz.dev\n\n${post.title}\n\n${post.description}\n\nRead it: ${link}`,
    footerHtml: `${escapeHtml(why)}<br><a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#888888;">Choose what you get, or unsubscribe</a>`,
    footerText: `${why}\nChoose what you get, or unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}`,
  });
  return { subject: post.title, html, text };
}

export function renderHeadsUpEmail(
  post: PostEntry,
  sendAt: Date,
  broadcastId: string,
): { subject: string; html: string; text: string } {
  const when = `${sendAt.toISOString().slice(11, 16)} UTC`;
  const note = 'Sent by the notify job in DiyazY/diyazy.github.io.';
  const { html, text } = renderEmail({
    bodyHtml:
      `<p>The email for <strong>${escapeHtml(post.title)}</strong> goes to subscribers at about <strong>${when}</strong>.</p>` +
      `<p>To stop it, open <a href="https://resend.com/broadcasts">Resend → Broadcasts</a> in the diyaz.dev team and cancel broadcast <code>${escapeHtml(broadcastId)}</code>.</p>`,
    bodyText:
      `The email for "${post.title}" goes to subscribers at about ${when}.\n\n` +
      `To stop it, open https://resend.com/broadcasts in the diyaz.dev team and cancel broadcast ${broadcastId}.`,
    footerHtml: escapeHtml(note),
    footerText: note,
  });
  return { subject: `Scheduled ~${when}: ${post.title}`, html, text };
}
