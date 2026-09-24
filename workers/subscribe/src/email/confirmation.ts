import { SITE_URL } from '../config.ts';
import { button, escapeHtml, renderEmail } from './layout.ts';

export function renderConfirmationEmail(confirmUrl: string): { subject: string; html: string; text: string } {
  const ignore = "If you didn't ask for this, ignore this email: you won't be added.";
  const { html, text } = renderEmail({
    bodyHtml:
      `<p>Hi,</p>` +
      `<p>Someone (hopefully you) asked to get new posts from <a href="${SITE_URL}" style="color:#333333;">diyaz.dev</a> by email. Confirm with one click:</p>` +
      `<p>${button(confirmUrl, 'Confirm subscription')}</p>` +
      `<p style="font-size:14px;color:#666666;">The link works for 48 hours. If the button doesn't work, paste this into your browser:<br>${escapeHtml(confirmUrl)}</p>`,
    bodyText:
      `Hi,\n\nSomeone (hopefully you) asked to get new posts from diyaz.dev by email. Confirm here:\n\n` +
      `${confirmUrl}\n\nThe link works for 48 hours.`,
    footerHtml: escapeHtml(ignore),
    footerText: ignore,
  });
  return { subject: 'Confirm your subscription to diyaz.dev', html, text };
}
