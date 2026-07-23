---
date: "2026-07-20"
title: "Your loops and graphs are stupid"
excerpt: "My entire TL is full of people talking about how they've moved from using loops to loops with graphs or state machines."
math: false
---

# Your loops and graphs are stupid

My entire TL is full of people talking about how they've moved from using loops to loops with graphs or state machines.

We're just reinventing software again.

> Loops are automations which follow a set of instructions. The set of instructions can be as simple as doing a research task, or more popularly, triaging, writing code, and making PRs.

LLMs are non-deterministic by nature. And if you've actually used loops (even with a smart model like gpt-5.6), you would've quickly found out that they are often unreliable.

Instructions are forgotten, workflow order is ignored, model outputs garbage, and a small output change from a model can influence the next step of the workflow. It all compounds.

<figure class="post-media post-media--screenshot">
  <a class="post-media-link" href="/images/agent-tool-parsing-drift.png" target="_blank" rel="noopener" aria-label="Open the full-size tool-parsing screenshot">
    <img src="/images/agent-tool-parsing-drift.png" alt="Agent runs with malformed heartbeat tool output" loading="lazy">
  </a>
  <figcaption>Breaking the tool parsing of gpt-5.6</figcaption>
</figure>

To fix this non-determinism and drifting from task, I've seen people argue that it's an issue of state and context, which they often solve with data structures and abstractions which minimize number of model decisions.

I agree with the instinct to reduce model non-determinism, but I think bespoke graphs (or graph libraries) are the wrong artifact to do so. Software itself encapsulates graphs. You don't need to write random, bespoke abstractions to encode a workflow. Move those deterministic bits into executable code.

I personally really like how [Hermes Agent](https://hermes-agent.nousresearch.com/) creates more deterministic workflows. It creates reusable scripts and skills for it to use as you ask it to do a task, and any updates that you ask in the workflow are documented through code.

I've also found the best success using hermes in a loop-based setting, it outperforms gpt-5.6 when used with GLM-5.2 for instruction following in a more deterministic workflow setting.

<figure class="post-media post-media--screenshot post-media--housing-search">
  <a class="post-media-link" href="/images/hermes-housing-search.png" target="_blank" rel="noopener" aria-label="Open the full-size housing-search screenshot">
    <img src="/images/hermes-housing-search.png" alt="Hermes Agent rental search results for San Francisco" loading="lazy">
  </a>
  <figcaption>Hermes agent finding me a place to live in SF (and it is how it did indeed find a place to live)</figcaption>
</figure>

<figure class="post-media post-media--screenshot post-media--drift-check">
  <a class="post-media-link" href="/images/ollama-python-drift-check.png" target="_blank" rel="noopener" aria-label="Open the full-size ollama-python drift-check screenshot">
    <img src="/images/ollama-python-drift-check.png" alt="ollama-python daily API drift-check report" loading="lazy">
  </a>
  <figcaption>Automated triaging for ollama-python</figcaption>
</figure>

Instead of creating temporary data structures for an agent to follow, get it to write code for itself. It's easier to audit, debug, and execute for both humans and LLMs. The scripts themselves can involve an LLM or another agent which can solve the non-deterministic bits of the task and tool output.

At the end of the day, a lot of this is the harness having to patch for the lack of trained behavior for the model. We saw this with /goal and how that basically got trained into the new gpt, fable, glm, and kimi models to do long horizon tasks.

Similarly, if designing, running, and maintaining loops is deemed desirable and gets trained into model behavior,
