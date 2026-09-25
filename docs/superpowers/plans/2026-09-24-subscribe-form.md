# Subscribe Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let diyaz.dev readers subscribe by email (double opt-in) and email every newly published post to them automatically, with a separate opt-in for coaching-programme news.

**Architecture:** A stateless Cloudflare Worker at `subscribe.diyaz.dev` handles signup (Turnstile + rate limits → AES-GCM-encrypted confirmation link) and confirmation (POST-only → upsert contact in a dedicated Resend team). A `notify` job in `build.yml` reads the build's `posts.json` after deploy and schedules a Resend broadcast (2 h out) per newly published post. Jekyll gets a form include behind `subscribe.enabled`, plus `/subscribe/`, `/subscribed/`, `/privacy/`.

**Tech Stack:** TypeScript on Node 24 (type stripping, no build step for scripts), Cloudflare Workers + Wrangler, Vitest, Resend REST API, Cloudflare Turnstile, Jekyll 4 / Liquid, GitHub Actions, Bash + Ruby (existing `check-build.sh`).

**Spec:** `docs/superpowers/specs/2026-09-24-subscribe-form-design.md` (approved 2026-09-24). Read it before starting; this plan argues from it.

## Deviations from the spec (settled while planning — flag, don't re-litigate)

| Spec said | Plan does | Why |
|---|---|---|
| §9 Vitest with `@cloudflare/vitest-pool-workers` | Plain Node Vitest + `wrangler deploy --dry-run` in CI | The Worker uses only standard Web APIs (`fetch`, `Request`, `crypto.subtle`, `FormData`), identical in Node 24; the dry-run bundle catches Worker-specific build errors without a workerd test pool to maintain. |
| §6.2 "per-IP rate limit" | Two limiters: `RL_IP` 5/60 s and `RL_EMAIL` 2/60 s (keyed on SHA-256 of the address) | Cloudflare docs advise against IP-only keys (shared NATs); the per-address key is what stops "subscription bombing" one victim. Allowed periods are only 10 or 60 s. |
| §6.2 honeypot (unnamed) | Field name `hp` | Browsers autofill fields named like `website`/`url`; an autofilled honeypot would silently drop a real human. |
| §8.2 broadcast name `post:<path>` | `post:<first 12 hex of SHA-256(path)>` | Immune to any broadcast-name length limit; path-based, so retitling never re-sends. |
| §8.1 job runs on every main push | `notify` job runs only when repo variable `NOTIFY_ENABLED` is `true` (revised in PR review; was "until `ANNOUNCE_SINCE` exists") | Prevents red CI between merge and launch, and a deleted `ANNOUNCE_SINCE` after launch now fails loudly instead of silently skipping. The script also refuses to run without `ANNOUNCE_SINCE`. |
| — (PR #49 review, 2026-09-25) | Turnstile loads on first form interaction and runs on submit; confirm reads segments/topics first, clears `unsubscribed` last and never revives a Programmes opt-in after a global unsubscribe (writes `opt_out` in that one case); `scheduled_at` is an ISO timestamp; `happy-dom` dev dependency for site-JS tests; Cloudflare invocation logs off | Findings from the five-agent PR review; the spec was revised to match. |
| §8.3 heads-up links `…/broadcasts/{id}` | Links `https://resend.com/broadcasts` + prints the ID | The per-broadcast URL format is unverified; the list page certainly exists. |
| §7 form "after `{{ content }}`" | After the share section | `post_read_completed` fires when `.share-section` scrolls into view; inserting the form above it would shift that metric. |
| — | Turnstile `action` must equal `subscribe`; allowed hostnames derive from `ALLOWED_ORIGINS` | Cloudflare's recommended siteverify checks; one variable toggles localhost for the E2E test. |

## Verified API facts (2026-09-24, from vendor docs)

- Resend: `POST /contacts` body `{email, unsubscribed, segments:[{id}], topics:[{id, subscription}]}`; `GET /contacts/{id_or_email}` (404 if absent); `PATCH /contacts/{id_or_email}` accepts `unsubscribed`; `POST /contacts/{id_or_email}/segments/{segment_id}`; `PATCH /contacts/{id_or_email}/topics` body is a **bare array** `[{id, subscription}]`; `POST /emails` accepts `reply_to`; `POST /broadcasts` accepts `segment_id, topic_id, from, reply_to, subject, name, html, text, send, scheduled_at` (`scheduled_at` natural language like `"in 2 hours"`, requires `send: true`); `GET /broadcasts?limit=100&after=<id>` → `{has_more, data:[{id, name, …}]}`; placeholder `{{{RESEND_UNSUBSCRIBE_URL}}}`; rate limit 5 req/s **per team** → 429. Duplicate-create behaviour is undocumented → always `GET` first.
- Cloudflare: rate-limit binding `ratelimits: [{name, namespace_id, simple:{limit, period}}]`, `period` ∈ {10, 60}, `env.X.limit({key}) → {success}`; Custom Domain via `routes: [{pattern, custom_domain: true}]`; Siteverify `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` (form or JSON: `secret, response, remoteip`) → `{success, hostname, action, "error-codes"}`; tokens single-use, 5-min validity, ≤ 2048 chars; explicit-render pages must `turnstile.reset(widgetId)` after each attempt; test keys: site `1x00000000000000000000AA` / secret `1x0000000000000000000000000000000AA` always pass.

## Global Constraints

- Worker package lives in `workers/subscribe/`; Node **24** locally and in CI; `"type": "module"`.
- TypeScript uses erasable syntax only (no enums, namespaces, parameter properties); relative imports carry the `.ts` extension; type-only imports use `import type` (Node type stripping fails at runtime otherwise).
- No runtime npm dependencies in `workers/subscribe/`; dev dependencies only: `wrangler`, `vitest`, `typescript`, `@types/node`.
- Constants (verbatim): `SITE_URL = 'https://diyaz.dev'`, `WORKER_URL = 'https://subscribe.diyaz.dev'`, `FROM = 'Diyaz Yakubov <diyaz@news.diyaz.dev>'`, token TTL **48 h**, AES-GCM **256-bit** key, Turnstile action `subscribe`.
- Never log, print, or put in the job summary: email addresses, tokens, API keys, the reply-to address. The repo and its Actions logs are **public**.
- Emails: text-first, **no images**, open/click tracking off. Post emails carry `{{{RESEND_UNSUBSCRIBE_URL}}}`; the confirmation email does not.
- The form only ever **adds** opt-ins; it never sets a topic to `opt_out`.
- Resend topics (permanent defaults): **New posts** = `opt_in`, public; **Programmes** = `opt_out`, public.
- Announcer: `scheduled_at: "in 2 hours"`; fuse = more than **3** candidates fails before sending; missing/invalid `ANNOUNCE_SINCE` fails.
- Site: every built HTML page has exactly **one `<h1>`** (enforced by `check-build.sh`); site JS follows `assets/js/analytics.js` style (IIFE, `'use strict'`, `var`, `function`); CSS uses tokens from `assets/css/variables.css`; screen-reader text uses the existing `.sr-only` class.
- Copy: no em-dash-heavy marketing voice; first person, plain words, matching existing posts.

## Review Focus

1. **Mixed-case or plus-addressed emails** (`Reader+News@Example.COM`): stored and emailed as `reader+news@example.com` consistently through subscribe → token → contact. Test in Task 5.
2. **Confirming the same link twice** (double-click, back button, scanner + human): both POSTs end in the 303 to `/subscribed/`, never an error page — including Resend answering 409 for "already in segment". Test in Task 6.
3. **Post titles with `&`, `<`, `"`, `|`** (e.g. "After the Feed | …"): HTML-escaped in the email body, verbatim in subject and plain text. Test in Task 7.
4. **A post retitled after it was announced**: not announced again (name keys on path). Test in Task 7.
5. **Turnstile blocked by an ad blocker or still loading**: the reader gets an actionable message (RSS fallback), never a silent no-op or a request without a token. Code in Task 10, manual check in Task 12.

---

## File map

```
workers/subscribe/
  package.json, package-lock.json, tsconfig.json, vitest.config.ts, wrangler.jsonc
  src/config.ts            constants shared by Worker + announcer
  src/env.ts               Env/Deps/Fetch/RateLimit types, allowedOrigins(), missingConfig()
  src/hash.ts              sha256Hex()
  src/validate.ts          normalizeEmail()
  src/token.ts             encryptToken()/decryptToken() (AES-GCM, base64url)
  src/resend.ts            createResendClient(), ResendError, request/response types
  src/turnstile.ts         verifyTurnstile()
  src/http.ts              corsHeaders(), json(), html()
  src/email/layout.ts      escapeHtml(), button(), renderEmail()
  src/email/confirmation.ts renderConfirmationEmail()
  src/pages.ts             confirmPage(), expiredPage(), retryPage(), errorPage()
  src/handlers/subscribe.ts handleSubscribe()
  src/handlers/confirm.ts  handleConfirmGet(), handleConfirmPost()
  src/index.ts             route() + default export (Worker entry)
  src/notify/posts.ts      PostEntry, parsePosts()
  src/notify/select.ts     broadcastName(), selectCandidates(), FuseError, MAX_PER_RUN
  src/notify/emails.ts     postLink(), renderPostEmail(), renderHeadsUpEmail()
  src/notify/run.ts        runNotify(), waitUntilLive()
  scripts/notify.ts        CLI used by the notify job
  test/helpers.ts + one *.test.ts per module
_config.yml                exclude workers/, subscribe: block
_includes/subscribe.html   form (renders only when enabled)
_includes/footer.html      Subscribe (when enabled) + Privacy links
_layouts/post.html         include the form after the share section
assets/css/subscribe.css   form + simple-page styles
assets/js/subscribe.js     submit, Turnstile explicit render, site:subscribe events
assets/js/analytics.js     subscribe_submitted / subscribe_failed
posts.json                 10 latest published posts for the announcer
subscribe.html, subscribed.html, privacy.html
.github/scripts/check-build.sh  posts.json + form-switch + new-page checks
.github/workflows/build.yml     worker job, posts artifact, notify job, dry_run input
.gitignore                 workers/subscribe/dist/, .wrangler/
```

---

### Task 1: Resend team, sending domain, topics, keys, Turnstile widget (owner: Diyaz)

Manual, account-level work. Claude must not create accounts or handle API keys. Tasks 2–11 do not depend on this and can run in parallel; Tasks 12–13 do.

**Files:** none.

**Interfaces:**
- Produces (non-secret, share with Claude): `RESEND_SEGMENT_ID`, `TOPIC_NEW_POSTS_ID`, `TOPIC_PROGRAMMES_ID`, Turnstile **site key**.
- Produces (secret, stays with Diyaz until Task 12/13): Resend key `diyaz-subscribe-worker`, Resend key `diyaz-notify-gha`, Turnstile **secret**, `TOKEN_KEY`, reply-to address.

- [ ] **Step 1: Create the Resend team.** Resend dashboard → team switcher → *Create team* → name `diyaz.dev`. (If the plan offers no multi-team option, create a separate Resend account instead; nothing else changes.) Check the plan's limits (domains, contacts, marketing sends) cover one domain and a few hundred contacts.

- [ ] **Step 2: Add the sending domain.** In the new team: Domains → *Add domain* → `news.diyaz.dev`, region **EU (Ireland)**. Copy each DNS record into Cloudflare → diyaz.dev zone → DNS, **Proxy status: DNS only (grey)**. Back in Resend, *Verify*. In the domain's settings, confirm **Open tracking: off** and **Click tracking: off**.

- [ ] **Step 3: Create the segment.** Audience → Segments → *Create* → `diyaz.dev readers`. Copy its ID.

- [ ] **Step 4: Create the two topics (defaults are permanent — read twice).**

  | Name | Default subscription | Visibility | Description |
  |---|---|---|---|
  | `New posts` | **Opt-in** | Public | An email when a new post goes up on diyaz.dev. |
  | `Programmes` | **Opt-out** | Public | Occasional news about my coaching programmes. |

  Copy both IDs.

- [ ] **Step 5: Create two API keys** (Full access — sending-only keys cannot manage contacts or broadcasts): `diyaz-subscribe-worker`, `diyaz-notify-gha`. Store them in your password manager.

- [ ] **Step 6: Create the Turnstile widget.**

  ```bash
  npx wrangler login
  ```
  ```bash
  npx wrangler turnstile widget create "diyaz-subscribe" --domain diyaz.dev --domain localhost --mode managed
  ```
  Leave **pre-clearance off**. Keep the printed secret; share the site key.

- [ ] **Step 7: Generate the token key** and store it with the other secrets.

  ```bash
  openssl rand -base64 32
  ```

- [ ] **Step 8: Hand over** the four non-secret values (segment ID, two topic IDs, Turnstile site key) to Claude in chat.

---

### Task 2: Worker package scaffold, token, email validation

**Files:**
- Create: `workers/subscribe/package.json`, `workers/subscribe/tsconfig.json`, `workers/subscribe/vitest.config.ts`
- Create: `workers/subscribe/src/config.ts`, `src/env.ts`, `src/hash.ts`, `src/validate.ts`, `src/token.ts`
- Test: `workers/subscribe/test/token.test.ts`, `workers/subscribe/test/validate.test.ts`
- Modify: `_config.yml` (`exclude:`), `.gitignore`

**Interfaces:**
- Produces:
  - `config.ts`: `SITE_URL`, `WORKER_URL`, `FROM`, `TOKEN_TTL_MS`, `TURNSTILE_ACTION` (strings/number).
  - `env.ts`: `type Fetch = (input: string, init?: RequestInit) => Promise<Response>`; `interface RateLimit { limit(o: {key: string}): Promise<{success: boolean}> }`; `interface Env { ALLOWED_ORIGINS; RESEND_SEGMENT_ID; TOPIC_NEW_POSTS_ID; TOPIC_PROGRAMMES_ID; RESEND_API_KEY; TOKEN_KEY; TURNSTILE_SECRET; REPLY_TO: string; RL_IP; RL_EMAIL: RateLimit }`; `interface Deps { fetch: Fetch; now(): number; sleep(ms): Promise<void>; log(entry: Record<string, string|number>): void }`; `allowedOrigins(env): string[]`; `missingConfig(env): string[]`.
  - `hash.ts`: `sha256Hex(text: string): Promise<string>` (64 lowercase hex).
  - `validate.ts`: `normalizeEmail(raw: unknown): string | null`.
  - `token.ts`: `interface TokenPayload { email: string; programmes: boolean; exp: number }`; `encryptToken(p, base64Key): Promise<string>`; `decryptToken(token, base64Key): Promise<TokenPayload | null>` (throws only on a malformed key).

- [ ] **Step 1: Scaffold the package**

  `workers/subscribe/package.json`:
  ```json
  {
    "name": "diyaz-subscribe",
    "private": true,
    "type": "module",
    "engines": { "node": ">=24" },
    "scripts": {
      "test": "vitest run",
      "typecheck": "tsc --noEmit",
      "build:check": "wrangler deploy --dry-run --outdir dist",
      "deploy": "wrangler deploy",
      "notify": "node scripts/notify.ts"
    }
  }
  ```

  `workers/subscribe/tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2023",
      "module": "ESNext",
      "moduleResolution": "Bundler",
      "lib": ["ES2023", "DOM", "DOM.Iterable"],
      "types": ["node"],
      "strict": true,
      "noEmit": true,
      "allowImportingTsExtensions": true,
      "erasableSyntaxOnly": true,
      "verbatimModuleSyntax": true,
      "isolatedModules": true,
      "skipLibCheck": true
    },
    "include": ["src", "scripts", "test", "vitest.config.ts"]
  }
  ```

  `workers/subscribe/vitest.config.ts`:
  ```ts
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
    test: { environment: 'node', include: ['test/**/*.test.ts'] },
  });
  ```

  Install dev dependencies (writes `package-lock.json`):
  ```bash
  cd workers/subscribe && npm install -D wrangler vitest typescript @types/node
  ```

  Append to `.gitignore`:
  ```
  # Subscribe Worker build output (wrangler dry-run bundle, local state)
  workers/subscribe/dist/
  .wrangler/
  ```

  In `_config.yml`, extend `exclude:` so Jekyll never copies the Worker sources into `_site`:
  ```yaml
  exclude:
    - ROADMAP.md
    # Internal planning/design docs (series specs, etc.). Kept in the repo for
    # continuity but never published, same rationale as ROADMAP.md above.
    - docs/
    # The subscribe Worker (TypeScript + node_modules); deployed with wrangler,
    # never part of the static site.
    - workers/
  ```

  `workers/subscribe/src/config.ts`:
  ```ts
  // Values shared by the Worker and the notify script. None of these are secrets.
  export const SITE_URL = 'https://diyaz.dev';
  export const WORKER_URL = 'https://subscribe.diyaz.dev';
  export const FROM = 'Diyaz Yakubov <diyaz@news.diyaz.dev>';
  export const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
  export const TURNSTILE_ACTION = 'subscribe';
  ```

  `workers/subscribe/src/env.ts`:
  ```ts
  // Everything the Worker reads from its environment, plus the side-effecting
  // functions handlers receive as `deps` so tests can replace them.

  export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

  export interface RateLimit {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  }

  export interface Env {
    ALLOWED_ORIGINS: string; // comma-separated, e.g. "https://diyaz.dev"
    RESEND_SEGMENT_ID: string;
    TOPIC_NEW_POSTS_ID: string;
    TOPIC_PROGRAMMES_ID: string;
    RESEND_API_KEY: string; // secret
    TOKEN_KEY: string; // secret, base64 of 32 random bytes
    TURNSTILE_SECRET: string; // secret
    REPLY_TO: string; // secret: keeps the address out of the public repo
    RL_IP: RateLimit;
    RL_EMAIL: RateLimit;
  }

  export interface Deps {
    fetch: Fetch;
    now: () => number;
    sleep: (ms: number) => Promise<void>;
    log: (entry: Record<string, string | number>) => void;
  }

  export function allowedOrigins(env: Env): string[] {
    return env.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  const REQUIRED = [
    'ALLOWED_ORIGINS',
    'RESEND_SEGMENT_ID',
    'TOPIC_NEW_POSTS_ID',
    'TOPIC_PROGRAMMES_ID',
    'RESEND_API_KEY',
    'TOKEN_KEY',
    'TURNSTILE_SECRET',
    'REPLY_TO',
  ] as const;

  // Names of required settings that are unset or blank. Handlers fail closed
  // on any of these rather than half-working with a missing ID or key.
  export function missingConfig(env: Env): string[] {
    return REQUIRED.filter((name) => typeof env[name] !== 'string' || env[name].trim() === '');
  }
  ```

  `workers/subscribe/src/hash.ts`:
  ```ts
  export async function sha256Hex(text: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  ```

- [ ] **Step 2: Write the failing tests**

  `workers/subscribe/test/validate.test.ts`:
  ```ts
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
  ```

  `workers/subscribe/test/token.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { decryptToken, encryptToken } from '../src/token.ts';

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
  });
  ```

- [ ] **Step 3: Run the tests to verify they fail**

  Run: `cd workers/subscribe && npm test`
  Expected: FAIL — `Failed to load url ../src/validate.ts` / `../src/token.ts` (modules do not exist).

- [ ] **Step 4: Implement**

  `workers/subscribe/src/validate.ts`:
  ```ts
  // Deliberately loose: the confirmation email is the real validation. This
  // only rejects input that can't possibly be an address.
  export function normalizeEmail(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const email = raw.trim().toLowerCase();
    if (email.length === 0 || email.length > 254) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return email;
  }
  ```

  `workers/subscribe/src/token.ts`:
  ```ts
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
  ```

- [ ] **Step 5: Run the tests and typecheck**

  Run: `cd workers/subscribe && npm test && npm run typecheck`
  Expected: PASS (13 tests), typecheck clean.

- [ ] **Step 6: Commit**

  ```bash
  git add .gitignore _config.yml workers/subscribe/package.json workers/subscribe/package-lock.json workers/subscribe/tsconfig.json workers/subscribe/vitest.config.ts workers/subscribe/src workers/subscribe/test
  git commit -m "Add subscribe Worker scaffold with encrypted confirmation tokens"
  ```

---

### Task 3: Resend REST client and shared test helpers

**Files:**
- Create: `workers/subscribe/src/resend.ts`, `workers/subscribe/test/helpers.ts`
- Test: `workers/subscribe/test/resend.test.ts`

**Interfaces:**
- Consumes: `Fetch`, `Env`, `Deps`, `RateLimit` from `src/env.ts`.
- Produces (`src/resend.ts`):
  ```ts
  class ResendError extends Error { readonly status: number }
  interface TopicSubscription { id: string; subscription: 'opt_in' | 'opt_out' }
  interface EmailInput { from: string; to: string; subject: string; html: string; text: string; reply_to?: string }
  interface ContactInput { email: string; unsubscribed: boolean; segments: { id: string }[]; topics: TopicSubscription[] }
  interface Contact { id: string; email: string; unsubscribed: boolean }
  interface BroadcastInput { segment_id; topic_id; from; reply_to; subject; name; html; text: string; send: true; scheduled_at: string }
  interface BroadcastSummary { id: string; name: string | null }
  interface ResendClient {
    sendEmail(i: EmailInput): Promise<{ id: string }>;
    getContact(email: string): Promise<Contact | null>;
    createContact(i: ContactInput): Promise<{ id: string }>;
    updateContact(email: string, patch: { unsubscribed: boolean }): Promise<void>;
    addContactToSegment(email: string, segmentId: string): Promise<void>;
    updateContactTopics(email: string, topics: TopicSubscription[]): Promise<void>;
    listBroadcasts(): Promise<BroadcastSummary[]>;
    createBroadcast(i: BroadcastInput): Promise<{ id: string }>;
  }
  function createResendClient(o: { apiKey: string; fetch: Fetch; sleep: (ms: number) => Promise<void> }): ResendClient
  ```
- Produces (`test/helpers.ts`): `NOW`, `TEST_KEY`, `Call`, `fakeFetch(handler) → { fetch, calls }`, `jsonResponse(body, status?, headers?)`, `limiter(success?) → RateLimit & { keys }`, `makeEnv(overrides?)`, `makeDeps(fetch) → Deps & { logs, sleeps }`.

- [ ] **Step 1: Write the test helpers**

  `workers/subscribe/test/helpers.ts`:
  ```ts
  import type { Deps, Env, Fetch, RateLimit } from '../src/env.ts';

  export const NOW = Date.parse('2026-09-26T12:00:00Z');
  export const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

  export interface Call {
    url: string;
    method: string;
    body: string | null;
    headers: Record<string, string>; // lowercase keys
  }

  // A fetch stand-in that records every call and answers via `handler`.
  export function fakeFetch(handler: (call: Call) => Response | Promise<Response>): { fetch: Fetch; calls: Call[] } {
    const calls: Call[] = [];
    const fetch: Fetch = async (input, init = {}) => {
      const headers: Record<string, string> = {};
      new Headers(init.headers).forEach((value, key) => {
        headers[key] = value;
      });
      const call: Call = {
        url: input,
        method: init.method ?? 'GET',
        body: init.body == null ? null : String(init.body),
        headers,
      };
      calls.push(call);
      return handler(call);
    };
    return { fetch, calls };
  }

  export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  }

  export function limiter(success = true): RateLimit & { keys: string[] } {
    const keys: string[] = [];
    return {
      keys,
      limit: async ({ key }) => {
        keys.push(key);
        return { success };
      },
    };
  }

  export function makeEnv(overrides: Partial<Env> = {}): Env {
    return {
      ALLOWED_ORIGINS: 'https://diyaz.dev',
      RESEND_SEGMENT_ID: 'seg_readers',
      TOPIC_NEW_POSTS_ID: 'topic_posts',
      TOPIC_PROGRAMMES_ID: 'topic_programmes',
      RESEND_API_KEY: 're_test',
      TOKEN_KEY: TEST_KEY,
      TURNSTILE_SECRET: 'turnstile_secret',
      REPLY_TO: 'owner@example.net',
      RL_IP: limiter(),
      RL_EMAIL: limiter(),
      ...overrides,
    };
  }

  export function makeDeps(fetch: Fetch): Deps & { logs: Record<string, string | number>[]; sleeps: number[] } {
    const logs: Record<string, string | number>[] = [];
    const sleeps: number[] = [];
    return {
      fetch,
      now: () => NOW,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      log: (entry) => {
        logs.push(entry);
      },
      logs,
      sleeps,
    };
  }
  ```

- [ ] **Step 2: Write the failing tests**

  `workers/subscribe/test/resend.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { ResendError, createResendClient } from '../src/resend.ts';
  import { fakeFetch, jsonResponse } from './helpers.ts';
  import type { Call } from './helpers.ts';

  function setup(handler: (call: Call) => Response | Promise<Response>) {
    const { fetch, calls } = fakeFetch(handler);
    const sleeps: number[] = [];
    const resend = createResendClient({
      apiKey: 're_key',
      fetch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    return { resend, calls, sleeps };
  }

  const EMAIL = { from: 'A <a@news.example>', to: 'r@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };

  describe('createResendClient', () => {
    it('sends JSON with a bearer key', async () => {
      const { resend, calls } = setup(() => jsonResponse({ id: 'em_1' }));
      expect(await resend.sendEmail(EMAIL)).toEqual({ id: 'em_1' });
      expect(calls[0].url).toBe('https://api.resend.com/emails');
      expect(calls[0].method).toBe('POST');
      expect(calls[0].headers.authorization).toBe('Bearer re_key');
      expect(calls[0].headers['content-type']).toBe('application/json');
      expect(JSON.parse(calls[0].body!)).toEqual(EMAIL);
    });

    it('returns null for a contact that does not exist, and encodes the address', async () => {
      const { resend, calls } = setup(() => jsonResponse({ message: 'Contact not found' }, 404));
      expect(await resend.getContact('r+x@example.com')).toBeNull();
      expect(calls[0].url).toBe('https://api.resend.com/contacts/r%2Bx%40example.com');
    });

    it('returns an existing contact', async () => {
      const { resend } = setup(() => jsonResponse({ id: 'c_1', email: 'r@example.com', unsubscribed: true }));
      expect(await resend.getContact('r@example.com')).toMatchObject({ id: 'c_1', unsubscribed: true });
    });

    it('retries a 429, honouring Retry-After', async () => {
      let n = 0;
      const { resend, calls, sleeps } = setup(() =>
        ++n === 1 ? jsonResponse({ message: 'slow down' }, 429, { 'Retry-After': '2' }) : jsonResponse({ id: 'em_1' }),
      );
      expect(await resend.sendEmail(EMAIL)).toEqual({ id: 'em_1' });
      expect(calls).toHaveLength(2);
      expect(sleeps).toEqual([2000]);
    });

    it('gives up after four attempts', async () => {
      const { resend, calls } = setup(() => jsonResponse({ message: 'slow down' }, 429));
      await expect(resend.sendEmail(EMAIL)).rejects.toMatchObject({ status: 429 });
      expect(calls).toHaveLength(4);
    });

    it('throws ResendError carrying the API message', async () => {
      const { resend } = setup(() => jsonResponse({ message: 'Invalid `from` field' }, 422));
      const err = await resend.sendEmail(EMAIL).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ResendError);
      expect(err).toMatchObject({ status: 422, message: 'Invalid `from` field' });
    });

    it('creates a contact with segments and topics', async () => {
      const { resend, calls } = setup(() => jsonResponse({ id: 'c_new' }));
      const input = {
        email: 'r@example.com',
        unsubscribed: false,
        segments: [{ id: 'seg' }],
        topics: [{ id: 't1', subscription: 'opt_in' as const }],
      };
      expect(await resend.createContact(input)).toEqual({ id: 'c_new' });
      expect(calls[0].url).toBe('https://api.resend.com/contacts');
      expect(JSON.parse(calls[0].body!)).toEqual(input);
    });

    it('patches the global unsubscribed flag', async () => {
      const { resend, calls } = setup(() => jsonResponse({ id: 'c_1' }));
      await resend.updateContact('r@example.com', { unsubscribed: false });
      expect(calls[0]).toMatchObject({ method: 'PATCH', url: 'https://api.resend.com/contacts/r%40example.com' });
      expect(JSON.parse(calls[0].body!)).toEqual({ unsubscribed: false });
    });

    it('sends topic updates as a bare array', async () => {
      const { resend, calls } = setup(() => jsonResponse({ id: 'c_1' }));
      await resend.updateContactTopics('r@example.com', [{ id: 't1', subscription: 'opt_in' }]);
      expect(calls[0]).toMatchObject({ method: 'PATCH', url: 'https://api.resend.com/contacts/r%40example.com/topics' });
      expect(JSON.parse(calls[0].body!)).toEqual([{ id: 't1', subscription: 'opt_in' }]);
    });

    it('adds a contact to a segment, treating "already there" (409) as success', async () => {
      const { resend, calls } = setup(() => jsonResponse({ message: 'already exists' }, 409));
      await expect(resend.addContactToSegment('r@example.com', 'seg')).resolves.toBeUndefined();
      expect(calls[0]).toMatchObject({ method: 'POST', url: 'https://api.resend.com/contacts/r%40example.com/segments/seg' });
    });

    it('pages through every broadcast', async () => {
      const { resend, calls } = setup((call) =>
        call.url.includes('after=b2')
          ? jsonResponse({ object: 'list', has_more: false, data: [{ id: 'b3', name: 'post:ccc' }] })
          : jsonResponse({ object: 'list', has_more: true, data: [{ id: 'b1', name: 'post:aaa' }, { id: 'b2', name: null }] }),
      );
      expect((await resend.listBroadcasts()).map((b) => b.name)).toEqual(['post:aaa', null, 'post:ccc']);
      expect(calls[0].url).toBe('https://api.resend.com/broadcasts?limit=100');
      expect(calls[1].url).toBe('https://api.resend.com/broadcasts?limit=100&after=b2');
    });

    it('creates a broadcast', async () => {
      const { resend, calls } = setup(() => jsonResponse({ id: 'b_new' }));
      const input = {
        segment_id: 'seg', topic_id: 't1', from: 'A <a@news.example>', reply_to: 'me@example.net',
        subject: 'Post', name: 'post:abc', html: '<p>x</p>', text: 'x', send: true as const, scheduled_at: 'in 2 hours',
      };
      expect(await resend.createBroadcast(input)).toEqual({ id: 'b_new' });
      expect(calls[0].url).toBe('https://api.resend.com/broadcasts');
      expect(JSON.parse(calls[0].body!)).toEqual(input);
    });
  });
  ```

- [ ] **Step 3: Run to verify it fails**

  Run: `cd workers/subscribe && npx vitest run test/resend.test.ts`
  Expected: FAIL — `Failed to load url ../src/resend.ts`.

- [ ] **Step 4: Implement**

  `workers/subscribe/src/resend.ts`:
  ```ts
  // Minimal Resend REST client: only the calls the Worker and notify script
  // make. Retries 429s (the API allows 5 requests/second per team) and turns
  // any other non-2xx into a ResendError carrying the status.
  import type { Fetch } from './env.ts';

  const API = 'https://api.resend.com';
  const MAX_ATTEMPTS = 4;

  export class ResendError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ResendError';
      this.status = status;
    }
  }

  export interface TopicSubscription {
    id: string;
    subscription: 'opt_in' | 'opt_out';
  }

  export interface EmailInput {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    reply_to?: string;
  }

  export interface ContactInput {
    email: string;
    unsubscribed: boolean;
    segments: { id: string }[];
    topics: TopicSubscription[];
  }

  export interface Contact {
    id: string;
    email: string;
    unsubscribed: boolean;
  }

  export interface BroadcastInput {
    segment_id: string;
    topic_id: string;
    from: string;
    reply_to: string;
    subject: string;
    name: string;
    html: string;
    text: string;
    send: true;
    scheduled_at: string;
  }

  export interface BroadcastSummary {
    id: string;
    name: string | null;
  }

  export interface ResendClient {
    sendEmail(input: EmailInput): Promise<{ id: string }>;
    getContact(email: string): Promise<Contact | null>;
    createContact(input: ContactInput): Promise<{ id: string }>;
    updateContact(email: string, patch: { unsubscribed: boolean }): Promise<void>;
    addContactToSegment(email: string, segmentId: string): Promise<void>;
    updateContactTopics(email: string, topics: TopicSubscription[]): Promise<void>;
    listBroadcasts(): Promise<BroadcastSummary[]>;
    createBroadcast(input: BroadcastInput): Promise<{ id: string }>;
  }

  async function errorMessage(res: Response): Promise<string> {
    try {
      const data = (await res.json()) as { message?: string; name?: string };
      return data.message || data.name || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  export function createResendClient(options: {
    apiKey: string;
    fetch: Fetch;
    sleep: (ms: number) => Promise<void>;
  }): ResendClient {
    async function call(method: string, path: string, body?: unknown): Promise<Response> {
      for (let attempt = 1; ; attempt++) {
        const res = await options.fetch(API + path, {
          method,
          headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (res.status !== 429 || attempt >= MAX_ATTEMPTS) return res;
        const retryAfter = Number(res.headers.get('Retry-After'));
        await options.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000);
      }
    }

    async function expectOk(res: Response, allow: number[] = []): Promise<Response> {
      if (res.ok || allow.includes(res.status)) return res;
      throw new ResendError(res.status, await errorMessage(res));
    }

    async function json<T>(method: string, path: string, body?: unknown): Promise<T> {
      const res = await expectOk(await call(method, path, body));
      return (await res.json()) as T;
    }

    const contact = (email: string) => `/contacts/${encodeURIComponent(email)}`;

    return {
      sendEmail: (input) => json('POST', '/emails', input),

      async getContact(email) {
        const res = await call('GET', contact(email));
        if (res.status === 404) return null;
        await expectOk(res);
        return (await res.json()) as Contact;
      },

      createContact: (input) => json('POST', '/contacts', input),

      async updateContact(email, patch) {
        await expectOk(await call('PATCH', contact(email), patch));
      },

      async addContactToSegment(email, segmentId) {
        // 409 = already in the segment: re-confirming must stay idempotent.
        await expectOk(await call('POST', `${contact(email)}/segments/${encodeURIComponent(segmentId)}`), [409]);
      },

      async updateContactTopics(email, topics) {
        await expectOk(await call('PATCH', `${contact(email)}/topics`, topics));
      },

      async listBroadcasts() {
        const all: BroadcastSummary[] = [];
        let after: string | undefined;
        for (;;) {
          const query = new URLSearchParams({ limit: '100' });
          if (after) query.set('after', after);
          const page = await json<{ has_more: boolean; data: BroadcastSummary[] }>('GET', `/broadcasts?${query}`);
          all.push(...page.data);
          if (!page.has_more || page.data.length === 0) return all;
          after = page.data[page.data.length - 1].id;
        }
      },

      createBroadcast: (input) => json('POST', '/broadcasts', input),
    };
  }
  ```

- [ ] **Step 5: Run tests and typecheck**

  Run: `cd workers/subscribe && npm test && npm run typecheck`
  Expected: PASS (all tests so far), typecheck clean.

- [ ] **Step 6: Commit**

  ```bash
  git add workers/subscribe/src/resend.ts workers/subscribe/test/helpers.ts workers/subscribe/test/resend.test.ts
  git commit -m "Add minimal Resend client with 429 retry"
  ```

---

### Task 4: Email layout, confirmation email, Worker pages

**Files:**
- Create: `workers/subscribe/src/email/layout.ts`, `src/email/confirmation.ts`, `src/pages.ts`
- Test: `workers/subscribe/test/render.test.ts`

**Interfaces:**
- Consumes: `SITE_URL` from `src/config.ts`.
- Produces: `escapeHtml(s): string`; `button(href, label): string`; `renderEmail({bodyHtml, bodyText, footerHtml, footerText}) → {html, text}`; `renderConfirmationEmail(confirmUrl) → {subject, html, text}`; `confirmPage(token)`, `expiredPage()`, `retryPage(token)`, `errorPage()` → HTML strings.

- [ ] **Step 1: Write the failing tests**

  `workers/subscribe/test/render.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { escapeHtml, renderEmail } from '../src/email/layout.ts';
  import { renderConfirmationEmail } from '../src/email/confirmation.ts';
  import { confirmPage, errorPage, expiredPage, retryPage } from '../src/pages.ts';

  const URL_ = 'https://subscribe.diyaz.dev/confirm?t=abc_DEF-123';

  describe('escapeHtml', () => {
    it('escapes the five HTML-significant characters', () => {
      expect(escapeHtml(`<a href="x">Q&A 'n'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Q&amp;A &#39;n&#39;&lt;/a&gt;');
    });
  });

  describe('renderEmail', () => {
    it('wraps body and footer in both parts, with no images', () => {
      const { html, text } = renderEmail({ bodyHtml: '<p>Body</p>', bodyText: 'Body', footerHtml: 'Foot', footerText: 'Foot' });
      expect(html).toContain('<p>Body</p>');
      expect(html).toContain('Foot');
      expect(html).not.toMatch(/<img/i);
      expect(text).toBe('Body\n\n--\nFoot\n');
    });
  });

  describe('renderConfirmationEmail', () => {
    it('carries the confirm link in both parts and says how long it lasts', () => {
      const email = renderConfirmationEmail(URL_);
      expect(email.subject).toBe('Confirm your subscription to diyaz.dev');
      expect(email.html).toContain(`href="${URL_}"`);
      expect(email.text).toContain(URL_);
      expect(email.text).toContain('48 hours');
    });

    it('has no unsubscribe placeholder (it is transactional, not a broadcast)', () => {
      const email = renderConfirmationEmail(URL_);
      expect(email.html + email.text).not.toContain('RESEND_UNSUBSCRIBE_URL');
    });
  });

  describe('pages', () => {
    const all = { confirm: confirmPage('tok'), expired: expiredPage(), retry: retryPage('tok'), error: errorPage() };

    it('each has exactly one h1 and is not indexed', () => {
      for (const html of Object.values(all)) {
        expect(html.match(/<h1/g)).toHaveLength(1);
        expect(html).toContain('<meta name="robots" content="noindex">');
      }
    });

    it('confirm page POSTs the token back', () => {
      expect(all.confirm).toContain('<form method="post" action="/confirm">');
      expect(all.confirm).toContain('<input type="hidden" name="t" value="tok">');
    });

    it('escapes the token it echoes', () => {
      expect(confirmPage('"><script>')).toContain('value="&quot;&gt;&lt;script&gt;"');
      expect(retryPage('"><script>')).toContain('value="&quot;&gt;&lt;script&gt;"');
    });

    it('expired page links back to the form', () => {
      expect(all.expired).toContain('href="https://diyaz.dev/subscribe/"');
    });

    it('retry page resubmits the same token', () => {
      expect(all.retry).toContain('<input type="hidden" name="t" value="tok">');
    });
  });
  ```

- [ ] **Step 2: Run to verify it fails**

  Run: `cd workers/subscribe && npx vitest run test/render.test.ts`
  Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

  `workers/subscribe/src/email/layout.ts`:
  ```ts
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
  ```

  `workers/subscribe/src/email/confirmation.ts`:
  ```ts
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
  ```

  `workers/subscribe/src/pages.ts`:
  ```ts
  // The Worker's own HTML: the confirm button page and its outcomes. Inline CSS,
  // light/dark via prefers-color-scheme, never indexed.
  import { SITE_URL } from './config.ts';
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

  function tokenForm(token: string, label: string): string {
    return `<form method="post" action="/confirm"><input type="hidden" name="t" value="${escapeHtml(token)}"><button type="submit">${label}</button></form>`;
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
      `<h1>This link has expired</h1><p>Confirmation links work for 48 hours. <a href="${SITE_URL}/subscribe/">Subscribe again</a> and you'll get a fresh one.</p>`,
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
  ```

- [ ] **Step 4: Run tests and typecheck**

  Run: `cd workers/subscribe && npm test && npm run typecheck`
  Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

  ```bash
  git add workers/subscribe/src/email workers/subscribe/src/pages.ts workers/subscribe/test/render.test.ts
  git commit -m "Add email layout, confirmation email and Worker pages"
  ```

---

### Task 5: Turnstile check, `POST /subscribe`, routing, Wrangler config

**Files:**
- Create: `workers/subscribe/src/turnstile.ts`, `src/http.ts`, `src/handlers/subscribe.ts`, `src/index.ts`, `workers/subscribe/wrangler.jsonc`
- Test: `workers/subscribe/test/turnstile.test.ts`, `workers/subscribe/test/subscribe.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4 (`Env`, `Deps`, `allowedOrigins`, `missingConfig`, `normalizeEmail`, `encryptToken`, `sha256Hex`, `createResendClient`, `ResendError`, `renderConfirmationEmail`, constants).
- Produces: `verifyTurnstile({secret, token, ip, allowedHostnames, fetch}): Promise<boolean>`; `corsHeaders(origin)`, `json(body, status, headers?)`, `html(body, status)`; `handleSubscribe(request, env, deps): Promise<Response>`; `route(request, env, deps): Promise<Response>` (exported from `src/index.ts`, used by Task 6 tests); default export `{ fetch(request, env) }`.
- Wire protocol (consumed by Task 10's JS): request `POST https://subscribe.diyaz.dev/subscribe`, body `application/x-www-form-urlencoded` with `email`, `programmes` (`"1"` or `""`), `hp` (honeypot, must be empty), `cf-turnstile-response`. Responses: `200 {"ok":true}`; `400 {"ok":false,"error":"validation"}`; `403 {"ok":false,"error":"turnstile"}`; `429 {"ok":false,"error":"rate_limit"}`; `500|502 {"ok":false,"error":"server"}`; disallowed `Origin` → plain `403` without CORS headers.

- [ ] **Step 1: Write the failing tests**

  `workers/subscribe/test/turnstile.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { verifyTurnstile } from '../src/turnstile.ts';
  import { fakeFetch, jsonResponse } from './helpers.ts';

  const BASE = { secret: 's3cret', token: 'tok', ip: '203.0.113.7', allowedHostnames: ['diyaz.dev'] };
  const PASS = { success: true, hostname: 'diyaz.dev', action: 'subscribe' };

  describe('verifyTurnstile', () => {
    it('accepts a success for our hostname and action, sending secret, token and IP', async () => {
      const { fetch, calls } = fakeFetch(() => jsonResponse(PASS));
      expect(await verifyTurnstile({ ...BASE, fetch })).toBe(true);
      expect(calls[0].url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
      const body = new URLSearchParams(calls[0].body!);
      expect(body.get('secret')).toBe('s3cret');
      expect(body.get('response')).toBe('tok');
      expect(body.get('remoteip')).toBe('203.0.113.7');
    });

    it('rejects success:false, another hostname, or another action', async () => {
      for (const answer of [{ ...PASS, success: false }, { ...PASS, hostname: 'evil.example' }, { ...PASS, action: 'login' }]) {
        const { fetch } = fakeFetch(() => jsonResponse(answer));
        expect(await verifyTurnstile({ ...BASE, fetch })).toBe(false);
      }
    });

    it('rejects without calling out when the token is empty or oversized', async () => {
      const { fetch, calls } = fakeFetch(() => jsonResponse(PASS));
      expect(await verifyTurnstile({ ...BASE, token: '', fetch })).toBe(false);
      expect(await verifyTurnstile({ ...BASE, token: 'x'.repeat(2049), fetch })).toBe(false);
      expect(calls).toHaveLength(0);
    });

    it('fails closed when Siteverify errors or is unreachable', async () => {
      const down = fakeFetch(() => jsonResponse({}, 500));
      expect(await verifyTurnstile({ ...BASE, fetch: down.fetch })).toBe(false);
      const unreachable = fakeFetch(() => {
        throw new Error('network');
      });
      expect(await verifyTurnstile({ ...BASE, fetch: unreachable.fetch })).toBe(false);
    });
  });
  ```

  `workers/subscribe/test/subscribe.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { route } from '../src/index.ts';
  import { decryptToken } from '../src/token.ts';
  import { FROM } from '../src/config.ts';
  import { NOW, TEST_KEY, fakeFetch, jsonResponse, limiter, makeDeps, makeEnv } from './helpers.ts';

  const ORIGIN = 'https://diyaz.dev';
  const VALID = { email: 'Reader@Example.com', programmes: '1', hp: '', 'cf-turnstile-response': 'tok' };

  function subscribeRequest(fields: Record<string, string>, origin: string | null = ORIGIN): Request {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'CF-Connecting-IP': '203.0.113.7',
    };
    if (origin) headers.Origin = origin;
    return new Request('https://subscribe.diyaz.dev/subscribe', {
      method: 'POST',
      headers,
      body: new URLSearchParams(fields).toString(),
    });
  }

  function services(options: { turnstile?: unknown; emailStatus?: number } = {}) {
    return fakeFetch((call) => {
      if (call.url.endsWith('/turnstile/v0/siteverify')) {
        return jsonResponse(options.turnstile ?? { success: true, hostname: 'diyaz.dev', action: 'subscribe' });
      }
      if (call.url === 'https://api.resend.com/emails') {
        const status = options.emailStatus ?? 200;
        return jsonResponse(status < 400 ? { id: 'em_1' } : { message: 'boom' }, status);
      }
      throw new Error(`unexpected ${call.method} ${call.url}`);
    });
  }

  const sentEmail = (calls: { url: string; body: string | null }[]) =>
    JSON.parse(calls.find((c) => c.url === 'https://api.resend.com/emails')!.body!);

  describe('POST /subscribe', () => {
    it('rejects an origin that is not allowed, before doing any work', async () => {
      const { fetch, calls } = services();
      const res = await route(subscribeRequest(VALID, 'https://evil.example'), makeEnv(), makeDeps(fetch));
      expect(res.status).toBe(403);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(calls).toHaveLength(0);
    });

    it('pretends success when the honeypot is filled, and sends nothing', async () => {
      const { fetch, calls } = services();
      const res = await route(subscribeRequest({ ...VALID, hp: 'http://spam.example' }), makeEnv(), makeDeps(fetch));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(calls).toHaveLength(0);
    });

    it('rejects an invalid email before calling Turnstile', async () => {
      const { fetch, calls } = services();
      const res = await route(subscribeRequest({ ...VALID, email: 'nope' }), makeEnv(), makeDeps(fetch));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error: 'validation' });
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
      expect(calls).toHaveLength(0);
    });

    it('rejects a failed Turnstile check and sends no email', async () => {
      const { fetch, calls } = services({ turnstile: { success: false } });
      const res = await route(subscribeRequest(VALID), makeEnv(), makeDeps(fetch));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ ok: false, error: 'turnstile' });
      expect(calls.some((c) => c.url.includes('api.resend.com'))).toBe(false);
    });

    it('accepts Turnstile hostnames from every allowed origin (localhost during the E2E test)', async () => {
      const { fetch } = services({ turnstile: { success: true, hostname: 'localhost', action: 'subscribe' } });
      const env = makeEnv({ ALLOWED_ORIGINS: 'https://diyaz.dev, http://localhost:4000' });
      const res = await route(subscribeRequest(VALID, 'http://localhost:4000'), env, makeDeps(fetch));
      expect(res.status).toBe(200);
    });

    it('returns 429 when the per-IP limit is hit, without touching the per-address limit', async () => {
      const { fetch } = services();
      const byAddress = limiter();
      const res = await route(subscribeRequest(VALID), makeEnv({ RL_IP: limiter(false), RL_EMAIL: byAddress }), makeDeps(fetch));
      expect(res.status).toBe(429);
      expect(await res.json()).toEqual({ ok: false, error: 'rate_limit' });
      expect(byAddress.keys).toHaveLength(0);
    });

    it('returns 429 when the per-address limit is hit', async () => {
      const { fetch, calls } = services();
      const res = await route(subscribeRequest(VALID), makeEnv({ RL_EMAIL: limiter(false) }), makeDeps(fetch));
      expect(res.status).toBe(429);
      expect(calls.some((c) => c.url.includes('api.resend.com'))).toBe(false);
    });

    it('keys the limits on the IP and on a hash of the address, never the raw address', async () => {
      const { fetch } = services();
      const byIp = limiter();
      const byAddress = limiter();
      await route(subscribeRequest(VALID), makeEnv({ RL_IP: byIp, RL_EMAIL: byAddress }), makeDeps(fetch));
      expect(byIp.keys).toEqual(['ip:203.0.113.7']);
      expect(byAddress.keys[0]).toMatch(/^email:[0-9a-f]{64}$/);
    });

    it('sends a confirmation email carrying an encrypted 48-hour token', async () => {
      const { fetch, calls } = services();
      const res = await route(subscribeRequest(VALID), makeEnv(), makeDeps(fetch));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);

      const email = sentEmail(calls);
      expect(email.to).toBe('reader@example.com');
      expect(email.from).toBe(FROM);
      expect(email.reply_to).toBe('owner@example.net');
      const token = /confirm\?t=([A-Za-z0-9_-]+)/.exec(email.text)![1];
      expect(email.html).toContain(`https://subscribe.diyaz.dev/confirm?t=${token}`);
      expect(await decryptToken(token, TEST_KEY)).toEqual({
        email: 'reader@example.com',
        programmes: true,
        exp: NOW + 48 * 60 * 60 * 1000,
      });
    });

    it('normalises mixed case but keeps plus-addressing all the way into the token', async () => {
      const { fetch, calls } = services();
      await route(subscribeRequest({ ...VALID, email: 'Reader+News@Example.COM' }), makeEnv(), makeDeps(fetch));
      const email = sentEmail(calls);
      expect(email.to).toBe('reader+news@example.com');
      const token = /confirm\?t=([A-Za-z0-9_-]+)/.exec(email.text)![1];
      expect((await decryptToken(token, TEST_KEY))!.email).toBe('reader+news@example.com');
    });

    it('records programmes=false when the box is unticked', async () => {
      const { fetch, calls } = services();
      await route(subscribeRequest({ ...VALID, programmes: '' }), makeEnv(), makeDeps(fetch));
      const token = /confirm\?t=([A-Za-z0-9_-]+)/.exec(sentEmail(calls).text)![1];
      expect((await decryptToken(token, TEST_KEY))!.programmes).toBe(false);
    });

    it('never looks up contacts, so the reply cannot reveal who is subscribed', async () => {
      const a = services();
      const b = services();
      const resA = await route(subscribeRequest(VALID), makeEnv(), makeDeps(a.fetch));
      const resB = await route(subscribeRequest({ ...VALID, email: 'other@example.org' }), makeEnv(), makeDeps(b.fetch));
      expect(await resA.text()).toBe(await resB.text());
      expect([...a.calls, ...b.calls].some((c) => c.url.includes('/contacts'))).toBe(false);
    });

    it('returns 502 when Resend fails to send', async () => {
      const { fetch } = services({ emailStatus: 500 });
      const res = await route(subscribeRequest(VALID), makeEnv(), makeDeps(fetch));
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ ok: false, error: 'server' });
    });

    it('fails closed when configuration is missing', async () => {
      const { fetch, calls } = services();
      const res = await route(subscribeRequest(VALID), makeEnv({ RESEND_SEGMENT_ID: '' }), makeDeps(fetch));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ ok: false, error: 'server' });
      expect(calls).toHaveLength(0);
    });

    it('never writes an email address to the logs', async () => {
      const ok = services();
      const okDeps = makeDeps(ok.fetch);
      await route(subscribeRequest(VALID), makeEnv(), okDeps);
      const failing = services({ emailStatus: 500 });
      const failingDeps = makeDeps(failing.fetch);
      await route(subscribeRequest(VALID), makeEnv(), failingDeps);
      expect(JSON.stringify([...okDeps.logs, ...failingDeps.logs])).not.toContain('@');
    });
  });

  describe('routing', () => {
    it('answers CORS preflight for an allowed origin', async () => {
      const req = new Request('https://subscribe.diyaz.dev/subscribe', { method: 'OPTIONS', headers: { Origin: ORIGIN } });
      const res = await route(req, makeEnv(), makeDeps(services().fetch));
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    });

    it('refuses preflight from other origins', async () => {
      const req = new Request('https://subscribe.diyaz.dev/subscribe', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
      const res = await route(req, makeEnv(), makeDeps(services().fetch));
      expect(res.status).toBe(403);
    });

    it('rejects GET /subscribe', async () => {
      const res = await route(new Request('https://subscribe.diyaz.dev/subscribe'), makeEnv(), makeDeps(services().fetch));
      expect(res.status).toBe(405);
    });

    it('sends the bare host to the site form', async () => {
      const res = await route(new Request('https://subscribe.diyaz.dev/'), makeEnv(), makeDeps(services().fetch));
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('https://diyaz.dev/subscribe/');
    });

    it('404s unknown paths', async () => {
      const res = await route(new Request('https://subscribe.diyaz.dev/nope'), makeEnv(), makeDeps(services().fetch));
      expect(res.status).toBe(404);
    });
  });
  ```

- [ ] **Step 2: Run to verify they fail**

  Run: `cd workers/subscribe && npx vitest run test/turnstile.test.ts test/subscribe.test.ts`
  Expected: FAIL — `../src/turnstile.ts` / `../src/index.ts` not found.

- [ ] **Step 3: Implement**

  `workers/subscribe/src/turnstile.ts`:
  ```ts
  // Server-side Turnstile check. Fails closed: an outage blocks signups rather
  // than letting bots through (the public form is the only way outsiders can
  // make this Resend team send email).
  import { TURNSTILE_ACTION } from './config.ts';
  import type { Fetch } from './env.ts';

  const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  export async function verifyTurnstile(input: {
    secret: string;
    token: string;
    ip: string;
    allowedHostnames: string[];
    fetch: Fetch;
  }): Promise<boolean> {
    if (!input.token || input.token.length > 2048) return false;
    try {
      const res = await input.fetch(SITEVERIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: input.secret, response: input.token, remoteip: input.ip }).toString(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { success?: boolean; hostname?: string; action?: string };
      return (
        data.success === true &&
        data.action === TURNSTILE_ACTION &&
        typeof data.hostname === 'string' &&
        input.allowedHostnames.includes(data.hostname)
      );
    } catch {
      return false;
    }
  }
  ```

  `workers/subscribe/src/http.ts`:
  ```ts
  export function corsHeaders(origin: string): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
  }

  export function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
    });
  }

  export function html(body: string, status: number): Response {
    return new Response(body, {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Frame-Options': 'DENY',
      },
    });
  }
  ```

  `workers/subscribe/src/handlers/subscribe.ts`:
  ```ts
  // POST /subscribe: validate, prove human, rate-limit, then email a
  // confirmation link. Nothing is stored; the subscriber exists only after the
  // reader confirms (handlers/confirm.ts).
  import { FROM, TOKEN_TTL_MS, WORKER_URL } from '../config.ts';
  import type { Deps, Env } from '../env.ts';
  import { allowedOrigins, missingConfig } from '../env.ts';
  import { renderConfirmationEmail } from '../email/confirmation.ts';
  import { sha256Hex } from '../hash.ts';
  import { corsHeaders, json } from '../http.ts';
  import { ResendError, createResendClient } from '../resend.ts';
  import { encryptToken } from '../token.ts';
  import { verifyTurnstile } from '../turnstile.ts';
  import { normalizeEmail } from '../validate.ts';

  export async function handleSubscribe(request: Request, env: Env, deps: Deps): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const origins = allowedOrigins(env);
    if (!origins.includes(origin)) {
      deps.log({ step: 'subscribe.origin', status: 403 });
      return new Response('Forbidden', { status: 403 });
    }
    const cors = corsHeaders(origin);

    if (missingConfig(env).length > 0) {
      deps.log({ step: 'subscribe.config', status: 500 });
      return json({ ok: false, error: 'server' }, 500, cors);
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ ok: false, error: 'validation' }, 400, cors);
    }

    // Honeypot: hidden from people, filled by naive bots. Pretend success so a
    // bot learns nothing, and send nothing.
    const honeypot = form.get('hp');
    if (typeof honeypot === 'string' && honeypot !== '') {
      deps.log({ step: 'subscribe.honeypot', status: 200 });
      return json({ ok: true }, 200, cors);
    }

    const email = normalizeEmail(form.get('email'));
    if (!email) return json({ ok: false, error: 'validation' }, 400, cors);

    const ip = request.headers.get('CF-Connecting-IP') ?? '';
    const human = await verifyTurnstile({
      secret: env.TURNSTILE_SECRET,
      token: String(form.get('cf-turnstile-response') ?? ''),
      ip,
      allowedHostnames: origins.map((o) => new URL(o).hostname),
      fetch: deps.fetch,
    });
    if (!human) {
      deps.log({ step: 'subscribe.turnstile', status: 403 });
      return json({ ok: false, error: 'turnstile' }, 403, cors);
    }

    // Per-IP stops one source spraying many addresses; per-address stops one
    // victim's inbox being flooded with confirmations. Keyed on a hash so the
    // raw address never becomes a rate-limit key.
    const ipOk = (await env.RL_IP.limit({ key: `ip:${ip}` })).success;
    const addressOk = ipOk && (await env.RL_EMAIL.limit({ key: `email:${await sha256Hex(email)}` })).success;
    if (!ipOk || !addressOk) {
      deps.log({ step: 'subscribe.rate_limit', status: 429 });
      return json({ ok: false, error: 'rate_limit' }, 429, cors);
    }

    const token = await encryptToken(
      { email, programmes: form.get('programmes') === '1', exp: deps.now() + TOKEN_TTL_MS },
      env.TOKEN_KEY,
    );
    const message = renderConfirmationEmail(`${WORKER_URL}/confirm?t=${token}`);
    try {
      await createResendClient({ apiKey: env.RESEND_API_KEY, fetch: deps.fetch, sleep: deps.sleep }).sendEmail({
        from: FROM,
        to: email,
        reply_to: env.REPLY_TO,
        ...message,
      });
    } catch (err) {
      deps.log({ step: 'subscribe.send', status: err instanceof ResendError ? err.status : 0 });
      return json({ ok: false, error: 'server' }, 502, cors);
    }

    deps.log({ step: 'subscribe.sent', status: 200 });
    // Same body whether or not the address is already subscribed.
    return json({ ok: true }, 200, cors);
  }
  ```

  `workers/subscribe/src/index.ts` (the `/confirm` branch is wired in Task 6; until then it 404s):
  ```ts
  import { SITE_URL } from './config.ts';
  import type { Deps, Env } from './env.ts';
  import { allowedOrigins } from './env.ts';
  import { handleSubscribe } from './handlers/subscribe.ts';
  import { corsHeaders } from './http.ts';

  export async function route(request: Request, env: Env, deps: Deps): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/subscribe') {
      if (request.method === 'OPTIONS') {
        const origin = request.headers.get('Origin') ?? '';
        if (!allowedOrigins(env).includes(origin)) return new Response(null, { status: 403 });
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
      }
      if (request.method === 'POST') return handleSubscribe(request, env, deps);
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST, OPTIONS' } });
    }

    if (pathname === '/') return Response.redirect(`${SITE_URL}/subscribe/`, 302);
    return new Response('Not Found', { status: 404 });
  }

  export default {
    fetch(request: Request, env: Env): Promise<Response> {
      return route(request, env, {
        fetch: (input, init) => fetch(input, init),
        now: () => Date.now(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        log: (entry) => console.log(JSON.stringify(entry)),
      });
    },
  };
  ```

  `workers/subscribe/wrangler.jsonc` (IDs are filled in during Task 12):
  ```jsonc
  {
    "$schema": "./node_modules/wrangler/config-schema.json",
    "name": "diyaz-subscribe",
    "main": "src/index.ts",
    "compatibility_date": "2026-09-24",
    "workers_dev": false,
    "routes": [{ "pattern": "subscribe.diyaz.dev", "custom_domain": true }],
    "observability": { "enabled": true },
    "vars": {
      // Comma-separated. Task 12 temporarily adds http://localhost:4000 via
      // `wrangler deploy --var`, never by editing this file.
      "ALLOWED_ORIGINS": "https://diyaz.dev",
      // Resend team "diyaz.dev" IDs (not secrets). Empty = Worker fails closed.
      "RESEND_SEGMENT_ID": "",
      "TOPIC_NEW_POSTS_ID": "",
      "TOPIC_PROGRAMMES_ID": ""
    },
    // Secrets (wrangler secret put): RESEND_API_KEY, TOKEN_KEY,
    // TURNSTILE_SECRET, REPLY_TO.
    "ratelimits": [
      { "name": "RL_IP", "namespace_id": "1001", "simple": { "limit": 5, "period": 60 } },
      { "name": "RL_EMAIL", "namespace_id": "1002", "simple": { "limit": 2, "period": 60 } }
    ]
  }
  ```

- [ ] **Step 4: Run tests, typecheck, and a bundle check**

  Run: `cd workers/subscribe && npm test && npm run typecheck && npm run build:check`
  Expected: tests PASS, typecheck clean, `wrangler deploy --dry-run` prints the bundle size and "--dry-run: exiting now." with no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add workers/subscribe/src workers/subscribe/test workers/subscribe/wrangler.jsonc
  git commit -m "Add POST /subscribe with Turnstile, rate limits and confirmation email"
  ```

---

### Task 6: `GET /confirm` and `POST /confirm`

**Files:**
- Create: `workers/subscribe/src/handlers/confirm.ts`
- Modify: `workers/subscribe/src/index.ts` (add the `/confirm` branch)
- Test: `workers/subscribe/test/confirm.test.ts`

**Interfaces:**
- Consumes: `route` (Task 5), `html` (Task 5), pages (Task 4), `decryptToken`/`encryptToken` (Task 2), Resend client (Task 3).
- Produces: `handleConfirmGet(request): Response`; `handleConfirmPost(request, env, deps): Promise<Response>`. Success = `303` with `Location: https://diyaz.dev/subscribed/`.

- [ ] **Step 1: Write the failing tests**

  `workers/subscribe/test/confirm.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { route } from '../src/index.ts';
  import { encryptToken } from '../src/token.ts';
  import { NOW, TEST_KEY, fakeFetch, jsonResponse, makeDeps, makeEnv } from './helpers.ts';
  import type { Call } from './helpers.ts';

  const ADDR = 'reader@example.com';
  const ENC = 'reader%40example.com';

  const tokenFor = (programmes: boolean, exp = NOW + 60_000) => encryptToken({ email: ADDR, programmes, exp }, TEST_KEY);

  function confirmPost(token: string): Request {
    return new Request('https://subscribe.diyaz.dev/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ t: token }).toString(),
    });
  }

  // Resend stand-in. `existing` answers GET /contacts with a contact;
  // `failOn` makes any call whose "METHOD /path" starts with it return 500.
  function resend(options: { existing?: boolean; failOn?: string; segment409?: boolean; first429?: boolean } = {}) {
    let throttled = false;
    return fakeFetch((call: Call) => {
      const key = `${call.method} ${call.url.replace('https://api.resend.com', '')}`;
      if (options.first429 && !throttled) {
        throttled = true;
        return jsonResponse({ message: 'slow down' }, 429, { 'Retry-After': '1' });
      }
      if (options.failOn && key.startsWith(options.failOn)) return jsonResponse({ message: 'boom' }, 500);
      if (key === `GET /contacts/${ENC}`) {
        return options.existing
          ? jsonResponse({ id: 'c_1', email: ADDR, unsubscribed: true })
          : jsonResponse({ message: 'not found' }, 404);
      }
      if (key === 'POST /contacts') return jsonResponse({ id: 'c_new' });
      if (key === `PATCH /contacts/${ENC}`) return jsonResponse({ id: 'c_1' });
      if (key === `POST /contacts/${ENC}/segments/seg_readers`) {
        return options.segment409 ? jsonResponse({ message: 'already exists' }, 409) : jsonResponse({ id: 'seg_readers' });
      }
      if (key === `PATCH /contacts/${ENC}/topics`) return jsonResponse({ id: 'c_1' });
      throw new Error(`unexpected ${key}`);
    });
  }

  const bodyOf = (calls: Call[], key: string) =>
    JSON.parse(calls.find((c) => `${c.method} ${c.url.replace('https://api.resend.com', '')}` === key)!.body!);

  describe('GET /confirm', () => {
    it('shows a button that POSTs the token, and touches nothing', async () => {
      const { fetch, calls } = resend();
      const res = await route(new Request('https://subscribe.diyaz.dev/confirm?t=abc'), makeEnv(), makeDeps(fetch));
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/html');
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
      const page = await res.text();
      expect(page).toContain('<form method="post" action="/confirm">');
      expect(page).toContain('value="abc"');
      expect(calls).toHaveLength(0);
    });

    it('treats a missing token as expired', async () => {
      const res = await route(new Request('https://subscribe.diyaz.dev/confirm'), makeEnv(), makeDeps(resend().fetch));
      expect(res.status).toBe(400);
      expect(await res.text()).toContain('This link has expired');
    });
  });

  describe('POST /confirm', () => {
    it('creates a new contact with both topics when programmes was ticked', async () => {
      const { fetch, calls } = resend();
      const res = await route(confirmPost(await tokenFor(true)), makeEnv(), makeDeps(fetch));
      expect(res.status).toBe(303);
      expect(res.headers.get('Location')).toBe('https://diyaz.dev/subscribed/');
      expect(bodyOf(calls, 'POST /contacts')).toEqual({
        email: ADDR,
        unsubscribed: false,
        segments: [{ id: 'seg_readers' }],
        topics: [
          { id: 'topic_posts', subscription: 'opt_in' },
          { id: 'topic_programmes', subscription: 'opt_in' },
        ],
      });
    });

    it('creates a new contact with only New posts when programmes was not ticked', async () => {
      const { fetch, calls } = resend();
      await route(confirmPost(await tokenFor(false)), makeEnv(), makeDeps(fetch));
      expect(bodyOf(calls, 'POST /contacts').topics).toEqual([{ id: 'topic_posts', subscription: 'opt_in' }]);
    });

    it('re-subscribes an existing contact without touching Programmes when unticked', async () => {
      const { fetch, calls } = resend({ existing: true });
      const res = await route(confirmPost(await tokenFor(false)), makeEnv(), makeDeps(fetch));
      expect(res.status).toBe(303);
      expect(calls.some((c) => c.method === 'POST' && c.url === 'https://api.resend.com/contacts')).toBe(false);
      expect(bodyOf(calls, `PATCH /contacts/${ENC}`)).toEqual({ unsubscribed: false });
      expect(calls.some((c) => c.url.endsWith(`/contacts/${ENC}/segments/seg_readers`))).toBe(true);
      expect(bodyOf(calls, `PATCH /contacts/${ENC}/topics`)).toEqual([{ id: 'topic_posts', subscription: 'opt_in' }]);
    });

    it('lands on /subscribed/ when the same link is confirmed twice', async () => {
      const token = await tokenFor(true);
      const first = await route(confirmPost(token), makeEnv(), makeDeps(resend().fetch));
      const second = await route(confirmPost(token), makeEnv(), makeDeps(resend({ existing: true, segment409: true }).fetch));
      expect([first.status, second.status]).toEqual([303, 303]);
      expect(second.headers.get('Location')).toBe('https://diyaz.dev/subscribed/');
    });

    it('rejects an expired token without calling Resend', async () => {
      const { fetch, calls } = resend();
      const res = await route(confirmPost(await tokenFor(true, NOW - 1)), makeEnv(), makeDeps(fetch));
      expect(res.status).toBe(400);
      expect(await res.text()).toContain('This link has expired');
      expect(calls).toHaveLength(0);
    });

    it('rejects a tampered or missing token', async () => {
      const token = await tokenFor(true);
      const tampered = token.slice(0, -2) + (token.at(-2) === 'A' ? 'B' : 'A') + token.at(-1);
      for (const t of [tampered, '']) {
        const res = await route(confirmPost(t), makeEnv(), makeDeps(resend().fetch));
        expect(res.status).toBe(400);
      }
    });

    it('offers a retry with the same token when Resend fails', async () => {
      const token = await tokenFor(true);
      const res = await route(confirmPost(token), makeEnv(), makeDeps(resend({ failOn: 'POST /contacts' }).fetch));
      expect(res.status).toBe(502);
      const page = await res.text();
      expect(page).toContain("That didn't go through");
      expect(page).toContain(`value="${token}"`);
    });

    it('waits out a 429 and still succeeds', async () => {
      const { fetch } = resend({ first429: true });
      const deps = makeDeps(fetch);
      const res = await route(confirmPost(await tokenFor(true)), makeEnv(), deps);
      expect(res.status).toBe(303);
      expect(deps.sleeps).toEqual([1000]);
    });

    it('fails closed with an error page when configuration is missing', async () => {
      const { fetch, calls } = resend();
      const res = await route(confirmPost(await tokenFor(true)), makeEnv({ TOPIC_NEW_POSTS_ID: '' }), makeDeps(fetch));
      expect(res.status).toBe(500);
      expect(calls).toHaveLength(0);
    });

    it('never writes an email address to the logs', async () => {
      const deps = makeDeps(resend({ failOn: 'POST /contacts' }).fetch);
      await route(confirmPost(await tokenFor(true)), makeEnv(), deps);
      expect(JSON.stringify(deps.logs)).not.toContain('@');
    });
  });
  ```

- [ ] **Step 2: Run to verify it fails**

  Run: `cd workers/subscribe && npx vitest run test/confirm.test.ts`
  Expected: FAIL — `/confirm` requests get `404` (and `../src/handlers/confirm.ts` does not exist yet).

- [ ] **Step 3: Implement**

  `workers/subscribe/src/handlers/confirm.ts`:
  ```ts
  // GET shows a button; only the POST it submits saves anything. Email link
  // scanners (Safe Links, Mimecast, ...) open every GET in a message, so a
  // subscribe-on-GET would confirm people who never clicked.
  import { SITE_URL } from '../config.ts';
  import type { Deps, Env } from '../env.ts';
  import { missingConfig } from '../env.ts';
  import { html } from '../http.ts';
  import { confirmPage, errorPage, expiredPage, retryPage } from '../pages.ts';
  import { ResendError, createResendClient } from '../resend.ts';
  import type { TopicSubscription } from '../resend.ts';
  import { decryptToken } from '../token.ts';
  import type { TokenPayload } from '../token.ts';

  export function handleConfirmGet(request: Request): Response {
    const token = new URL(request.url).searchParams.get('t') ?? '';
    if (!token) return html(expiredPage(), 400);
    return html(confirmPage(token), 200);
  }

  export async function handleConfirmPost(request: Request, env: Env, deps: Deps): Promise<Response> {
    if (missingConfig(env).length > 0) {
      deps.log({ step: 'confirm.config', status: 500 });
      return html(errorPage(), 500);
    }

    let token = '';
    try {
      token = String((await request.formData()).get('t') ?? '');
    } catch {
      // No form body: treated as a missing token below.
    }

    let payload: TokenPayload | null = null;
    try {
      payload = token ? await decryptToken(token, env.TOKEN_KEY) : null;
    } catch {
      deps.log({ step: 'confirm.key', status: 500 });
      return html(errorPage(), 500);
    }
    if (!payload || payload.exp < deps.now()) {
      deps.log({ step: 'confirm.token', status: 400 });
      return html(expiredPage(), 400);
    }

    // The form only ever adds opt-ins. An unticked box leaves Programmes alone:
    // new contacts fall back to its opt_out default, and an earlier opt-in is
    // not revoked. Opting out happens on Resend's preferences page.
    const topics: TopicSubscription[] = [{ id: env.TOPIC_NEW_POSTS_ID, subscription: 'opt_in' }];
    if (payload.programmes) topics.push({ id: env.TOPIC_PROGRAMMES_ID, subscription: 'opt_in' });

    const resend = createResendClient({ apiKey: env.RESEND_API_KEY, fetch: deps.fetch, sleep: deps.sleep });
    try {
      const existing = await resend.getContact(payload.email);
      if (!existing) {
        await resend.createContact({
          email: payload.email,
          unsubscribed: false,
          segments: [{ id: env.RESEND_SEGMENT_ID }],
          topics,
        });
      } else {
        // The global flag only spans this team (diyaz.dev), so clearing it
        // can't re-subscribe anyone to another product's emails.
        await resend.updateContact(payload.email, { unsubscribed: false });
        await resend.addContactToSegment(payload.email, env.RESEND_SEGMENT_ID);
        await resend.updateContactTopics(payload.email, topics);
      }
    } catch (err) {
      deps.log({ step: 'confirm.save', status: err instanceof ResendError ? err.status : 0 });
      return html(retryPage(token), 502);
    }

    deps.log({ step: 'confirm.saved', status: 303 });
    return new Response(null, {
      status: 303,
      headers: { Location: `${SITE_URL}/subscribed/`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    });
  }
  ```

  In `workers/subscribe/src/index.ts`, add the import and the branch (keep everything else):
  ```ts
  import { handleConfirmGet, handleConfirmPost } from './handlers/confirm.ts';
  ```
  ```ts
    if (pathname === '/confirm') {
      if (request.method === 'GET') return handleConfirmGet(request);
      if (request.method === 'POST') return handleConfirmPost(request, env, deps);
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, POST' } });
    }
  ```
  (place it directly after the `/subscribe` block, before the `/` redirect).

- [ ] **Step 4: Run tests, typecheck, bundle**

  Run: `cd workers/subscribe && npm test && npm run typecheck && npm run build:check`
  Expected: all PASS / clean.

- [ ] **Step 5: Commit**

  ```bash
  git add workers/subscribe/src workers/subscribe/test/confirm.test.ts
  git commit -m "Add POST-only confirmation that upserts the subscriber in Resend"
  ```

---

### Task 7: Announcer core — posts parsing, selection, email content

**Files:**
- Create: `workers/subscribe/src/notify/posts.ts`, `src/notify/select.ts`, `src/notify/emails.ts`
- Test: `workers/subscribe/test/notify-select.test.ts`, `workers/subscribe/test/notify-emails.test.ts`

**Interfaces:**
- Consumes: `sha256Hex` (Task 2), `renderEmail`, `button`, `escapeHtml` (Task 4).
- Produces:
  - `interface PostEntry { url: string; path: string; title: string; description: string; date: string }`; `parsePosts(data: unknown): PostEntry[]` (throws with `posts.json: …` on bad shape).
  - `MAX_PER_RUN = 3`; `class FuseError extends Error`; `broadcastName(post): Promise<string>` → `post:<12 hex>`; `selectCandidates(posts, announced: ReadonlySet<string>, {since: string | undefined; now: Date}): Promise<PostEntry[]>` (oldest first).
  - `postLink(post): string`; `renderPostEmail(post) → {subject, html, text}`; `renderHeadsUpEmail(post, sendAt: Date, broadcastId: string) → {subject, html, text}`.

- [ ] **Step 1: Write the failing tests**

  `workers/subscribe/test/notify-select.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { parsePosts } from '../src/notify/posts.ts';
  import type { PostEntry } from '../src/notify/posts.ts';
  import { FuseError, MAX_PER_RUN, broadcastName, selectCandidates } from '../src/notify/select.ts';

  const NOW = new Date('2026-09-30T14:05:00Z');
  const post = (path: string, date: string, title = 'A post'): PostEntry => ({
    url: `https://diyaz.dev${path}`,
    path,
    title,
    description: 'One line about it.',
    date,
  });
  const OLD = post('/2026/09/23/part-1.html', '2026-09-23T08:00:00+00:00');
  const NEW = post('/2026/09/30/part-2.html', '2026-09-30T08:00:00+00:00');
  const FUTURE = post('/2026/10/07/part-3.html', '2026-10-07T08:00:00+00:00');

  describe('parsePosts', () => {
    it('accepts the shape posts.json produces', () => {
      expect(parsePosts([NEW])).toEqual([NEW]);
    });

    it('rejects anything else', () => {
      expect(() => parsePosts({})).toThrow(/expected an array/);
      expect(() => parsePosts([{ ...NEW, title: '' }])).toThrow(/entry 0 has no title/);
      expect(() => parsePosts([null])).toThrow(/entry 0 has no url/);
    });
  });

  describe('broadcastName', () => {
    it('is post: plus 12 hex characters of the path hash', async () => {
      expect(await broadcastName(NEW)).toMatch(/^post:[0-9a-f]{12}$/);
      expect(await broadcastName(NEW)).not.toBe(await broadcastName(OLD));
    });
  });

  describe('selectCandidates', () => {
    it('refuses to run without a valid ANNOUNCE_SINCE', async () => {
      for (const since of [undefined, '', 'not-a-date']) {
        await expect(selectCandidates([NEW], new Set(), { since, now: NOW })).rejects.toThrow(/ANNOUNCE_SINCE/);
      }
    });

    it('skips posts before the cutoff and posts from the future', async () => {
      expect(await selectCandidates([OLD, NEW, FUTURE], new Set(), { since: '2026-09-26', now: NOW })).toEqual([NEW]);
    });

    it('skips posts already announced', async () => {
      const announced = new Set([await broadcastName(NEW)]);
      expect(await selectCandidates([NEW], announced, { since: '2026-09-26', now: NOW })).toEqual([]);
    });

    it('does not announce a post again after it is retitled', async () => {
      const announced = new Set([await broadcastName(NEW)]);
      const retitled = { ...NEW, title: 'A better title' };
      expect(await selectCandidates([retitled], announced, { since: '2026-09-26', now: NOW })).toEqual([]);
    });

    it('returns oldest first', async () => {
      const a = post('/2026/09/28/a.html', '2026-09-28T08:00:00+00:00');
      const b = post('/2026/09/29/b.html', '2026-09-29T08:00:00+00:00');
      expect(await selectCandidates([NEW, b, a], new Set(), { since: '2026-09-26', now: NOW })).toEqual([a, b, NEW]);
    });

    it(`allows ${MAX_PER_RUN}, refuses one more`, async () => {
      const many = [27, 28, 29, 30].map((d) => post(`/2026/09/${d}/p.html`, `2026-09-${d}T08:00:00+00:00`));
      await expect(selectCandidates(many.slice(0, 3), new Set(), { since: '2026-09-26', now: NOW })).resolves.toHaveLength(3);
      await expect(selectCandidates(many, new Set(), { since: '2026-09-26', now: NOW })).rejects.toBeInstanceOf(FuseError);
    });
  });
  ```

  `workers/subscribe/test/notify-emails.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import type { PostEntry } from '../src/notify/posts.ts';
  import { postLink, renderHeadsUpEmail, renderPostEmail } from '../src/notify/emails.ts';

  const POST: PostEntry = {
    url: 'https://diyaz.dev/2026/09/30/After-the-Feed-Part-2.html',
    path: '/2026/09/30/After-the-Feed-Part-2.html',
    title: 'After the Feed | How the last three takeovers happened',
    description: 'WhatsApp, Instagram and Telegram each caught an overlooked shift.',
    date: '2026-09-30T08:00:00+00:00',
  };
  const LINK =
    'https://diyaz.dev/2026/09/30/After-the-Feed-Part-2.html?utm_source=newsletter&utm_medium=email&utm_campaign=After-the-Feed-Part-2';

  describe('renderPostEmail', () => {
    it('links to the post with newsletter UTM tags', () => {
      expect(postLink(POST)).toBe(LINK);
    });

    it('uses the title as subject and carries description and link in both parts', () => {
      const email = renderPostEmail(POST);
      expect(email.subject).toBe(POST.title);
      expect(email.text).toContain(POST.description);
      expect(email.text).toContain(LINK);
      expect(email.html).toContain(`href="${LINK.replace(/&/g, '&amp;')}"`);
    });

    it('includes the unsubscribe placeholder in both parts', () => {
      const email = renderPostEmail(POST);
      expect(email.html).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}');
      expect(email.text).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}');
    });

    it('has no images', () => {
      expect(renderPostEmail(POST).html).not.toMatch(/<img/i);
    });

    it('escapes titles and descriptions in HTML but keeps them verbatim in subject and text', () => {
      const tricky = { ...POST, title: 'Q&A | <draft> "quotes"', description: 'Tom & Jerry <3' };
      const email = renderPostEmail(tricky);
      expect(email.subject).toBe('Q&A | <draft> "quotes"');
      expect(email.text).toContain('Q&A | <draft> "quotes"');
      expect(email.html).toContain('Q&amp;A | &lt;draft&gt; &quot;quotes&quot;');
      expect(email.html).toContain('Tom &amp; Jerry &lt;3');
      expect(email.html).not.toContain('<draft>');
    });
  });

  describe('renderHeadsUpEmail', () => {
    it('names the post, the UTC send time and the broadcast id', () => {
      const email = renderHeadsUpEmail(POST, new Date('2026-09-30T16:05:00Z'), 'b_123');
      expect(email.subject).toBe(`Scheduled ~16:05 UTC: ${POST.title}`);
      expect(email.text).toContain('b_123');
      expect(email.text).toContain('https://resend.com/broadcasts');
      expect(email.html).not.toContain('RESEND_UNSUBSCRIBE_URL');
    });
  });
  ```

- [ ] **Step 2: Run to verify they fail**

  Run: `cd workers/subscribe && npx vitest run test/notify-select.test.ts test/notify-emails.test.ts`
  Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

  `workers/subscribe/src/notify/posts.ts`:
  ```ts
  // One entry of /posts.json (built by Jekyll from posts.json at the repo root).
  export interface PostEntry {
    url: string; // absolute
    path: string; // site-relative, e.g. /2026/09/30/Slug.html
    title: string;
    description: string;
    date: string; // ISO 8601
  }

  const KEYS = ['url', 'path', 'title', 'description', 'date'] as const;

  export function parsePosts(data: unknown): PostEntry[] {
    if (!Array.isArray(data)) throw new Error('posts.json: expected an array');
    return data.map((raw: unknown, i) => {
      const entry = (raw ?? {}) as Record<string, unknown>;
      for (const key of KEYS) {
        const value = entry[key];
        if (typeof value !== 'string' || value.trim() === '') throw new Error(`posts.json: entry ${i} has no ${key}`);
      }
      return {
        url: entry.url as string,
        path: entry.path as string,
        title: entry.title as string,
        description: entry.description as string,
        date: entry.date as string,
      };
    });
  }
  ```

  `workers/subscribe/src/notify/select.ts`:
  ```ts
  // Which posts to announce this run. Two guards: the broadcast name makes
  // re-runs safe; the fuse catches logic mistakes before anything is sent.
  import { sha256Hex } from '../hash.ts';
  import type { PostEntry } from './posts.ts';

  export const MAX_PER_RUN = 3;

  export class FuseError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'FuseError';
    }
  }

  // Keyed on the path (not the title) so a retitled post is not re-sent, and
  // hashed so the name stays short whatever Resend's name length limit is.
  export async function broadcastName(post: PostEntry): Promise<string> {
    return `post:${(await sha256Hex(post.path)).slice(0, 12)}`;
  }

  export async function selectCandidates(
    posts: PostEntry[],
    announced: ReadonlySet<string>,
    options: { since: string | undefined; now: Date },
  ): Promise<PostEntry[]> {
    const since = options.since ? Date.parse(options.since) : Number.NaN;
    if (Number.isNaN(since)) {
      throw new Error('ANNOUNCE_SINCE is not set to a valid date; refusing to guess which posts are new');
    }
    const now = options.now.getTime();

    const fresh: PostEntry[] = [];
    for (const post of posts) {
      const published = Date.parse(post.date);
      if (Number.isNaN(published) || published < since || published > now) continue;
      if (announced.has(await broadcastName(post))) continue;
      fresh.push(post);
    }
    fresh.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

    if (fresh.length > MAX_PER_RUN) {
      throw new FuseError(`${fresh.length} posts qualify (max ${MAX_PER_RUN}); refusing to send. Check ANNOUNCE_SINCE.`);
    }
    return fresh;
  }
  ```

  `workers/subscribe/src/notify/emails.ts`:
  ```ts
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
  ```

- [ ] **Step 4: Run tests and typecheck**

  Run: `cd workers/subscribe && npm test && npm run typecheck`
  Expected: PASS, clean.

- [ ] **Step 5: Commit**

  ```bash
  git add workers/subscribe/src/notify workers/subscribe/test/notify-select.test.ts workers/subscribe/test/notify-emails.test.ts
  git commit -m "Add announcer post selection, fuse and email content"
  ```

---

### Task 8: Announcer runner and CLI

**Files:**
- Create: `workers/subscribe/src/notify/run.ts`, `workers/subscribe/scripts/notify.ts`
- Test: `workers/subscribe/test/notify-run.test.ts`

**Interfaces:**
- Consumes: `ResendClient`, `createResendClient`, `BroadcastInput`, `EmailInput` (Task 3); `FROM` (Task 2); Task 7 exports.
- Produces:
  - `interface NotifyConfig { since: string | undefined; segmentId: string; topicId: string; replyTo: string; dryRun: boolean }`
  - `interface NotifyDeps { resend: ResendClient; fetch: Fetch; sleep(ms): Promise<void>; now(): Date; log(line: string): void; summary(markdown: string): void }`
  - `runNotify(posts, config, deps): Promise<{ scheduled: number }>`; `waitUntilLive(url, deps, attempts = 10, intervalMs = 30_000): Promise<void>`
  - CLI: `node scripts/notify.ts <posts.json>` reading env `RESEND_API_KEY`, `NOTIFY_REPLY_TO`, `ANNOUNCE_SINCE`, `RESEND_SEGMENT_ID`, `TOPIC_NEW_POSTS_ID`, `DRY_RUN` (`"1"` = dry run), `GITHUB_STEP_SUMMARY` (optional). Exit code 1 on any failure.

- [ ] **Step 1: Write the failing tests**

  `workers/subscribe/test/notify-run.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { runNotify } from '../src/notify/run.ts';
  import type { NotifyConfig } from '../src/notify/run.ts';
  import type { PostEntry } from '../src/notify/posts.ts';
  import { broadcastName } from '../src/notify/select.ts';
  import type { BroadcastInput, EmailInput, ResendClient } from '../src/resend.ts';
  import { FROM } from '../src/config.ts';
  import { fakeFetch } from './helpers.ts';

  const NOW = new Date('2026-09-30T14:05:00Z');
  const CONFIG: NotifyConfig = {
    since: '2026-09-26',
    segmentId: 'seg_readers',
    topicId: 'topic_posts',
    replyTo: 'owner@example.net',
    dryRun: false,
  };
  const post = (day: number): PostEntry => ({
    url: `https://diyaz.dev/2026/09/${day}/p${day}.html`,
    path: `/2026/09/${day}/p${day}.html`,
    title: `Post ${day}`,
    description: `About post ${day}.`,
    date: `2026-09-${day}T08:00:00+00:00`,
  });

  function fakeResend(existingNames: string[] = []) {
    const broadcasts: BroadcastInput[] = [];
    const emails: EmailInput[] = [];
    const client: ResendClient = {
      listBroadcasts: async () => existingNames.map((name, i) => ({ id: `b_old_${i}`, name })),
      createBroadcast: async (input) => {
        broadcasts.push(input);
        return { id: `b_${broadcasts.length}` };
      },
      sendEmail: async (input) => {
        emails.push(input);
        return { id: `e_${emails.length}` };
      },
      getContact: async () => null,
      createContact: async () => ({ id: 'unused' }),
      updateContact: async () => {},
      addContactToSegment: async () => {},
      updateContactTopics: async () => {},
    };
    return { client, broadcasts, emails };
  }

  function setup(options: { existing?: string[]; status?: (url: string) => number } = {}) {
    const resend = fakeResend(options.existing);
    const site = fakeFetch((call) => new Response('', { status: options.status ? options.status(call.url) : 200 }));
    const logs: string[] = [];
    const summary: string[] = [];
    const deps = {
      resend: resend.client,
      fetch: site.fetch,
      sleep: async () => {},
      now: () => NOW,
      log: (line: string) => {
        logs.push(line);
      },
      summary: (md: string) => {
        summary.push(md);
      },
    };
    return { ...resend, deps, siteCalls: site.calls, logs, summary };
  }

  describe('runNotify', () => {
    it('does nothing when no post is new', async () => {
      const s = setup({ existing: [await broadcastName(post(30))] });
      expect(await runNotify([post(30)], CONFIG, s.deps)).toEqual({ scheduled: 0 });
      expect(s.siteCalls).toHaveLength(0);
      expect(s.broadcasts).toHaveLength(0);
    });

    it('checks the post is live, schedules one broadcast, and sends a heads-up', async () => {
      const s = setup();
      expect(await runNotify([post(30)], CONFIG, s.deps)).toEqual({ scheduled: 1 });
      expect(s.siteCalls.map((c) => c.url)).toEqual([post(30).url]);
      expect(s.broadcasts).toHaveLength(1);
      expect(s.broadcasts[0]).toMatchObject({
        segment_id: 'seg_readers',
        topic_id: 'topic_posts',
        from: FROM,
        reply_to: 'owner@example.net',
        subject: 'Post 30',
        name: await broadcastName(post(30)),
        send: true,
        scheduled_at: 'in 2 hours',
      });
      expect(s.emails).toHaveLength(1);
      expect(s.emails[0]).toMatchObject({ from: FROM, to: 'owner@example.net', subject: 'Scheduled ~16:05 UTC: Post 30' });
      expect(s.summary.join('\n')).toContain('Post 30');
    });

    it('in a dry run, checks and reports but sends nothing', async () => {
      const s = setup();
      expect(await runNotify([post(30)], { ...CONFIG, dryRun: true }, s.deps)).toEqual({ scheduled: 0 });
      expect(s.siteCalls).toHaveLength(1);
      expect(s.broadcasts).toHaveLength(0);
      expect(s.emails).toHaveLength(0);
      expect(s.logs.join('\n')).toContain('[dry run] would announce: Post 30');
    });

    it('fails without sending when a post never goes live', async () => {
      const s = setup({ status: () => 404 });
      await expect(runNotify([post(30)], CONFIG, s.deps)).rejects.toThrow(/not live/);
      expect(s.siteCalls).toHaveLength(10);
      expect(s.broadcasts).toHaveLength(0);
    });

    it('checks every candidate is live before sending any', async () => {
      const s = setup({ status: (url) => (url === post(29).url ? 200 : 404) });
      await expect(runNotify([post(29), post(30)], CONFIG, s.deps)).rejects.toThrow(/not live/);
      expect(s.broadcasts).toHaveLength(0);
    });

    it('propagates the missing-ANNOUNCE_SINCE refusal', async () => {
      const s = setup();
      await expect(runNotify([post(30)], { ...CONFIG, since: undefined }, s.deps)).rejects.toThrow(/ANNOUNCE_SINCE/);
      expect(s.broadcasts).toHaveLength(0);
    });

    it('never puts the reply-to address in logs or the summary', async () => {
      const s = setup();
      await runNotify([post(30)], CONFIG, s.deps);
      expect([...s.logs, ...s.summary].join('\n')).not.toContain('owner@example.net');
    });
  });
  ```

- [ ] **Step 2: Run to verify it fails**

  Run: `cd workers/subscribe && npx vitest run test/notify-run.test.ts`
  Expected: FAIL — `../src/notify/run.ts` not found.

- [ ] **Step 3: Implement**

  `workers/subscribe/src/notify/run.ts`:
  ```ts
  // Orchestrates one notify run. Output (log lines, job summary) is public in
  // GitHub Actions, so it carries post titles and broadcast IDs only.
  import { FROM } from '../config.ts';
  import type { Fetch } from '../env.ts';
  import type { ResendClient } from '../resend.ts';
  import { renderHeadsUpEmail, renderPostEmail } from './emails.ts';
  import type { PostEntry } from './posts.ts';
  import { broadcastName, selectCandidates } from './select.ts';

  const DELAY_MS = 2 * 60 * 60 * 1000; // must match scheduled_at below

  export interface NotifyConfig {
    since: string | undefined;
    segmentId: string;
    topicId: string;
    replyTo: string;
    dryRun: boolean;
  }

  export interface NotifyDeps {
    resend: ResendClient;
    fetch: Fetch;
    sleep: (ms: number) => Promise<void>;
    now: () => Date;
    log: (line: string) => void;
    summary: (markdown: string) => void;
  }

  // GitHub Pages can take a minute or two to serve a fresh deploy. Never email
  // a link that 404s.
  export async function waitUntilLive(
    url: string,
    deps: Pick<NotifyDeps, 'fetch' | 'sleep' | 'log'>,
    attempts = 10,
    intervalMs = 30_000,
  ): Promise<void> {
    for (let i = 1; i <= attempts; i++) {
      try {
        const res = await deps.fetch(url, { method: 'GET', redirect: 'follow' });
        if (res.status === 200) return;
        deps.log(`not live yet (${res.status}): ${url}`);
      } catch {
        deps.log(`not reachable yet: ${url}`);
      }
      if (i < attempts) await deps.sleep(intervalMs);
    }
    throw new Error(`Post not live after ${attempts} checks: ${url}`);
  }

  export async function runNotify(
    posts: PostEntry[],
    config: NotifyConfig,
    deps: NotifyDeps,
  ): Promise<{ scheduled: number }> {
    const announced = new Set((await deps.resend.listBroadcasts()).map((b) => b.name ?? ''));
    const candidates = await selectCandidates(posts, announced, { since: config.since, now: deps.now() });
    deps.log(`${candidates.length} post(s) to announce`);
    if (candidates.length === 0) return { scheduled: 0 };

    // Every candidate must be live before the first send, so a half-finished
    // deploy sends nothing rather than some of it.
    for (const post of candidates) await waitUntilLive(post.url, deps);

    if (config.dryRun) {
      for (const post of candidates) {
        deps.log(`[dry run] would announce: ${post.title}`);
        deps.summary(`- [dry run] would announce **${post.title}**`);
      }
      return { scheduled: 0 };
    }

    let scheduled = 0;
    for (const post of candidates) {
      const { id } = await deps.resend.createBroadcast({
        segment_id: config.segmentId,
        topic_id: config.topicId,
        from: FROM,
        reply_to: config.replyTo,
        name: await broadcastName(post),
        ...renderPostEmail(post),
        send: true,
        scheduled_at: 'in 2 hours',
      });
      const sendAt = new Date(deps.now().getTime() + DELAY_MS);
      await deps.resend.sendEmail({ from: FROM, to: config.replyTo, ...renderHeadsUpEmail(post, sendAt, id) });
      deps.log(`scheduled: ${post.title} (${id})`);
      deps.summary(`- **${post.title}**: sends ~${sendAt.toISOString().slice(11, 16)} UTC, broadcast \`${id}\``);
      scheduled++;
    }
    return { scheduled };
  }
  ```

  `workers/subscribe/scripts/notify.ts`:
  ```ts
  // Entry point for the `notify` job in .github/workflows/build.yml:
  //   node scripts/notify.ts <path/to/posts.json>
  // Env: RESEND_API_KEY, NOTIFY_REPLY_TO (secrets); ANNOUNCE_SINCE,
  // RESEND_SEGMENT_ID, TOPIC_NEW_POSTS_ID (repo variables); DRY_RUN=1 to only
  // report. Logs are public: never print secrets or addresses.
  import { appendFileSync, readFileSync } from 'node:fs';
  import type { Fetch } from '../src/env.ts';
  import { parsePosts } from '../src/notify/posts.ts';
  import { runNotify } from '../src/notify/run.ts';
  import { createResendClient } from '../src/resend.ts';

  function required(name: string): string {
    const value = process.env[name];
    if (!value) {
      console.error(`Missing environment variable ${name}`);
      process.exit(1);
    }
    return value;
  }

  const postsPath = process.argv[2];
  if (!postsPath) {
    console.error('Usage: node scripts/notify.ts <path/to/posts.json>');
    process.exit(1);
  }

  const fetchFn: Fetch = (input, init) => fetch(input, init);
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;

  try {
    const posts = parsePosts(JSON.parse(readFileSync(postsPath, 'utf8')));
    const result = await runNotify(
      posts,
      {
        since: process.env.ANNOUNCE_SINCE,
        segmentId: required('RESEND_SEGMENT_ID'),
        topicId: required('TOPIC_NEW_POSTS_ID'),
        replyTo: required('NOTIFY_REPLY_TO'),
        dryRun: process.env.DRY_RUN === '1',
      },
      {
        resend: createResendClient({ apiKey: required('RESEND_API_KEY'), fetch: fetchFn, sleep }),
        fetch: fetchFn,
        sleep,
        now: () => new Date(),
        log: (line) => console.log(line),
        summary: (markdown) => {
          if (summaryFile) appendFileSync(summaryFile, `${markdown}\n`);
        },
      },
    );
    console.log(`done: ${result.scheduled} scheduled`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  ```

- [ ] **Step 4: Run tests, typecheck, and a CLI smoke test**

  Run: `cd workers/subscribe && npm test && npm run typecheck`
  Expected: PASS, clean.

  Smoke-test the refusal path without any network or secrets:
  ```bash
  cd workers/subscribe && echo '[]' > $TMPDIR/posts-empty.json && RESEND_SEGMENT_ID=x TOPIC_NEW_POSTS_ID=x NOTIFY_REPLY_TO=x RESEND_API_KEY=x node scripts/notify.ts $TMPDIR/posts-empty.json; echo "exit=$?"
  ```
  Expected: it tries `GET https://api.resend.com/broadcasts` with a bogus key, prints the API's error message (e.g. `API key is invalid`) and `exit=1`. It must not print the key.

- [ ] **Step 5: Commit**

  ```bash
  git add workers/subscribe/src/notify/run.ts workers/subscribe/scripts/notify.ts workers/subscribe/test/notify-run.test.ts
  git commit -m "Add notify runner and CLI for scheduling post broadcasts"
  ```

---

### Task 9: `posts.json` and its build checks

**Files:**
- Create: `posts.json` (repo root)
- Modify: `.github/scripts/check-build.sh`, `.github/workflows/build.yml` (one `env` line on the future-build step)

**Interfaces:**
- Produces: `/posts.json` — array of ≤ 10 objects `{url, path, title, description, date}` (consumed by Task 8's `parsePosts`); env switch `CHECK_ALLOW_FUTURE=1` for `check-build.sh`.

- [ ] **Step 1: Add the failing check** to `.github/scripts/check-build.sh`, directly before the final `echo` / summary block:

  ```bash
  # --- posts.json feeds the newsletter announcer ----------------------------
  # workers/subscribe/scripts/notify.ts reads this file from the build output
  # to decide which posts to email. A malformed file stops announcements; a
  # future-dated entry would announce a post before it is public. The --future
  # validation build legitimately contains future posts, so CI sets
  # CHECK_ALLOW_FUTURE=1 for that run only.
  if [ -f "$SITE/posts.json" ]; then
    if ruby -rjson -rtime -e '
        posts = JSON.parse(File.read(ARGV[0]))
        abort "not an array" unless posts.is_a?(Array)
        abort "empty" if posts.empty?
        abort "#{posts.size} entries (max 10)" if posts.size > 10
        posts.each_with_index do |p, i|
          %w[url path title description date].each do |k|
            abort "entry #{i} missing #{k}" if p[k].to_s.strip.empty?
          end
          abort "entry #{i} url not on https://diyaz.dev/" unless p["url"].start_with?("https://diyaz.dev/")
          t = (Time.iso8601(p["date"]) rescue abort("entry #{i} date not ISO 8601: #{p["date"]}"))
          abort "entry #{i} is future-dated (#{p["date"]})" if ENV["CHECK_ALLOW_FUTURE"] != "1" && t > Time.now
        end
        puts "#{posts.size} entries"
      ' "$SITE/posts.json" >"$tmp" 2>&1; then
      pass "posts.json valid ($(cat "$tmp"))"
    else
      fail "posts.json invalid: $(cat "$tmp")"
    fi
  else
    fail "posts.json missing from build"
  fi
  ```

- [ ] **Step 2: Run the build checks to verify it fails**

  Run: `bundle exec jekyll build && ./.github/scripts/check-build.sh _site`
  Expected: `FAIL  posts.json missing from build`, exit 1.

- [ ] **Step 3: Implement** `posts.json` at the repo root:

  ```liquid
  ---
  layout: null
  sitemap: false
  ---
  {%- comment -%}
    The 10 most recent published posts, for the newsletter announcer
    (workers/subscribe/scripts/notify.ts). Built with future: false, so a
    future-dated post never appears here before its date.
  {%- endcomment -%}
  [
  {%- for post in site.posts limit:10 %}
    {
      "url": {{ post.url | absolute_url | jsonify }},
      "path": {{ post.url | jsonify }},
      "title": {{ post.title | jsonify }},
      "description": {{ post.description | default: post.excerpt | strip_html | normalize_whitespace | truncate: 300 | jsonify }},
      "date": {{ post.date | date_to_xmlschema | jsonify }}
    }{% unless forloop.last %},{% endunless %}
  {%- endfor %}
  ]
  ```

  In `.github/workflows/build.yml`, give the future-build validation step the switch (add the one `CHECK_ALLOW_FUTURE` line to its existing `env:`):
  ```yaml
        - name: Validate scheduled (future-dated) posts
          run: |
            bundle exec jekyll build --future --trace --strict_front_matter -d _site_future
            ./.github/scripts/check-build.sh _site_future
          env:
            JEKYLL_ENV: production
            # posts.json in this throwaway build legitimately lists future posts.
            CHECK_ALLOW_FUTURE: '1'
  ```

- [ ] **Step 4: Run both builds' checks**

  Run: `JEKYLL_ENV=production bundle exec jekyll build && ./.github/scripts/check-build.sh _site`
  Expected: `ok    posts.json valid (10 entries)` and `all checks passed`.

  Run: `JEKYLL_ENV=production bundle exec jekyll build --future -d _site_future && CHECK_ALLOW_FUTURE=1 ./.github/scripts/check-build.sh _site_future`
  Expected: `all checks passed`.

  Run: `JEKYLL_ENV=production bundle exec jekyll build --future -d _site_future && ./.github/scripts/check-build.sh _site_future; echo "exit=$?"`
  Expected: `FAIL  posts.json invalid: entry 0 is future-dated (…)`, `exit=1` (proves the guard works).

  Feed the real file to the parser as a cross-check:
  ```bash
  cd workers/subscribe && node -e "import('./src/notify/posts.ts').then(m => console.log(m.parsePosts(JSON.parse(require('fs').readFileSync('../../_site/posts.json','utf8'))).length))"
  ```
  Expected: `10`.

- [ ] **Step 5: Commit**

  ```bash
  git add posts.json .github/scripts/check-build.sh .github/workflows/build.yml
  git commit -m "Publish posts.json for the newsletter announcer, with build checks"
  ```

---

### Task 10: Subscribe form, pages, footer, analytics (site)

**Files:**
- Create: `_includes/subscribe.html`, `assets/js/subscribe.js`, `assets/css/subscribe.css`, `subscribe.html`, `subscribed.html`, `privacy.html`
- Modify: `_config.yml` (`subscribe:` block), `_layouts/post.html` (include after the share section), `_includes/footer.html`, `assets/js/analytics.js`, `.github/scripts/check-build.sh`

**Interfaces:**
- Consumes: the Worker wire protocol from Task 5 (field names `email`, `programmes`, `hp`, `cf-turnstile-response`; JSON `{ok, error}`).
- Produces: `site:subscribe` DOM event, `detail = { status: 'submitted' | 'failed', location: 'post' | 'page', programmes?: boolean, reason?: 'validation' | 'turnstile' | 'rate_limit' | 'server' | 'pending' | 'blocked' }`; PostHog events `subscribe_submitted {programmes, location}`, `subscribe_failed {reason, location}`.

- [ ] **Step 1: Add the failing build checks** to `.github/scripts/check-build.sh`, after the posts.json block from Task 9:

  ```bash
  # --- subscribe form follows the subscribe.enabled switch ------------------
  # The form ships dark (enabled: false) until the Worker is tested end to end.
  # Disabled: no page may render it. Enabled: every post must, and the public
  # Turnstile site key must be set or the form can never get a token.
  sub_enabled=$(ruby -ryaml -e 'puts((YAML.load_file(ARGV[0])["subscribe"] || {})["enabled"] == true)' "$REPO/_config.yml")
  if [ "$sub_enabled" = "true" ]; then
    missing=0
    for f in "$SITE"/2*/*/*/*.html; do
      [ -f "$f" ] || continue
      grep -q 'data-subscribe-form' "$f" || missing=$((missing + 1))
    done
    if [ "$missing" -eq 0 ]; then pass "subscribe form on every post"; else fail "$missing post(s) missing the subscribe form"; fi
    if ruby -ryaml -e 'k = ((YAML.load_file(ARGV[0])["subscribe"] || {})["turnstile_site_key"]).to_s; abort if k.strip.empty?' "$REPO/_config.yml"; then
      pass "subscribe.turnstile_site_key is set"
    else
      fail "subscribe.enabled is true but subscribe.turnstile_site_key is empty"
    fi
  else
    if grep -rl 'data-subscribe-form' "$SITE" --include='*.html' >"$tmp"; then
      fail "subscribe form rendered while subscribe.enabled is false:"
      sed 's/^/          /' "$tmp"
    else
      pass "no subscribe form while subscribe.enabled is false"
    fi
  fi

  for f in subscribe/index.html subscribed/index.html privacy/index.html; do
    if [ -s "$SITE/$f" ]; then pass "$f exists and is non-empty"; else fail "$f missing or empty"; fi
  done

  if [ -f "$SITE/sitemap.xml" ] && grep -q '/subscribed/' "$SITE/sitemap.xml"; then
    fail "/subscribed/ (a post-confirmation page) is in sitemap.xml"
  else
    pass "sitemap.xml omits /subscribed/"
  fi
  ```

- [ ] **Step 2: Run to verify it fails**

  Run: `JEKYLL_ENV=production bundle exec jekyll build && ./.github/scripts/check-build.sh _site`
  Expected: FAILs for `subscribe/index.html`, `subscribed/index.html`, `privacy/index.html` missing.

- [ ] **Step 3: Implement**

  `_config.yml` — add after the PostHog block:
  ```yaml
  # Email subscriptions (docs/superpowers/specs/2026-09-24-subscribe-form-design.md).
  # The form, the footer "Subscribe" link, and the form on /subscribe/ render
  # only when enabled. The Worker behind `endpoint` lives in workers/subscribe/.
  # turnstile_site_key is public (Cloudflare Turnstile widget "diyaz-subscribe").
  subscribe:
    enabled: false
    endpoint: "https://subscribe.diyaz.dev/subscribe"
    turnstile_site_key: ""
  ```

  `_includes/subscribe.html`:
  ```liquid
  {%- comment -%}
    Email subscribe form. Renders nothing unless site.subscribe.enabled.
    Params: location ("post" | "page", used for ids and analytics),
            heading (optional title above the form).
    Posts to the Worker in workers/subscribe/ (field names are its contract).
    Turnstile's api.js has no integrity= on purpose: Cloudflare updates it in
    place and requires loading it from this exact URL, so a pinned SRI hash
    would break the form on their next release (same as the PostHog loader).
  {%- endcomment -%}
  {%- if site.subscribe.enabled -%}
  <link rel="stylesheet" href="{{ site.baseurl }}/assets/css/subscribe.css">
  <section class="subscribe-box" aria-label="Subscribe by email">
    {%- if include.heading %}
    <h3 class="subscribe-title">{{ include.heading }}</h3>
    {%- endif %}
    <form class="subscribe-form" data-subscribe-form data-location="{{ include.location }}"
          data-endpoint="{{ site.subscribe.endpoint }}" data-sitekey="{{ site.subscribe.turnstile_site_key }}" novalidate>
      <div class="subscribe-row">
        <label class="sr-only" for="subscribe-email-{{ include.location }}">Email address</label>
        <input id="subscribe-email-{{ include.location }}" type="email" name="email" required autocomplete="email" placeholder="you@example.com">
        <button type="submit">Subscribe</button>
      </div>
      <label class="subscribe-check">
        <input type="checkbox" name="programmes" value="1">
        <span>Also send me occasional news about my coaching programmes.</span>
      </label>
      <div class="subscribe-hp" aria-hidden="true">
        <label>Leave this empty <input type="text" name="hp" tabindex="-1" autocomplete="off"></label>
      </div>
      <div class="subscribe-turnstile"></div>
      <p class="subscribe-status" role="status" aria-live="polite"></p>
      <p class="subscribe-note">You'll get an email to confirm. Unsubscribe any time. No open or click tracking. <a href="{{ '/privacy/' | relative_url }}">Privacy</a></p>
    </form>
    <noscript><p class="subscribe-note">Subscribing needs JavaScript. You can follow the <a href="{{ '/feed.xml' | relative_url }}">RSS feed</a> instead.</p></noscript>
  </section>
  <script src="{{ site.baseurl }}/assets/js/subscribe.js"></script>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&amp;onload=onSubscribeTurnstileLoad" async defer></script>
  {%- endif -%}
  ```

  `assets/js/subscribe.js`:
  ```js
  // Email subscribe form (see _includes/subscribe.html and workers/subscribe/).
  //
  // Turnstile is rendered explicitly so each form keeps its widget id: tokens
  // are single-use, so the widget is reset after every attempt. This file loads
  // (synchronously, after the form markup) before Turnstile's async api.js, so
  // the onload callback below always exists when api.js calls it.
  //
  // Analytics stay decoupled: this dispatches `site:subscribe` events and
  // analytics.js turns them into PostHog captures, like `site:search`.
  (function () {
    'use strict';

    var MESSAGES = {
      ok: 'Almost done: check your inbox and click the link to confirm.',
      validation: "That email address doesn't look right.",
      turnstile: "Couldn't verify you're human. Please try again.",
      rate_limit: 'Too many attempts. Please wait a minute and try again.',
      server: 'Something went wrong on my side. Please try again later.',
      pending: 'One moment: still checking you are not a bot. Try again in a second.',
      blocked: "The bot check didn't load (an ad blocker?). Allow challenges.cloudflare.com, or follow the RSS feed instead."
    };
    var SERVER_REASONS = ['validation', 'turnstile', 'rate_limit', 'server'];

    var forms = Array.prototype.slice.call(document.querySelectorAll('[data-subscribe-form]'));
    if (!forms.length) return;

    // Called by api.js via ?onload=.
    window.onSubscribeTurnstileLoad = function () {
      forms.forEach(function (form) {
        form._widgetId = window.turnstile.render(form.querySelector('.subscribe-turnstile'), {
          sitekey: form.getAttribute('data-sitekey'),
          action: 'subscribe',
          appearance: 'interaction-only'
        });
      });
    };

    forms.forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submit(form);
      });
    });

    function setStatus(form, kind, text) {
      var el = form.querySelector('.subscribe-status');
      el.textContent = text;
      el.setAttribute('data-kind', kind);
    }

    function emit(form, detail) {
      detail.location = form.getAttribute('data-location') || 'post';
      try {
        document.dispatchEvent(new CustomEvent('site:subscribe', { detail: detail }));
      } catch (err) {
        /* analytics only */
      }
    }

    function fail(form, reason) {
      setStatus(form, 'error', MESSAGES[reason]);
      emit(form, { status: 'failed', reason: reason });
    }

    function submit(form) {
      // No Turnstile at all (script blocked) vs. not finished yet: both must
      // tell the reader what to do, and neither sends a request.
      if (!window.turnstile || form._widgetId == null) return fail(form, 'blocked');
      var token = window.turnstile.getResponse(form._widgetId);
      if (!token) return fail(form, 'pending');

      var button = form.querySelector('button[type="submit"]');
      var programmes = form.elements.programmes.checked;
      var body = new URLSearchParams();
      body.set('email', form.elements.email.value);
      body.set('programmes', programmes ? '1' : '');
      body.set('hp', form.elements.hp.value);
      body.set('cf-turnstile-response', token);

      button.disabled = true;
      setStatus(form, 'busy', 'Sending…');

      // URLSearchParams body = form-encoded "simple" request: no CORS preflight.
      fetch(form.getAttribute('data-endpoint'), { method: 'POST', body: body })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            return { status: res.status, data: data };
          });
        })
        .then(function (r) {
          if (r.status === 200 && r.data.ok) {
            setStatus(form, 'ok', MESSAGES.ok);
            form.elements.email.value = '';
            emit(form, { status: 'submitted', programmes: programmes });
          } else {
            fail(form, SERVER_REASONS.indexOf(r.data.error) >= 0 ? r.data.error : 'server');
          }
        })
        .catch(function () {
          fail(form, 'server');
        })
        .then(function () {
          button.disabled = false;
          window.turnstile.reset(form._widgetId);
        });
    }
  })();
  ```

  `assets/css/subscribe.css`:
  ```css
  /* Email subscribe form (_includes/subscribe.html) and the plain pages
     /subscribe/, /subscribed/, /privacy/. Tokens from variables.css. */

  .subscribe-box {
    --subscribe-error: #b3261e;
    margin: 32px 0;
    padding: 20px;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    background: var(--color-bg-secondary);
  }
  [data-theme="dark"] .subscribe-box { --subscribe-error: #f2b8b5; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) .subscribe-box { --subscribe-error: #f2b8b5; }
  }

  .subscribe-title { margin: 0 0 12px; font-size: var(--font-size-lg); }
  .subscribe-row { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
  .subscribe-row input[type="email"] {
    flex: 1 1 220px;
    min-width: 0;
    padding: 10px 12px;
    font: inherit;
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
  }
  .subscribe-row button {
    padding: 10px 18px;
    font: inherit;
    font-weight: var(--font-weight-semibold);
    color: var(--color-bg);
    background: var(--color-primary);
    border: 0;
    border-radius: var(--radius-md);
    cursor: pointer;
  }
  .subscribe-row button:disabled { opacity: 0.6; cursor: wait; }
  .subscribe-check {
    display: flex;
    gap: var(--spacing-sm);
    align-items: flex-start;
    margin-top: 12px;
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
  }
  .subscribe-hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  .subscribe-turnstile:empty { display: none; }
  .subscribe-turnstile { margin-top: 12px; }
  .subscribe-status { min-height: 1.5em; margin: 12px 0 0; font-size: var(--font-size-sm); }
  .subscribe-status[data-kind="ok"] { color: var(--color-text); font-weight: var(--font-weight-medium); }
  .subscribe-status[data-kind="error"] { color: var(--subscribe-error); }
  .subscribe-note { margin: 8px 0 0; font-size: var(--font-size-xs); color: var(--color-text-muted); }

  /* Plain single-column pages (same shape as the series hub pages). */
  .simple-page { display: block; padding: 10px; }
  .simple-page-container {
    max-width: 720px;
    margin: 0 auto;
    padding: 30px;
    background-color: var(--color-panel-bg);
    border-radius: 10px;
  }
  @media (max-width: 600px) {
    .simple-page-container { padding: 20px 16px; }
  }
  ```

  `subscribe.html`:
  ```html
  ---
  title: Subscribe
  description: "Get new posts from diyaz.dev by email: one short note when something new goes up. Confirm by email, unsubscribe any time."
  permalink: /subscribe/
  ---
  <link rel="stylesheet" href="{{ site.baseurl }}/assets/css/subscribe.css">

  <div class="panel-container simple-page">
    <div class="simple-page-container">
      <h1>Subscribe</h1>
      <p>One short email when a new post goes up: the title, a line about it, and a link. Nothing else unless you ask for it.</p>
      {% if site.subscribe.enabled %}
        {% include subscribe.html location="page" %}
      {% else %}
        <p>Email subscriptions open soon. Until then, you can follow the <a href="{{ '/feed.xml' | relative_url }}">RSS feed</a>.</p>
      {% endif %}
    </div>
  </div>
  ```

  `subscribed.html`:
  ```html
  ---
  title: "You're subscribed"
  description: "Your subscription to new posts on diyaz.dev is confirmed."
  permalink: /subscribed/
  # Only reached from a confirmation link; nothing to index.
  sitemap: false
  ---
  <link rel="stylesheet" href="{{ site.baseurl }}/assets/css/subscribe.css">

  <div class="panel-container simple-page">
    <div class="simple-page-container">
      <h1>You're subscribed</h1>
      <p>Thanks for confirming. The next post will land in your inbox the day it goes up.</p>
      <p>Every email has a link to change what you get or to unsubscribe, and you can reply to any of them to reach me directly.</p>
      <p><a href="{{ '/blog.html' | relative_url }}">Browse the blog &rarr;</a></p>
    </div>
  </div>
  ```

  `privacy.html`:
  ```html
  ---
  title: Privacy
  description: "What diyaz.dev collects: cookieless analytics, and your email address only if you subscribe. Who processes it, how long it is kept, and your rights."
  permalink: /privacy/
  ---
  <link rel="stylesheet" href="{{ site.baseurl }}/assets/css/subscribe.css">

  <div class="panel-container simple-page">
    <div class="simple-page-container">
      <h1>Privacy</h1>
      <p>This is a personal site run by {{ site.author.name }}. It collects as little as it can. Last updated September 24, 2026.</p>

      <h2>If you subscribe by email</h2>
      <p><strong>What I store:</strong> your email address and which topics you chose ("New posts", and "Programmes" only if you ticked the box). Nothing is stored until you click the link in the confirmation email; an unconfirmed signup leaves no record.</p>
      <p><strong>Why:</strong> to send you what you asked for. The legal basis is your consent, which you can withdraw at any time with the link at the bottom of every email.</p>
      <p><strong>Who processes it:</strong></p>
      <ul>
        <li><strong>Resend</strong> (Resend, Inc.) keeps the subscriber list and delivers the emails, sending from its EU region.</li>
        <li><strong>Cloudflare</strong> runs the small service behind the form and the Turnstile check that tells people from bots. Turnstile looks at signals from your browser for that one purpose; in this setup it sets no cookies.</li>
      </ul>
      <p><strong>How long:</strong> until you unsubscribe. Emails have no open or click tracking.</p>

      <h2>Analytics</h2>
      <p>The site uses <a href="https://posthog.com" rel="noopener">PostHog</a> (EU cloud) in cookieless mode: no cookies, no local storage, IP addresses anonymised, and a visitor identifier that is a daily-rotating hash. It records things like page views, searches and whether a post was read to the end, so I can see what's useful.</p>

      <h2>Your rights</h2>
      <p>You can ask to see, correct or delete what's stored about you, or object to its use. If you're a subscriber, reply to any email; otherwise message me on <a href="https://www.linkedin.com/in/{{ site.author.linkedin }}/" rel="noopener">LinkedIn</a>. You can also complain to your data protection authority (in Finland, the Data Protection Ombudsman).</p>
    </div>
  </div>
  ```

  `_layouts/post.html` — insert on the blank line immediately before `<!-- Post Navigation -->` (i.e. after the share section closes):
  ```liquid

        {% include subscribe.html location="post" heading="Get the next post by email" %}
  ```

  `_includes/footer.html` — inside `<div class="footer-links">`, before the RSS link:
  ```liquid
              {% if site.subscribe.enabled %}
              <a href="{{ '/subscribe/' | relative_url }}" class="footer-link">Subscribe</a>
              {% endif %}
  ```
  and after the GitHub link:
  ```liquid
              <a href="{{ '/privacy/' | relative_url }}" class="footer-link">Privacy</a>
  ```

  `assets/js/analytics.js` — add after the `site:search` block (and extend the header comment's list with "email subscriptions"):
  ```js
    // --- Email subscribe form -----------------------------------------------
    // subscribe.js dispatches `site:subscribe` after each attempt. A confirmed
    // subscription shows up as a pageview of /subscribed/ (the Worker's
    // redirect target), so no event is needed for that step.
    document.addEventListener('site:subscribe', function (e) {
      var detail = e.detail || {};
      if (detail.status === 'submitted') {
        capture('subscribe_submitted', { programmes: !!detail.programmes, location: detail.location });
      } else if (detail.status === 'failed') {
        capture('subscribe_failed', { reason: detail.reason, location: detail.location });
      }
    });
  ```

- [ ] **Step 4: Verify with the form off (default) and on**

  Run: `JEKYLL_ENV=production bundle exec jekyll build && ./.github/scripts/check-build.sh _site`
  Expected: `ok    no subscribe form while subscribe.enabled is false`, the three pages exist, `sitemap.xml omits /subscribed/`, every page has exactly one h1, `all checks passed`.

  Simulate "on" with a throwaway override config (the Turnstile *test* site key):
  ```bash
  printf 'subscribe:\n  enabled: true\n  endpoint: "https://subscribe.diyaz.dev/subscribe"\n  turnstile_site_key: "1x00000000000000000000AA"\n' > $TMPDIR/_config.subscribe-on.yml
  JEKYLL_ENV=production bundle exec jekyll build --config _config.yml,$TMPDIR/_config.subscribe-on.yml -d $TMPDIR/_site_on
  grep -c 'data-subscribe-form' $TMPDIR/_site_on/2026/09/23/*.html $TMPDIR/_site_on/subscribe/index.html
  grep -c 'href="/subscribe/"' $TMPDIR/_site_on/index.html
  ```
  Expected: each post and `/subscribe/` report `1`; the homepage footer has the Subscribe link. (`check-build.sh` reads the repo `_config.yml`, so it stays in "off" mode here; the "on" branch is exercised in Task 13.)

  Look at it: `bundle exec jekyll serve --config _config.yml,$TMPDIR/_config.subscribe-on.yml` → open `http://localhost:4000/2026/09/23/After-the-Feed-Why-Social-Media-Stopped-Feeling-Like-Connection.html` and `http://localhost:4000/subscribe/` in the browser pane, light and dark theme, desktop and 375 px mobile. Check: form below the share buttons, no horizontal scroll on mobile, honeypot invisible, Turnstile widget hidden unless it needs interaction, status text readable in both themes.

- [ ] **Step 5: Commit**

  ```bash
  git add _config.yml _includes/subscribe.html _includes/footer.html _layouts/post.html assets/js/subscribe.js assets/js/analytics.js assets/css/subscribe.css subscribe.html subscribed.html privacy.html .github/scripts/check-build.sh
  git commit -m "Add subscribe form (off by default), subscribe/subscribed/privacy pages"
  ```

---

### Task 11: CI — Worker checks, posts artifact, notify job

**Files:**
- Modify: `.github/workflows/build.yml`

**Interfaces:**
- Consumes: `npm test`, `npm run typecheck`, `npm run build:check` (Tasks 2–8); `scripts/notify.ts` CLI and its env contract (Task 8); `_site/posts.json` (Task 9).
- Produces: job `worker` (every event); artifact `posts-json` (main only); job `notify` (main only, skipped until `vars.ANNOUNCE_SINCE` is set); `workflow_dispatch` input `dry_run`.

- [ ] **Step 1: Edit `.github/workflows/build.yml`**

  Replace the bare `workflow_dispatch:` trigger with:
  ```yaml
    workflow_dispatch:
      inputs:
        dry_run:
          description: "notify job: list the posts it would announce, send nothing"
          type: boolean
          default: false
  ```

  In the `build` job, after the `Upload Pages artifact` step:
  ```yaml
        # The notify job reads posts.json from this exact build, not the live
        # site (GitHub Pages caches responses for ~10 minutes).
        - name: Upload posts.json for notify
          if: github.ref == 'refs/heads/main'
          uses: actions/upload-artifact@v4
          with:
            name: posts-json
            path: _site/posts.json
            retention-days: 1
  ```

  Add two jobs after `deploy`:
  ```yaml
    # Subscribe Worker + announcer (workers/subscribe/): types, tests, and a
    # dry-run bundle so a Worker-only build error fails CI, not the deploy.
    worker:
      runs-on: ubuntu-latest
      defaults:
        run:
          working-directory: workers/subscribe
      steps:
        - name: Checkout repository
          uses: actions/checkout@v4

        - name: Set up Node
          uses: actions/setup-node@v4
          with:
            node-version: '24'
            cache: npm
            cache-dependency-path: workers/subscribe/package-lock.json

        - run: npm ci
        - run: npm run typecheck
        - run: npm test
        - name: Bundle without deploying
          run: npm run build:check

    # Emails newly published posts to subscribers (a Resend broadcast scheduled
    # 2 hours out, plus a heads-up to the author). Runs after every deploy of
    # main, including the Wednesday cron that reveals scheduled posts. Skipped
    # until ANNOUNCE_SINCE exists (i.e. before launch); the script also refuses
    # to run without it. Logs are public: the script prints titles and IDs only.
    notify:
      if: github.ref == 'refs/heads/main' && vars.ANNOUNCE_SINCE != ''
      needs: [deploy, worker]
      runs-on: ubuntu-latest
      permissions:
        contents: read
      defaults:
        run:
          working-directory: workers/subscribe
      steps:
        - name: Checkout repository
          uses: actions/checkout@v4

        - name: Set up Node
          uses: actions/setup-node@v4
          with:
            node-version: '24'
            cache: npm
            cache-dependency-path: workers/subscribe/package-lock.json

        - run: npm ci

        - name: Download posts.json from this build
          uses: actions/download-artifact@v4
          with:
            name: posts-json
            path: ${{ runner.temp }}/posts

        - name: Announce new posts
          run: node scripts/notify.ts "$RUNNER_TEMP/posts/posts.json"
          env:
            RESEND_API_KEY: ${{ secrets.RESEND_API_KEY_NOTIFY }}
            NOTIFY_REPLY_TO: ${{ secrets.NOTIFY_REPLY_TO }}
            ANNOUNCE_SINCE: ${{ vars.ANNOUNCE_SINCE }}
            RESEND_SEGMENT_ID: ${{ vars.RESEND_SEGMENT_ID }}
            TOPIC_NEW_POSTS_ID: ${{ vars.TOPIC_NEW_POSTS_ID }}
            DRY_RUN: ${{ inputs.dry_run && '1' || '' }}
  ```

- [ ] **Step 2: Validate the workflow file**

  Run: `ruby -ryaml -e 'w = YAML.load_file(".github/workflows/build.yml"); puts w["jobs"].keys.join(", "); puts w[true]["workflow_dispatch"]["inputs"].keys.inspect'`
  Expected: `build, deploy, worker, notify` and `["dry_run"]`. (Ruby parses the YAML key `on:` as `true`.)

  If `actionlint` is available (`brew install actionlint` is **not** to be run without asking), run `actionlint .github/workflows/build.yml` and expect no output.

- [ ] **Step 3: Commit, push the branch, open a PR, watch CI**

  ```bash
  git add .github/workflows/build.yml
  git commit -m "Run Worker checks in CI; add post-deploy notify job"
  git push -u origin claude/diyaz-subscribe-form-2730be
  ```
  Open a PR against `main` (title: "Email subscriptions: Worker, announcer, form (off)"). Expected on the PR: `build` green (form off, posts.json valid, future build valid), `worker` green, `deploy`/`notify` skipped (not main).

  **Do not merge yet** — merging is safe (form off, notify skipped) but waits for Diyaz's review of the PR.

---

### Task 12: Deploy the Worker and test end to end (Claude + Diyaz)

Requires Task 1. Deploying is outward-facing: get Diyaz's explicit go-ahead in chat before Step 2.

**Files:**
- Modify: `workers/subscribe/wrangler.jsonc` (fill the three IDs)

**Interfaces:**
- Consumes: IDs and site key from Task 1; the whole Worker.
- Produces: live `https://subscribe.diyaz.dev`; verified subscriber flow.

- [ ] **Step 1: Fill the IDs** from Task 1 into `wrangler.jsonc` `vars` (`RESEND_SEGMENT_ID`, `TOPIC_NEW_POSTS_ID`, `TOPIC_PROGRAMMES_ID`), then:

  ```bash
  cd workers/subscribe && npm test && npm run build:check
  git add wrangler.jsonc && git commit -m "Configure subscribe Worker with Resend team IDs" && git push
  ```

- [ ] **Step 2: First deploy, with localhost allowed for testing** (Diyaz is logged in via `npx wrangler login`):

  ```bash
  cd workers/subscribe && npx wrangler deploy --var "ALLOWED_ORIGINS:https://diyaz.dev,http://localhost:4000"
  ```
  Expected: output lists the custom domain `subscribe.diyaz.dev` and the `RL_IP`/`RL_EMAIL` bindings.

- [ ] **Step 3: Diyaz sets the Worker secrets** (each command prompts for the value; Claude never sees them):

  ```bash
  cd workers/subscribe && npx wrangler secret put RESEND_API_KEY
  ```
  ```bash
  cd workers/subscribe && npx wrangler secret put TOKEN_KEY
  ```
  ```bash
  cd workers/subscribe && npx wrangler secret put TURNSTILE_SECRET
  ```
  ```bash
  cd workers/subscribe && npx wrangler secret put REPLY_TO
  ```

- [ ] **Step 4: Smoke-test the endpoints** (no personal data involved):

  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' https://subscribe.diyaz.dev/nope
  curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://subscribe.diyaz.dev/
  curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Origin: https://evil.example' https://subscribe.diyaz.dev/subscribe
  curl -s -X POST -H 'Origin: https://diyaz.dev' --data 'email=nope&hp=' https://subscribe.diyaz.dev/subscribe
  curl -s https://subscribe.diyaz.dev/confirm?t=garbage | grep -c 'One more click'
  curl -s -X POST --data 't=garbage' https://subscribe.diyaz.dev/confirm | grep -c 'This link has expired'
  ```
  Expected, in order: `404`; `302 https://diyaz.dev/subscribe/`; `403`; `{"ok":false,"error":"validation"}`; `1`; `1`.

- [ ] **Step 5: End-to-end from a local build.** Create `$TMPDIR/_config.e2e.yml` with the **real** site key from Task 1 and analytics off:

  ```yaml
  subscribe:
    enabled: true
    endpoint: "https://subscribe.diyaz.dev/subscribe"
    turnstile_site_key: "<site key from Task 1>"
  posthog:
    api_key: ""
  ```
  ```bash
  bundle exec jekyll serve --config _config.yml,$TMPDIR/_config.e2e.yml --port 4000
  ```
  Diyaz, at `http://localhost:4000/subscribe/`:
  1. Subscribes with their own address, **Programmes unticked**. Expect "Almost done…". Confirmation email arrives from `diyaz@news.diyaz.dev`, reply-to = their inbox, link on `subscribe.diyaz.dev`.
  2. Opens the link → "One more click" page → **Confirm** → lands on `https://diyaz.dev/subscribed/` (404 until the site deploys it; the URL is what matters here).
  3. Resend (team diyaz.dev) → contact exists, in "diyaz.dev readers", New posts = subscribed, Programmes = not subscribed.
  4. Subscribes again with the same address, **Programmes ticked**, confirms → Programmes now subscribed (existing-contact path, Review Focus 2).
  5. Clicks **Confirm** again on the same page (back button, resubmit) → still ends on `/subscribed/`.
  6. Blocks `challenges.cloudflare.com` (browser devtools request blocking, or an ad blocker), reloads, submits → sees the "bot check didn't load" message; no request to `subscribe.diyaz.dev` in the network tab (Review Focus 5).
  7. Submits a bogus address like `nope` → "That email address doesn't look right."
  8. With the Network tab open on a post, confirms **no** request to `challenges.cloudflare.com` until clicking into the form (lazy Turnstile, which `/privacy/` promises).
  9. Consent round-trip (the PR-review critical case): subscribe with Programmes **ticked** and confirm → in Resend, open the preferences link from a test broadcast (or mark the contact unsubscribed in the dashboard) and unsubscribe from all → subscribe again with the box **unticked** and confirm → the contact is subscribed, New posts `opt_in`, **Programmes `opt_out`**.
  10. Note in the ledger what Resend actually does for a topics PATCH (merge or replace) and for a duplicate segment add; the code is correct either way, but record it.
  If step 3 or 4 shows a Resend API mismatch (e.g. a status other than 404/409 for "not found"/"already in segment"), fix `src/resend.ts` with a failing test first, redeploy, repeat.

- [ ] **Step 6: Lock origins back down to production**

  ```bash
  cd workers/subscribe && npx wrangler deploy
  ```
  Then: `curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Origin: http://localhost:4000' https://subscribe.diyaz.dev/subscribe` → `403`.

---

### Task 13: Launch — repo settings, switch on, dry run

Requires Tasks 11–12 and Diyaz's approval of the PR.

**Files:**
- Modify: `_config.yml` (`subscribe.enabled: true`, `turnstile_site_key`)

- [ ] **Step 1: Repo variables** (non-secret; Claude may run these with Diyaz's go-ahead):

  ```bash
  gh variable set RESEND_SEGMENT_ID --body "<segment id>"
  gh variable set TOPIC_NEW_POSTS_ID --body "<New posts topic id>"
  ```

- [ ] **Step 2: Repo secrets** (Diyaz runs these; each prompts for the value):

  ```bash
  gh secret set RESEND_API_KEY_NOTIFY
  ```
  ```bash
  gh secret set NOTIFY_REPLY_TO
  ```

- [ ] **Step 3: Switch the form on.** In `_config.yml`: `enabled: true`, `turnstile_site_key: "<site key from Task 1>"`.

  Run: `JEKYLL_ENV=production bundle exec jekyll build && ./.github/scripts/check-build.sh _site`
  Expected: `ok    subscribe form on every post`, `ok    subscribe.turnstile_site_key is set`, `all checks passed`.

  ```bash
  git add _config.yml && git commit -m "Switch on email subscriptions" && git push
  ```
  Diyaz merges the PR. Expected on `main`: `build`, `deploy`, `worker` green; `notify` **skipped** (`NOTIFY_ENABLED` not set yet).

- [ ] **Step 4: Verify production.** Open `https://diyaz.dev/subscribe/` and a post in the browser pane: form present, Turnstile widget loads, footer shows Subscribe + Privacy, `https://diyaz.dev/privacy/` renders. (Don't submit a real address unless Diyaz asks — they already tested the flow in Task 12.)

- [ ] **Step 5: Set the cutoff and dry-run the announcer.** `ANNOUNCE_SINCE` must be after Part 1 (2026-09-23 08:00 UTC) and on or before Part 2 (2026-09-30 08:00 UTC); use the launch day:

  ```bash
  gh variable set ANNOUNCE_SINCE --body "<launch day, e.g. 2026-09-26>"
  gh variable set NOTIFY_ENABLED --body "true"
  gh workflow run build.yml --ref main -f dry_run=true
  ```
  Expected in the `notify` job log: `0 post(s) to announce` and `done: 0 scheduled` (Part 2 is still future-dated).

- [ ] **Step 6: Watch the first real send** (Wed 2026-09-30): the 14:00 UTC cron run's `notify` job logs `1 post(s) to announce` and `scheduled: After the Feed | …`; Diyaz gets the heads-up around 14:10 UTC and the post email around 16:00 UTC. If the cron run is skipped by GitHub, trigger it manually: `gh workflow run build.yml --ref main`.

---

### Task 14: Record the change

**Files:**
- Modify: `ROADMAP.md` (Phase 6 "Newsletter signup")
- Modify (Obsidian vault, outside the repo): `wiki/domains/tech/diyaz-dev.md`, `wiki/projects/_index.md`
- Create: memory file `~/.claude/projects/-Users-diyaz-di-projects-diyazy-github-io/memory/newsletter-diyaz-dev.md` + pointer in `MEMORY.md`

- [ ] **Step 1: ROADMAP.md** — replace the deferred "Newsletter signup" item (the Buttondown/EmailOctopus/ConvertKit sub-list and example embed) with:

  ```markdown
  - [x] **Newsletter signup** — own list in a dedicated Resend team (`news.diyaz.dev`)
      - [x] Double opt-in via the `subscribe.diyaz.dev` Worker (`workers/subscribe/`),
        Turnstile + rate limits, POST-only confirmation
      - [x] Topics: "New posts" (default) and "Programmes" (opt-in only)
      - [x] New posts emailed automatically by the `notify` job after each deploy
        (scheduled 2 h out, heads-up email, cancel in Resend)
      - [x] Form on every post and on `/subscribe/`; `/privacy/` page
      - Design: `docs/superpowers/specs/2026-09-24-subscribe-form-design.md`
  ```
  Commit: `git add ROADMAP.md && git commit -m "ROADMAP: newsletter signup shipped" && git push`.

- [ ] **Step 2: Wiki article** (`wiki/domains/tech/diyaz-dev.md` in the vault): update **Status** (last change: email subscriptions), add a "Newsletter" bullet under Key Details (Resend team "diyaz.dev", `news.diyaz.dev`, Worker at `subscribe.diyaz.dev`, `notify` job, topics), flip the Plans-vs-reality row "Phase 6: newsletter signup" to ✅, and remove the resolved Open Question ("build it here, or reuse toptop.dev's Resend newsletter?" → answered: here, separate team). Update the Project Registry row's date.

- [ ] **Step 3: Memory.** Write `newsletter-diyaz-dev.md` (type `project`): what exists and where (Worker `diyaz-subscribe` on `subscribe.diyaz.dev`, Resend team "diyaz.dev" separate from the main account because contact `unsubscribed` is team-wide, the `ANNOUNCE_SINCE` gate, the 2 h cancel window, secrets live in Worker secrets + GitHub secrets, the Resend connector in Claude reaches only the old account). Link `[[posthog-diyaz-dev]]` and `[[diyaz-dev-migration]]`. Add its one-line pointer to `MEMORY.md`.
