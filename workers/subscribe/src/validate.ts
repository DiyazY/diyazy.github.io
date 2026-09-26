// Deliberately loose: the confirmation email is the real validation. This
// rejects input that can't be a plain mailbox (display names like
// `"a" <x@y>`, lists, quoting, IP literals, empty labels) and lowercases the
// rest, which the rate-limit key, the token and the Resend contact all rely on.
const ATOM = /^[^\s@<>()[\],;:"\\]+$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  const at = email.lastIndexOf('@');
  if (at <= 0 || at !== email.indexOf('@')) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!ATOM.test(local) || !ATOM.test(domain)) return null;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some((label) => label === '')) return null;
  return email;
}
