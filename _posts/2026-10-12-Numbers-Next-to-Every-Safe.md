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

That word did a lot of work. It came after days of careful, staged work, read-only checks and progress logs, and it sounded like the rest of the plan. So I ran it. Seven minutes later PostgreSQL wrote `PANIC: could not write to file "pg_wal/…": No space left on device` and stopped.

This is the week that followed: a crash, a migration plan the hosting provider made impossible, a second server, a copy of the database that expired while nobody was watching, a 20-minute cutover, and the first backup I actually trust, because I restored it.

## The setup

I run [busypipe](https://busypipe.com), a social analytics product, mostly on my own. Its biggest piece is the Social DB: a TimescaleDB database of posts, profiles, hashtags and their counts over time. By early October it was about 800 GB, on a server whose mirrored disk shows as 905 GB in `df`.

For most of this week I worked with Claude, an AI coding assistant. Claude read the code and the runbooks, and through a tunnel I opened it could query Prometheus and run read-only SQL on the database. It planned each step and wrote every command. It had no shell and couldn't change anything: I ran every command on the servers myself and pasted the output back.

That split decides who presses the button. It doesn't decide whether the button is safe. The command was mine to run, and I ran it.

## Sunday night into Monday: a rebuild that ate the disk

We had decided that every post we have ever collected should count in the hashtag charts, not only the last year. One of those charts is built from a co-occurrence rollup: which hashtags appear together, day by day. Rebuilding it over all history meant inserting more than a billion rows, a year or half a year at a time. After each stage, compression (TimescaleDB rewriting old chunks into a compact columnar format) and a vacuum gave the space back.

The stage for the first half of 2025 started late on Sunday, inserted 258.7 million pairs, and failed at its last step: a temporary sort file had nowhere to go. PostgreSQL stayed up with 24 GB free.

Then the cleanup. Claude gave it to me as one command, four compression jobs and three vacuums, and called it safe: compression works one chunk at a time and frees space as it goes.

It doesn't. Compression writes the compressed copy, and the WAL for it, *before* the old rows can be released, and the space only comes back after a vacuum. WAL is the log Postgres writes before it changes data files, and it piles up until a checkpoint lets it be recycled. This server allowed up to 16 GB of it between checkpoints. Sixteen gigabytes of WAL, plus the chunk being rewritten, plus everything held until the vacuum, doesn't fit in 24 GB. Nobody had checked `max_wal_size` or the largest chunk. The disk went to zero.

## Forty-six minutes

The database was down for 46 minutes. The crash took a moment; the time went into recovering from it.

With the disk full, the container couldn't even write its lock file, so it restarted every minute and got nowhere. Claude suggested a cleanup to free a few gigabytes: remove stopped containers matching the app services, prune unused images. I ran it. I had just stopped the scheduler, the pipelines and the enricher to protect the disk, so they were exactly the stopped containers that filter matched. They were deleted with their images. No data was lost, but data collection later needed a redeploy instead of a `docker start`.

With a few gigabytes free, recovery could start, and then autoheal, a container that restarts anything failing its health check, kept restarting it. A database in crash recovery fails its health check by design, so recovery never got past about 30 seconds of WAL replay until I stopped autoheal by hand.

The fastest source of space had been there the whole time. ext4 reserves 5% of the filesystem for root, about 45 GB that PostgreSQL can't use, and one `tune2fs -m 1` released most of it without deleting anything. We found it 40 minutes into the outage.

When the database came back, I told Claude, angrily, that its "safe" had framed me, and that it should write that down. Fair or not, the rule that came out of it is the title of this post. **Any claim that a production step is safe comes with the numbers next to it**: free space from `df`, the reserve from `tune2fs -l`, `max_wal_size`, the largest chunk or sort the step will touch, and the peak it needs, not the end state. If those weren't measured, the claim is "not verified", not "safe".

For the rest of the week we tried to hold to it. It slipped once more, on Wednesday.

## The plan: copy first, then swap

The disk was the problem, so a bigger disk looked like the answer. Hetzner offered a drive swap on the same server: four larger NVMe drives in RAID 10, the same machine and IP addresses, under an hour of work by appointment. The swap replaces the drives, so everything on them is lost, and I had to confirm that in writing.

So the plan started with a copy. On Monday I rented a temporary server and ran a streaming replica on it, seeded with `pg_basebackup` over an SSH tunnel: about four and a half hours at 52 MB/s. A replica holds a replication slot, which makes the primary keep WAL until the replica has used it. Before creating one, we capped how much a slot can hold back (`max_slot_wal_keep_size = 10GB`), so a stalled replica would lose its slot instead of filling the production disk a second time.

With my Mac, production and the temporary server all in play, I asked Claude that day to mark where every command runs. From then on each block came labelled with the host and the prompt I should see before pasting.

Then a rehearsal. I asked why we needed one, since the data was already on the second machine. The answer: on swap day, every step should be one that has already worked once. So on Tuesday we cloned the replica, started the clone as a normal database, read from it, wrote to it, and threw it away. The swap was booked for Thursday morning.

## The vendor says no

On Wednesday morning Hetzner wrote back: no hardware change of any kind is allowed on this older server model. The only way to more storage was converting it to a current model, at about ten times what I pay now.

The last step of the plan was gone. Everything before it still worked, and that turned out to be the important part. Instead of copying the data back onto new drives, the database moves to its own machine and stays there: 64 GB of RAM, two 1.92 TB NVMe drives, linked to the app server over WireGuard, with no database port on the public internet. It's the same software on two hosts, with one more address in the connection strings. When the database outgrows this disk, the next move is the same move again.

## The copy that expired

Seeding the new machine was the same `pg_basebackup`: 817 GB, a little under three hours, finished around mid-afternoon. The replica was supposed to start right after.

It didn't. The tunnel Claude watched through had dropped just before the copy finished. I saw the finished log about two and a half hours later and left the boot for the morning. By then the slot was marked `lost`. The database was writing about 5.4 GB of WAL an hour that week, against a 10 GB cap: the slot had lasted under two hours, so it was gone before I even looked. The copy could no longer catch up, because the WAL it needed was gone and there was no archive to fetch it from.

Both numbers were known. Nobody divided one by the other.

We copied the whole database again. This time no one had to remember anything: the copy wrote its exit codes to a file, and a small watcher on my Mac booted the replica as soon as the file read `0 0`. By the time I looked, it was streaming with zero lag. The cap had done its job and protected the production disk. It also put a deadline on every finished copy, and now that deadline is in the runbook.

## Twenty minutes on a Friday

On Friday morning I stopped every writer; unprocessed messages waited in the queue. I shut the old primary down cleanly, so it wrote a final checkpoint, and confirmed the new server's replica had replayed exactly that checkpoint, the last record the old primary ever wrote. Then I promoted it and merged the pull request pointing the apps at the new address.

Writers stopped at 05:45 UTC. The apps were green around 06:03, and the ingestion queues were empty again by 06:06. About twenty minutes of downtime, most of it the deploy pipeline.

Two small hiccups. A shell helper from the runbook didn't exist in a new SSH session, so every runbook block now runs on its own in a fresh shell. And the monitoring tunnel dropped mid-window. That's where pasting output back all week paid off: Claude didn't need the dashboards to follow along.

The old database stayed on the app server, stopped and untouched, until something better existed.

## A backup isn't a backup yet

Something better didn't exist yet, because this database had never had a backup.

The design assumed it could be rebuilt by replaying the raw data archive, which would take days. After the cutover, the only other copies were the stopped database, getting staler by the hour, and that archive.

The backup uses pgBackRest. WAL goes to Cloudflare R2 continuously, a full backup runs every Sunday and a differential on the other days, and a weekly verify reads it all back. Prometheus alerts fire if archiving stops, a backup goes stale or a verify fails. If the upload ever falls 300 GB behind, pgBackRest drops WAL from the archive rather than fill the disk. Point-in-time recovery then has a gap until the next full backup, but the database keeps running.

Two code reviews passed the configuration. A local test against our own database image then found three things they missed. The worst: `pgbackrest verify` exits 0 even when it finds invalid files. Only the output says `status: error`, so our monitoring checks both.

The first full backup took 1 hour 26 minutes and compressed 782 GB down to 217 GB. It finished, but flagged `error(s) detected`: half a page, 4 KB, at the end of one compressed chunk from January 2025, most likely left by Monday's crash. The data in it was intact. Verify still passed, because it checks the backup against itself, and the backup was a faithful copy of what was on disk. A `VACUUM FULL` rewrote the chunk, and the next full backup came back clean. The backup's first useful act was to show us a scar nothing else had noticed.

## The restore that made it real

All of that only proves the files exist. A backup is real only after you've restored it.

Restoring over the old stopped copy would have been free, but it wouldn't test the disaster case: an empty disk, everything coming from R2. So I rented a cheap box that could hold the data, a temporary server with spinning disks and its RAID still resyncing, for an honest upper bound.

We restored from the first full backup, the one with the half page, to a point in time: 10:30:00 UTC that morning. Recovery stopped just before the first transaction that committed after it, and the newest row in the restored database was from 10:29:57. The extensions were there, the paused maintenance jobs were still paused, and a test table could be created, written and dropped. The half page didn't get in the way.

From start to a usable database took 4 hours 3 minutes, most of it copying from R2. On production NVMe it should be faster. "Hours, not days" is now a measured number in the runbook header.

Only then did I delete the old copy, which left the app server with 844 GB free.

## A footnote, four days later

On Thursday 15 October, the job that keeps the rollups up to date ran over all history for the first time, and it wrote WAL faster than the backup could upload it. The queue limit did what it was set up to do: pgBackRest dropped WAL, and point-in-time recovery had a gap of about nine hours until a new full backup finished. The disk never filled. The job now runs in small steps that stop when the archive falls behind.

The number nobody had put next to "re-enable the catch-up" was how fast the archive could keep up.

## What I'm keeping

**"Safe" needs numbers, including the peak.** Calling a step safe means you've measured the limits it can hit: disk, WAL, locks, archive lag. Compression, `VACUUM FULL`, big refreshes and index builds all need more room while they run than when they finish. This applies to me as much as to the assistant. The assistant just said the word out loud, and I believed it.

**Rehearse on a copy.** The rehearsal looked redundant. When Hetzner said no, the tested half of the plan carried straight over.

**A cap is also a deadline.** The WAL cap protected the production disk and put a timer on every finished copy. Automate the step that has a deadline.

**A backup is a hypothesis until a restore proves it.** Restore it, to an empty disk, to a point in time, and write down how long it took.

Running production alone with an AI assistant worked once its claims had to come with numbers. Clear roles didn't stop the crash. Measurements did.

---

The database now has its own server, room to grow, a backup that has been restored once, and a runbook that says how long a restore takes.

The disk will fill up again some day. This time there will be numbers next to every step that needs space.
