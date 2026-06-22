---
title: "Sources: Creating the Ollama Agent Harness"
date: "2026-06-22"
excerpt: "Source notes and verification TODOs for the Ollama Agent Harness draft."
protected: true
math: false
---

# Sources: Creating the Ollama Agent Harness

## Source threads consulted

- Chief of Staff handoff: `019e852c-7e8c-71d3-ba4b-62cc3df28771`
- Compare agent loops: `019e9525-34be-7d52-89da-6299e1c7ce1a`
- Agent-loop optimization inventory and messaging: `019edcdd-8d8d-74f2-91bd-9a690b61e6aa`
- Agent-loop review threads: `019ed8fe-7bd8-77c1-8e42-48b3c47a94c0`, `019ed9c0-2ebb-7090-bad8-6ae786e94920`
- Codex agent-loop changes research: `019ee1e5-31ce-77f1-92d0-921a8a6da280`
- MLX structured outputs research: `019eda06-4f12-7a63-a3e8-9bfd88b93d79`
- AI Engineer talk skeleton and deck work: `019ed248-3624-7a50-b6b4-83be7d44b948`

## Local context consulted

- `/Users/parth/Documents/repos/ollama-agent-loop/docs/agent-loop-design-decisions.md`
- `/Users/parth/Documents/repos/ollama-agent-loop/agent/session.go`
- `/Users/parth/Documents/repos/ollama-agent-loop/agent/compactor.go`
- `/Users/parth/Documents/repos/ollama-agent-loop/agent/events.go`
- `/Users/parth/Documents/repos/ollama-agent-loop/agent/trace.go`
- `/Users/parth/Documents/repos/ollama-agent-loop/agent/tools/bash.go`
- `/Users/parth/Documents/repos/ollama-agent-loop/agent/tools/file.go`
- `/Users/parth/Documents/repos/ollama-agent-loop/agent/tools/web.go`
- `/Users/parth/Documents/repos/ollama-agent-loop/agent/skills/skills.go`
- `/Users/parth/Documents/repos/ollama-agent-loop/agent/tools/skill.go`
- `/Users/parth/Documents/repos/ollama-agent-loop/docs/context-length.mdx`
- `/Users/parth/Documents/repos/ollama-agent-loop/envconfig/config.go`
- `/Users/parth/Documents/repos/ollama-agent-loop/server/routes.go`
- `/Users/parth/Documents/repos/ollama-agent-loop/cmd/cmd.go`
- `/Users/parth/Documents/repos/ollama-agent-loop/evals/agent-capability-report-2026-06-18-2219.md`
- `/Users/parth/Documents/repos/ollama-agent-loop/evals/agent-capability-report.md`
- `/Users/parth/Documents/presentations/ai-engineer-local-agents-harness-talk/research-notes.md`
- `/Users/parth/Documents/presentations/ai-engineer-local-agents-harness-talk/presentation-skeleton.md`

## Public content and voice pass

- Personal site and talks page: agent tooling at Ollama, small tools, local AI, open agents, structured outputs, and writing ideas while they are still forming.
- "The philosophy of Ollama Launch": simplicity, invisibility, delightful discovery, "Oh it actually works," model choice as product surface, and legible failure when invisibility breaks.
- "Building reliable AI agents": first-principles agent loops, tool design, context engineering, prompt rendering, evals, and the idea that the harness shapes model behavior.
- "The Era of Generalists": breadth, taste, orchestration, verification loops, and the feeling of using agents to move across an end-to-end workflow.
- "Demystifying how models pick their next token": practical attention to sampling, templates, structured outputs, and the sensitivity of model behavior to seemingly small runtime choices.
- Tools page: small terminal-native experiments like `zuko`, `ducky`, `watchy`, `vimollama`, and OllamaClaw; useful context for the "build the small thing to understand the system" posture.
- Ollama blog posts on Launch, OpenClaw, web search/subagents, streaming tool calling, and structured outputs: one-command setup, local/cloud model choice, context recommendations, tool-oriented model workflows, and no-config defaults.
- ODSC / Generative AI Fundamentalz interview materials: local-first AI, open models, agent harnesses as tools plus loop plus memory plus environment, verification loops, context engineering, and the move from model experimentation toward system design.

Recurring focal points to keep in this draft:

- Usefulness over spectacle.
- Local-first, not local maximalist.
- Simplicity that hides setup but exposes failure.
- The harness as product surface.
- What the model actually sees: tools, output, context, schemas, summaries, and runtime limits.
- Small tools and first-principles experiments as a way to understand larger systems.
- Engineering taste as curation: good defaults, bounded surfaces, and fewer ways for the user to fall into incidental complexity.

## Claims to verify before publishing

- Whether to call this "Ollama Agent Harness," "Ollama agent loop," or another final product name.
- The current public/default status of the agent harness work. The inspected local worktree was on `parth-input-style-experiment`, with lineage from the `parth-agent-loop` work.
- Exact current `OLLAMA_CONTEXT_LENGTH` behavior and docs wording at publish time.
- Whether to include the specific Gemma/Qwen eval counts, or keep them as private design evidence.
- Whether synthetic compaction as `compact_conversation` is final enough to describe as current behavior.
- Whether trace env naming should be `OLLAMA_AGENT_TRACE` or another final variable if trace UI is mentioned publicly.
- Which comparisons to Codex, Pi, Hermes Agent, or OpenClaw can be named publicly.
- Whether the Pi comparison should stay as a named callout or be generalized to "minimal harnesses" before publishing.

## Diagrams or examples

- Added: a "what the model sees" context budget diagram.
- Added: a runtime-aware budgeting diagram from model metadata/request/env/VRAM to harness policy.
- Added: a tool-output artifact flow from raw output to preview, artifact, range read, and search.
- Added: a synthetic compaction transcript showing success and empty-summary paths.
- Possible still: a before/after trace table from a small local-agent task, showing prompt eval duration, prompt estimate, tool output share, and compaction events.
