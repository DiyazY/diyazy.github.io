// Confirmation tokens: AES-GCM authenticated encryption of
// { email, programmes, exp }, serialised as base64url(iv || ciphertext).
// Encryption (not just a signature) keeps the address unreadable in URLs that
// land in logs, browser history or link scanners; GCM's tag rejects tampering.

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
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function importKey(base64Key: string): Promise<CryptoKey> {
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  } catch {
    throw new Error('TOKEN_KEY must be 32 bytes (base64)');
  }
  if (raw.length !== 32) throw new Error('TOKEN_KEY must be 32 bytes (base64)');
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

// null for anything that isn't a token we issued with this key. Expiry is the
// caller's job (it owns the clock).
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
