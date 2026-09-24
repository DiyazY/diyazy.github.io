import { describe, expect, it } from 'vitest';
import { normalizeEmail } from '../src/validate.ts';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Reader@Example.COM ')).toBe('reader@example.com');
  });

  it('keeps plus-addressing', () => {
    expect(normalizeEmail('Reader+News@Example.com')).toBe('reader+news@example.com');
  });

  it('rejects values that are not plausible addresses', () => {
    for (const bad of ['', 'reader', 'reader@', '@example.com', 'reader@example', 'a b@example.com']) {
      expect(normalizeEmail(bad)).toBeNull();
    }
  });

  it('rejects addresses over 254 characters', () => {
    expect(normalizeEmail(`${'a'.repeat(245)}@example.com`)).toBeNull();
  });

  it('rejects non-strings', () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });
});
