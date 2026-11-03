---
layout: post
author: Diyaz Yakubov
title: "What the Edge Taught Me About Research"
date: 2026-11-18 08:00:00 UTC
background: /assets/images/posts/2026-11-18-What-the-Edge-Taught-Me-About-Research/img-01.jpg
excerpt_separator: <!--more-->
tags: [research, edge-computing, kubernetes, phd, tampere-university]
---
I came to research as an engineer with a practical question: which Kubernetes should you run on a small computer that sits at the edge of a network?

<!--more-->

After years of building production systems, I already had opinions about that question. Research made me test them against measurements, and most of them didn't hold up.

## Starting with a testbed

The first step was hardware on a desk: an Intel NUC and a few Raspberry Pis, running five lightweight Kubernetes distributions: k8s, k3s, k0s, KubeEdge and OpenYurt. I measured CPU, memory, disk, throughput and latency under different workloads.

That became two papers at ESOCC 2025, written with David Hästbacka and published in Springer LNCS. The first covered [performance and resource efficiency](https://doi.org/10.1007/978-3-031-84617-5_7). k3s used the fewest resources, and k0s and k8s led on throughput and latency. The second covered [security, resilience and maintainability](https://doi.org/10.1007/978-3-031-84617-5_8). The distributions that are easiest to operate scored lowest on security compliance, and the hardened ones cost more to run. No distribution came out best on every measure. Each one trades something away.

## Going a layer deeper

The comparisons showed how the distributions differed, but not why. So the next two studies, both at ESOCC 2026 with Sergio Moreschini and David Hästbacka, looked inside the nodes.

The [energy study](https://doi.org/10.1007/978-3-032-37831-6_1) built a DVFS power model for the Raspberry Pi 4's ARM core. At idle, all five distributions drew within about 1.5% of each other. Under pod churn, full k8s was the most energy-efficient per pod lifecycle, which I didn't expect. CPU frequency didn't predict orchestration performance. The differences came from software architecture, not hardware.

The [overhead study](https://doi.org/10.1007/978-3-032-37831-6_7) used cgroup telemetry on a k0s worker to split the "orchestration tax" across the four system pods. At idle the whole tax was about 0.38% of the node, and one pod carried two-thirds of it. Control-plane churn multiplied system CPU by 9.2×, while memory stayed in a near-fixed 46–60 MiB band.

What I took from both: a choice that looks like infrastructure plumbing has measurable costs, and you only find out where they sit by measuring.

## From measurements to a method

Four papers of measurements still don't tell a team what to pick. So the next piece of work, [Di-Select](https://doi.org/10.1007/s10586-026-06269-5), published open access in *Cluster Computing* this year, steps back from benchmarks. It combines a structured literature review with grounded-theory coding. The result is seven evaluation constructs and fifteen causal propositions that spell out the trade-offs a team faces when choosing an orchestration distribution for cloud and edge.

I find this the most useful result so far, because it turns "it depends" into a list of what it depends on.

All the code and data behind these papers is public on [GitHub](https://github.com/DiyazY). If you can't rerun a benchmark, you can't trust it.

## Where it's going: di-agent

My doctoral research at Tampere University builds on all of this. [di-agent](https://github.com/DiyazY/di-agent) is an autonomous orchestration agent for resource-constrained edge nodes. It makes scheduling and offloading decisions on the node itself, without a central control plane.

The papers feed straight into it. The agent's Semantic Map starts from priors taken from the earlier measurements, such as what churn costs, where overhead sits and how energy behaves under load, and refines them with live telemetry from the deployment it's running in. Each study so far has been a question the agent will need answered before it can decide anything on its own.

The goal is concrete. Edge nodes are small, often disconnected, and too numerous to manage by hand. They should be able to make reasonable decisions about their own workloads, based on evidence rather than defaults someone guessed years ago.

## Why I keep doing both

I run [busypipe](https://busypipe.com) and do research at the same time, and people ask why. The two help each other. Building products taught me which questions matter. Research taught me to stop trusting my first answer to them. The databases I operate at busypipe now get the same treatment as the edge testbed: measure first, then decide.

The next step is getting di-agent from a design to running on real nodes. I'll write about what breaks along the way.
