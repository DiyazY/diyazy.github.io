---
layout: post
author: Diyaz Yakubov
title: "The Quiet Outage"
date: 2026-05-04 18:34:41 UTC
background: https://cdn-images-1.medium.com/max/1024/1*hW8EPRd1a54OArFdPGE0-w.png
excerpt_separator: <!--more-->
tags: [monitoring, short-story, maintenance, distributed-systems, bugs]
original_link: https://medium.com/@diyaz.yakubov/the-quiet-outage-0d7c031c2174?source=rss-ce9f85b2b690------2
---
Two days of a barely-broken production system, and what they taught me about emergence, restraint, and the fix that almost&nbsp;wasn’t.

The most dangerous outages don’t&nbsp;crash.

They go quiet. Throughput drops, but no error page fires. No alarm hits the on-call rotation. The dashboards keep drawing graphs — they just draw flat lines. The system is “up” in every sense the monitoring understands. It’s just not doing any&nbsp;work.

You don’t notice for hours. Then you notice, and you look, and everything claims to be healthy, and there’s a moment when you wonder if the problem is actually&nbsp;you.

This is a story about one of&nbsp;those.

### A normal Friday&nbsp;morning

The signal was a steady throughput number — call it ~200 work units per second under normal load — that had collapsed overnight to&nbsp;zero.

Not “near zero,” not “degraded.” Zero.

Then, about two hours later, a burst: 250/s for roughly an hour. Then silence again, six hours of it. Then another burst. Then&nbsp;silence.

The system wasn’t broken. It was _breathing_. Once every six&nbsp;hours.

If you’ve spent any time in distributed systems, you know the feeling that comes next — the slow, cold realization that the failure mode you’re staring at isn’t a failure at all. It’s the system doing exactly what it was told to do, but at a scale where what it was told doesn’t work&nbsp;anymore.

### The shape of the&nbsp;problem

About 50,000 entities feed the work loop. Each one has a “next due” timestamp. The scheduler picks whichever ones are due, processes them, and then reschedules them based on their type and priority. Boring stuff. The kind of thing you write in a weekend and assume you won’t need to&nbsp;revisit.

When I built this three months ago, I picked a parameter that controls how much randomness gets added to those re-scheduling timestamps. The parameter is called _spread_; its purpose is to keep entities from all coming due at the same instant. I sized it deliberately for the load I expected at launch — generous enough that the re-scheduling looked uniform, tight enough that the budget per cycle stayed reasonable.

What I didn’t size it for was the load three months later, after a 5x growth curve I should have anticipated and&nbsp;didn’t.

At a small scale, the parameter was generous. With ten thousand entities, the spread was wide enough to be effectively uniform.

At fifty thousand, it&nbsp;wasn’t.

What happens when the spread is too narrow for the load? The same thing happens when buses run on a route too short for their headway. They bunch. One bus picks up a few extra passengers, falls slightly behind, picks up more passengers because more have accumulated, and falls further behind. The bus behind it catches up, picks up almost no one, and races ahead. Within a few cycles, you have two buses running together — one full, one empty — and a long, quiet stretch where neither&nbsp;was.

That’s what fifty thousand entities had done to themselves over a few weeks. They’d drifted into a tight cluster. Every time the system processed them, they all became “due” again at roughly the same moment. Twelve hours later: another cluster. Six hours of silence between clusters.

The technical name for this is _cohort synchronization_. The intuitive name is&nbsp;_herd_.

### The metric that mattered wasn’t on any dashboard

The way I figured this out is worth a paragraph of its&nbsp;own.

The dashboards I’d built showed throughput, error rate, queue depth, and latency — all the things you’d expect. Every one of them was either “healthy” or “consistent with the throughput collapse,” which is to say, not diagnostic. Throughput was zero. Queue depth was zero. Latency was undefined. The error rate was zero. None of those numbers told me&nbsp;_why_.

The diagnostic metric was a counter — _entities removed from the active pool_ — that I’d never charted, because under steady-state operation it was always zero or near-zero. I queried it because I’d run out of dashboard widgets to look at. It had spiked: tens of thousands of entities removed in a single sweep, then thousands more in the&nbsp;next.

That single line of telemetry was the entire incident.

The lesson is one I’ve now relearned three or four times in my career, and it never sticks until I see it again: **dashboards reflect the failures you expected**. The metrics that actually diagnose unprecedented incidents are almost always the ones no one charted. You find them by querying everything, not by looking at the&nbsp;wall.

After the incident, the first thing I did was promote that counter to the dashboard. The second thing I did was add four others I’d noticed during the diagnosis but had similarly never bothered to chart. The third thing I did was accept that I will probably do this again next quarter, because incidents teach you about the metrics you should have had, and there is no shortcut to knowing which ones those&nbsp;are.

### The temptation to&nbsp;rewrite

I want to spend a moment on this, because it’s the part most postmortems leave&nbsp;out.

Spend a day diagnosing a herding bug in your own scheduler, and your hands start to itch. There are mature, off-the-shelf workflow systems. They give you durability, retries, observability, queue management, all the boring infrastructure you keep half-implementing. _What if we just used one of those?_ It’s a real and persistent thought, especially around hour eighteen.

I sketched it out. Honestly. A day-long detour into “what if we migrated.”

The conclusion was the one I should have started with: the herding wasn’t a bug in _the scheduler_. It was a property of _the workload_. Migrating to anything off-the-shelf would have been a four-to-six-month project that didn’t address the actual cause. The actual cause was a number — a configuration parameter — that had been quietly too small ever since I’d crossed some threshold of scale, somewhere in the last few weeks. The actual fix was changing that&nbsp;number.

I changed two numbers in two pull requests. Each PR was three new tests and a one-line config change. The tests pin the new behaviour so that the parameter cannot drift back. The PRs were merged the same day they were&nbsp;written.

The lesson: **incidents make you want to rewrite. The right answer is almost always to fix the smallest thing that resolves it, pin a test that prevents regression, and write the runbook so the next person doesn’t lose two days.** The rewrite belongs on a roadmap, with a budget, after the fire is out — not in the same week as the&nbsp;fire.

### Recovery has an order of operations

The textbook story ends when you ship the fix. Real recovery has more steps, and the steps don’t&nbsp;commute.

In my case, three pull requests had to land. One enforced a hard limit on the active pool. One widened the spread for the bulk of the workload. One widened it further for a particular tier of slow-cycling work. Anyone reading the diff after the fact would assume the order didn’t matter much. It&nbsp;did.

If you merged the limit-enforcer first, while the cohort was still bunched, you’d archive thousands of entities from inside the cluster. The ones you kept would all share roughly the same recent timestamp. The herd would reform tighter, not&nbsp;looser.

So the order was: spread first, then run a one-shot SQL operation that broke up the existing cluster, _then_ the limit-enforcer on a now-evenly-distributed pool, _then_ the second spread&nbsp;bump.

I wrote the order into the runbook before I ran the steps, so future-me — possibly sleep-deprived, possibly mid-incident — would not have to derive it under pressure.

Real recovery is a sequence with a footnote at every step. The fix isn’t the diff; the fix is the diff _plus_ the order _plus_ the&nbsp;reason.

### The “this looks broken but isn’t”&nbsp;footnote

While writing the runbook, I added a warning that I’m proud of. It said, in effect: _during the drain, the system will look broken. Some entities will appear overdue. Throughput will lag. Don’t roll back. Don’t panic. This is the recovery; it looks like the failure for the first four to eight&nbsp;hours._

The reason that the warning is in the runbook is that I almost rolled the fix back, twice, while the recovery was running. The metrics were temporarily worse in shape than they had been pre-fix — exactly the way you’d expect a queue under structural rebalancing to look — and every reflex I have was screaming to&nbsp;revert.

The runbook is written by people who imagine themselves anxious. A runbook that only tells you what to do but not what it’ll _look like_ is a runbook that gets ignored at exactly the moment it was meant to be&nbsp;useful.

I now write a “what to expect, including the scary parts” section in every runbook I&nbsp;touch.

### What I’d want a peer to take from&nbsp;this

If you’ve read this far, you’ve probably had a Friday like mine. A few things I want to keep, written down so I have a chance of remembering them:

The most expensive incidents are the quietest ones. The system that crashes pages everyone instantly. The system that goes silent gives you two days of a sinking feeling and then a long diagnosis. Build alerts on _zeroes_, not just on errors. A throughput of zero is an&nbsp;event.

The metric that diagnoses a novel incident is the one that no one charted. Query the long tail of your telemetry first. Promote whatever you find afterwards.

Resist the rewrite. Fix the parameter. Pin the test. Then put the rewrite on a roadmap with a budget and a quarter, not on a Monday with a&nbsp;coffee.

The order of operations during recovery is part of the fix. Write it down before you run&nbsp;it.

Real runbooks describe what the recovery _looks like_, not just what it does. Including the parts that look like the original&nbsp;problem.

Time-to-understand is usually much longer than time-to-fix. Once I understood, the code change was about ninety minutes of work. Understanding took two full days. That ratio is normal, and it’s easy to plan for the ninety minutes and forget the two days. That’s why the same incident keeps recurring in the same codebase under the same engineer.

Two quiet days of production cost very little in user-visible terms. The system continued to “run.” The graphs continued to draw. Some work happened in&nbsp;bursts.

The cost of _not_ understanding what I’d just lived through would have been a third quiet outage a few weeks later — when neither I nor the runbook would be ready, and I’d start the diagnosis from zero&nbsp;again.

The system has recovered. The numbers are bumped. The tests are pinned. The runbook is on&nbsp;disk.

Next time it goes quiet, I’ll know how to&nbsp;listen.

 ![](https://medium.com/_/stat?event=post.clientViewed&referrerSource=full_rss&postId=0d7c031c2174)