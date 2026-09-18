---
layout: post
author: Diyaz Yakubov
title: "After the Feed | Three openings nobody has fully built"
description: "Combine the proven pieces — constraint, authenticity, tangibility — and three product openings appear: a verified-camera network, a darkroom that mails you things, and an ambient close circle."
date: 2026-10-14 08:00:00 UTC
background: /assets/images/posts/2026-10-14-After-the-Feed-Three-Openings-Nobody-Has-Fully-Built/img-01.png
excerpt_separator: <!--more-->
tags: [after-the-feed, social-media, technology, ideas]
---
_Part 4 of **After the Feed**, a field guide to how social media gets rebuilt. [See all parts &rarr;](/after-the-feed.html)_

[Part 3](/2026/10/07/After-the-Feed-The-Apps-Quietly-Proving-People-Want-Out.html) showed the demand is real and already paying: constraint, authenticity, tangibility, all monetized without ads — just scattered across a widget, a journal, a camera mode, and a toy. So the obvious move is to stop scattering. What happens when you combine them, on shared infrastructure, at scale?

You get three distinct openings. None fully exists yet. Each is a product someone will build.

<!--more-->

## Opening 1: the verified-camera network

Picture a photo-sharing network where every image carries proof that it's real — not a promise, a cryptographic receipt. The moment you press the shutter, the phone's secure hardware signs the photo, attesting *this came from a real camera sensor, at this time, unaltered by AI.* That signature travels with the image everywhere it goes.

This flips the losing game. Right now everyone's trying to *detect* fakes after the fact, which is a race you can't win as the models get better. The winning move is the opposite: don't try to catch the fakes, **prove the real ones**. The technology exists — an open standard called [Content Credentials (C2PA)](https://c2pa.org/) already defines how to attach tamper-evident provenance to media, and modern phones already have the secure enclaves to sign it.

A network built on that becomes the natural home for the things that *need* to be trusted: photojournalism, documentary work, "this actually happened" moments. In a web drowning in generated images, "verified real" stops being a nice-to-have and becomes the entire value proposition — and it's one the incumbents structurally can't offer, because their feeds are built to be frictionless and unverified.

## Opening 2: the darkroom that mails you things

Retro proved people will pay to send a postcard. Instax proved they'll pay for a print. So build the network where the **physical object is the point**, and the app is just the darkroom.

Close friends, a family, a creative collective contribute photos into a shared, private roll over a month. At the end of the cycle, the app doesn't just show you a recap — it *prints and ships* one: a set of real prints, a small photo book, postcards sent to everyone's actual mailboxes. The digital side is the staging area; the artifact is the deliverable, and the artifact is what you keep.

This inverts the whole digital-first hierarchy, and it comes with a business model built in — you're selling a physical good with real margins, not renting attention to advertisers. It's the part of Part 3 that already works (postcards, prints), turned from a feature into the foundation.

## Opening 3: the ambient circle

Locket showed that a tiny, capped, glanceable presence layer is something people love and will pay for. But Locket is deliberately one small thing. The opening is to build the full version: an **ambient close-circle** network that lives in widgets, lock screens, and watch faces rather than in an app you open.

The design rules are constraints, on purpose. A hard cap around [Dunbar's number](https://en.wikipedia.org/wiki/Dunbar%27s_number) — the ~150 stable relationships a human can actually maintain, and far fewer for the inner circle. No public timeline. No follower counts. No comment threads to perform in. Just quiet, reciprocal, glanceable presence — knowing what the handful of people you love are up to, without the machinery of an audience.

It's social media that optimizes for *feeling connected* instead of *time on app* — which is exactly why no ad-funded incumbent will build it. Calm is the opposite of their revenue model.

## Why these are openings, not products yet

Each of these has been *gestured at* by a successful small app, and none has been built in full. The reason is the same for all three: they need plumbing that didn't used to exist and doesn't come free.

A verified-camera network needs hardware attestation and a way to carry signed provenance at scale. The darkroom network needs identity and shared, portable data that isn't locked in one company's silo. The ambient circle needs to sync presence privately without becoming yet another surveillance funnel. All three, underneath, need an answer to the same question: *how do you build a social network that runs on trust and portability instead of a walled-garden ad engine* — without asking normal people to understand any of it?

That's not a hand-wave. There's an actual technical stack that makes it buildable now, and there's an actual way to hide all of it behind a normal-feeling app. That's the deep dive.

_Next in the series: **Part 5 (deep dive) — how you'd actually build it**: the open protocol, the hardware signing, and how to make the cryptography invisible. [See all parts &rarr;](/after-the-feed.html)_

## References

- [Content Credentials (C2PA)](https://c2pa.org/) — the open provenance standard
- [Dunbar's number](https://en.wikipedia.org/wiki/Dunbar%27s_number)
- Prior art referenced throughout: [Locket](https://apps.apple.com/us/app/locket-widget/id1600525061), [Retro](https://apps.apple.com/us/app/retro-photos-with-friends/id6443709020), [Halide Process Zero](https://www.lux.camera/introducing-process-zero-for-iphone/)
