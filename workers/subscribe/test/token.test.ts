import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken, isValidTokenKey, issueToken, readToken } from '../src/token.ts';
import { TOKEN_TTL_MS } from '../src/config.ts';

const KEY = Buffer.alloc(32, 7).toString('base64');
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64');
const PAYLOAD = { email: 'reader@example.com', programmes: true, exp: 1_790_000_000_000 };

describe('token', () => {
  it('round-trips the payload', async () => {
    const token = await encryptToken(PAYLOAD, KEY);
    expect(await decryptToken(token, KEY)).toEqual(PAYLOAD);
  });

  it('round-trips programmes=false', async () => {
    const token = await encryptToken({ ...PAYLOAD, programmes: false }, KEY);
    expect(await decryptToken(token, KEY)).toEqual({ ...PAYLOAD, programmes: false });
  });

  it('is URL-safe and does not reveal the address', async () => {
    const token = await encryptToken(PAYLOAD, KEY);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, 'base64url').toString('latin1')).not.toContain('reader');
  });

  it('uses a fresh IV each time', async () => {
    expect(await encryptToken(PAYLOAD, KEY)).not.toBe(await encryptToken(PAYLOAD, KEY));
  });

  it('rejects a tampered token', async () => {
    const token = await encryptToken(PAYLOAD, KEY);
    const i = token.length - 2;
    const tampered = token.slice(0, i) + (token[i] === 'A' ? 'B' : 'A') + token.slice(i + 1);
    expect(await decryptToken(tampered, KEY)).toBeNull();
  });

  it('rejects a token made with another key', async () => {
    const token = await encryptToken(PAYLOAD, OTHER_KEY);
    expect(await decryptToken(token, KEY)).toBeNull();
  });

  it('rejects garbage', async () => {
    expect(await decryptToken('', KEY)).toBeNull();
    expect(await decryptToken('not a token!', KEY)).toBeNull();
    expect(await decryptToken('AAAA', KEY)).toBeNull();
  });

  it('throws on a malformed key', async () => {
    await expect(encryptToken(PAYLOAD, 'short')).rejects.toThrow(/32 bytes/);
    await expect(encryptToken(PAYLOAD, Buffer.alloc(16).toString('base64'))).rejects.toThrow(/32 bytes/);
  });

  it('issues tokens that expire TOKEN_TTL_MS after issue', async () => {
    const now = 1_790_000_000_000;
    const token = await issueToken({ email: 'reader@example.com', programmes: true }, KEY, now);
    expect(await readToken(token, KEY, now)).toEqual({
      ok: true,
      payload: { email: 'reader@example.com', programmes: true, exp: now + TOKEN_TTL_MS },
    });
    expect(await readToken(token, KEY, now + TOKEN_TTL_MS)).toMatchObject({ ok: true });
    expect(await readToken(token, KEY, now + TOKEN_TTL_MS + 1)).toEqual({ ok: false, reason: 'expired' });
  });

  it('says why a token was rejected', async () => {
    expect(await readToken('', KEY, 0)).toEqual({ ok: false, reason: 'missing' });
    expect(await readToken('not a token!', KEY, 0)).toEqual({ ok: false, reason: 'invalid' });
    const other = await issueToken({ email: 'r@example.com', programmes: false }, OTHER_KEY, 0);
    expect(await readToken(other, KEY, 0)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('checks a key is 32 bytes of base64 without throwing', () => {
    expect(isValidTokenKey(KEY)).toBe(true);
    expect(isValidTokenKey('a'.repeat(64))).toBe(false); // hex-looking, decodes to 48 bytes
    expect(isValidTokenKey('short')).toBe(false);
    expect(isValidTokenKey('')).toBe(false);
  });
});
