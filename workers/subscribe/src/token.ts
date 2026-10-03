// Confirmation tokens: AES-GCM authenticated encryption of
// { email, programmes, exp }, serialised as base64url(iv || ciphertext).
// Encryption (not just a signature) keeps the address unreadable in URLs that
// land in logs, browser history or link scanners; GCM's tag rejects tampering.
// Handlers use issueToken/readToken, which own the expiry rule.
import { TOKEN_TTL_MS } from './config.ts';

export interface TokenPayload {
  email: string;
  programmes: boolean;
  exp: number; // epoch ms
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  try {
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function decodeKey(base64Key: string): Uint8Array<ArrayBuffer> | null {
  try {
    const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
    return raw.length === 32 ? raw : null;
  } catch {
    return null;
  }
}

// Synchronous check used by configProblems(), so a bad key fails closed with
// a logged config error instead of throwing mid-request.
export function isValidTokenKey(base64Key: string): boolean {
  return decodeKey(base64Key) !== null;
}

async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = decodeKey(base64Key);
  if (!raw) throw new Error('TOKEN_KEY must be 32 bytes (base64)');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptToken(payload: TokenPayload, base64Key: string): Promise<string> {
  const key = await importKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plain = new TextEncoder().encode(
    JSON.stringify({ e: payload.email, p: payload.programmes ? 1 : 0, x: payload.exp }),
  );
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  const out = new Uint8Array(IV_BYTES + cipher.length);
  out.set(iv);
  out.set(cipher, IV_BYTES);
  return toBase64Url(out);
}

// null for anything that isn't a token we issued with this key; throws only if
// the key itself is malformed. Expiry is checked by readToken.
export async function decryptToken(token: string, base64Key: string): Promise<TokenPayload | null> {
  const key = await importKey(base64Key);
  const bytes = fromBase64Url(token);
  if (!bytes || bytes.length <= IV_BYTES + TAG_BYTES) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES) },
      key,
      bytes.slice(IV_BYTES),
    );
    const data = JSON.parse(new TextDecoder().decode(plain)) as { e?: unknown; p?: unknown; x?: unknown };
    if (typeof data.e !== 'string' || typeof data.x !== 'number') return null;
    return { email: data.e, programmes: data.p === 1, exp: data.x };
  } catch {
    return null;
  }
}

export function issueToken(
  input: { email: string; programmes: boolean },
  base64Key: string,
  now: number,
): Promise<string> {
  return encryptToken({ ...input, exp: now + TOKEN_TTL_MS }, base64Key);
}

export type TokenCheck =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: 'missing' | 'invalid' | 'expired' };

export async function readToken(token: string, base64Key: string, now: number): Promise<TokenCheck> {
  if (!token) return { ok: false, reason: 'missing' };
  const payload = await decryptToken(token, base64Key);
  if (!payload) return { ok: false, reason: 'invalid' };
  if (payload.exp < now) return { ok: false, reason: 'expired' };
  return { ok: true, payload };
}
