# Sampling and structured outputs in LLMs
Sampling and structured outputs are tied together as they are both determine what the model's next chosen token will be.

Sampling is the process of selecting a token from the model's vocabulary based on the probability distribution.

I launched structured outputs in ollama last december, did a research project around on-the-fly structured outputs using finite state machines with pre-computed graphs, and am currently working on supporting structured outputs for thinking models. I also built the sampler along for Ollama's engine back in March 2025 to launch Gemma3. I wanted to write a bit about these as there weren't a lot of resources around them. 

Structured outputs are extremely useful for models to output data in a specific format. They allow models to turn unstructured data into structured data. Think reading documents, scraping websites, or even just parsing through text.

// TODO: maybe rm?
With all my time working on LLMs, I've found that no matter what model I work on they're always extremely sensitive to the slightest variation in their system prompts, templating, structured outputs, and sampling parameters


## Background
### Sampling
After completing a forward pass, the model outputs a probability for each possible token in the vocabulary. A token is then "sampled" given the probability distribution. 

There are many transformations that can be applied to the logits (the raw output of the model) before finally picking a token to output.

On a high level, Ollama applies the following transformations in order to sample a token:

```go
tokens = topK(tokens, s.topK)

temperature(tokens, s.temperature)
softmax(tokens)

tokens = topP(tokens, s.topP)
tokens = minP(tokens, s.minP)
```

`greedy` selects the token with the highest score:
$$\text{token} = \arg\max_i \text{logits}_i$$

`topK` selects the top k tokens with the highest score, this is mostly an optimization to reduce the number of tokens to sample from. Since sampling is happening on the CPU, this is often a `topK` of 40 tokens vs the full vocabulary – often 128k tokens:
$$\text{topK}(\text{logits}, k) = \{\text{logits}_i : \text{logits}_i \text{ is among top } k \text{ values}\}$$

`temperature` scales and normalizes the tokens by `1/temperature`. A higher temperature value flattens the probability distribution which results in more creativity from the model but also more randomness:
$$\text{logits}_i = \frac{\text{logits}_i}{\tau}$$

`softmax` normalizes the raw scores of the tokens to a probability distribution:
$$P(x_i) = \frac{e^{\text{logits}_i}}{\sum_{j} e^{\text{logits}_j}}$$

`topP` (nucleus sampling) keeps the smallest set of tokens whose cumulative probability exceeds p (e.g. 0.95). This allows us to quickly reject low probability tokens and improve efficiency and quality:
$$\text{topP}(P, p) = \{x_i : \sum_{j \in \text{sorted indices}} P(x_j) \leq p\}$$

`minP` discards tokens whose probability is below `maxProbability * minP`. MinP is said to improve "text quality and creativity" as it uses the max probability to act as a scaling factor on the minimum threshold [Turning up the heat: min-p sampling for creative and coherent llm outputs](https://arxiv.org/pdf/2407.01082):
$$\text{minP}(P, m) = \{x_i : P(x_i) \geq m \cdot \max_j P(x_j)\}$$

After the transformations are applied, a token is randomly sampled from the remaining tokens.


### Structured outputs
Structured outputs builds on top of sampling by constraining the model's output to a specific format.

There are many ways to constrain the model's output – Ollama uses grammars to mask invalid tokens which don't fit the request format.  

A grammar is a set of rules which describes a valid string. In Ollama, JSON schemas are supported, so they are turned into grammars and then used as part of the sampling process.

I've also experimented with state machines to constrain the model's output and they result in the same end result, but can potentially lead to more efficient sampling. OpenAI uses [llguidance](https://github.com/guidance-ai/llguidance) for grammar based constrained sampling which also uses state machines.

I built a strong intuition around "feeling" the model to figure out when the constraining was working well or not. The intuition I built was strongly supported by ["Let me speak freely"](https://arxiv.org/abs/2409.06333). I often would prompt the model without any instruction to output JSON or a defined schema and some models would completely fail.

I think models over time will just be able to output JSON without constraining over time. 

## gpt-oss with structured outputs

What's interesting is the output with `gpt-oss` without any instruction for JSON is insanely good. So much so that when chatting with it and its constrained the model even hallucinates that it has been given instructions to only output JSON. It's cool that there the model has been trained that well for this.
