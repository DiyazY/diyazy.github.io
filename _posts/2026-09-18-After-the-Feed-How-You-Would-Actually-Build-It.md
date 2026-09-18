---
layout: post
author: Diyaz Yakubov
title: "After the Feed | How you'd actually build it (deep dive)"
description: "The mechanics of an anti-algorithmic network: an open protocol that splits the pieces apart, a photo signed as real at the shutter, and the trick of hiding all the cryptography behind a normal app."
date: 2026-09-18 08:00:00 UTC
background: /assets/images/posts/2026-09-18-After-the-Feed-How-You-Would-Actually-Build-It/img-01.png
excerpt_separator: <!--more-->
tags: [after-the-feed, technology, protocols, deep-dive]
---
_Part 5 of **After the Feed**, a field guide to how social media gets rebuilt. [See all parts &rarr;](/after-the-feed.html)_

**Heads up:** Parts 5 and 6 are the deep dives — the actual mechanics. If you're here for the story rather than the plumbing, [skip to Part 7](/2026/09/18/After-the-Feed-Where-This-Goes-Next.html) and you won't miss the argument. Still here? Good. Let's build the thing from [Part 4](/2026/09/18/After-the-Feed-Three-Openings-Nobody-Has-Fully-Built.html).

<!--more-->

## The one idea that makes it possible: take the network apart

Every incumbent social platform is one company holding four things at once: your **identity**, your **data**, the **feed** that ranks it, and the **moderation** that governs it. That bundling is the source of the lock-in — and of the ad-driven feed you can't escape.

The move is to *unbundle* it. There's an open standard for exactly this — the [AT Protocol](https://atproto.com/), the plumbing under Bluesky — and its whole premise is that those four jobs should be separate layers that different parties can run and swap. Split them apart and portability, verification, and non-ad business models all become possible, because no single company owns the whole stack anymore.

Concretely, a post travels through five roles:

<figure class="diagram" role="group" aria-label="The five-layer pipeline of an open, verified social network">
<svg viewBox="0 0 560 596" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;max-width:560px;display:block;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif" role="img" aria-labelledby="pipeTitle pipeDesc">
<title id="pipeTitle">Five-layer pipeline</title>
<desc id="pipeDesc">Capture signs the photo as real; a personal data server stores it; a relay broadcasts it; an AppView builds feeds and re-checks signatures; a labeler stamps verified or flags unverifiable posts.</desc>
<defs>
<marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10 z" fill="var(--color-accent, #c9a227)"/>
</marker>
</defs>
<!-- arrows -->
<line x1="280" y1="108" x2="280" y2="130" stroke="var(--color-accent, #c9a227)" stroke-width="2" marker-end="url(#arrow)"/>
<line x1="280" y1="226" x2="280" y2="248" stroke="var(--color-accent, #c9a227)" stroke-width="2" marker-end="url(#arrow)"/>
<line x1="280" y1="344" x2="280" y2="366" stroke="var(--color-accent, #c9a227)" stroke-width="2" marker-end="url(#arrow)"/>
<line x1="280" y1="462" x2="280" y2="484" stroke="var(--color-accent, #c9a227)" stroke-width="2" marker-end="url(#arrow)"/>
<!-- 1 capture (accent) -->
<rect x="60" y="16" width="440" height="92" rx="12" fill="var(--color-bg-secondary, #f2f2f2)" stroke="var(--color-accent, #c9a227)" stroke-width="2"/>
<text x="84" y="44" letter-spacing="1.5" font-size="12" fill="var(--color-accent, #c9a227)">01 · CAPTURE</text>
<text x="84" y="70" font-size="18" font-weight="700" fill="var(--color-text, #333)">The camera signs the shot</text>
<text x="84" y="92" font-size="13.5" fill="var(--color-text-light, #666)">Secure hardware marks it real at the shutter.</text>
<!-- 2 PDS -->
<rect x="60" y="134" width="440" height="92" rx="12" fill="var(--color-bg-secondary, #f2f2f2)" stroke="var(--color-border, rgba(42,37,33,0.1))"/>
<text x="84" y="162" letter-spacing="1.5" font-size="12" fill="var(--color-accent, #c9a227)">02 · PERSONAL DATA SERVER</text>
<text x="84" y="188" font-size="18" font-weight="700" fill="var(--color-text, #333)">You own the storage</text>
<text x="84" y="210" font-size="13.5" fill="var(--color-text-light, #666)">The signed photo lives here — not in a silo.</text>
<!-- 3 relay -->
<rect x="60" y="252" width="440" height="92" rx="12" fill="var(--color-bg-secondary, #f2f2f2)" stroke="var(--color-border, rgba(42,37,33,0.1))"/>
<text x="84" y="280" letter-spacing="1.5" font-size="12" fill="var(--color-accent, #c9a227)">03 · RELAY</text>
<text x="84" y="306" font-size="18" font-weight="700" fill="var(--color-text, #333)">The firehose</text>
<text x="84" y="328" font-size="13.5" fill="var(--color-text-light, #666)">Broadcasts new posts across the network.</text>
<!-- 4 appview -->
<rect x="60" y="370" width="440" height="92" rx="12" fill="var(--color-bg-secondary, #f2f2f2)" stroke="var(--color-border, rgba(42,37,33,0.1))"/>
<text x="84" y="398" letter-spacing="1.5" font-size="12" fill="var(--color-accent, #c9a227)">04 · APPVIEW</text>
<text x="84" y="424" font-size="18" font-weight="700" fill="var(--color-text, #333)">Builds the feed you see</text>
<text x="84" y="446" font-size="13.5" fill="var(--color-text-light, #666)">Indexes posts and re-checks each signature.</text>
<!-- 5 labeler (accent) -->
<rect x="60" y="488" width="440" height="92" rx="12" fill="var(--color-bg-secondary, #f2f2f2)" stroke="var(--color-accent, #c9a227)" stroke-width="2"/>
<text x="84" y="516" letter-spacing="1.5" font-size="12" fill="var(--color-accent, #c9a227)">05 · LABELER</text>
<text x="84" y="542" font-size="18" font-weight="700" fill="var(--color-text, #333)">Stamps &ldquo;verified real&rdquo;</text>
<text x="84" y="564" font-size="13.5" fill="var(--color-text-light, #666)">Or flags what can&rsquo;t be proven.</text>
</svg>
<figcaption>The pipeline. The two gold steps are where trust is created and checked; the rest is just moving data. Because the layers are separate, you can own your data and still use anyone's app.</figcaption>
</figure>

The two highlighted steps are the whole point of the exercise. Everything else — storage, broadcast, indexing — is ordinary infrastructure. Trust gets *created* at capture and *checked* at the label.

## Signing the photo at the shutter

Here's the part that makes "verified real" more than a marketing badge. Modern phones have a **secure enclave** — isolated hardware that already guards your fingerprint, face scan, and payment keys. At the instant you take a photo, the app can ask that hardware to do two things: attest that the app itself is genuine and untampered (via [Apple App Attest](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity) or [Google Play Integrity](https://developer.android.com/google/play/integrity)), and cryptographically sign the raw image plus a [C2PA](https://c2pa.org/) manifest — sensor data, timestamp, a hash of the pixels — *before the file is ever written to disk*.

That signature is the receipt. It doesn't prove the *content* is meaningful or honest; it proves the *provenance* — this is light that hit a real sensor at a real moment, not a generated image. And critically, you're not trying to detect fakes after the fact (unwinnable). You're proving the real ones at the source (tractable).

## The hard part isn't the crypto. It's hiding it.

Every decentralized, cryptographic consumer product in history has died on the same hill: seed phrases, key management, wallet jargon, ten-step onboarding. Normal people will not do any of it, and they shouldn't have to. So the rule for this whole build is one line: **the protocol lives entirely beneath the presentation layer.** If a user ever sees the word "cryptographic," you've failed.

In practice that means:

- **Sign-up is a passkey**, not a seed phrase. The account key is generated in the secure enclave and unlocked with Face ID — the same gesture people already use a dozen times a day. No twelve words to write on paper.
- **The data server is managed for them.** Behind the scenes they get a personal data server on a hosted fleet; on screen they get three normal toggles — *just me*, *my circle*, *everyone*.
- **Identity looks like a username.** Under the hood it's a decentralized identifier; on screen it's `@you.theapp`.
- **Portability is a button.** If a power user ever wants to leave and self-host, one export hands them their whole signed archive and repoints their identity — no lost followers. The escape hatch exists, which is *why* you can trust the front door, but almost nobody needs to open it.

Done right, signing up and posting feels exactly like any normal app. The sovereignty is real; it's just invisible.

## Don't launch on an island

The last piece is distribution. A brand-new network with no one on it is dead on arrival — the cold-start problem that Part 2's winners all solved. Because this is built on an open protocol, you get a cheat code: **publish to the wider network too.** Every verified capture can also cross-post into the standard Bluesky ecosystem as an ordinary photo, with a link back. You inherit an existing audience and graph on day one, while your own app is the only place the verification, the optics, and the print options actually render.

None of this is exotic research. It's assembled from shipping standards — an open protocol, secure enclaves, an open provenance format, passkeys. The novelty isn't any one piece. It's putting them together and then making them disappear.

Which leaves one honest question: if you're not selling ads, how does a thing like this pay for itself? That's the last deep dive.

_Next in the series: **Part 6 (deep dive) — how it pays for itself without ads**, and whether the unit economics actually work. [See all parts &rarr;](/after-the-feed.html)_

## References

- [AT Protocol](https://atproto.com/) — overview and specs; [Ozone](https://github.com/bluesky-social/ozone), the open moderation/labeler framework
- [Content Credentials (C2PA)](https://c2pa.org/)
- [Apple App Attest](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity) · [Google Play Integrity](https://developer.android.com/google/play/integrity)
- [Passkeys / WebAuthn](https://fidoalliance.org/passkeys/)
