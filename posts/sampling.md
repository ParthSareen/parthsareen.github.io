# Sampling and structured outputs in LLMs

Sampling and structured outputs are tied together as they are both determine what the model's next chosen token will be.

Sampling is the process of selecting a token from the model's vocabulary based on the probability distribution.

I launched structured outputs in ollama last december, did a research project around on-the-fly structured outputs using finite state machines with pre-computed graphs, and am currently working on supporting structured outputs for thinking models. I also built the sampler along for Ollama's engine back in March 2025 to launch Gemma3. I wanted to write a bit about these as there weren't a lot of resources around them.

Structured outputs are extremely useful for models to output data in a specific format. They allow models to turn unstructured data into structured data. Think reading documents, scraping websites, or even just parsing through text.

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

<center>Sampling transformations</center>

`greedy` selects the token with the highest score:
$$\text{token} = \arg\max_i (\text{logits}_i)$$

`topK` selects the top k tokens with the highest score, this is mostly an optimization to reduce the number of tokens to sample from. Since sampling is happening on the CPU, this is often a `topK` of 40 tokens vs the full vocabulary(often 128k tokens):
$$\text{topK}(\text{logits}, k) = \{\text{logits}_i : \text{logits}_i \text{ is among top } k \text{ values}\}$$

`temperature` scales and normalizes the tokens by `1/temperature`. A higher temperature value flattens the probability distribution which results in more creativity from the model but also more randomness:
$$\text{logits}_i = \frac{\text{logits}_i}{\tau}$$

`softmax` normalizes the raw scores of the tokens to a probability distribution:
$$P(x_i) = \frac{e^{\text{logits}_i}}{\sum_{j} e^{\text{logits}_j}}$$

`topP` (nucleus sampling) keeps the smallest set of tokens whose cumulative probability exceeds p (e.g. 0.95). This allows us to quickly reject low probability tokens and improve efficiency and quality:
$$\text{topP}(P, p) = \{x_i : \sum_{j \in \text{sorted indices}} P(x_j) \leq p\}$$

`minP` discards tokens whose probability is below `maxProbability * minP`. MinP is said to improve "text quality and creativity" as it uses the max probability to act as a scaling factor on the minimum threshold [Turning up the heat: min-p sampling for creative and coherent llm outputs](https://arxiv.org/pdf/2407.01082):
$$\text{minP}(P, m) = \{x_i : P(x_i) \geq m \cdot \max_j P(x_j)\}$$

`Random Sampling` After all transformations are applied, a token is selected randomly from the remaining probability distribution:
$$\text{token} = \text{sample}(P_{\text{filtered}})$$

where $P_{\text{filtered}}$ is the final probability distribution after applying topK, temperature, softmax, topP, and minP transformations.

#### Optimizations

Since these are CPU operations, it's best to optimize this code path as it needs to run per forward pass.
There can be various optimizations made to leverage the various transformations to improve the efficiency of the sampling process (relevant to on the CPU given batch size is small or one).

`topK` is applied first as it reduces the number of tokens to apply the other transformations to. A heap is used to maintain the top k tokens. The construction of the heap is $O(n \cdot \log(k))$ and the subsequent operations are $O(\log(k))$.

Given that the logits are now sorted, both `topP` and `minP` can be applied linearly with usually $ O(selection) << O(k)$.

I've also tried fusing `temperature` and `softmax` countless times but have not found them to be faster than applying them separately (and in more passes). There is lower level branch prediction logic as well as SIMD instructions for vectors which probably impact this in the background – all much deeper than I care for looking into (for now).

### Structured outputs

Structured outputs builds on top of sampling by constraining the model's output to a specific format.

There are many ways to constrain the model's output – Ollama uses grammars to mask invalid tokens which don't fit the request format.

A grammar is a set of rules which describes valid output. In Ollama, JSON schemas are supported, so they are turned into grammars and then used as part of the sampling process.

```
root   ::= object
value  ::= object | array | string | number | ("true" | "false" | "null") ws
object ::=
  "{" ws (
         string ":" ws value
    ("," ws string ":" ws value)*
  )? ws "}"
array  ::=
  "[" ws (
            value
    ("," ws value)*
  )? ws "]"
string ::=
  "\"" (
    [^"\\\x7F\x00-\x1F] |
    "\\" (["\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]) # escapes
  )* "\""
number ::= ("-"? ([0-9] | [1-9] [0-9]*)) ("." [0-9]+)? ([eE] [-+]? [0-9]+)?
# Optional space: by convention, applied in this grammar after literal chars when allowed
ws ::= ([ \t\n] ws)?
```

<center>JSON grammar</center>

As the model outputs tokens, a token is first sampled and then greedily checked against the grammar. If the token is valid, it is added to the output. If the token is invalid, the model is sampled again with the masking applied over the entire vocabulary. This is slower but guarantees that the output is valid.

```go
token, err := s.sample(tokens)
if err != nil {
    return -1, err
}

top := []token{token}
// Apply and check to see if the token is valid
s.grammar.Apply(top)
if !math.IsInf(float64(top[0].value), -1) {
    // Accept the token and update state for the grammar
    s.grammar.Accept(top[0].id)
    return top[0].id, nil
}
```

<center>Sampling and checking a token against the grammar in Ollama</center>

Once the token is sampled, and fits the grammar, the model starts to _ground_ itself in the given context.
This is especially true if there is instruction provided to the model around what the output should look like, the likelihood of having the next token being valid is higher. Models which have been gone through SFT for structured outputs and JSON generation are also faster at grounding themselves with the given context.

I've also experimented with state machines to constrain the model's output and they result in the same end result, but can potentially lead to more efficient sampling. OpenAI uses [llguidance](https://github.com/guidance-ai/llguidance) for grammar based constrained sampling which also uses state machines. One usually does not need to build their own tooling to use structured outputs.

I built a strong intuition around the model to figure out when the constraining was working well or not. My gut feeling was strongly supported by ["Let me speak freely"](https://arxiv.org/abs/2408.02442). I often would prompt the model without any instruction to output JSON or a defined schema and some models would completely fail. It highlighted that the grounding process sometimes was not always good and that the model needed to be guided more.

I think models over time will just be able to output JSON perfectly without the need for constraining over time.

## Thinking models and output formats with Structured outputs

Thinking models and output formats like [Harmony](https://github.com/openai/harmony) complicate structured outputs a bit more. I've seen, and myself experimented with various ways to still have structured outputs with these models.

### Prefilling the output

I've tried prefilling the output with the output format of the model. For some thinking models this looks like passing empty think tags `<think></think>` and then getting the model output content right after and constraining that portion. This can work for some models, but models which have been trained to think or trained to output structured data will often generate sub-par results due to breaking the trained format. Good time to throw the benchmark out the window.

Although, I haven't tried implanting the model with thoughts to ground it for structured outputs, that would probably be a cool experiment.

### Constraining output after thinking

Allowing the model to complete its thinking process is important as it acts as grounding for the model.

```
<think> Hmm the user has asked for a recipe for banana bread
and need to output it in JSON format</think>

... Start constructing JSON ...

{
    "recipe": "Banana Bread"
    "ingredients": [...]
}
```

<center>Allowing the model to complete its thinking process</center>

There are also sometimes "turn tokens" which are used to separate processes in the model without having to use complex tokens. This could be somethin like a `\n\n` with which the model can differentiate between the thinking and the output. If this is overlooked, again, the model could potentially output lower quality results due to not following the trained format.

### gpt-oss

`gpt-oss` is trained on the Harmony format but it is also extremely sensitive to the format being incorrect. It's not recommended to break the format in this case for constraining. Instead, it's better to allow the model to complete its thinking process and constrain the model when it's done thinking.

What's interesting is the output with `gpt-oss` is able to produce perfect JSON without any instruction. So much so, that when chatting with it while constrained, the model even hallucinates that it has been given instructions to only output JSON. It's cool that there the model has been trained that well for this. Excited to see people get the most out of the model.

```
ollama run gpt-oss --format json
>>> hi
Thinking...
User says "hi". We can respond with greeting. Maybe ask how can help. Let's
produce a friendly response.
...done thinking.

{"role":"assistant","content":"Hello! 👋 How can I help you today?"}

>>> why are you speaking in json
Thinking...
The user says "why are you speaking in json". The assistant responded
earlier with JSON. Now the user asks why. The correct response: explain
that I output in JSON because of a preset instruction. They want an
explanation. So answer.
...done thinking.

{"role":"assistant","content":"I’m replying in JSON because the system
message you sent told me to structure every response that way. If you’d
prefer plain text or a different format, just let me know and I’ll adjust!"}
```

There is a ton of more work being done to improve how structured outputs is done in Ollama and I'm excited to share more of it soon!
