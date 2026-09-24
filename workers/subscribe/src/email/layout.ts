// One look for every email: plain, text-first, no images (no remote loads,
// so nothing that works like open tracking).

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;background:#2a2521;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">${escapeHtml(label)}</a>`;
}

export interface EmailParts {
  bodyHtml: string;
  bodyText: string;
  footerHtml: string;
  footerText: string;
}

export function renderEmail(parts: EmailParts): { html: string; text: string } {
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f2f2f2;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.6;">
${parts.bodyHtml}
<hr style="border:none;border-top:1px solid #e8e8e8;margin:32px 0 16px;">
<div style="font-size:13px;line-height:1.5;color:#888888;">${parts.footerHtml}</div>
</div>
</body>
</html>`;
  return { html, text: `${parts.bodyText}\n\n--\n${parts.footerText}\n` };
}
