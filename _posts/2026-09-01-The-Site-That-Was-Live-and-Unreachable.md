---
layout: post
author: Diyaz Yakubov
title: "The Site That Was Live and Unreachable"
date: 2026-09-01 07:30:00 UTC
excerpt_separator: <!--more-->
tags: [github-pages, dns, https, debugging, build-in-public]
---
GitHub said the site was deployed. The browser said it couldn't establish a secure connection. Both were telling the truth.

<!--more-->

The bug wasn't in my code. It was in _when_ I clicked a button.

### A clean migration, or so it looked

I was moving this blog from a `github.io` subdomain to a real domain. The kind of task you've done before and expect to finish before your coffee gets cold: buy the domain, point DNS at GitHub Pages, tell the repo its new name, done. GitHub even handles the certificate for you.

So I added the DNS records — four A records for the apex, four AAAA, a CNAME for `www` — and while they were saving, I set the custom domain on the repo. The deploy went green. The old URLs started redirecting to the new domain. Every dashboard I had said the same word: **built**.

Then I opened the new domain in a browser and got a connection error.

Not a 404. Not a redirect loop. A TLS failure — the browser refused to complete the handshake at all. And because the domain sits under a certificate-only TLD, there was no insecure version to fall back to. The site was, in every sense the tooling understood, live. It was also completely unreachable.

### Everything was healthy

I did what you do. I checked DNS. All four A records resolved, straight from the domain's own authoritative nameserver — no propagation excuse, no cache to blame. No conflicting CAA record telling the certificate authority to stay away. No stray DNSSEC signature. Public resolvers agreed with the authoritative ones. The redirects from the old domain worked perfectly, which meant GitHub's edge already knew about the new name and was routing it.

When I forced a raw connection, the server handed back a certificate — the wildcard `*.github.io` one. Valid, just for the wrong name. So the routing layer was up. The only thing missing was a certificate that actually matched the domain.

I assumed what everyone assumes: it's slow. Fresh domains take a while. I gave it an hour. Then a few more. Three or four hours in, staring at a site that was "deployed" and had never once loaded, I stopped believing the propagation story. Something wasn't slow. Something wasn't _happening_.

### The state that wasn't there

The thing that broke the case open wasn't a value. It was the absence of one.

GitHub exposes the certificate's status for a Pages site. I'd been half-reading it as I waited, expecting it to march through the stages — pending, then issued. But the field wasn't `pending`. It wasn't `errored` either. It was empty. Null. No state at all.

That distinction is the whole incident. `pending` means the request is in flight. `errored` means it was tried and failed. Null means it was **never requested**. The certificate wasn't slow to arrive and it hadn't failed to issue — nothing had ever asked for it. For hours I'd been waiting on a process that had never started.

Once I was looking for a thing that never started rather than a thing running late, the cause was obvious. GitHub verifies a custom domain's DNS at one specific moment: the instant you set the domain. That check is what queues the certificate request. And I had set the domain while my DNS records were still half-entered — two of the four apex records in, the rest a few clicks behind. The verification ran against an incomplete zone, didn't find what it needed, and quietly declined to queue anything.

Then it never looked again. A one-shot check, run against a state I hadn't finished creating, failing in a way that leaves no error — only an empty field where a status should be.

### The fix took ten seconds

Remove the custom domain. Add it back. That's it.

By then all nine DNS records were long since in place, so this time the verification — which only ever runs at that one moment — saw a complete zone. The certificate state flipped from null to `authorization_pending` within seconds, and to `approved` a few minutes after. I turned on enforced HTTPS, reloaded, and the site I'd "deployed" hours earlier finally loaded for the first time.

The entire outage was the gap between when I set the domain and when I finished the DNS.

### What I took from it

There's a familiar failure story where a check runs, fails, and screams. This was the other kind — the check ran, failed, and said nothing, because from its point of view there was nothing to report. It did its one job at its one moment and moved on. The silence wasn't a missing alert; it was the honest output of a system that had already decided there was no work to do.

Two things stuck with me.

The first is that **an empty state is data.** I lost hours to the difference between "this is taking a while" and "this never began," and the only thing that told them apart was noticing that a field which should have held _something_ held nothing. When you're waiting on a process, confirm it actually started before you spend any time wondering why it's slow. Absence is a reading, not a blank.

The second is about one-shot checks in general. Any validation that runs exactly once, at a moment whose completeness you don't control, is a trap waiting for the day your inputs aren't ready yet. It won't retry. It won't warn. It'll just leave a quiet null behind and let you assume the best. If you can't make the check re-run on its own, the next best thing is to make sure the world is fully in place before you trigger it — and to know exactly how to trigger it again when you got the order wrong.

I got the order wrong. Now I know the button that fixes it. Next time, I'll finish the DNS before I reach for it.
