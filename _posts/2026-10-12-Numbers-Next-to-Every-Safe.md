---
layout: post
author: Diyaz Yakubov
title: "Numbers Next to Every \"Safe\""
date: 2026-10-12 07:30:00 UTC
published: false
excerpt_separator: <!--more-->
tags: [postgresql, timescaledb, incident, devops, ai-assisted-ops, build-in-public]
---
The command that crashed my production database was introduced as safe.

<!--more-->

That word did a lot of work. It came after an hour of careful staging, read-only checks and progress logs. It sounded like the rest of the plan. Because it sounded that way, I ran it. Seven minutes later PostgreSQL wrote `PANIC: could not write to file "pg_wal/…": No space left on device` and stopped.

This is the story of the week that followed: a crash, a migration plan that the hosting provider refused, a second server, a copy of the database that expired while nobody was watching, a 20-minute cutover, and the first backup that I actually trust, because I restored it.

## The setup

I run [busypipe](https://busypipe.com), a social analytics product, mostly on my own. Its biggest piece is a TimescaleDB database of social media data: posts, profiles, hashtags and their counts over time. By early October it was about 800 GB, on a server whose mirrored disk shows as 905 GB in `df`.

For most of this week I worked with Claude, an AI coding assistant. The way we split the work matters for this story, so here it is. Claude read the code and the runbooks, could query Prometheus read-only through a tunnel, planned each step, and wrote every command. I ran every command on the servers myself and pasted the output back. Claude had no shell or database access to any machine. Every decision that touched production went through my hands and my terminal.

That split protected us more than once this week. It didn't prevent the crash. The command was mine to run, and I ran it.

## Sunday night into Monday: a rebuild that ate the disk

We had decided that every post we have ever collected should count in the hashtag charts, not only the last year. One of those charts is built from a co-occurrence rollup: which hashtags appear together, day by day. Rebuilding it over all history meant inserting more than a billion pairs, stage by stage, a year or half a year at a time. Each stage was followed by compression and a vacuum to give the space back.

The early stages went fine. Then the stage for the first half of 2025, started late on Sunday, inserted 258.7 million pairs and failed at its last step. A sort file for the monthly rollup had nowhere to go. PostgreSQL stayed up with 24 GB free.

The next step was the cleanup: run the four compression jobs and three vacuums to get the space back. It was given to me as one command and described as safe. The reasoning was that compression works one chunk at a time and frees space as it goes.

That reasoning was wrong in two ways. Compression writes the compressed copy, and the WAL for it, *before* the old rows can be released. The space only comes back after a vacuum. And the server allowed up to 16 GB of WAL between checkpoints. Sixteen gigabytes of WAL, plus the chunk being rewritten, plus everything that stays allocated until the vacuum runs, doesn't fit in 24 GB. Nobody checked `max_wal_size` or the size of the largest chunk before the command ran. The disk went to zero.

## Forty-six minutes

The database was down for 46 minutes. The crash took a moment; the time went into recovering from it.

The container couldn't even write its lock file, so it restarted every minute and achieved nothing. Once I had freed a few gigabytes, our autoheal container noticed the database was failing its health check and restarted it. A database in crash recovery fails its health check by design. So recovery kept starting again and never got past about 30 seconds of WAL replay, until I stopped autoheal by hand.

The fastest source of free space was there the whole time: ext4 reserves 5% of the filesystem for root, about 45 GB that PostgreSQL can't use. One `tune2fs -m 1` released most of it, without deleting anything. We found it 40 minutes into the outage.

Then a suggested cleanup made things worse. To free a few more gigabytes, I removed stopped containers whose names matched the app services and pruned unused images. I had just stopped the scheduler, the pipelines and the enricher to protect the disk. So they were exactly the stopped containers that filter matched, and they were deleted along with their images. No data was lost, but data collection needed a full redeploy instead of a `docker start`.

When the database came back, I wrote one sentence to Claude: it had framed me with the "safe" actions, and it should write that down somewhere.

It did, in the postmortem and in its own notes. The rule that came out of it is the title of this post. **Any claim that a production step is safe comes with the numbers next to it**: free space measured with `df`, the reserve from `tune2fs -l`, `max_wal_size`, the largest chunk or sort the step will touch, and the peak it needs, not the end state. If those numbers weren't measured, the claim is "not verified", not "safe".

For the rest of the week the rule held. Every step started with read-only checks, and the action came only after I had pasted their output back. That slowed things down, and I didn't mind.

## The plan: copy first, then swap

The disk was the problem, so a bigger disk looked like the answer. Hetzner offered a drive swap on the same server: four larger NVMe drives in RAID 10, the same machine and IP addresses, 30 to 60 minutes of work by appointment. The catch was in the fine print. A swap replaces the drives, so everything on them is lost, and I had to confirm that in writing.

So the plan started with a copy. I rented a temporary server and ran a streaming replica of the database on it. It was seeded with `pg_basebackup` over an SSH tunnel, because the production disk had no room for a local base backup. The copy took about four and a half hours at 52 MB/s. Before creating the replication slot, we capped how much WAL a slot can hold back on the primary (`max_slot_wal_keep_size = 10GB`). A stalled replica would then lose its slot instead of filling the production disk a second time.

Then a rehearsal. I asked why we needed one, since the data was already on the second machine. The answer: on swap day, every step should be one that has already worked once. So we stopped the replica, cloned it on the temporary server (779 GB in 21 minutes), started the clone as a normal database and checked it. It was ready to take connections in about ten seconds. Reads worked, a compressed chunk read back correctly, a write went through. The replica reconnected and caught up.

The swap was booked for Thursday morning, timed to start after my family mornings. The runbook was written down to which terminal each command runs in.

## The vendor says no

On Wednesday morning Hetzner wrote back. Under their current rules, no hardware change of any kind was allowed on this server model. It is an older, grandfathered model. The only way to more storage was to convert it to a current model at current prices, which cost several times what I pay now.

Most of the plan was suddenly useless. The part that survived turned out to be the important one.

Everything up to the swap still worked: the replica, the tunnel, the WAL cap, the rehearsal. What changed was where the copy ended up. Instead of copying the data back onto new drives in the same server, the database moves to its own server and stays there. The app server keeps the apps, the queue, the small databases and monitoring. A new dedicated machine with 64 GB of RAM and two 1.92 TB NVMe drives runs only the Social DB. The two servers talk over WireGuard: encrypted, about ten lines of config on each side, and no database port on the public internet.

I had resisted a second server, because "two servers" sounds like a different kind of system. It isn't. It's the same software on two hosts, with one more address in the connection strings. There's no clustering and no new datastore. And when this database outgrows those 1.9 TB, the next move is the same move again.

## The copy that expired

Seeding the new server was the same `pg_basebackup` as before: 817 GB, a little under three hours. It finished in the afternoon. The replica was supposed to start right after.

It didn't. Nobody booted it for about six hours.

The production database writes about 5.4 GB of WAL an hour. The slot cap we had set so carefully was 10 GB. An idle slot therefore has about an hour and fifty minutes before the primary gives up on it, and less during bursts. After six hours the slot was marked `lost`. The 817 GB copy couldn't catch up anymore, because the WAL it needed was gone, and there was no archive to fetch it from.

My first message the next morning was confused: do we copy the whole database back? We copied the whole database again, in the same direction, another three hours of read load on production. This time a human didn't have to remember anything. The copy wrote its exit codes to a file. A small watcher on my Mac polled for that file and booted the replica as soon as it read `0 0`. The second seed finished, the watcher booted the replica, and it was streaming with zero lag by the time I looked.

The cap worked: it protected the production disk exactly as designed. It also meant a finished copy has a deadline, and nobody had written that deadline down. Now it's in the runbook.

## Twenty minutes on a Friday

The cutover ran on Friday morning. I stopped every writer and let the queues drain. Then I stopped the old primary cleanly, so it wrote a shutdown checkpoint, and noted where that checkpoint was. On the new server, I checked that the replica had replayed that checkpoint, the last record the old primary ever wrote. It had. Then I promoted it and merged the pull request that pointed the apps at the new address. The deploy rolled out.

Writers stopped at 05:45 UTC. The apps were green around 06:03. Consumer lag was back to zero by 06:06. That's about twenty minutes of downtime, most of it the deploy pipeline.

The hiccups were small. The runbook used a shell helper function, and it doesn't exist in a new SSH session, so twice I got `command not found` halfway through. The lesson: every block in a runbook should run on its own in a fresh shell. The monitoring tunnel also dropped in the middle of the window. That was why I had pasted output back all week instead of relying on Claude reading the dashboards.

The old database stayed on the app server, stopped and untouched, as a fallback. It would stay there until something better existed.

## A backup isn't a backup yet

Something better didn't exist yet, because this database had never had a backup.

The small databases had nightly dumps. The Social DB didn't. The design assumed it could be rebuilt by replaying the raw data archive, which would take days. During the move I kept saying "the safety copy", but the only real copies were a stopped database on the old server, getting staler by the hour, and that archive.

The backup we built uses pgBackRest. Every WAL segment goes to Cloudflare R2 as it's written, a full backup runs every Sunday and a differential on the other days, and a weekly verify reads it all back. Prometheus alerts fire if archiving stops, a backup goes stale or a verify fails. There's no standby server. A restore measured in hours is enough for the users we have today.

Two code reviews passed the configuration. Then a local integration test against our own database image found three things neither review caught:

- **pgBackRest must connect as the right role.** Our clusters have no `postgres` role, so it fails until you tell it which user to use (`pg1-user`).
- **Postgres can't be PID 1 in the container.** With async archiving, the background push process gets orphaned and adopted by PID 1. If PID 1 is the postmaster, PostgreSQL 18 sees a child it didn't start exit with an error, treats it as a crash and restarts the whole cluster. The container needs `--init`.
- **`pgbackrest verify` exits 0 even when it finds invalid files.** Only the output says `status: error`. Our monitoring checks both the exit code and the text.

The first full backup took 1 hour 26 minutes and compressed 782 GB down to 217 GB. Verify then reported an error. It was half a page, 4 KB, in one compressed chunk from January 2025, left over from Monday's crash. The 8.5 million rows in that chunk were intact. A `VACUUM FULL` rewrote it, and the next full backup came back clean. So the backup's first useful act was to show us a scar from the crash that nothing else had noticed.

## The restore that made it real

All of that only proves the files exist. A backup is real only after you've restored it.

I asked whether we could test without renting another server. Restoring over the old stopped copy would have been free, but it wouldn't test the disaster case: an empty disk, everything coming from R2. And I had just learned that Hetzner's auction servers are billed for the whole month even when you cancel them after a few days. The temporary replica server cost a full month for two days of use. So I took the cheapest box that could hold the data: a temporary server with spinning disks, its RAID still resyncing. That gave an honest upper bound.

The restore ran in the evening and the recovery finished late at night. Somewhere in there, with a third server in play and commands arriving for "the server", I had to ask Claude to say which one, every time. From then on every command block was labelled with the host and the prompt I should see before pasting.

The target was a point in time: 10:30:00 UTC that morning, half an hour after the clean full backup finished. Recovery stopped just before the first transaction that committed after it. The newest row in the restored database was from 10:29:57. The extensions were there, the paused maintenance jobs were still paused, and a test table could be created, written and dropped.

From start to a usable database took 4 hours 3 minutes. The copy from R2 took 2 h 44 min, then fsync, about 16 minutes of WAL replay, and a long end-of-recovery checkpoint. That was on spinning disks. On the production NVMe it would be faster. "Hours, not days" is now a measured number, written in the runbook header.

Only then did I delete the old copy on the app server. That freed 844 GB. Then I cancelled the test server.

## What I'm keeping

**"Safe" needs evidence.** Calling a production step safe means you've checked the specific limits it can hit, such as disk, WAL and locks, with numbers. How the step usually behaves isn't evidence. This applies to me as much as to the AI assistant. It just became visible because the assistant said the word out loud and I believed it.

**Budget for the peak, not the end state.** Compression, `VACUUM FULL`, large refreshes and index builds all need more space while they run than when they finish. Measure the disk you actually have: the reserve and the other services come out of it.

**Read-only checks first, actions second.** It's slower. This week it caught most of the mistakes before they ran. The one time we skipped it, the database crashed.

**Rehearse on a copy.** The rehearsal looked redundant when the data was already on the second machine. It meant every step on the real day had already worked once, and the plan survived the vendor's no because its first half had been tested.

**A cap is also a deadline.** The WAL cap protected the production disk and also put a timer on every finished copy. Automate the step that has a deadline. Don't rely on someone remembering it.

**When the vendor says no, check what's left of the plan.** Most of the work was still useful. The new plan came out of the old one's parts.

**A backup is a hypothesis until a restore proves it.** Restore it, to an empty disk, to a point in time, and write down how long it took.

**Running production alone with an AI assistant works if the roles stay clear.** The assistant wrote the plan and every command and kept the runbooks honest. I decided, ran and checked. When I asked it to name the server every time, it did. When I said it had framed me with "safe", it wrote the postmortem and kept the rule for the rest of the week. The crash happened when a confident word stood in for a measurement. The week went well once every claim came with its numbers.

---

The database now has its own server, room to grow, a backup that has been restored once, and a runbook that says how long a restore takes. The paused maintenance is resuming one job at a time, with a `df` check between each.

The disk will fill up again some day. This time there will be numbers next to every step that needs space.
