# Thoughts around sampling in LLMs

With all my time working on LLMs, I've found that no matter what model I work on they're always extremely sensitive to the slightest variation in their system prompts, templating, structured outputs, and sampling parameters

I launched structured outputs in ollama last december, did a research project around on the fly structured outputs using finite state machines using pre-computed graphs (which didn't see the light of day) and am currently working on supporting structured outputs for thinking models. 


## How structured outputs work
When the model outputs probabilties...


fsm work and what i looked into

I built a strong intuition around "feeling" the model to figure out when the constraining was working well or not. The intuition I built was strongly supported by ["Let me speak freely"](https://arxiv.org/abs/2409.06333). I often would prompt the model without any instruction to output JSON or a defined schema and some models would completely fail.

I think models over time will just be able to output JSON without constraining over time. 

What's interesting is the output with `gpt-oss` without any instruction for JSON is insanely good. Given that the model is trained with synthetic data, it's a bit of a mystery to me why it's so good.

So much so that when chatting with it and its constrained the model even hallucinates that it has been given instructions to only output JSON. It's cool that there the model has been trained that well for this.


