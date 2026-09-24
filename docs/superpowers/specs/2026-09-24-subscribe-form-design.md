# Subscribe form — design spec

_Status: approved design, pre-plan · Date: 2026-09-24 · Author: Diyaz Yakubov (with Claude)_

Internal planning document. Not published (see `exclude` in `_config.yml`).

## 1. Goal

Let readers of `diyaz.dev` subscribe by email, for two purposes:

- **A. New-post alerts.** Every newly published post is emailed to subscribers
  automatically, with no manual writing. First target: "After the Feed"
  Part 2 on Wed 2026-09-30.
- **C. Audience for paid work.** Subscribers can opt in, separately, to
  occasional news about Diyaz's coaching programmes (TopTop, e.g. the Architect
  Track). Those emails are written by hand; only the opt-in is built here.

Closes ROADMAP Phase 6 "Newsletter signup (deferred)" and the wiki open question
"build it here, or reuse toptop.dev's Resend newsletter?" (answer: build it
here, in its own Resend team).

## 2. Motivation (PostHog, project 277133, 2026-09-17 → 2026-09-24)

- 20 visitors, 53 pageviews, 22 sessions. Daily visitors 2 → 6; the peak
  (6 visitors, 22 pageviews, 2 `post_read_completed`) is 2026-09-23, the day
  "After the Feed" Part 1 revealed.
- Referrers: `$direct` 16 visitors, internal 11, medium.com 1.
- Visitor counts are an **upper bound**: cookieless mode re-hashes identity
  daily, so one person on three days counts three times.
- Expectation at a 1–3% signup rate: a handful of subscribers over the series,
  not dozens. The case for building now is **timing** (a six-week weekly series
  whose readers have no way back to Part 2 except RSS), not volume.

## 3. Decisions (locked)

| Decision | Choice | Consequence |
|---|---|---|
| **Purpose** | A (new-post alerts) + C (optional programmes opt-in) | Two Resend topics; only A is automated. |
| **Whose list** | Diyaz's personal list | Emails come from Diyaz on `news.diyaz.dev`, not TopTop. Programmes reach only readers who ticked the box. |
| **Approach** | Cloudflare Worker + Resend (contacts, topics, broadcasts) + GitHub Actions announcer | No new vendor; hosted unsubscribe/preferences from Resend; ~230 lines of code. |
| **Resend account** | **Separate Resend team "diyaz.dev"** | Contact `unsubscribed` is account-wide ("unsubscribed from all Broadcasts"); a separate team keeps consent, abuse blast radius, and full-access keys away from toptop.dev, BusyPipe, Salpön, Eurojackpot Stats. |
| **Replies** | Reach Diyaz | `reply_to` set to Diyaz's inbox. The address is a secret (Worker + GitHub), never committed; `author.email` in `_config.yml` stays empty. |
| **Consent** | Double opt-in, encrypted stateless token, POST-confirm | No subscriber exists until the reader clicks **Confirm** on a page; link scanners that only GET cannot subscribe anyone. |
| **Email content** | Teaser: title + `description` + link | Readers land on the site (read-completion + programme links measurable). Text-first, no images, no open/click tracking. |
| **Send safety** | Broadcast scheduled "in 2 hours" + heads-up email to Diyaz | A cancel window that is actually noticed. |
| **Launch switch** | `subscribe.enabled` in `_config.yml` | Code ships dark; flipped after an end-to-end test against the deployed Worker. |

## 4. Architecture

```
 reader on a post                     subscribe.diyaz.dev (Worker)                      Resend team "diyaz.dev"
 [email] [☐ Programmes] [Subscribe] ─► POST /subscribe ── validate, Turnstile, rate ─► confirmation email
                                                                                          │
 reader's inbox ◄─────────────────────────────────────────────────────────────────────────┘
   "Confirm" link ───────────────────► GET /confirm?t=…  → page with [Confirm] button
                                       POST /confirm     → decrypt + expiry ─────────────► upsert contact:
                                          └─► 303 → diyaz.dev/subscribed/                    segment "diyaz.dev readers"
                                                                                             topic "New posts" opt_in
                                                                                             topic "Programmes" opt_in if ticked

 GitHub Actions build.yml
   push main / Wed cron / dispatch ─► build ─► deploy ─► notify ── new, live, unannounced? ─► broadcast "New posts",
                                                                                              scheduled in 2 h
                                                                                            ► heads-up email to Diyaz
```

Four units, each with one job:

1. **Resend team** — configuration only (§5).
2. **Worker** `workers/subscribe/` — signup + confirmation, stateless (§6).
3. **Site** — form include, `/subscribe/`, `/subscribed/`, `/privacy/`,
   `/posts.json`, analytics events (§7).
4. **Announcer** — `notify` job + `workers/subscribe/scripts/notify.ts` (§8).

The Worker runs on a **subdomain** because the `diyaz.dev` apex is a
DNS-only (grey-cloud) record pointing at GitHub Pages, which issues its own
certificate; routing a Worker on the apex would require proxying it.

## 5. Resend team "diyaz.dev" (manual setup by Diyaz)

- **Sending domain** `news.diyaz.dev`, region **EU** (matches the other five
  domains, all `eu-west-1`). DNS records added in Cloudflare as DNS-only.
  Open tracking **off**, click tracking **off**.
- **Segment** "diyaz.dev readers" — the one list.
- **Topics** (default subscription is **permanent** — verify before creating):

  | Topic | `default_subscription` | `visibility` | Meaning |
  |---|---|---|---|
  | New posts | `opt_in` | `public` | Receives post broadcasts unless opted out. |
  | Programmes | `opt_out` | `public` | Receives programme emails **only** if explicitly opted in; public so post-only readers can opt in later from the preferences page. |

- **API keys** (full access; Resend's sending-only keys cannot manage
  contacts or broadcasts), one per consumer so each can be revoked alone:
  `diyaz-subscribe-worker`, `diyaz-notify-gha`.
- **Sender:** `Diyaz Yakubov <diyaz@news.diyaz.dev>`; `reply_to`: Diyaz's inbox.

## 6. Worker — `subscribe.diyaz.dev`

Code: `workers/subscribe/` (TypeScript). `workers/` is added to `exclude:` in
`_config.yml` next to `docs/`. Custom domain via `wrangler.jsonc`
(`custom_domain: true`). Deployed manually with `npx wrangler deploy` (CI
deploy is out of scope).

### 6.1 Configuration

| Name | Kind | Committed? |
|---|---|---|
| `SITE_URL` (`https://diyaz.dev`), `ALLOWED_ORIGINS` | var | yes |
| `RESEND_SEGMENT_ID`, `TOPIC_NEW_POSTS_ID`, `TOPIC_PROGRAMMES_ID` | var | yes (IDs, not secrets) |
| `FROM` (`Diyaz Yakubov <diyaz@news.diyaz.dev>`) | var | yes |
| `RESEND_API_KEY` | secret | no |
| `TOKEN_KEY` (AES-GCM 256-bit, base64) | secret | no |
| `TURNSTILE_SECRET` | secret | no |
| `REPLY_TO` | secret | no (keeps the address out of the public repo) |
| Rate limiter | binding | yes |

`ALLOWED_ORIGINS` temporarily includes `http://localhost:4000` during the
end-to-end test (§10 step 4) and is reverted after.

### 6.2 `POST /subscribe`

Checks run in this order; the first failure responds:

1. `Origin` ∈ `ALLOWED_ORIGINS`, else 403. CORS headers only for allowed origins.
2. Honeypot field empty (else respond with the normal success body, send nothing).
3. Email present, ≤ 254 chars, plausible syntax, else 400.
4. Turnstile token verified with Siteverify (one-time token; pre-clearance
   **off**, so no `cf_clearance` cookie), else 403.
5. Per-IP rate limit (Workers rate-limiting binding; window chosen in the plan
   from the binding's supported periods), else 429.
6. Token = AES-GCM encrypt `{ email, programmes: bool, exp: now + 48h }`,
   base64url, random 96-bit IV prefixed.
7. Send the confirmation email (Resend transactional send, `from` = `FROM`):
   subject "Confirm your subscription to diyaz.dev"; one button linking
   `https://subscribe.diyaz.dev/confirm?t=<token>`; "If you didn't ask for
   this, ignore it: you won't be added." On Resend failure → 502.
8. 200 with the **same body regardless of whether the address is already
   subscribed** (no membership oracle).

### 6.3 `GET /confirm?t=…`

Serves a minimal self-contained HTML page (inline CSS, light/dark via
`prefers-color-scheme`) with a **Confirm subscription** button: a form that
POSTs `t` to `/confirm`. Headers: `Cache-Control: no-store`,
`Referrer-Policy: no-referrer`. Does **not** decrypt or touch Resend.

### 6.4 `POST /confirm`

1. Decrypt `t` with `TOKEN_KEY` (AES-GCM authenticates: tampering fails
   decryption). Invalid or `exp` passed → "This link has expired — subscribe
   again" page linking `SITE_URL/subscribe/`.
2. Upsert the contact in Resend:
   - add to segment "diyaz.dev readers";
   - topic "New posts" → `opt_in`;
   - topic "Programmes" → `opt_in` **only if** `programmes` is true. When false,
     leave the topic untouched (new contacts fall back to its `opt_out`
     default; an existing opt-in is not revoked by a later form).
     **Rule: the form only ever adds opt-ins; opt-outs happen on Resend's
     preferences page.**
   - `unsubscribed: false` (safe: the flag is scoped to this team only).
3. On Resend failure → page with a **Try again** button (same token, still valid).
4. Success → `303` to `SITE_URL/subscribed/`.

### 6.5 Logging

Log the failing step and HTTP status; **never** log email addresses or tokens.

## 7. Site changes (Jekyll)

- **Config** (`_config.yml`):
  ```yaml
  subscribe:
    enabled: false          # flip to true at launch (§10 step 5)
    endpoint: "https://subscribe.diyaz.dev/subscribe"
    turnstile_site_key: "" # public key
  ```
  Every include below renders nothing when `enabled` is false, mirroring the
  `posthog.api_key` gate.
- **`_includes/subscribe.html`** — email input, unchecked checkbox *"Also send
  me occasional news about my coaching programmes."*, hidden honeypot,
  Turnstile widget, button, and the note *"You'll get an email to confirm.
  Unsubscribe any time. No open or click tracking. [Privacy](/privacy/)"*.
  Submits with `fetch` and swaps in "Check your inbox to confirm." / an error
  message. `<noscript>`: "Subscribing needs JavaScript. You can follow the
  [RSS feed](/feed.xml) instead." Styled with the existing CSS variables
  (`assets/css/variables.css`), dark mode included.
- **Placement:** after `{{ content }}` in `_layouts/post.html`; on the new
  `/subscribe/` page; a "Subscribe" link in `_includes/footer.html` next to RSS.
- **`/subscribed/`** — thank-you page (the redirect target after confirming).
- **`/privacy/`** — what is collected (email, topic choices), purpose,
  processors (Resend — EU region; Cloudflare — Worker + Turnstile), retention
  (until unsubscribe), rights and contact route, plus the cookieless PostHog
  setup. Linked from the form note and the footer.
- **`/posts.json`** (`layout: null`, `sitemap: false`) — the 10 most recent
  **published** posts: `url` (absolute), `path`, `title`, `description`
  (fallback: stripped excerpt), `date` (`date_to_xmlschema`). Built with the
  production `future: false`, so future-dated posts never appear.
- **Analytics** (`assets/js/analytics.js`): `subscribe_submitted`
  (`{ programmes, location: "post" | "page" }`) on a 200 response;
  `subscribe_failed` (`{ reason: "validation" | "turnstile" | "rate_limit" |
  "server" }`). A confirmation = a `/subscribed/` pageview. Announcer links
  carry `utm_source=newsletter&utm_medium=email&utm_campaign=<slug>`.

## 8. Announcer — `notify` job

### 8.1 Placement

New job in `.github/workflows/build.yml`: `needs: deploy`, runs only on
`refs/heads/main` (push, the Wednesday `0 14 * * 3` cron, `workflow_dispatch`).
Separate from `deploy`, so a failure never blocks or rolls back a deploy.
Reads `posts.json` from **this run's build output** (not the live site, which
GitHub Pages caches ~10 min). Script: `workers/subscribe/scripts/notify.ts`,
sharing the email layout module with the Worker.

Configuration — repo **variables:** `ANNOUNCE_SINCE` (ISO date, launch day),
`RESEND_SEGMENT_ID`, `TOPIC_NEW_POSTS_ID`; repo **secrets:**
`RESEND_API_KEY_NOTIFY`, `NOTIFY_REPLY_TO`. The repository is public, so
workflow logs and the job summary are public: they contain post titles and
broadcast IDs only — never keys, the reply-to address, or subscriber data.

### 8.2 Selection

A post is a candidate when **all** hold:

1. `date >= ANNOUNCE_SINCE`. If `ANNOUNCE_SINCE` is unset → **fail**, never
   "announce everything".
2. No broadcast in the team is named `post:<path>` (paginate the full list).
3. `GET <url>` returns 200 (retry every 30 s for up to 5 min; still failing →
   job fails, nothing sent for that post).

**Fuse:** more than **3** candidates in one run → job fails **before sending
anything**.

### 8.3 Sending (per candidate)

- `POST /broadcasts`: `segment_id` = readers, `topic_id` = New posts,
  `from`, `reply_to`, `subject` = post title, `name` = `post:<path>`, `html` +
  `text`, `send: true`, `scheduled_at: "in 2 hours"`.
- Heads-up transactional email to `NOTIFY_REPLY_TO`: *"Scheduled for ~HH:MM
  UTC: {title}. Cancel: https://resend.com/broadcasts/{id}"*.
- Append title, scheduled time, broadcast ID to `$GITHUB_STEP_SUMMARY`.

Any Resend error → job fails (GitHub notifies Diyaz). Re-running is safe:
announced posts are skipped by rule 2.

`workflow_dispatch` input `dry_run` (default `false`): run selection, print
the candidates, send nothing.

### 8.4 Email content (teaser)

Text-first, no images, HTML + plain text:

- Post title (heading) and `description`.
- **Read it on diyaz.dev →** — post URL + UTM parameters (§7).
- Footer: "You're getting this because you subscribed on diyaz.dev. Just hit
  reply to reach me." and the preferences/unsubscribe link
  `{{{RESEND_UNSUBSCRIBE_URL}}}`.

Timing: a Wednesday post dated 08:00 UTC reveals with the 14:00 UTC cron and
sends ~16:00 UTC (19:00 Helsinki). A post merged on another day sends 2 h
after that deploy.

## 9. Testing (TDD)

- **Worker** — Vitest with `@cloudflare/vitest-pool-workers` (runs in workerd):
  token round-trip; tampered and expired tokens rejected; `/subscribe` check
  order (origin → honeypot → email → Turnstile → rate limit) with Turnstile and
  Resend mocked; identical 200 body for new and existing addresses;
  `GET /confirm` renders the button and never calls Resend; `POST /confirm`
  upserts with the right topics (Programmes untouched when unticked) and 303s;
  each §6 failure path returns its page/status; no email address in log output.
- **Announcer** — selection as a pure function (`ANNOUNCE_SINCE` unset → error,
  cutoff, already-announced, fuse); renderer output contains
  `{{{RESEND_UNSUBSCRIBE_URL}}}`, the UTM link, and no `<img>`.
- **CI** — `build.yml` runs `workers/subscribe` tests on every PR.
  `check-build.sh` asserts `posts.json` exists and parses, contains no post
  dated in the future, and (when `subscribe.enabled`) the form include renders
  on post pages; with it disabled, no form markup appears.

## 10. Rollout (target: Part 2, Wed 2026-09-30)

| # | Step | Owner |
|---|---|---|
| 1 | Create Resend team "diyaz.dev"; add + verify `news.diyaz.dev` (EU) via Cloudflare DNS; create segment and both topics (review §5 table first); create the two API keys. Create the Turnstile widget (pre-clearance off). | Diyaz (account creation and API keys stay with Diyaz; Claude provides exact steps) |
| 2 | `wrangler secret put` for the Worker; `gh secret set` / `gh variable set` for the repo. | Diyaz (commands prepared by Claude) |
| 3 | PR: Worker, site changes, `posts.json`, announcer, tests — with `subscribe.enabled: false`. | Claude |
| 4 | Deploy the Worker; end-to-end test from a local build (localhost temporarily allowed): Diyaz subscribes with their own address, confirms, the contact appears in Resend with the right topics; revert `ALLOWED_ORIGINS`. | Claude + Diyaz |
| 5 | Set `ANNOUNCE_SINCE` = launch day; `subscribe.enabled: true`; dispatch `notify` with `dry_run: true` → expect 0 candidates. | Claude |
| 6 | Wed 2026-09-30 ~14:10 UTC heads-up email; ~16:00 UTC Part 2 goes to subscribers. | Automatic |
| 7 | Update ROADMAP Phase 6, the wiki article `wiki/domains/tech/diyaz-dev`, and the Project Registry. | Claude |

The Resend connector available to Claude reaches the **existing** account
only; the new team is invisible to it unless connected separately. Nothing in
this design depends on that.

## 11. Out of scope

- Programme emails themselves (written and sent by hand from the Resend
  dashboard to the Programmes topic).
- Welcome email / drip sequence; digest mode.
- Syncing with toptop.dev's newsletter (Vercel KV).
- CI deployment of the Worker.
- Subscribe form on the homepage; subscriber counts on the site.
- Images, open tracking, click tracking in emails.

## 12. To confirm while planning

- Resend supports several teams under one login. If not, use a separate Resend
  account; the design is unchanged either way.
- Workers rate-limiting binding: supported `period` values → pick the window.
- Resend: contact upsert semantics (create on an existing email), broadcast
  `name` length limit, broadcasts list pagination, whether the hosted
  preferences page lists `public` topics as expected.
- Resend plan limits for the new team (domains, contacts, monthly sends) —
  expected volume is tiny, but the free plan's limits must fit.
- Retrieving `posts.json` in the `notify` job from the Pages artifact
  (`github-pages` tarball) vs a separate small artifact uploaded by `build`.
