// The Worker's own HTML: the confirm button page and its outcomes. Inline CSS,
// light/dark via prefers-color-scheme, never indexed.
import { SITE_URL, TOKEN_TTL_HOURS } from './config.ts';
import { escapeHtml } from './email/layout.ts';

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} · diyaz.dev</title>
<style>
:root{color-scheme:light dark;--bg:#f2f2f2;--panel:#ffffff;--text:#333333;--muted:#666666;--btn:#2a2521;--btn-text:#ffffff}
@media (prefers-color-scheme:dark){:root{--bg:#1a1a1a;--panel:#2a2a2a;--text:#e5e5e5;--muted:#b0b0b0;--btn:#f5f5f5;--btn-text:#1a1a1a}}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
main{max-width:480px;margin:10vh auto;padding:32px 24px;background:var(--panel);border-radius:12px}
h1{font-size:1.4rem;line-height:1.3;margin:0 0 12px}
p{color:var(--muted)}
a{color:inherit}
button{font:inherit;font-weight:600;padding:12px 20px;border:0;border-radius:8px;background:var(--btn);color:var(--btn-text);cursor:pointer}
</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

// Disabling the button on submit stops a double click sending two POSTs (the
// handler copes with that race too, this just avoids it).
function tokenForm(token: string, label: string): string {
  return `<form method="post" action="/confirm" onsubmit="this.querySelector('button').disabled = true"><input type="hidden" name="t" value="${escapeHtml(token)}"><button type="submit">${label}</button></form>`;
}

export function confirmPage(token: string): string {
  return page(
    'Confirm your subscription',
    `<h1>One more click</h1><p>Confirm that you'd like new posts from diyaz.dev by email.</p>${tokenForm(token, 'Confirm subscription')}`,
  );
}

export function expiredPage(): string {
  return page(
    'Link expired',
    `<h1>This link has expired or isn't valid</h1><p>Confirmation links work for ${TOKEN_TTL_HOURS} hours, and only exactly as they were sent. <a href="${SITE_URL}/subscribe/">Subscribe again</a> and you'll get a fresh one.</p>`,
  );
}

export function retryPage(token: string): string {
  return page(
    'Something went wrong',
    `<h1>That didn't go through</h1><p>Something went wrong on my side while saving your subscription. Your link still works, so try again in a minute.</p>${tokenForm(token, 'Try again')}`,
  );
}

export function errorPage(): string {
  return page(
    'Something went wrong',
    `<h1>Something went wrong</h1><p>Please try again later, or <a href="${SITE_URL}/">go back to diyaz.dev</a>.</p>`,
  );
}
