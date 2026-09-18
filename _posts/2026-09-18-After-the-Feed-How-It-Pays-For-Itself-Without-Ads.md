---
layout: post
author: Diyaz Yakubov
title: "After the Feed | How it pays for itself without ads (deep dive)"
description: "If you're not selling attention, how does a social network survive? Subscriptions, physical prints, and a creator market — and why an unbundled network is cheap enough to run for it to work."
date: 2026-09-18 08:30:00 UTC
background: /assets/images/posts/2026-09-18-After-the-Feed-How-It-Pays-For-Itself-Without-Ads/img-01.png
excerpt_separator: <!--more-->
tags: [after-the-feed, technology, business, deep-dive]
---
_Part 6 of **After the Feed**, a field guide to how social media gets rebuilt. [See all parts &rarr;](/after-the-feed.html)_

We [built the thing](/2026/09/18/After-the-Feed-How-You-Would-Actually-Build-It.html) in Part 5, and did it without an ad engine. Which raises the obvious objection: advertising exists because it answered a genuinely hard question — how do you pay for a free product used by millions of people? If you throw the ad model out, you need a real answer, not a wish. Here's the answer, and why it's not as fragile as it sounds.

<!--more-->

## Why the ads have to go — it's structural, not moral

The point isn't that ads are evil. It's that the ad model *is* the feed model. You can't keep one and drop the other.

Surveillance advertising pays out in proportion to attention and data, so it rewards whatever maximizes both: infinite scroll, autoplay, notification bait, a feed tuned to agitate. Every dark pattern from [Part 1](/2026/09/18/After-the-Feed-Why-Social-Media-Stopped-Feeling-Like-Connection.html) is a rational response to that incentive. A network built on trust and calm can't run on a revenue model that pays it to be neither. So the money has to come from somewhere that gets *better* when the product gets better for you.

There are three such places, and two of them are already proven (Part 3).

## Stream 1: subscriptions for what you actually keep

Charge for the archive, not the access. Posting and viewing stay free; what you pay for is durable, high-quality storage of your originals — full-resolution, uncompressed, yours — plus the nicer creative tools and a custom handle.

This isn't speculative. Retro already sells almost exactly this at around **$36 a year** and just raised a $21M round on the strength of it. People will pay a modest recurring fee for a photo product that respects them. The subscription both funds the storage it pays for and aligns the business with the user: you're selling them a better version of *their own stuff*, not renting them to a third party.

## Stream 2: turn pixels into objects

This is the one advertising literally cannot do: sell a physical good. The tactile-artifact opening from Part 4 is also the cleanest revenue line in the whole design.

Monthly print boxes, photo books, one-off postcards mailed anywhere — real products with real margins. Retro's postcards (a couple of dollars a card) and Fujifilm's billion-dollar Instax business both prove the demand is there and people pay happily, because they're getting something they can hold. Every print sold is revenue that arrives *because* the user valued a memory enough to make it permanent. The incentive points the right way.

## Stream 3: a creator market

Once the network is open, let professionals build on it — photographers selling color/development profiles, curators running verified feeds — and take a standard platform cut. It's low-overhead (you're running a marketplace, not an ad exchange) and it deepens the product without the company having to build every feature itself. Think of it as the Telegram-bots lesson from Part 2, monetized.

## Does the math actually close?

Here's the part worth being honest about: the following is an **illustrative model**, not a forecast. But the shape of it is what matters.

> **A rough model, at ~100,000 engaged users.** An unbundled network is *cheap* to run compared to an incumbent. You're indexing structured records off an event stream — not running billion-item recommendation models over every asset — and media is served from your own storage through ordinary caching. Blended infrastructure lands in the ballpark of a few cents per active user per month. Against that: even a few percent of users on a ~$4–5/month plan, plus print orders at healthy margins, plus a marketplace cut, comfortably clears the cost — with gross margins that look like software, not media.

The reason those numbers can work where an ad business would need scale in the *hundreds of millions* is exactly the unbundling from Part 5. The expensive thing about big social platforms — the giant, always-on recommender crunching everything for engagement — is the thing this architecture doesn't have. Take out the attention engine and the cost base collapses to roughly "storage plus indexing," which usage-based subscriptions and physical goods can cover directly.

## The alignment is the moat

Step back and the real advantage isn't any single stream. It's that **every** revenue line gets healthier when the product serves you better. Better archives → more subscriptions. More meaningful moments → more prints. A richer ecosystem → more marketplace activity. There's no point at which the business benefits from making the product worse — which is precisely the trap the ad-funded feed can never climb out of.

Is it proven at platform scale? Not yet. The closest live proof — Retro — is still measured in low millions of users, not hundreds of millions. But it's real, it's growing, and it's profitable-shaped doing exactly this. The bet of this whole series is that "small, trusted, and sustainable" is a better starting point than "huge, exhausting, and cornered."

So where does it all actually go? Last part.

_Next in the series: **Part 7 — where this goes next**: the roadmap, and the honest hopeful, grim, and boring-but-likely futures. [See all parts &rarr;](/after-the-feed.html)_

## References

- Retro pricing and model: [Engadget](https://www.engadget.com/2234246/retro-app-what-is-it-how-to-use/); [$21M Series A](https://techcrunch.com/2026/08/28/friend-focused-photo-sharing-app-retro-snags-21m/)
- Physical-goods demand: [Fujifilm Instax sales to exceed $1 billion](https://www.digitalcameraworld.com/cameras/instant-cameras/fujifilm-instax-sales-to-exceed-usd1-billion)
- On why the ad model shapes the feed: [Part 1 references](/2026/09/18/After-the-Feed-Why-Social-Media-Stopped-Feeling-Like-Connection.html#references)
