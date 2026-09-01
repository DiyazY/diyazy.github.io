---
layout: post
author: Diyaz Yakubov
title: "I Built a Karpathy-Style Knowledge Wiki From 8 Months of Obsidian Notes — Here’s How"
date: 2026-04-07 19:24:32 UTC
background: /assets/images/posts/2026-04-07-I-Built-a-KarpathyStyle-Knowledge-Wiki-From-8-Months-of-Obsidian-Notes-Heres-How/img-01.png
excerpt_separator: <!--more-->
tags: [ai, knowledge, claude, obsidian, wiki]
original_link: https://medium.com/@diyaz.yakubov/i-built-a-karpathy-style-knowledge-wiki-from-8-months-of-obsidian-notes-heres-how-af532d23f05f?source=rss-ce9f85b2b690------2
---
### The Problem With Notes That Only You Can&nbsp;Read

I’ve been using Obsidian daily since August 2025. Daily plans, project specs, business ideas, speech scripts, study notes, expense tracking — 273 markdown files across a dozen&nbsp;folders.

And I couldn’t find anything.

Not because Obsidian is bad at search. It’s excellent. The problem was me. My notes were written for the version of me who was sitting at the keyboard that day. Future me had no idea what “check the thing for bp” meant three months later. My `ideas/` folder was a graveyard of half-sentences. My `study/` folder had two checklist items pretending to be course&nbsp;notes.

Sound familiar?

### The Karpathy&nbsp;Approach

Then I read Andrej Karpathy’s post about using LLMs to build personal knowledge bases. His approach is&nbsp;elegant:

1. **Ingest** raw sources (articles, papers, repos, notes) into a `raw/`directory  
2. **Compile** them with an LLM into a wiki — a collection of interconnected `.md` files  
3. **Query** the wiki by asking the LLM complex questions against it  
4. **File back** the answers and explorations into the wiki, so it always&nbsp;grows

The critical shift: **you rarely touch the wiki directly. It’s the LLM’s domain.** Your job is to feed it sources and ask questions. The LLM organizes, cross-links, and maintains everything.

I realized I was sitting on 8 months of raw source material. It was already in markdown. It just needed compilation.

### What I Actually&nbsp;Did

I sat down with Claude in a single session and went through this&nbsp;process:

#### 1. Audit

First, I had Claude read through every folder in my vault — projects, ideas, study notes, business files, daily plans, templates. Not skimming — actually reading the content and cataloguing what knowledge existed, how detailed it was, and what could be extracted as standalone wiki articles.

The results were humbling. My `study/` section was three files containing a grand total of five lines. My `ideas/` folder had seven files averaging about 120 bytes each. But my daily plans? 220+ files of meticulous time-blocked schedules with real insights buried in the notes sections. My Toastmasters speech scripts had genuine narrative wisdom in them. The knowledge was there — it was just trapped in the wrong&nbsp;format.

#### 2. Design the Structure

We designed a wiki structure with six&nbsp;domains:

- **Tech**  — projects, tools, infrastructure  
- **Business**  — ventures, finances, consulting  
- **Career**  — university, speaking, professional growth  
- **Learning**  — courses, languages, research  
- **Personal**  — productivity, health, routines  
- **Ideas**  — explorations and “what if”&nbsp;thinking

Plus a `concepts/` folder for cross-cutting themes that connect multiple domains — things like “Time-Blocking” (which touches personal, business, and tech) or “Multiple Income Streams” (connecting business, career, and personal philosophy).

#### 3. Compile

This is where the magic happened. Claude read my raw notes and compiled them into 44 structured wiki articles, each following a consistent template:

- A one-line summary  
- Status indicator (Active, Dormant, Stub)  
- Source attribution back to the original note  
- Related article links  
- The actual content — not copied, but \*distilled\*  
- Open questions for future exploration  
- Cross-links to related&nbsp;articles

For example, my scattered BusyPipe project notes (spread across 8 files including Excalidraw diagrams and draft schemas) became a single clean article that explains what BusyPipe is, its architecture, milestones, and how it connects to my other projects and financial strategy.

My Toastmasters speech about failure and financial independence got compiled into a concept article called “Learning vs Racing” that connects to my business strategy, my content creation plans, and my productivity philosophy.

#### 4. Build the&nbsp;Pipeline

A wiki is only useful if it keeps growing. So we built three maintenance mechanisms:

**Raw ingest folder** (`wiki/raw/`) — A place to drop web clips, papers, screenshots, meeting notes. Anything. The LLM reads them and compiles them into proper wiki articles on&nbsp;request.

**A `/wiki-write` skill**  — At the end of any conversation with Claude, I type “save to wiki” and it extracts the key insights, conclusions, and decisions from the entire conversation and saves them as a structured markdown file in `raw/`. No more losing knowledge that only existed in a chat&nbsp;window.

**A weekly health check**  — An automated task that runs every Sunday night and scans the entire wiki for broken links, stale articles, gaps between what I’m working on (from daily plans) and what the wiki covers, and missing cross-links. It writes a report and fixes simple issues automatically.

### What Changed

The immediate difference: I can now ask Claude “what’s the relationship between my BusyPipe project and my SaaS costs?” and it navigates the wiki, finds the relevant articles, and gives me a coherent answer that connects my expense tracking, my subscriptions, my TopTop revenue, and my financial independence strategy. It can do this because the knowledge is structured and cross-linked, not scattered across random&nbsp;files.

But the deeper change is philosophical. My notes used to be write-only — useful the day I wrote them, then slowly decaying into noise. Now every note, every conversation, every web clip feeds into a living knowledge base that gets richer over time. Karpathy’s phrase captures it perfectly: explorations and queries always “add&nbsp;up.”

![wiki graph](/assets/images/posts/2026-04-07-I-Built-a-KarpathyStyle-Knowledge-Wiki-From-8-Months-of-Obsidian-Notes-Heres-How/img-01.png)
_wiki graph_

### How You Can Do&nbsp;This

You don’t need anything fancy. Here’s the&nbsp;minimum:

1. **An Obsidian vault** (or any folder of markdown files) — you probably already have this  
2. **An LLM with file access**  — Claude with Cowork mode, Cursor, or even the API with a script  
3. **One session to do the initial compilation**  — have the LLM audit your notes, design a structure, and compile articles  
4. **A raw/ folder** for ongoing ingestion  
5. **The Obsidian Web Clipper extension** for saving web articles as&nbsp;markdown

The key principle: stop thinking of your notes as finished products. They’re raw material. Let the LLM compile them into something structured, and then keep feeding it more raw material.

Your scattered notes are a goldmine. You just need a&nbsp;smelter.

_I built this using Claude in Cowork mode with an Obsidian vault mounted as a workspace folder. The entire process — from audit to 44 compiled wiki articles — took a single afternoon session._

In fact, I had been thinking about this for a long time, but like any engineer, I didn’t have the time. [https://www.linkedin.com/posts/activity-7400255931525271552-eknz](https://www.linkedin.com/posts/activity-7400255931525271552-eknz)

