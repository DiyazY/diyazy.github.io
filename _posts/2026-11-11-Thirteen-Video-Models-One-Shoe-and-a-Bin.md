---
layout: post
author: Diyaz Yakubov
title: "Thirteen video models, one shoe and a bin"
description: "How I picked and judged AI video models for a product idea without being any good at video myself: same input to every model, my own scores, real invoices, and the moment I gave up on generated physics."
date: 2026-11-11 08:00:00 UTC
background: /assets/images/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/img-01.jpg
excerpt_separator: <!--more-->
tags: [ai, video-generation, evaluation, busypipe, product]
---
I spent a week and a little over forty dollars asking AI video models to make a man throw a shoe into a bin. Most of them couldn't. The ones that could looked fake. The thing that finally worked wasn't generating the throw at all.

<!--more-->

I should say this first: I am not a graphics or video person. I can't edit in Premiere, I don't know what a LUT is without looking it up, and my eye for "this looks off" is about as good as anyone scrolling TikTok on the bus. That turned out to be useful. The people who will judge these videos are exactly that audience, not colourists.

The question behind all this was practical. [busypipe](https://busypipe.com/) already tells brands what is working on TikTok: which formats, which hooks, which hashtags are rising in their niche. The obvious next step is "now make me one". Before building anything, I wanted to know whether the generation part was good enough, how much it really cost, and how I'd even tell the difference between models.

So most of this post is about the boring middle part: how to choose and how to judge, when you can't trust your own taste much and every attempt costs money.

## Rule one: same input, every model

The first decision was the only one I'd keep if I did this again. Every model gets **the same still image and the same prompt**, at the same length and aspect ratio. No per-model tuning, no cherry-picked retries. Otherwise you're comparing my prompting luck, not the models.

I picked two shots that stress different things:

- **A, the shoe toss.** A man on an outdoor court throws a white running shoe into a green bin. People, hands, an object with weight and a target. Physics.
- **B, the product turn.** A plain white shoe on wet concrete, slow turn, water droplets. No people; it's about the product staying the same shoe while the camera moves.

I used [Higgsfield](https://higgsfield.ai/) because one API key reaches most of the current models, which matters when you want thirteen of them. I started with four (Kling 3.0, Seedance 2.0, Hailuo 2.3, Wan 3.0), then noticed the catalogue had more and ran everything that accepted an image: thirteen video models plus a few "workflows" (motion transfer, product shots, ad images).

Here is shot A from twelve of them, side by side, with the score I gave each one.

<video controls muted playsinline loop preload="none" poster="/assets/videos/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/bakeoff-shoe-toss.jpg" style="width:100%;max-width:640px;display:block;margin:1.5rem auto;">
  <source src="/assets/videos/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/bakeoff-shoe-toss.mp4" type="video/mp4">
</video>

And shot B:

<video controls muted playsinline loop preload="none" poster="/assets/videos/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/bakeoff-product-turn.jpg" style="width:100%;max-width:640px;display:block;margin:1.5rem auto;">
  <source src="/assets/videos/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/bakeoff-product-turn.mp4" type="video/mp4">
</video>

The grid is the single most useful thing I made. Watching thirteen clips one after another, you forget the first by the fifth. Watching them play at the same time, the bad ones are obvious in two seconds: the shoe vanishes mid-air, the arm bends twice, the bin moves, a cut appears that nobody asked for.

## Rule two: I'm the judge, not the checklist

My first pass at judging was a table with a criterion that sounded objective: **did it do what the prompt said?** Does the shoe land in the bin, yes or no. By that measure one model won clearly. Hailuo 2.3 was the only one that landed the toss, and it was also the cheapest. Easy decision.

Then I actually sat down and scored every clip myself, on a page built for it: every video in one place, a 1-to-10 score, a few tick boxes ("usable", "fake", "AI glitch"), a notes field, and a ranking tab that sorts everything by score.

![The review page: every clip, a score, flags and notes](/assets/images/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/review-page.jpg)

My ranking disagreed with the checklist almost completely. Hailuo, the "winner", got a 3 for the toss. It did the action, and it looked fake doing it. Grok Video 1.5 got a 9 even though the shoe misses the bin, because the man looked like a man. Wan 3.0 Prime got an 8 on both shots for the same reason.

![The ranking tab, sorted by my own scores](/assets/images/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/review-ranking.jpg)

That was the most important finding of the week, and it had nothing to do with any model: **I'd been measuring the wrong thing.** For a TikTok, "does it look real" beats "did it follow the instructions". Someone scrolling past doesn't know what the prompt was. They know when a hand looks like rubber.

The final shortlist, by my own scores (shoe toss / product turn, then the real cost per clip):

- **Grok Video 1.5:** 9 / 8, average 8.5, $0.71 a clip
- **Wan 3.0 Prime:** 8 / 8, average 8.0, $0.60
- **Happy Horse 1.1:** 7 / 7, average 7.0, $0.60
- Kling 3.0: 7 / 3, average 5.0, $0.36
- Hailuo 2.3: 3 / 6, average 4.5, $0.24
- Seedance 2.0: 6 / 2, average 4.0, $1.29
- Wan 2.7: 1 / 1, average 1.0, $0.43

About half of all the clips I scored were usable. So the real price of a usable five-second clip is roughly double the price of a clip.

## Rule three: read the invoice, not the price list

The playground shows a price per generation. I exported the actual billing after the run and compared. For some models the real cost was the listed one. For others it was up to **3.4 times** higher: Hailuo listed at $0.07 and billed at $0.24; Seedance 2.0 listed at $0.49 and billed at $1.29. The ranking by value changed less than I expected, but the budget changed a lot. A finished 15-second video with retries lands somewhere between three and ten dollars, not "a few cents".

The one pleasant surprise: failed and rejected requests didn't seem to be billed.

## Does "knowing the niche" make better videos?

This was the actual product question. busypipe's whole pitch is context: here is what's working for brands like yours, make that. So I made ten short videos. Five briefs came from busypipe data for a sportswear portfolio: a "does that count?" challenge, a list of gym tips, a 15-minute routine. Five control briefs were written with no data at all, just "small US running-shoe brand, make five TikToks". Same models, same editing, then a blind rating page with the videos shuffled.

The result was inconclusive, and the reason is worth more than a result. All ten scored 1 or 2 out of 10, except one generic video that got a 7. When the footage itself looks like AI, nobody gets far enough to notice whether the *idea* is any good. Context changes the idea; it can't rescue the picture. I couldn't test the thing I cared about until the floor was higher.

## Trying to raise the floor

Higgsfield's own showcase reel looks nothing like my clips, so I assumed I was doing something wrong. Some of it was me. I re-ran two of the briefs in "pro mode": 1080p models, two stills per shot to pick from, prompts written like a camera brief (lens, framing, light, what must not move).

<video controls muted playsinline loop preload="none" poster="/assets/videos/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/cheap-vs-pro.jpg" style="width:100%;max-width:640px;display:block;margin:1.5rem auto;">
  <source src="/assets/videos/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/cheap-vs-pro.mp4" type="video/mp4">
</video>

It is sharper. I still scored the finished videos 1 and 3. Individual shots got 6 and 8; stitched together, one bad beat sinks the whole thing. Every extra shot is another chance to look fake.

Pro mode also surfaced a problem I hadn't thought about. I asked for plain, unbranded shoes and wrote "no logos" in every prompt. Six of eight running stills came back with real brand marks: swooshes, three stripes, the lot.

![Stills that were asked for "no logos"](/assets/images/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/logo-leaks.jpg)

For a product that makes ads for brands, that's not a cosmetic issue. Every frame needs a logo check before it goes anywhere.

Next I read what people who do this for a living recommend, and it boiled down to a few habits: prompt for imperfection ("shot on a phone", "off-centre", overcast) rather than "cinematic"; generate several takes and keep the cleanest; and, for actions that keep failing, give the model **both the first and the last frame**, so it only has to fill in the middle. Then grade it down afterwards: a bit less saturation, a little grain, captions in the style TikTok viewers expect.

Start and end frames worked for the action. Three out of three takes landed the shoe in the bin. I also found that two of those three takes had a hidden jump cut, a single frame where the scene snaps. You can't really see it at full speed, but you feel it. ffmpeg's scene-change detector flags it in a second, which makes a cheap automatic quality check.

<video controls muted playsinline loop preload="none" poster="/assets/videos/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/start-end-frame-challenge.jpg" style="width:100%;max-width:360px;display:block;margin:1.5rem auto;">
  <source src="/assets/videos/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/start-end-frame-challenge.mp4" type="video/mp4">
</video>

My verdict, as the non-expert in the room: the shoe lands, and it still looks fake. The bin doesn't react. Nothing has weight. The model drew a shoe arriving in a bin; it didn't simulate one.

## Stop generating the physics

The idea that fixed it came from giving up on the hard part. Real footage already has real physics. What if I start from a real, licensed clip and only swap what needs to be ours?

Higgsfield has two tools for that. One transfers motion: you give it a video and a character, and the character performs the video. The other swaps an object: you give it a video and a product photo. I took two free-licence stock clips from [Mixkit](https://mixkit.co/), a young man shooting a basketball and someone tying their running shoes, and ran both.

<video controls muted playsinline loop preload="none" poster="/assets/videos/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/real-footage-person-swap.jpg" style="width:100%;max-width:640px;display:block;margin:1.5rem auto;">
  <source src="/assets/videos/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/real-footage-person-swap.mp4" type="video/mp4">
</video>

Same lift, same arc, same release, frame for frame, with a real ball. The jersey and its cartoon-team logo are gone; our invented character is in his place.

<video controls muted playsinline loop preload="none" poster="/assets/videos/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/real-footage-product-swap.jpg" style="width:100%;max-width:360px;display:block;margin:1.5rem auto;">
  <source src="/assets/videos/posts/2026-11-11-Thirteen-Video-Models-One-Shoe-and-a-Bin/real-footage-product-swap.mp4" type="video/mp4">
</video>

And the grey sneaker becomes our white knit shoe, while real hands pull real laces through it. This was the first result all week that I'd show someone without explaining it first.

It isn't cheap (roughly $0.58 per second of source video at 720p, so about $6 for a ten-second clip), and the source footage has to be properly licensed: stock, a brand's own shoots, or clips creators have agreed to. Never a scraped TikTok.

## What I'd tell myself a week ago

- **Fix the input and vary only the model.** Same still, same prompt. Anything else is comparing your own luck.
- **Look at everything at once.** A grid and a scoring page did more than any metric. Building them took less time than one round of arguing with myself.
- **Score what the audience will notice.** "Followed the prompt" was my engineer's criterion. "Looks real" was the right one. I only found out by scoring.
- **Budget from the invoice.** List prices were up to 3.4× off.
- **Single shots can pass; sequences fail.** Each extra generated beat is another chance to look fake.
- **Check every frame for logos.** "No logos" in a prompt is a wish, not a setting.
- **Don't generate what reality already does well.** Real footage plus a swap beat every generated throw.

For busypipe, the conclusion is less "we'll generate your videos" and more "we'll tell you what to make, and help you remake proven formats with your own product in them". The data decides what; real footage carries the physics; the model only changes what has to be yours.

## Methodology and caveats

- **Sample size.** One generation per model per shot in the bake-off. That points in a direction; it doesn't prove anything. A second run could reorder the middle of the table.
- **Scoring.** Every score is mine, from one viewer who is explicitly not a video professional. The blind context-versus-generic test had too few raters and too low a quality floor to say anything.
- **Costs.** Per-clip costs come from Higgsfield's billing export for the bake-off (about $20 of the total). Later rounds are estimated from those real per-clip prices. Everything together came to a little over $40. Prices change often.
- **Models.** The catalogue as of early October 2026. Durations were about five seconds (six for models that only allow six), vertical 9:16, at the default or 720p resolution unless I say otherwise. One model (Cinema Studio 4) failed on the people shot and isn't in the grid.
- **Footage and brands.** The brand is a placeholder and every person in generated stills is invented. The stock clips are Mixkit footage under its free licence. The logos in the leak image were generated by the model against the prompt, which is the point of showing it.
- **Tooling.** The scripts, grids and scoring page were thrown together with an AI assistant doing most of the typing. Nothing here needed editing software.
