---
date: "2026-02-17"
---

# Subagents and web search in Claude Code

I recently built out ollama launch to make it easier to use Ollama with different integrations like Claude Code, OpenClaw, OpenCode, and more. I also just released subagents and web search support for Ollama's Claude Code integration. Both now work out of the box -- no MCP servers or API keys needed.


tl;dr:
```bash
ollama launch claude --model minimax-m2.5:cloud
```

## Context rot (degradation)

If you've used a coding agent for a longer task, you've probably noticed it getting worse as the session goes on where the agent forgets earlier constraints, contradicts itself, and loses the thread. Don't even get me started on hitting compaction automatically without the extra prompt, behavior degrades significantly. This is context degradation.

["Lost in the Middle" (Liu et al., 2023)](https://arxiv.org/abs/2307.03172) was the first paper to study this properly. LLMs systematically underweight information in the middle of long contexts where they favor the start and the end, and everything in between gets diluted. [Paulsen (2025)](https://arxiv.org/abs/2509.21361) and [Veseli et al. (2025)](https://arxiv.org/abs/2508.07479) showed the same pattern across a wide range of task types, not just the toy benchmarks.

The practical consequence: even models with 1M token context windows don't use them well. Sessions running at 90% context utilization produce more code but at noticeably lower quality. The context window is not as big as it looks. Inherently, a model keeps an "essence" of what came before through the attention mechanism, but it's not a perfect memory.

## What subagents fix

Even just a few months ago, subagents weren't really feasable, spawning and their interaction was not very well defined, and the models themselves didn't naturally reach for them. As I mentioned in my [agents post](/posts/building-reliable-ai-agents/), 
Instead of one agent accumulating everything in a single context, subagents let you spawn isolated agents for discrete tasks -- each with their own clean context. The main agent orchestrates and gets back condensed results, without any of the subordinate work polluting it.

In Claude Code, subagents run in parallel. A single prompt can kick off agents simultaneously exploring your auth flow, payment integration, and notification system. Each one has full attention for its task. The main agent only sees the summaries.

Anthropic's [2026 Agentic Coding Trends Report](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf) calls this the defining shift: multi-agent systems replacing single-agent workflows to maximize performance across separate context windows. 

Some models reach for this naturally. `minimax-m2.5`, `glm-5`, and `kimi-k2.5` are the best at it right now. You can also just ask explicitly:

```
> spawn subagents to explore the auth flow, payment integration, and notification system

> audit security issues, find performance bottlenecks, and check accessibility in parallel with subagents

> create subagents to map the database queries, trace the API routes, and catalog error handling patterns
```

## Web search

Ollama's [web search](https://ollama.com/blog/web-search) is now built into the Anthropic compatibility layer. When the model needs current information, it just searches -- nothing to configure.

Combined with subagents, you can spawn multiple research agents searching in parallel, each with their own loop (search, fetch, refine), all returning results without any of the intermediate noise in your main context. This is the same feedback loop I described in my [agents post](/posts/building-reliable-ai-agents/), but running across isolated contexts at the same time.

```
> research the postgres 18 release notes, audit our queries for deprecated patterns, and create migration tasks

> create 3 research agents to research how our top 3 competitors price their API tiers, compare against our current pricing, and draft recommendations

> study how top open source projects handle their release process, review our CI/CD pipeline, and draft improvements
```

## Which models to use

- `minimax-m2.5:cloud`
- `glm-5:cloud`
- `kimi-k2.5:cloud`

These have strong tool-use and naturally reach for subagents. Same idea I wrote about with harness-specific training -- models post-trained on specific tool patterns outperform generalized models for those patterns. These three align well with how Claude Code's subagent and search tools work.

More details:
- [ollama launch](https://ollama.com/blog/launch) for more integrations
- [Claude Code with Ollama](https://ollama.com/blog/claude) for basic setup
- [Web search API](https://ollama.com/blog/web-search) for standalone usage
