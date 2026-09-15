---
layout: post
author: Diyaz Yakubov
title: "The Things Around the Code"
date: 2026-09-15 09:00:00 UTC
background: /assets/images/posts/2026-09-15-The-Things-Around-the-Code/img-01.jpg
excerpt_separator: <!--more-->
tags: [software-architecture, career, mentorship, engineering-leadership]
---
The hardest part of my job stopped being the code a long time ago. Nobody told me when it happened, and nobody taught me what replaced it.

<!--more-->

There's a moment in a strong engineer's career that never gets announced. The questions you're handed quietly change shape. For years they sound like _how do I build this_ — which library, which pattern, which way to hold the data. Then one day, without ceremony, they become _should we build this at all, and what shape should it take so it survives contact with everything we can't predict?_

The code is still there. It's just no longer the hard part.

## The long way around

I learned this the slow way, which for a long time was the only way I knew.

Over more than a decade I've worked on systems that quietly carried the records of millions of people, where a bug was never only a bug. I've worked on small devices that had to behave perfectly on a bench with no cloud to catch them if they fell, and on pipelines that had to make sense of a flood of data arriving faster than anyone could ever read it. I built in one country, then moved and rebuilt my instincts in another. And I watched the ground shift under the whole trade — from machines we owned and could put our hands on, to platforms that live somewhere we will never visit.

None of it came with a curriculum. I never sat in a class called _Architecture_. I picked it up the way most of us do: in hallways, in code reviews that went sideways, in the tense quiet after something broke in production, in a single offhand sentence from someone more senior that quietly reorganized how I saw the whole problem. I learned the things around the code by being in the right rooms at the right time — and by being lucky enough to keep landing in them.

I've come to think of it the way I think about the buildings I like to sketch when I'm not at a keyboard. An architect of a building doesn't lay every brick. They decide what the space is _for_, how people will move through it, what weather it has to survive, and where to spend a budget that never quite stretches far enough. The bricks still matter enormously. But the building is made of decisions.

## The things around the code

So what _are_ the things around the code? For years I couldn't have named them cleanly. Now I can, because I've watched them decide whether good engineers grow into trusted architects or stay one step below, wondering what the gap is made of.

It's the ability to look at a tangle of requirements and see the _shape_ of a system underneath — the boundaries, the seams, the parts that should never be allowed to know about each other. It's holding quality steady when the deadline is real and everyone is tired, instead of promising to clean it up in a later that never comes. It's the unglamorous discipline of actually _shipping_ — the plumbing and the safeguards that turn a working branch into something running, calmly, in front of real people. It's making a call with half the information you'd like, and being able to explain, months later, why it was the right call to make with what you had. And it's the quietest skill of all: moving a group of people toward a good outcome when you hold no authority over any of them — only a case worth trusting.

Notice how little of this is about writing more code, or memorizing one more framework. It's about the _scope of the decisions you're trusted with_. That, in the end, is the real distance between senior and architect. Not more syntax. More weight.

## Why I built a track for it

For the last stretch of my career I've spent much of my time on the far side of that gap — advising teams, mentoring engineers, being the person brought in to untangle the architectural knots nobody else wanted to pull on. And I kept meeting the same person.

They were good. Genuinely good — trusted with the work that mattered, often writing code cleaner than mine. And they were stuck at exactly the same edge, for exactly the same reason: no one had ever made the next set of skills _explicit_ for them. They were waiting, without quite realizing it, to be invited into the right room. Some would wait years. Some never would.

That's what finally bothered me enough to build something. The knowledge isn't secret, and it isn't rare. It's just handed out badly — slowly, unevenly, and mostly by accident, to whoever happens to be standing nearby when it's spoken aloud. I wanted to make the rooms deliberate.

So I built [the Architect Track](https://toptop.dev/architect-track): six months, one-on-one, drawn straight from the work I do for clients every day rather than from a stack of slides. We don't practice on toy problems. We practice on a real system you already own and understand, because that is where the decisions actually bite. Month by month it works across the whole surface of the job — the craft, the system design, the quality, the delivery, and the leadership that has no authority behind it — and it ends with you defending an architecture end to end, the way you'd have to defend it in a room that counts. It's less a syllabus than the path I took the long way around, compressed and made intentional.

## The architect your team already needs

If you're the person I keep describing — capable, trusted, standing at that edge and feeling the questions change shape under you — here's the thing I wish someone had said to me sooner. The gap is real, but it's narrower than it looks from where you're standing, and none of it is innate. Nobody is born knowing how to hold a whole system in their head. It's learned, one decision at a time. The only thing wrong with how most of us learn it is that we leave it to chance.

You don't have to. The architect your team already needs is closer than you think — more often than not, it's already you, a few deliberate rooms away.

If any of this sounds like where you are, that's exactly what the Track is for. And if you'd like the fuller story of why I started building things like it, I wrote about that [when I launched the Academy](https://toptop.dev/blog/introducing-toptop-academy).
