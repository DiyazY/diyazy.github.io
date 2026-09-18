# After the Feed — series design spec

_Status: approved shape, pre-drafting · Date: 2026-09-18 · Author: Diyaz Yakubov (with Claude)_

Internal planning document. Not published (see `exclude` in `_config.yml`).

## 1. Goal

Turn the source document _"Architecture of the Post-Algorithmic Social
Paradigm"_ (`~/Downloads/Innovative Social Media Niches.docx`) into a multi-part
blog series on `diyaz.dev`, in the same house style and machinery as the
existing **Speculative Design** series.

The source is a dense strategy/whitepaper (a VC-style pitch for one startup). The
series is **not** that. It is a **field guide**: first-person, plain-spoken
essays explaining how consumer social media is breaking and what is being built
to replace it, using the source's concept as one worked example rather than a
product pitch.

## 2. Decisions (locked)

| Decision | Choice | Consequence |
|---|---|---|
| **Stance** | Field guide | First-person explainer voice; real apps are the anchor; the `aperture.photos` concept is an illustration, never "buy my startup." |
| **Audience / depth** | Hybrid | Parts 1–4 fully general-reader; Parts 5–6 flagged "deep dive" that casual readers can skip. |
| **Fact-checking** | Verify load-bearing stats first | Web-verify key figures against primary sources before drafting the parts that use them; replace/cut weak cites. |
| **Series name** | **After the Feed** | Tag `after-the-feed`; hub `/after-the-feed.html`; title prefix `After the Feed \| <subtitle>`. |
| **Visuals** | Claude generates | Consistent SVG covers (`img-01`) + inline diagrams for the paradigm table and the 5-layer pipeline; light/dark friendly. |
| **Process** | Spec → verify → pilot Part 1 → batch 2–7 | De-risks the voice rewrite on one post before committing to seven. |

## 3. Voice & format contract (match the Sept-2026 posts, NOT the Medium imports)

Reference exemplar: `_posts/2026-09-03-Speculative-Design-Ethics-and-Ownership.md`.

Every post:
- **Frontmatter:** `layout: post`, `author: Diyaz Yakubov`, `title: "After the Feed | <subtitle>"`, an SEO `description` (1–2 sentences), UTC `date`, `background: /assets/images/posts/<slug>/img-01.png`, `excerpt_separator: <!--more-->`, `tags: [after-the-feed, …]`.
- **Opener:** `_Part N of the After the Feed series. [See all parts &rarr;](/after-the-feed.html)_` (Part 1 uses a "Start here / opening of a seven-part series" variant).
- One `<!--more-->` break after the first paragraph or two.
- `##` section headers; short paragraphs; concrete over abstract.
- Explicit **call-backs** to earlier parts and a **forward link** footer: `_Next: [Part N+1 — <title> &rarr;](/YYYY/MM/DD/<slug>.html)_`.
- A real `## References` list (markdown links, primary sources).
- Voice rules: plain words over jargon ("epistemic trust" → "whether you can believe what you see"); one idea at a time; earn every number; no hype; plant a question, pay it off later.

Permalink format is `/:year/:month/:day/:title.html` (Jekyll default; confirmed by existing cross-links). No `future: true` in config → **posts must be dated today-or-earlier to build**, which sets the cadence approach (§7).

## 4. The arc — 7 parts

Slugs below are the filename stem after the date (`_posts/YYYY-MM-DD-<slug>.md`).

### Part 1 — Start here · slug `After-the-Feed-Why-Social-Media-Stopped-Feeling-Like-Connection`
Why social media stopped feeling like connection. Algorithmic saturation,
digital burnout, the collapse of "can I believe this image," and the
intention-action gap (people say they're exhausted, screen time still climbs).
Ends by naming the wedge the rest of the series follows: **authenticity /
believable human presence**. Anchor data: ad-blocking %, the "recommendations
vs. friends" survey, the 3-era shift (render as a diagram). Sets up the whole
series.

### Part 2 — slug `After-the-Feed-How-the-Last-Three-Takeovers-Actually-Happened`
WhatsApp, Instagram, Telegram. Each won not on features but on an orthogonal
shift — the address book as identity, the camera's flaws turned into a look,
multi-jurisdiction servers + bots. The shared pattern: strip incumbent
monetization friction, establish trust, couple a frictionless primitive to an
overlooked hardware capability. This is the lens for judging what comes next.

### Part 3 — slug `After-the-Feed-The-Apps-Quietly-Proving-People-Want-Out`
The counter-cultural vanguard already validating the thesis: Locket (ambient
widget, 20-friend cap), Retro (chronological journal, physical postcards),
Halide Process Zero (anti-AI camera), Fujifilm Instax (the analog revival).
Each one is a proof that constraints + authenticity + tangibility retain users
and make money without ads.

### Part 4 — slug `After-the-Feed-Three-Openings-Nobody-Has-Fully-Built`
The three white spaces as reader-facing product ideas, not a pitch: (1) the
optical-truth network (hardware-signed real photos), (2) the tactile artifact
network (digital staging → physical prints), (3) the ambient close circle
(Dunbar-capped, no public metrics). What each would feel like; why now.

### Part 5 — DEEP DIVE · slug `After-the-Feed-How-You-Would-Actually-Build-It`
How you'd actually build an anti-algorithmic network: the AT Protocol's
decoupled layers (identity / storage / relay / AppView / labeler), hardware
attestation + C2PA at the sensor, and — critically — how you **hide all of it**
(passkeys instead of seed phrases, managed PDS, one-click portability). Flagged
so casual readers can skip. Include the 5-layer pipeline diagram; keep the
Lexicon schema as an optional aside, not the spine.

### Part 6 — DEEP DIVE · slug `After-the-Feed-How-It-Pays-For-Itself-Without-Ads`
The economics: why surveillance ads are rejected on purpose, and what replaces
them — archival subscriptions, physical-print commerce, a creator profile
market. Unit economics at 100k MAU (blended cost/user, gross margins). Flagged
deep dive. Tables become clean comparison graphics.

### Part 7 — slug `After-the-Feed-Where-This-Goes-Next`
The phased roadmap distilled, then an honest close in the Speculative-Design
tradition: the hopeful version, the grim version, and the boring-but-likely one
in between. Ties the wedge (authenticity) back to the opening.

> If Part 5 runs long in drafting, split "invisible crypto / onboarding" back
> into its own Part (restoring the original 8-part structure).

## 5. Hub page — `after-the-feed.html`
Clone `speculative-design.html`. Change: `<h1>`, the `title`/`description`/
`image` frontmatter, the `where_exp` tag to `after-the-feed`, the
`remove_first` prefix to `"After the Feed | "`, and a new `series-intro`
paragraph. The ordered list auto-collects by tag + date, same as the exemplar.
Add a link to it wherever `speculative-design.html` is currently linked
(check `blog.html` / nav / homepage).

## 6. Verification ledger (fill during the pre-draft pass)

Verify against **primary** sources; replace Scribd/dataintelo/accio/aggregator
cites or soften the claim.

| Claim | Doc value | Finding (verified 2026-09-18) | Status |
|---|---|---|---|
| Locket downloads / revenue | 90M+ / ~$400k/mo | **Correct to ~80M total downloads, ~$300k/mo** (Sensor Tower Mar 2026; substack). 90M unsupported. | ✅ corrected |
| Retro Series A | $21M, Thrive, 1.7M MAU | $21M **led by Field Ventures + Thrive** (not Thrive alone); 1.7M MAU ✓; ~7M downloads; +460% spend ✓ (TechCrunch 2026-08-28). | ✅ corrected |
| Halide Process Zero | anti-AI raw pipeline | ✓ Confirmed: single-exposure RAW, no AI/computational, HEIF+DNG, works on non-Pro iPhones (Lux Camera, DPReview, TechCrunch). | ✅ |
| Fujifilm Instax revenue | ¥150B+, >$1B, 63% of profit | ¥150B record ✓ (>$1B); imaging div rev ¥469.7B, op income ¥101.9B FY23/24. **63%-of-profit split unverified → soften to "a major share."** | ✅ (soften split) |
| Instant-camera market size | $1.4–4.2B → $7.8B 2034 | **Not supported.** 2024 ≈ $1.35–1.53B; 2034 forecasts range $1.2–3.9B across firms. $7.8B has no basis. **Frame qualitatively.** | ✅ reframed |
| Ad-blocking adoption | 42.7% | 42.7% is Statista (≥1 device); GWI ~29.5%, DataReportal ~32.5%. **Frame as "~a third, by some counts >40%."** | ✅ (attribute) |
| "Recs less interesting than friends" | 69% / 57% refuse influencer | **Unverifiable** in public Mintel materials (was in Scribd PDF). **DROP the numbers.** Keep Mintel's real "Anti-Algorithm" 2026 trend qualitatively. | ✅ dropped |
| Digital-burnout / intention-action gap | frontiersin 2026 | **Better anchors found:** Incogni "great digital fatigue" — 55% post less than 5y ago, 47% deleted an app over stress (61% Millennials, 56% Gen Z); ScienceDirect on algorithmic awareness; study: algorithmic dependency predicts burnout > total usage. | ✅ upgraded |

Rule of thumb (held): if a number can't be traced to a credible primary within a
reasonable search, it doesn't go in the post under Diyaz's name.

**Part 1 approved number set:** ad-blocking "~a third, >40% by some counts"
(GWI/Statista); Mintel Anti-Algorithm trend (qualitative); Incogni fatigue
figures (55% / 47% / 61%); the algorithmic-dependency-vs-usage finding. The
3-era shift is conceptual (diagram, no stats).

## 7. Cadence & rollout (weekly drip)
Decided: reveal one post per Wednesday, starting 2026-09-23. Mechanism:
- Each post is **future-dated** to its Wednesday (08:00 UTC). `future: false` in
  `_config.yml` keeps future-dated posts out of the build entirely — no page, no
  URL — so they stay hidden until their date.
- A **weekly cron** in `.github/workflows/build.yml` (`0 14 * * 3`, Wednesdays
  14:00 UTC) rebuilds and deploys, revealing that week's post. Manual
  `workflow_dispatch` is the catch-up if a scheduled run is skipped.
- Filename date = frontmatter date = URL date = cover-dir date, all the Wednesday
  (the post URL follows the frontmatter `date`, verified empirically).
- **Forward** cross-links (to a not-yet-published part) point to the hub so they
  never 404 mid-rollout; **backward** links point directly to the earlier part.

| Part | Reveal (Wed) | URL |
|---|---|---|
| 1 | 2026-09-23 | /2026/09/23/After-the-Feed-Why-Social-Media-Stopped-Feeling-Like-Connection.html |
| 2 | 2026-09-30 | /2026/09/30/After-the-Feed-How-the-Last-Three-Takeovers-Actually-Happened.html |
| 3 | 2026-10-07 | /2026/10/07/After-the-Feed-The-Apps-Quietly-Proving-People-Want-Out.html |
| 4 | 2026-10-14 | /2026/10/14/After-the-Feed-Three-Openings-Nobody-Has-Fully-Built.html |
| 5 | 2026-10-21 | /2026/10/21/After-the-Feed-How-You-Would-Actually-Build-It.html |
| 6 | 2026-10-28 | /2026/10/28/After-the-Feed-How-It-Pays-For-Itself-Without-Ads.html |
| 7 | 2026-11-04 | /2026/11/04/After-the-Feed-Where-This-Goes-Next.html |

Caveat: the post source lives in the public repo once merged; only the built
pages are hidden until each date. Hiding the source too would need a manual
weekly merge instead of the cron.

## 8. Out of scope
- No changes to the Speculative Design series.
- No new analytics/PostHog work (existing cookieless setup covers new posts).
- No unrelated site refactors.
