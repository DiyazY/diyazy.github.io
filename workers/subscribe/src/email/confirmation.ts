import { SITE_URL, TOKEN_TTL_HOURS } from '../config.ts';
import { button, escapeHtml, renderEmail } from './layout.ts';
import type { RenderedEmail } from './layout.ts';

// The double-opt-in email is the consent record, so it restates exactly what
// the reader asked for, including the Programmes box when it was ticked.
export function renderConfirmationEmail(confirmUrl: string, programmes: boolean): RenderedEmail {
  const ignore = "If you didn't ask for this, ignore this email: you won't be added.";
  const what = programmes
    ? 'new posts from diyaz.dev by email, plus occasional news about my coaching programmes'
    : 'new posts from diyaz.dev by email';
  const { html, text } = renderEmail({
    bodyHtml:
      `<p>Hi,</p>` +
      `<p>Someone (hopefully you) asked to get ${escapeHtml(what).replace('diyaz.dev', `<a href="${SITE_URL}" style="color:#333333;">diyaz.dev</a>`)}. Confirm with one click:</p>` +
      `<p>${button(confirmUrl, 'Confirm subscription')}</p>` +
      `<p style="font-size:14px;color:#666666;">The link works for ${TOKEN_TTL_HOURS} hours. If the button doesn't work, paste this into your browser:<br>${escapeHtml(confirmUrl)}</p>`,
    bodyText:
      `Hi,\n\nSomeone (hopefully you) asked to get ${what}. Confirm here:\n\n` +
      `${confirmUrl}\n\nThe link works for ${TOKEN_TTL_HOURS} hours.`,
    footerHtml: escapeHtml(ignore),
    footerText: ignore,
  });
  return { subject: 'Confirm your subscription to diyaz.dev', html, text };
}
