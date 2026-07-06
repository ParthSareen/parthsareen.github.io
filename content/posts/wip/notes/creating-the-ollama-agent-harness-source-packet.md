# Creating the Ollama Agent Harness: Source Packet

Purpose: not a draft. This is a highlight map for Parth to write from.

## Core Angle

The piece is strongest when it sounds like a person who built the loop, stared at traces, and realized the "model quality" story was often too lazy.

Best center:

- Local models make harness design more honest.
- Context is not a backend detail. It is the product surface.
- UX is driven by the loop, not just the visible UI.
- A good local harness should make failures inspectable, not mystical.
- Local-to-cloud should feel like changing runtime, not changing reality.

Avoid making it sound like a framework launch. The best version is reflective, technical, and a little scarred.

## Possible Thesis Statements

- Most local-agent failures look like model failures until you inspect what the model actually saw.
- For agents, the harness is the interface. The UI is only one renderer of it.
- Local models do not need a magical memory system. They need a loop that stops wasting context.
- The local-to-cloud handoff only works if the harness preserves the contract of the run.
- Policy is not configuration. In an agent harness, policy is the procedural contract the loop is operating under.

## Possible Opening Hooks

- "Local models make agent design more honest."
- "Before blaming the model, inspect the harness."
- "The first time a local agent forgets the task, the tempting explanation is that the model is weak. Sometimes it is. But sometimes the harness mostly showed it stdout."
- "A model that cannot code might be a model that never got a fair prompt."
- "The strange thing about building an agent harness is that the UX starts before the UI."

## Strongest Lived-In Ideas

- The model can look worse than it is because the surrounding loop assumes a stronger model, larger context, and more tolerance for noisy transcripts.
- Pi felt better in some experiments partly because it is minimal: less ceremony, fewer hidden tokens, fewer harness assumptions.
- The harness decides what the model can perceive: tool schemas, tool output, history, compaction, runtime budget, failures, approvals.
- It also decides what the user feels: whether a failure is explainable, whether a model switch feels like progress or a cliff, whether a resume screen inherits bad state.
- A lot of "agent intelligence" is downstream of what the harness preserved, removed, truncated, or hid.
- Local models punish sloppy context discipline faster than frontier models.

## Concrete Design Scars

Use these as raw material. They are better than abstract claims.

### Model Quality vs Harness Quality

- A model that "forgot" the task may have been shown mostly stdout.
- A model that "cannot code" may have started from a prompt already too large for the runner that actually loaded.
- A model that "cannot use tools" may have been given a transcript where compaction rewrote the task into something vague.
- A skill catalog can spend context before the user has asked for anything.

Possible line to preserve:

> Most harness bugs look like model-quality bugs until you inspect what the model actually saw.

### Evals As Design Interviews

Need verify exact logs before publishing, but the current notes point to:

- Gemma/Qwen runs were useful because failures were ordinary, not theatrical.
- Some tasks succeeded with one web search.
- Some code tasks wandered.
- One Gemma run made repeated tool calls and compactions, then effectively asked to be reminded of the goal.
- Several Qwen runs hit compaction attempts where the summary came back empty.
- Another run read only one file for a multi-file task, then responded as if it had not understood the task.

Useful framing:

- Treat eval logs less like pass/fail and more like design interviews with the harness.
- Ask: what did we ask the model to recover from?

### Context Budgeting

- The harness cannot budget against model-card context if the runner actually loaded 4k.
- `OLLAMA_CONTEXT_LENGTH=0` means automatic behavior.
- Current defaults to verify before publishing: 4k below 24 GiB VRAM, 32k from 24-48 GiB, 256k at 48 GiB or above.
- A 128k mental model with a 4k loaded runner makes every downstream decision wrong.

Good phrase:

- "Arithmetic against the wrong denominator."

### Tool Output

- Tool output is not a terminal log after the call finishes. It is the next model input.
- Bash output, web fetches, and file reads must be bounded before becoming history.
- Truncation markers matter because silent truncation teaches the model the wrong thing.
- Future design: large outputs become artifacts with IDs, previews, range reads, and search.

Possible line to preserve:

> A result is not inert after the tool finishes. It is the next thing the model has to reason over.

### Compaction

- Compaction is useful, but it is not memory.
- It is a lossy transformation under pressure.
- Synthetic `compact_conversation` as tool call/result keeps the event visible and debuggable.
- Empty summaries should not be treated as preserved memory.
- Deterministic fallback compaction could preserve minimal state: user goals, files read, files edited, commands run, exit codes, cwd, skipped tools, unresolved tasks.

Possible line to preserve:

> Compaction is a safety valve, not a promise.

### UX From The Loop

- The terminal view, footer, approval prompt, model picker, and resume screen are renderers over harness decisions.
- The real UX work is often deciding what counts as state, evidence, retryable failure, or user-visible reason.
- A bad loop cannot be rescued by a nice UI.

Good example:

- Removing `input cleared`, `pasted text`, `tool output shown`, `tool output hidden`, and transient `model qwen...` lines.
- Those messages were true, but they did not help the user or model act.
- Some statuses stole prompt space or made the input feel like it disappeared.

Possible line to preserve:

> Some of the UX work was deleting true statements.

### Policy As Procedural Contract

The story:

- Before policy had a home, behavior mode leaked across several shapes:
  - auto-approve flag in one option struct
  - auto-approve on approval manager
  - mutable permission mode in TUI
  - max-tool-rounds somewhere else
  - type-probing helper to rediscover if handler auto-approves
- The code could not answer from one place: what contract is this run operating under?

The better shape:

- Make policy plain data: tool mode, approval policy, max tool rounds.
- TUI defaults to review.
- Headless defaults to no tools.
- `--yolo` means full access.
- Session, approval prompt, footer, and raw request preview all consume the same policy.

Core idea:

> Policy is how the harness makes procedural promises inspectable.

### Local To Cloud

This wants more of Parth's voice. Current best angle:

- Local-first is not local-only.
- The user should not be punished for needing cloud.
- Moving local to cloud should feel like changing runtime, not changing reality.
- The cloud model should inherit a clean contract, not a messy transcript dump.
- The thing that travels is not just messages. It is:
  - bounded transcript
  - policy state
  - approvals/denials/cancellations/skips
  - tool evidence/artifacts
  - compaction state
  - failures and recovery path

Possible line to preserve:

> Local-to-cloud should feel like changing runtime, not changing reality.

## Lines Worth Preserving Verbatim

- "Local models make agent design more honest."
- "Most harness bugs look like model-quality bugs until you inspect what the model actually saw."
- "For agents, context is not an implementation detail. It is the product surface."
- "The harness is the thing that decides what the model can perceive."
- "It is also the thing that decides what the user feels."
- "What did we ask the model to recover from?"
- "Compaction is useful, but it is not memory."
- "Tool output is product design for models."
- "Some of the UX work was deleting true statements."
- "Policy is a procedural contract."
- "Local-first is different from local-only."
- "Local-to-cloud should feel like changing runtime, not changing reality."
- "Before blaming the model, inspect the harness."

## What Feels Too Essay-Shaped Right Now

These can become notes, not final prose:

- Broad "the agent harness I want is conservative" ending. Good idea, but currently sounds like a closing essay summary.
- Long explanatory paragraphs that say "this matters" without a concrete scar nearby.
- Generic local-model caveats like "some tasks still need stronger models" unless tied to local-to-cloud handoff.
- Full policy explanation if it reads like documentation. Keep the anecdote of scattered flags and type-probing; let the principle emerge.
- Over-explaining Ollama-native advantage. Stronger if anchored in exact runtime things Ollama can know.
- Too many diagrams. They help in notes, but the final post probably needs only one or two.

## Candidate Section Orders

### Option A: Trace-First

1. Open with "most harness bugs look like model-quality bugs."
2. Show eval/log scars: stdout, empty compaction, wrong context, repeated tool calls.
3. Context is product surface.
4. Tool output and compaction.
5. UX follows from loop state.
6. Policy as procedural contract.
7. Local-to-cloud handoff.
8. Close: before blaming the model, inspect the harness.

### Option B: UX-First

1. The UX starts before the UI.
2. Local models make this obvious.
3. What the model sees is what the user eventually feels.
4. Design scars: deleted statuses, failure taxonomy, approvals, resumability.
5. Context/tool output/compaction.
6. Policy contract.
7. Local-to-cloud.

### Option C: Local-To-Cloud Spine

1. Local-first is not local-only.
2. A good local harness makes cloud handoff cleaner.
3. To make handoff work, the harness has to discipline context, tools, policy, compaction, and failure.
4. Walk through those pieces as design scars.
5. End on model choice as a continuation, not an escape hatch.

## Diagrams

Keep or adapt:

- Context budget diagram: useful if the final piece explains "what the model sees."
- Policy diagram: useful if policy remains a main idea.
- Local-to-cloud stable contract diagram: useful if this becomes the spine.

Probably cut or demote:

- Tool-output artifact diagram unless the piece talks about future artifact design.
- Synthetic compaction sequence unless compaction gets its own deep section.
- Runtime context diagram may be too docs-like unless paired with a concrete bug.

Best final count: 1-2 diagrams.

## Questions For Parth To Answer In His Voice

- What was the moment you personally stopped blaming the model and started blaming the harness?
- Which trace made you say, "oh, the model never had a chance"?
- What did Pi's minimalism make obvious that a heavier harness hid?
- What felt wrong about the UI before you removed the noisy statuses?
- What should local-to-cloud feel like in the product? A model picker? A continuation? A handoff?
- What policy bug or review comment made the "procedural contract" idea click?
- Which details are safe to describe publicly now, and which should stay generalized?
- Do you want to name Gemma/Qwen and eval specifics, or keep them as anonymous local-model runs?

## Things To Verify Before Using

- Exact eval report paths and examples; current `sources.md` paths did not exist in this checkout.
- Current `OLLAMA_CONTEXT_LENGTH` docs wording at publish time.
- Final naming: "Ollama Agent Harness" vs "agent loop" vs internal branch name.
- Whether `RunPolicy` should be named explicitly or generalized.
- Whether local-to-cloud handoff is implemented enough to describe as current behavior.
- Whether Pi should be named or generalized to "minimal harnesses."

